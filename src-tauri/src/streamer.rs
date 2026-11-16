use axum::{
    body::{Body, Bytes},
    extract::{Path as UrlPath, Query, Request, State},
    http::{header, HeaderValue, Method, Response, StatusCode},
    middleware::{self, Next},
    response::IntoResponse,
    routing::get,
    Json, Router,
};
use serde::Deserialize;
use std::collections::HashMap;
use std::net::{Ipv4Addr, TcpListener};
use std::path::{Path, PathBuf};
use std::process::Stdio;
use std::sync::{Arc, Mutex};
use tokio::io::AsyncReadExt;
use tokio::sync::Semaphore;
use tower_http::cors::{AllowOrigin, CorsLayer};

use crate::media::{self, Media, Tools, VideoMode};

/// Thumbnails are requested in bursts by the library grid; cap concurrent ffmpeg processes.
const MAX_CONCURRENT_THUMBNAILS: usize = 4;
/// Probe results kept in memory; the least recently used one is dropped beyond this.
const MAX_OPEN_MEDIA: usize = 32;
/// Used when free, so the URL stays stable across runs; otherwise the OS picks a port.
const PREFERRED_PORT: u16 = 8765;

struct AppState {
    tools: Arc<Tools>,
    media: Mutex<MediaCache>,
    thumbnails: Semaphore,
    /// Secret the webview gets over IPC. Without it any web page open in the user's browser
    /// could ask this server for frames or streams of arbitrary local files.
    token: String,
}

#[derive(Default)]
struct MediaCache {
    entries: HashMap<String, (Arc<Media>, u64)>,
    clock: u64,
}

impl MediaCache {
    fn get(&mut self, id: &str) -> Option<Arc<Media>> {
        self.clock += 1;
        let (media, used) = self.entries.get_mut(id)?;
        *used = self.clock;
        Some(media.clone())
    }

    fn insert(&mut self, id: String, media: Arc<Media>) {
        self.clock += 1;
        self.entries.insert(id, (media, self.clock));
        while self.entries.len() > MAX_OPEN_MEDIA {
            let Some(oldest) = self.entries.iter().min_by_key(|(_, (_, used))| *used).map(|(id, _)| id.clone()) else {
                break;
            };
            self.entries.remove(&oldest);
        }
    }
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
    /// Whether to keep the frame in the disk cache. Seek previews turn this off: they cover
    /// the whole timeline of a file and are rarely asked for twice.
    #[serde(default = "enabled")]
    cache: bool,
}

fn enabled() -> bool {
    true
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
        .ok_or_else(|| error(StatusCode::NOT_FOUND, format!("Unknown media id {id}; call /media/open first")))
}

fn pick_audio<'a>(media: &'a Media, requested: Option<usize>) -> Option<&'a media::AudioStream> {
    let audio = &media.info.audio;
    requested
        .and_then(|i| audio.iter().find(|a| a.index == i))
        .or_else(|| audio.iter().find(|a| a.default))
        .or_else(|| audio.first())
}

/// Rejects requests that don't carry the session token.
async fn require_token(State(state): State<Arc<AppState>>, request: Request, next: Next) -> Response<Body> {
    let authorized = request
        .uri()
        .query()
        .is_some_and(|query| query.split('&').any(|pair| pair.strip_prefix("token=") == Some(state.token.as_str())));
    if authorized {
        next.run(request).await
    } else {
        error(StatusCode::FORBIDDEN, "Missing or invalid token")
    }
}

/// Only the app's own webview may read responses cross-origin: `tauri://localhost` on
/// macOS/Linux, `http(s)://tauri.localhost` on Windows, and the local dev server.
fn is_app_origin(origin: &HeaderValue) -> bool {
    let Ok(origin) = origin.to_str() else {
        return false;
    };
    let Some((scheme, rest)) = origin.split_once("://") else {
        return false;
    };
    let host = rest.split(':').next().unwrap_or(rest);
    match scheme {
        "tauri" => host == "localhost",
        "http" | "https" => matches!(host, "tauri.localhost" | "localhost" | "127.0.0.1"),
        _ => false,
    }
}

/// Probes a file (reusing the cached result while the file is unchanged) and returns the
/// track list the player needs to build its menus.
async fn open_media(State(state): State<Arc<AppState>>, Query(params): Query<OpenParams>) -> Response<Body> {
    let path = PathBuf::from(&params.path);
    let id = media::media_id(&path);
    let (fingerprint, external_subtitles) = media::snapshot(&path).await;

    let cached = state.media.lock().unwrap().get(&id);
    if let Some(m) =
        cached.filter(|m| Some(m.fingerprint) == fingerprint && m.external_subtitles == external_subtitles)
    {
        return Json(m.info.clone()).into_response();
    }

    match media::probe(&state.tools, &path, fingerprint, external_subtitles).await {
        Ok(m) => {
            let info = m.info.clone();
            state.media.lock().unwrap().insert(id, Arc::new(m));
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
    // Segment URLs are resolved by the player, so they have to carry the token themselves.
    query.push_str(&format!("&token={}", state.token));

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
    // Only transcoding needs an encoder; don't probe for one when stream-copying.
    let encoder = match mode {
        VideoMode::Transcode => state.tools.video_encoder().await,
        VideoMode::Copy => media::VideoEncoder::X264,
    };

    let args = media::segment_args(&media, segment, pick_audio(&media, params.audio), mode, encoder);
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
    let track = track.trim_end_matches(".vtt");

    let (source, stream, fingerprint): (&Path, Option<usize>, _) = if let Some(n) = track.strip_prefix('s') {
        match n.parse() {
            Ok(stream) => (&media.path, Some(stream), Some(media.fingerprint)),
            Err(_) => return error(StatusCode::BAD_REQUEST, format!("Bad subtitle track {track}")),
        }
    } else if let Some(sub) = track
        .strip_prefix('x')
        .and_then(|n| n.parse::<usize>().ok())
        .and_then(|n| media.external_subtitles.get(n))
    {
        (sub, None, media::fingerprint(sub).await)
    } else {
        return error(StatusCode::NOT_FOUND, format!("Unknown subtitle track {track}"));
    };

    // Extracting an embedded track makes ffmpeg read through the whole container, so the
    // result is kept on disk rather than redone every time the app starts.
    let cache = media::cache_file("subs", (source, fingerprint, stream), "vtt");
    let vtt = match tokio::fs::read(&cache).await {
        Ok(vtt) => vtt,
        Err(_) => {
            let output = media::command(&state.tools.ffmpeg)
                .args(media::subtitle_args(source, stream))
                .output()
                .await;
            match output {
                Ok(o) if o.status.success() => {
                    media::cache_write(&cache, &o.stdout).await;
                    o.stdout
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
        .body(Body::from(vtt))
        .unwrap()
}

async fn get_thumbnail(State(state): State<Arc<AppState>>, Query(params): Query<ThumbnailParams>) -> Response<Body> {
    let path = PathBuf::from(&params.path);
    let Some(fingerprint) = media::fingerprint(&path).await else {
        return error(StatusCode::NOT_FOUND, format!("File not found: {}", path.display()));
    };
    let cache = params
        .cache
        .then(|| media::cache_file("thumb", (&path, fingerprint, params.time.to_bits(), params.width), "jpg"));
    if let Some(cache) = &cache {
        if let Ok(jpeg) = tokio::fs::read(cache).await {
            return jpeg_response(jpeg);
        }
    }

    let _permit = state.thumbnails.acquire().await.unwrap();
    let mut result = extract_frame(&state.tools, &path, params.time, params.width).await;
    // Seeking past the end of a short clip decodes nothing (ffmpeg reports that as an
    // error); show the first frame instead.
    if result.is_err() && params.time > 0.0 {
        result = extract_frame(&state.tools, &path, 0.0, params.width).await;
    }
    match result {
        Ok(jpeg) => {
            if let Some(cache) = &cache {
                media::cache_write(cache, &jpeg).await;
            }
            jpeg_response(jpeg)
        }
        Err(message) => error(StatusCode::UNPROCESSABLE_ENTITY, format!("Thumbnail failed: {message}")),
    }
}

/// One JPEG frame at `time`, or ffmpeg's complaint when it couldn't produce one.
async fn extract_frame(tools: &Tools, path: &Path, time: f64, width: Option<u32>) -> Result<Vec<u8>, String> {
    let output = media::command(&tools.ffmpeg)
        .args(media::thumbnail_args(path, time, width))
        .output()
        .await
        .map_err(|e| format!("failed to run ffmpeg: {e}"))?;
    if output.status.success() && !output.stdout.is_empty() {
        Ok(output.stdout)
    } else {
        Err(String::from_utf8_lossy(&output.stderr).trim().to_string())
    }
}

fn jpeg_response(jpeg: Vec<u8>) -> Response<Body> {
    Response::builder()
        .header(header::CONTENT_TYPE, "image/jpeg")
        .header(header::CACHE_CONTROL, "max-age=3600")
        .body(Body::from(jpeg))
        .unwrap()
}

/// Drops the in-memory probe cache (the disk cache is removed by the `clear_video_cache`
/// command). Segment processes need no cleanup: each one is owned by its HTTP response and
/// is killed as soon as the player abandons the request.
async fn clear_cache(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    state.media.lock().unwrap().entries.clear();
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

/// A listener bound to loopback, plus what the webview needs to reach it.
pub struct Endpoint {
    listener: TcpListener,
    pub port: u16,
    pub token: String,
}

/// Binds the media server socket. Falls back to an OS-assigned port when the preferred one
/// is taken (e.g. by a second instance of the app), so playback keeps working either way.
pub fn bind() -> std::io::Result<Endpoint> {
    let listener = TcpListener::bind((Ipv4Addr::LOCALHOST, PREFERRED_PORT))
        .or_else(|_| TcpListener::bind((Ipv4Addr::LOCALHOST, 0)))?;
    listener.set_nonblocking(true)?;
    let port = listener.local_addr()?.port();

    let mut secret = [0u8; 24];
    getrandom::fill(&mut secret).map_err(|e| std::io::Error::other(e.to_string()))?;
    let token = secret.iter().map(|byte| format!("{byte:02x}")).collect();

    Ok(Endpoint { listener, port, token })
}

pub async fn serve(endpoint: Endpoint) {
    serve_with(endpoint, Tools::resolve()).await
}

async fn serve_with(endpoint: Endpoint, tools: Tools) {
    let state = Arc::new(AppState {
        tools: Arc::new(tools),
        media: Mutex::new(MediaCache::default()),
        thumbnails: Semaphore::new(MAX_CONCURRENT_THUMBNAILS),
        token: endpoint.token,
    });
    println!(
        "Using ffmpeg at {} and ffprobe at {}",
        state.tools.ffmpeg.display(),
        state.tools.ffprobe.display()
    );

    let cors = CorsLayer::new()
        .allow_origin(AllowOrigin::predicate(|origin, _| is_app_origin(origin)))
        .allow_methods([Method::GET]);

    let app = Router::new()
        .route("/media/open", get(open_media))
        .route("/media/{id}/index.m3u8", get(hls_playlist))
        .route("/media/{id}/seg/{file}", get(hls_segment))
        .route("/media/{id}/subtitles/{track}", get(subtitle_track))
        .route("/thumbnail", get(get_thumbnail))
        .route("/clear-cache", get(clear_cache))
        .layer(middleware::from_fn_with_state(state.clone(), require_token))
        // Outermost, so CORS preflights are answered before the token check.
        .layer(cors)
        .with_state(state);

    println!("Starting local video stream server at http://127.0.0.1:{}", endpoint.port);

    let listener = match tokio::net::TcpListener::from_std(endpoint.listener) {
        Ok(l) => l,
        Err(e) => {
            eprintln!("Failed to start stream server: {e}");
            return;
        }
    };
    if let Err(e) = axum::serve(listener, app).await {
        eprintln!("Stream server error: {}", e);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::media::test_support::{ffmpeg, real_tools};
    use tokio::io::AsyncWriteExt;

    /// Minimal HTTP/1.0 GET (no chunked encoding to undo): returns the status and body.
    async fn http_get(port: u16, path_and_query: &str) -> (u16, Vec<u8>) {
        let mut stream = tokio::net::TcpStream::connect(("127.0.0.1", port)).await.unwrap();
        let request = format!("GET {path_and_query} HTTP/1.0\r\nHost: 127.0.0.1\r\n\r\n");
        stream.write_all(request.as_bytes()).await.unwrap();
        let mut response = Vec::new();
        stream.read_to_end(&mut response).await.unwrap();
        let split = response.windows(4).position(|w| w == b"\r\n\r\n").expect("no header terminator");
        let status = std::str::from_utf8(&response[..split]).unwrap().split(' ').nth(1).unwrap().parse().unwrap();
        (status, response[split + 4..].to_vec())
    }

    /// Drives the real server with real ffmpeg. Needs the binaries, so it only runs on
    /// request: `VIDBASE_FFMPEG=... VIDBASE_FFPROBE=... cargo test -- --ignored`.
    #[tokio::test]
    #[ignore = "needs ffmpeg and ffprobe (VIDBASE_FFMPEG / VIDBASE_FFPROBE)"]
    async fn serves_media_end_to_end() {
        let tools = real_tools();
        let dir = tempfile::tempdir().unwrap();
        let mp4 = dir.path().join("clip.mp4");
        let mkv = dir.path().join("clip.mkv");
        let srt = dir.path().join("clip.srt");
        std::fs::write(&srt, "1\n00:00:01,000 --> 00:00:03,000\nHello\n").unwrap();
        ffmpeg(&tools, &["-f", "lavfi", "-i", "testsrc=d=30:s=320x180:r=24", "-f", "lavfi", "-i", "sine=d=30"])
            .args(["-c:v", "libx264", "-g", "48", "-bf", "2", "-pix_fmt", "yuv420p", "-c:a", "aac"])
            .arg(&mp4)
            .status()
            .await
            .unwrap();
        ffmpeg(&tools, &["-i"])
            .arg(&mp4)
            .arg("-i")
            .arg(&srt)
            .args(["-map", "0", "-map", "1", "-c", "copy", "-c:s", "srt"])
            .arg(&mkv)
            .status()
            .await
            .unwrap();

        let endpoint = bind().unwrap();
        let (port, token) = (endpoint.port, endpoint.token.clone());
        tokio::spawn(serve_with(endpoint, tools));
        tokio::time::sleep(std::time::Duration::from_millis(100)).await;

        // Requests without the session token are refused.
        let thumbnail = format!("/thumbnail?path={}&time=10&width=120", mp4.display());
        assert_eq!(http_get(port, &thumbnail).await.0, 403);
        assert_eq!(http_get(port, &format!("{thumbnail}&token=wrong")).await.0, 403);

        // Thumbnails: generated once, then served from the disk cache.
        let fingerprint = media::fingerprint(&mp4).await.unwrap();
        let cached = media::cache_file("thumb", (&mp4, fingerprint, 10f64.to_bits(), Some(120u32)), "jpg");
        let _ = std::fs::remove_file(&cached);
        let (status, jpeg) = http_get(port, &format!("{thumbnail}&token={token}")).await;
        assert_eq!((status, &jpeg[..2]), (200, &[0xFF, 0xD8][..]));
        assert_eq!(std::fs::read(&cached).unwrap(), jpeg);
        assert_eq!(http_get(port, &format!("{thumbnail}&token={token}")).await.1, jpeg);
        // Past the end of the clip: falls back to the first frame instead of failing.
        let late = format!("/thumbnail?path={}&time=999&cache=false&token={token}", mp4.display());
        let (status, jpeg) = http_get(port, &late).await;
        assert_eq!((status, &jpeg[..2]), (200, &[0xFF, 0xD8][..]));

        // MP4: stream copy on keyframe boundaries taken from the container index.
        let (status, body) = http_get(port, &format!("/media/open?path={}&token={token}", mp4.display())).await;
        assert_eq!(status, 200, "{}", String::from_utf8_lossy(&body));
        let id = serde_json::from_slice::<serde_json::Value>(&body).unwrap()["id"].as_str().unwrap().to_string();
        let (_, playlist) = http_get(port, &format!("/media/{id}/index.m3u8?video=copy&token={token}")).await;
        let playlist = String::from_utf8(playlist).unwrap();
        assert!(playlist.contains(&format!("seg/0.ts?video=copy&audio=1&token={token}")), "{playlist}");
        assert_eq!(playlist.matches("#EXTINF").count(), 5, "{playlist}");
        let (status, segment) = http_get(port, &format!("/media/{id}/seg/1.ts?video=copy&audio=1&token={token}")).await;
        assert_eq!((status, segment[0]), (200, 0x47));

        // Transcoding works with whichever encoder was selected for this machine.
        let (status, segment) = http_get(port, &format!("/media/{id}/seg/0.ts?video=transcode&token={token}")).await;
        assert_eq!((status, segment[0]), (200, 0x47));

        // MKV: embedded subtitles are converted once and cached on disk.
        let (_, body) = http_get(port, &format!("/media/open?path={}&token={token}", mkv.display())).await;
        let info = serde_json::from_slice::<serde_json::Value>(&body).unwrap();
        let (id, track) = (info["id"].as_str().unwrap(), info["subtitles"][0]["id"].as_str().unwrap());
        let (status, vtt) = http_get(port, &format!("/media/{id}/subtitles/{track}.vtt?token={token}")).await;
        let vtt = String::from_utf8(vtt).unwrap();
        assert!(status == 200 && vtt.starts_with("WEBVTT") && vtt.contains("Hello"), "{status} {vtt}");
        let stream: usize = track[1..].parse().unwrap();
        let fingerprint = media::fingerprint(&mkv).await;
        let cached = media::cache_file("subs", (mkv.as_path(), fingerprint, Some(stream)), "vtt");
        assert_eq!(std::fs::read_to_string(&cached).unwrap(), vtt);
        let (_, playlist) = http_get(port, &format!("/media/{id}/index.m3u8?video=copy&token={token}")).await;
        assert!(String::from_utf8(playlist).unwrap().contains("seg/0.ts?video=copy"));
    }

    #[test]
    fn only_app_origins_are_allowed() {
        for origin in ["tauri://localhost", "http://tauri.localhost", "https://tauri.localhost", "http://localhost:1420"] {
            assert!(is_app_origin(&HeaderValue::from_static(origin)), "{origin}");
        }
        for origin in ["https://evil.example", "http://tauri.localhost.evil.example", "tauri://evil", "null"] {
            assert!(!is_app_origin(&HeaderValue::from_static(origin)), "{origin}");
        }
    }
}
