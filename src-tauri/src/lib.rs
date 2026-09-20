mod discord_rpc;
use tauri::Manager;
mod files;
mod streamer;
mod volume_mixer; // <-- NEW

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
async fn clear_video_cache() -> Result<(), String> {
    let temp_dir = std::env::temp_dir().join("vidbase_streams");
    if temp_dir.exists() {
        std::fs::remove_dir_all(&temp_dir).map_err(|e| format!("Failed to clear cache: {}", e))?;
    }
    // Also recreate it so it's ready for next streams
    let _ = std::fs::create_dir_all(&temp_dir);
    Ok(())
}

#[tauri::command]
fn window_minimize(window: tauri::Window) {
    let _ = window.minimize();
}

#[tauri::command]
fn window_toggle_maximize(window: tauri::Window) {
    if let Ok(maximized) = window.is_maximized() {
        if maximized {
            let _ = window.unmaximize();
        } else {
            let _ = window.maximize();
        }
    }
}

#[tauri::command]
fn window_close(window: tauri::Window) {
    let _ = window.close();
}

#[tauri::command]
fn restart_app(app: tauri::AppHandle) {
    #[cfg(target_os = "macos")]
    {
        // Relaunching the executable directly is unreliable after an in-place update
        // on macOS, so reopen the .app bundle through `open` once this process exits.
        // The helper runs in its own process group with stdio detached so it survives
        // our exit; its output goes to a log file to make failures diagnosable.
        use std::os::unix::process::CommandExt;
        use std::process::{Command, Stdio};

        if let Some(bundle) = std::env::current_exe().ok().and_then(|exe| {
            exe.ancestors()
                .find(|p| p.extension().map_or(false, |e| e == "app"))
                .map(|p| p.to_path_buf())
        }) {
            let log_path = std::env::temp_dir().join("vidbase_restart.log");
            let log = std::fs::File::create(&log_path).ok();
            let (out, err) = match log.and_then(|f| f.try_clone().ok().map(|c| (f, c))) {
                Some((a, b)) => (Stdio::from(a), Stdio::from(b)),
                None => (Stdio::null(), Stdio::null()),
            };
            let script = "while kill -0 \"$1\" 2>/dev/null; do sleep 0.2; done; sleep 0.5; echo \"opening $0\"; open -n \"$0\"; echo \"open exit=$?\"";
            let spawned = Command::new("/bin/sh")
                .arg("-c")
                .arg(script)
                .arg(&bundle)
                .arg(std::process::id().to_string())
                .stdin(Stdio::null())
                .stdout(out)
                .stderr(err)
                .process_group(0)
                .spawn();
            if spawned.is_ok() {
                app.exit(0);
                return;
            }
        }
    }
    app.restart();
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    volume_mixer::init();

    // Start video streamer on a background thread natively
    tauri::async_runtime::spawn(async move {
        streamer::start_server().await;
    });

    let builder = tauri::Builder::default();

    #[cfg(desktop)]
    let builder = builder
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init());

    builder
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .manage(discord_rpc::DiscordState {
            // <-- NEW
            client: std::sync::Mutex::new(None),
        })
        .invoke_handler(tauri::generate_handler![
            greet,
            files::list_media_files,
            clear_video_cache,
            window_minimize,
            window_toggle_maximize,
            window_close,
            restart_app,
            discord_rpc::set_discord_activity,   // <-- NEW
            discord_rpc::clear_discord_activity  // <-- NEW
        ])
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { .. } = event {
                // Clear Discord Rich Presence when the window is closing without blocking the UI
                let mut client_opt: Option<discord_presence::Client> = None;
                if let Ok(mut client_guard) = window
                    .state::<discord_rpc::DiscordState>()
                    .client
                    .try_lock()
                {
                    client_opt = client_guard.take();
                }

                if let Some(mut client) = client_opt {
                    std::thread::spawn(move || {
                        let _ = client.clear_activity();
                    });
                }
            }
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app_handle, event| {
            if let tauri::RunEvent::Exit = event {
                // Final cleanup on exit
                let mut client_opt: Option<discord_presence::Client> = None;
                if let Ok(mut client_guard) = app_handle
                    .state::<discord_rpc::DiscordState>()
                    .client
                    .try_lock()
                {
                    client_opt = client_guard.take();
                }

                if let Some(mut client) = client_opt {
                    let _ = client.clear_activity();
                }
            }
        });
}
