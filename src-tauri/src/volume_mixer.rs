#[cfg(windows)]
pub fn init() {
    std::thread::spawn(|| {
        use std::time::Duration;
        use sysinfo::System;
        use windows::core::{Interface, PCWSTR};
        use windows::Win32::Media::Audio::{
            eMultimedia, eRender, IAudioSessionControl2, IAudioSessionManager2,
            IMMDeviceEnumerator, MMDeviceEnumerator,
        };
        use windows::Win32::System::Com::{
            CoCreateInstance, CoInitializeEx, CLSCTX_ALL, COINIT_MULTITHREADED,
        };

        unsafe {
            let _ = CoInitializeEx(None, COINIT_MULTITHREADED);
        }

        let mut sys = System::new_all();
        let current_pid = std::process::id();

        loop {
            std::thread::sleep(Duration::from_secs(2));

            // In sysinfo 0.30, refresh_all() works to refresh everything.
            sys.refresh_all();

            let mut webview_pids = std::collections::HashSet::new();
            for (pid, process) in sys.processes() {
                let name = process.name().to_lowercase();
                if name.contains("msedgewebview") || name.contains("webview2") {
                    let mut is_descendant = false;
                    let mut curr = Some(*pid);
                    while let Some(p) = curr {
                        if p.as_u32() == current_pid {
                            is_descendant = true;
                            break;
                        }
                        curr = sys.process(p).and_then(|proc| proc.parent());
                    }
                    if is_descendant {
                        webview_pids.insert(pid.as_u32());
                    }
                }
            }

            if webview_pids.is_empty() {
                continue;
            }

            unsafe {
                let device_enumerator: Result<IMMDeviceEnumerator, _> =
                    CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL);

                if let Ok(enumerator) = device_enumerator {
                    if let Ok(device) = enumerator.GetDefaultAudioEndpoint(eRender, eMultimedia) {
                        // The Activate method usually takes the interface type as a generic parameter or it's inferred.
                        // Try calling it and using .cast or explicit type.
                        let manager: Result<IAudioSessionManager2, _> =
                            device.Activate(CLSCTX_ALL, None);
                        if let Ok(manager) = manager {
                            if let Ok(session_enumerator) = manager.GetSessionEnumerator() {
                                if let Ok(count) = session_enumerator.GetCount() {
                                    for i in 0..count {
                                        if let Ok(session_control) =
                                            session_enumerator.GetSession(i)
                                        {
                                            if let Ok(session_control2) =
                                                session_control.cast::<IAudioSessionControl2>()
                                            {
                                                if let Ok(pid) = session_control2.GetProcessId() {
                                                    if webview_pids.contains(&pid) {
                                                        let new_name: Vec<u16> =
                                                            "vidbase\0".encode_utf16().collect();
                                                        let _ = session_control.SetDisplayName(
                                                            PCWSTR::from_raw(new_name.as_ptr()),
                                                            std::ptr::null(),
                                                        );

                                                        if let Ok(exe_path) =
                                                            std::env::current_exe()
                                                        {
                                                            let exe_path_str =
                                                                exe_path.to_string_lossy();
                                                            // For Windows, Icon paths can be the executable itself e.g "C:\path\to\app.exe,0" or just the exe
                                                            let icon_path: Vec<u16> =
                                                                format!("{}\0", exe_path_str)
                                                                    .encode_utf16()
                                                                    .collect();
                                                            let _ = session_control.SetIconPath(
                                                                PCWSTR::from_raw(
                                                                    icon_path.as_ptr(),
                                                                ),
                                                                std::ptr::null(),
                                                            );
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    });
}

#[cfg(not(windows))]
pub fn init() {}
