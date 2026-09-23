use axum::{
    body::{Body, Bytes},
    extract::{Path as UrlPath, Query, State},
    http::{header, Response, StatusCode},
    response::IntoResponse,
    routing::get,
    Json, Router,
};
use serde::Deserialize;
use std::collections::HashMap;
use std::net::SocketAddr;
use std::path::{Path, PathBuf};
use std::process::Stdio;
use std::sync::{Arc, Mutex};
use tokio::io::AsyncReadExt;
use tokio::sync::Semaphore;
use tower_http::cors::{Any, CorsLayer};

use crate::media::{self, Fingerprint, Media, Tools, VideoMode};

/// Thumbnails are requested in bursts by the library grid; cap concurrent ffmpeg processes.
const MAX_CONCURRENT_THUMBNAILS: usize = 4;

struct AppState {
    tools: Tools,
    media: Mutex<HashMap<String, Arc<Media>>>,
    subtitles: Mutex<HashMap<(String, String), Arc<String>>>,
    thumbnails: Semaphore,
}

#[derive(Deserialize)]
struct OpenParams {
    path: String,
}

#[derive(Deserialize)]
struct StreamParams {
    /// Absolute stream index of the audio track; defaults to the file's default track.
    audio: Option<usize>,
    #[serde(default)]
    video: VideoMode,
}

#[derive(Deserialize)]
struct ThumbnailParams {
    path: String,
    time: f64,
    width: Option<u32>,
}

fn error(status: StatusCode, message: impl Into<String>) -> Response<Body> {
    let message = message.into();
    eprintln!("[streamer] {message}");
    Response::builder().status(status).body(Body::from(message)).unwrap()
}

fn lookup(state: &AppState, id: &str) -> Result<Arc<Media>, Response<Body>> {
    state
        .media
        .lock()
        .unwrap()
        .get(id)
        .cloned()
        .ok_or_else(|| error(StatusCode::NOT_FOUND, format!("Unknown media id {id}; call /media/open first")))
}

fn pick_audio<'a>(media: &'a Media, requested: Option<usize>) -> Option<&'a media::AudioStream> {
    let audio = &media.info.audio;
    requested
        .and_then(|i| audio.iter().find(|a| a.index == i))
        .or_else(|| audio.iter().find(|a| a.default))
        .or_else(|| audio.first())
}

/// Probes a file (reusing the cached result while the file is unchanged) and returns the
/// track list the player needs to build its menus.
async fn open_media(State(state): State<Arc<AppState>>, Query(params): Query<OpenParams>) -> Response<Body> {
    let path = PathBuf::from(&params.path);
    let id = media::media_id(&path);

    let cached = state.media.lock().unwrap().get(&id).cloned();
    if let Some(m) = cached.filter(|m| {
        Some(m.fingerprint) == Fingerprint::of(&path) && m.external_subtitles == media::find_external_subtitles(&path)
    }) {
        return Json(m.info.clone()).into_response();
    }

    match media::probe(&state.tools, &path).await {
        Ok(m) => {
            let info = m.info.clone();
            state.media.lock().unwrap().insert(id.clone(), Arc::new(m));
            state.subtitles.lock().unwrap().retain(|(media_id, _), _| *media_id != id);
            Json(info).into_response()
        }
        Err(e) => error(StatusCode::UNPROCESSABLE_ENTITY, e),
    }
}

async fn hls_playlist(
    State(state): State<Arc<AppState>>,
    UrlPath(id): UrlPath<String>,
    Query(params): Query<StreamParams>,
) -> Response<Body> {
    let media = match lookup(&state, &id) {
        Ok(m) => m,
        Err(resp) => return resp,
    };
    let (mode, segments) = media.plan(&state.tools, params.video).await;
    let mut query = format!("video={}", if mode == VideoMode::Copy { "copy" } else { "transcode" });
    if let Some(a) = pick_audio(&media, params.audio) {
        query.push_str(&format!("&audio={}", a.index));
    }

    Response::builder()
        .header(header::CONTENT_TYPE, "application/vnd.apple.mpegurl")
        .header(header::CACHE_CONTROL, "no-store")
        .body(Body::from(media::playlist(&segments, &query)))
        .unwrap()
}

async fn hls_segment(
    State(state): State<Arc<AppState>>,
    UrlPath((id, file)): UrlPath<(String, String)>,
    Query(params): Query<StreamParams>,
) -> Response<Body> {
    let media = match lookup(&state, &id) {
        Ok(m) => m,
        Err(resp) => return resp,
    };
    let Some(index) = file.strip_suffix(".ts").and_then(|n| n.parse::<usize>().ok()) else {
        return error(StatusCode::BAD_REQUEST, format!("Bad segment name {file}"));
    };
    let (mode, segments) = media.plan(&state.tools, params.video).await;
    let Some(segment) = segments.get(index).copied() else {
        return error(StatusCode::NOT_FOUND, format!("Segment {index} out of range"));
    };

    let args = media::segment_args(&media, segment, pick_audio(&media, params.audio), mode);
    stream_process(&state.tools.ffmpeg, args, "video/mp2t")
}

/// Converts an embedded (`s<index>`) or sidecar (`x<n>`) subtitle track to WebVTT.
async fn subtitle_track(
    State(state): State<Arc<AppState>>,
    UrlPath((id, track)): UrlPath<(String, String)>,
) -> Response<Body> {
    let media = match lookup(&state, &id) {
        Ok(m) => m,
        Err(resp) => return resp,
    };
    let track = track.trim_end_matches(".vtt").to_string();
    let key = (id.clone(), track.clone());

    let cached = state.subtitles.lock().unwrap().get(&key).cloned();
    let vtt = match cached {
        Some(vtt) => vtt,
        None => {
            let (source, stream): (&Path, Option<usize>) = if let Some(n) = track.strip_prefix('s') {
                match n.parse() {
                    Ok(stream) => (&media.path, Some(stream)),
                    Err(_) => return error(StatusCode::BAD_REQUEST, format!("Bad subtitle track {track}")),
                }
            } else if let Some(sub) = track
                .strip_prefix('x')
                .and_then(|n| n.parse::<usize>().ok())
                .and_then(|n| media.external_subtitles.get(n))
            {
                (sub, None)
            } else {
                return error(StatusCode::NOT_FOUND, format!("Unknown subtitle track {track}"));
            };

            let output = media::command(&state.tools.ffmpeg)
                .args(media::subtitle_args(source, stream))
                .output()
                .await;
            match output {
                Ok(o) if o.status.success() => {
                    let vtt = Arc::new(String::from_utf8_lossy(&o.stdout).to_string());
                    state.subtitles.lock().unwrap().insert(key, vtt.clone());
                    vtt
                }
                Ok(o) => {
                    return error(
                        StatusCode::UNPROCESSABLE_ENTITY,
                        format!("Subtitle extraction failed: {}", String::from_utf8_lossy(&o.stderr).trim()),
                    )
                }
                Err(e) => return error(StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to run ffmpeg: {e}")),
            }
        }
    };

    Response::builder()
        .header(header::CONTENT_TYPE, "text/vtt; charset=utf-8")
        .body(Body::from(vtt.as_str().to_owned()))
        .unwrap()
}

async fn get_thumbnail(State(state): State<Arc<AppState>>, Query(params): Query<ThumbnailParams>) -> Response<Body> {
    let _permit = state.thumbnails.acquire().await.unwrap();
    let output = media::command(&state.tools.ffmpeg)
        .args(media::thumbnail_args(Path::new(&params.path), params.time, params.width))
        .output()
        .await;
    match output {
        Ok(o) if o.status.success() && !o.stdout.is_empty() => Response::builder()
            .header(header::CONTENT_TYPE, "image/jpeg")
            .header(header::CACHE_CONTROL, "max-age=3600")
            .body(Body::from(o.stdout))
            .unwrap(),
        Ok(o) => error(
            StatusCode::UNPROCESSABLE_ENTITY,
            format!("Thumbnail failed: {}", String::from_utf8_lossy(&o.stderr).trim()),
        ),
        Err(e) => error(StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to run ffmpeg: {e}")),
    }
}

/// Drops probe/subtitle caches. Segment processes need no cleanup: each one is owned by
/// its HTTP response and is killed as soon as the player abandons the request.
async fn clear_cache(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    state.media.lock().unwrap().clear();
    state.subtitles.lock().unwrap().clear();
    StatusCode::OK
}

/// Streams a process's stdout as the response body. The child lives inside the body stream,
/// so an aborted request (e.g. the player seeking elsewhere) kills it via `kill_on_drop`.
fn stream_process(program: &Path, args: Vec<String>, content_type: &'static str) -> Response<Body> {
    let mut child = match media::command(program)
        .args(&args)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
    {
        Ok(child) => child,
        Err(e) => return error(StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to start ffmpeg: {e}")),
    };
    let mut stdout = child.stdout.take().unwrap();
    let mut stderr = child.stderr.take().unwrap();
    // Drain stderr concurrently so a chatty process can't block on a full pipe.
    let stderr_task = tokio::spawn(async move {
        let mut text = String::new();
        let _ = stderr.read_to_string(&mut text).await;
        text
    });

    let body = async_stream::stream! {
        let mut buf = vec![0u8; 64 * 1024];
        loop {
            match stdout.read(&mut buf).await {
                Ok(0) => break,
                Ok(n) => yield Ok::<Bytes, std::io::Error>(Bytes::copy_from_slice(&buf[..n])),
                Err(e) => {
                    yield Err(e);
                    break;
                }
            }
        }
        if let Ok(status) = child.wait().await {
            if !status.success() {
                let stderr = stderr_task.await.unwrap_or_default();
                eprintln!("[streamer] ffmpeg exited with {status}: {}", stderr.trim());
            }
        }
    };

    Response::builder()
        .header(header::CONTENT_TYPE, content_type)
        .body(Body::from_stream(body))
        .unwrap()
}

pub async fn start_server() {
    let state = Arc::new(AppState {
        tools: Tools::resolve(),
        media: Mutex::new(HashMap::new()),
        subtitles: Mutex::new(HashMap::new()),
        thumbnails: Semaphore::new(MAX_CONCURRENT_THUMBNAILS),
    });
    println!(
        "Using ffmpeg at {} and ffprobe at {}",
        state.tools.ffmpeg.display(),
        state.tools.ffprobe.display()
    );

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let app = Router::new()
        .route("/media/open", get(open_media))
        .route("/media/{id}/index.m3u8", get(hls_playlist))
        .route("/media/{id}/seg/{file}", get(hls_segment))
        .route("/media/{id}/subtitles/{track}", get(subtitle_track))
        .route("/thumbnail", get(get_thumbnail))
        .route("/clear-cache", get(clear_cache))
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
