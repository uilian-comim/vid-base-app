use axum::{
    body::Body,
    extract::{Query, State},
    http::{header, Response, StatusCode},
    response::IntoResponse,
    routing::get,
    Router,
};
use serde::{Deserialize, Serialize};
use std::net::SocketAddr;
use std::process::Stdio;
use std::sync::Arc;
use tokio::process::Command;
use tokio_util::io::ReaderStream;
use tower_http::cors::{Any, CorsLayer};

#[derive(Serialize)]
struct StreamInfo {
    duration: Option<f64>,
}

#[derive(Deserialize)]
struct StreamParams {
    path: String,
}

#[derive(Deserialize)]
struct PlayParams {
    path: String,
    start: f64,
}

#[derive(Deserialize)]
struct ThumbnailParams {
    path: String,
    time: f64,
}

struct AppState {
    ffmpeg_path: String,
    ffprobe_path: String,
}

/// Resolves a binary by name. Apps launched from Finder/Dock on macOS don't inherit the
/// shell PATH, so Homebrew/MacPorts locations must be probed explicitly.
fn resolve_binary(name: &str) -> String {
    #[cfg(target_os = "macos")]
    {
        let candidates = [
            "/opt/homebrew/bin",
            "/usr/local/bin",
            "/opt/local/bin",
            "/usr/bin",
        ];
        for dir in candidates {
            let p = std::path::Path::new(dir).join(name);
            if p.is_file() {
                return p.to_string_lossy().to_string();
            }
        }
    }
    name.to_string()
}

async fn get_video_info(
    State(state): State<Arc<AppState>>,
    Query(params): Query<StreamParams>,
) -> impl IntoResponse {
    let output = Command::new(&state.ffprobe_path)
        .arg("-v")
        .arg("error")
        .arg("-show_entries")
        .arg("format=duration")
        .arg("-of")
        .arg("default=noprint_wrappers=1:nokey=1")
        .arg(&params.path)
        .output()
        .await
        .ok();

    let duration = output.and_then(|o| {
        let s = String::from_utf8_lossy(&o.stdout).trim().to_string();
        s.parse::<f64>().ok()
    });

    let json = serde_json::to_string(&StreamInfo { duration }).unwrap();
    Response::builder()
        .header(header::CONTENT_TYPE, "application/json")
        .header("Access-Control-Allow-Origin", "*")
        .body(Body::from(json))
        .unwrap()
}

async fn stream_fmp4(
    State(state): State<Arc<AppState>>,
    Query(params): Query<PlayParams>,
) -> impl IntoResponse {
    let mut cmd = Command::new(&state.ffmpeg_path);
    cmd.arg("-ss")
        .arg(params.start.to_string())
        .arg("-i")
        .arg(&params.path)
        .arg("-c:v")
        .arg("copy")
        .arg("-c:a")
        .arg("aac")
        .arg("-movflags")
        .arg("frag_keyframe+empty_moov+default_base_moof")
        .arg("-f")
        .arg("mp4")
        .arg("pipe:1")
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .kill_on_drop(true);

    match cmd.spawn() {
        Ok(mut child) => {
            let stdout = child.stdout.take().unwrap();
            let stream = ReaderStream::new(stdout);

            // Harvest the child process later
            tokio::spawn(async move {
                let _ = child.wait().await;
            });

            Response::builder()
                .status(StatusCode::OK)
                .header(header::CONTENT_TYPE, "video/mp4")
                .header("Access-Control-Allow-Origin", "*")
                .body(Body::from_stream(stream))
                .unwrap()
        }
        Err(e) => {
            eprintln!("Failed to spawn ffmpeg: {}", e);
            Response::builder()
                .status(StatusCode::INTERNAL_SERVER_ERROR)
                .body(Body::from("Failed to start ffmpeg"))
                .unwrap()
        }
    }
}

// Keep a stub for stop_stream so frontend doesn't error when wiping cache
async fn stop_hls_stream() -> impl IntoResponse {
    Response::builder()
        .status(StatusCode::OK)
        .header("Access-Control-Allow-Origin", "*")
        .body(Body::from("No-op"))
        .unwrap()
}

async fn get_thumbnail(
    State(state): State<Arc<AppState>>,
    Query(params): Query<ThumbnailParams>,
) -> impl IntoResponse {
    let mut cmd = Command::new(&state.ffmpeg_path);
    // Use fast seek before input
    cmd.arg("-ss")
        .arg(params.time.to_string())
        .arg("-i")
        .arg(&params.path)
        .arg("-frames:v")
        .arg("1")
        .arg("-q:v")
        .arg("5") // Good enough quality for a small tooltip
        .arg("-f")
        .arg("image2")
        .arg("-update")
        .arg("1")
        .arg("pipe:1")
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .kill_on_drop(true);

    match cmd.spawn() {
        Ok(mut child) => {
            let stdout = child.stdout.take().unwrap();
            let stream = ReaderStream::new(stdout);

            tokio::spawn(async move {
                let _ = child.wait().await;
            });

            Response::builder()
                .status(StatusCode::OK)
                .header(header::CONTENT_TYPE, "image/jpeg")
                .header("Access-Control-Allow-Origin", "*")
                .body(Body::from_stream(stream))
                .unwrap()
        }
        Err(e) => {
            eprintln!("Failed to extract thumbnail: {}", e);
            Response::builder()
                .status(StatusCode::INTERNAL_SERVER_ERROR)
                .body(Body::from("Failed to generate thumbnail"))
                .unwrap()
        }
    }
}

pub async fn start_server() {
    let state = Arc::new(AppState {
        ffmpeg_path: resolve_binary("ffmpeg"),
        ffprobe_path: resolve_binary("ffprobe"),
    });

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let app = Router::new()
        .route("/video-info", get(get_video_info))
        .route("/play", get(stream_fmp4))
        .route("/thumbnail", get(get_thumbnail))
        .route("/start-stream", get(stop_hls_stream)) // Stubs
        .route("/stop-stream", get(stop_hls_stream))
        .layer(cors)
        .with_state(state);

    let addr = SocketAddr::from(([127, 0, 0, 1], 8765));
    println!("Starting local video stream server at http://{}", addr);

    let listener = match tokio::net::TcpListener::bind(&addr).await {
        Ok(l) => l,
        Err(e) => {
            eprintln!("Failed to bind stream server on {}: {}", addr, e);
            return;
        }
    };
    if let Err(e) = axum::serve(listener, app).await {
        eprintln!("Stream server error: {}", e);
    }
}
