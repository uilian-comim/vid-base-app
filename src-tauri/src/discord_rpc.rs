use discord_presence::Client;
use std::sync::Mutex;
use tauri::{AppHandle, Manager};

pub struct DiscordState {
    pub client: Mutex<Option<Client>>,
}

impl Drop for DiscordState {
    fn drop(&mut self) {
        if let Ok(mut client_guard) = self.client.lock() {
            if let Some(mut client) = client_guard.take() {
                // The new client manages its own Drop nicely
                let _ = client.clear_activity();
            }
        }
    }
}

#[tauri::command]
pub fn set_discord_activity(
    app_handle: AppHandle,
    activity_state: String,
    details: String,
    start_timestamp: Option<i64>,
) -> Result<(), String> {
    std::thread::spawn(move || {
        let state = app_handle.state::<DiscordState>();

        // 1. Get or Initialize Client without holding the Mutex over long operations
        {
            let mut guard = state.client.lock().unwrap();
            if guard.is_none() {
                println!("Initializing discord-presence client...");
                let mut new_client = Client::new(1478402472606306416);
                new_client.start();
                *guard = Some(new_client);
            }
        }

        // 2. Try to set the activity, retrying if the background thread hasn't finished connecting (NotStarted)
        let mut attempts = 0;
        loop {
            let mut success = false;
            let mut should_retry = false;

            {
                let mut guard = state.client.lock().unwrap();
                if let Some(client) = guard.as_mut() {
                    let res = client.set_activity(|a| {
                        if let Some(ts) = start_timestamp {
                            a.state(&activity_state)
                                .details(&details)
                                .timestamps(|t| t.start(ts as u64))
                        } else {
                            a.state(&activity_state).details(&details)
                        }
                    });

                    match res {
                        Ok(_) => {
                            println!("Discord activity successfully set to: {}", activity_state);
                            success = true;
                        }
                        Err(e) => {
                            let err_str = format!("{:?}", e);
                            if err_str.contains("NotStarted") {
                                should_retry = true;
                            } else {
                                println!("Failed to set Discord activity unrecoverably: {:?}", e);
                                success = true; // Break loop on other errors
                            }
                        }
                    }
                } else {
                    // Client was cleared by another thread
                    success = true;
                }
            }

            if success || attempts >= 15 {
                if attempts >= 15 {
                    println!("Failed to set Discord activity: Timed out waiting for connection.");
                }
                break;
            }

            // Sleep and retry
            std::thread::sleep(std::time::Duration::from_millis(200));
            attempts += 1;
        }
    });

    Ok(())
}

#[tauri::command]
pub fn clear_discord_activity(app_handle: AppHandle) -> Result<(), String> {
    std::thread::spawn(move || {
        let state = app_handle.state::<DiscordState>();

        // Lock, take the client, and immediately unlock
        // By taking it, the old client will go out of scope at the end of this thread and gracefully disconnect.
        let client_opt = {
            let mut guard = state.client.lock().unwrap();
            guard.take()
        };

        if let Some(mut client) = client_opt {
            println!("Clearing Discord activity...");
            let _ = client.clear_activity();
            println!("Discord client instance dropped and connection closed.");
        }
    });

    Ok(())
}
