//! Windows only: labels the app's audio session in the system volume mixer as "vidbase"
//! (with the app icon) instead of the anonymous WebView2 process that actually plays audio.

#[cfg(windows)]
pub fn init() {
    std::thread::spawn(|| {
        use std::collections::HashMap;
        use std::time::Duration;
        use sysinfo::{Pid, ProcessRefreshKind, System};
        use windows::core::{Interface, PCWSTR};
        use windows::Win32::Media::Audio::{
            eMultimedia, eRender, IAudioSessionControl2, IAudioSessionManager2,
            IMMDeviceEnumerator, MMDeviceEnumerator,
        };
        use windows::Win32::System::Com::{
            CoCreateInstance, CoInitializeEx, CLSCTX_ALL, COINIT_MULTITHREADED,
        };

        /// Upper bound when walking up the process tree, in case of a parent cycle.
        const MAX_ANCESTORS: usize = 32;

        unsafe {
            let _ = CoInitializeEx(None, COINIT_MULTITHREADED);
        }

        let mut sys = System::new();
        let current_pid = std::process::id();
        // Whether each process that owns an audio session is one of our webviews. Lets the
        // loop skip the (comparatively expensive) process snapshot unless a session from a
        // process it hasn't seen yet shows up.
        let mut is_own_webview: HashMap<u32, bool> = HashMap::new();

        loop {
            std::thread::sleep(Duration::from_secs(2));

            // Listing audio sessions is a handful of cheap COM calls; there are only a few
            // sessions system-wide, and none of ours until something plays.
            let mut sessions = Vec::new();
            unsafe {
                let device_enumerator: Result<IMMDeviceEnumerator, _> =
                    CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL);

                if let Ok(enumerator) = device_enumerator {
                    if let Ok(device) = enumerator.GetDefaultAudioEndpoint(eRender, eMultimedia) {
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
                                                    sessions.push((session_control, pid));
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

            // Forget processes whose sessions are gone, so a reused PID is classified again.
            is_own_webview.retain(|pid, _| sessions.iter().any(|(_, p)| p == pid));

            if sessions.iter().any(|(_, pid)| !is_own_webview.contains_key(pid)) {
                // Only names and parent PIDs are needed, not CPU/memory/disk usage.
                sys.refresh_processes_specifics(ProcessRefreshKind::new());

                for (_, pid) in &sessions {
                    is_own_webview.entry(*pid).or_insert_with(|| {
                        let Some(process) = sys.process(Pid::from_u32(*pid)) else {
                            return false;
                        };
                        let name = process.name().to_lowercase();
                        if !(name.contains("msedgewebview") || name.contains("webview2")) {
                            return false;
                        }
                        let mut ancestor = process.parent();
                        for _ in 0..MAX_ANCESTORS {
                            match ancestor {
                                Some(p) if p.as_u32() == current_pid => return true,
                                Some(p) => ancestor = sys.process(p).and_then(|proc| proc.parent()),
                                None => break,
                            }
                        }
                        false
                    });
                }
            }

            for (session_control, pid) in &sessions {
                if is_own_webview.get(pid) != Some(&true) {
                    continue;
                }
                unsafe {
                    let new_name: Vec<u16> = "vidbase\0".encode_utf16().collect();
                    let _ = session_control
                        .SetDisplayName(PCWSTR::from_raw(new_name.as_ptr()), std::ptr::null());

                    if let Ok(exe_path) = std::env::current_exe() {
                        // For Windows, Icon paths can be the executable itself e.g "C:\path\to\app.exe,0" or just the exe
                        let icon_path: Vec<u16> =
                            format!("{}\0", exe_path.to_string_lossy()).encode_utf16().collect();
                        let _ = session_control
                            .SetIconPath(PCWSTR::from_raw(icon_path.as_ptr()), std::ptr::null());
                    }
                }
            }
        }
    });
}

#[cfg(not(windows))]
pub fn init() {}
