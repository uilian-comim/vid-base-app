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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    volume_mixer::init();

    // Start video streamer on a background thread natively
    tauri::async_runtime::spawn(async move {
        streamer::start_server().await;
    });

    tauri::Builder::default()
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
