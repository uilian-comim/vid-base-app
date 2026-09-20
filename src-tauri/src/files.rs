use serde::{Deserialize, Serialize};
use std::path::Path;
use walkdir::WalkDir;

#[derive(Debug, Serialize, Deserialize)]
pub struct FileEntry {
    name: String,
    path: String,
    file_type: String,
}

#[tauri::command]
pub async fn list_media_files(paths: Vec<String>) -> Vec<FileEntry> {
    // Sync commands run on the main thread; walk the disk on a blocking thread instead.
    tauri::async_runtime::spawn_blocking(move || scan_media_files(paths))
        .await
        .unwrap_or_default()
}

fn scan_media_files(paths: Vec<String>) -> Vec<FileEntry> {
    let mut files = Vec::new();
    let video_extensions = vec!["mp4", "mkv", "ts", "avi", "mov", "webm"];
    let doc_extensions = vec!["pdf"];

    for path_str in paths {
        let path = Path::new(&path_str);
        if !path.exists() {
            continue;
        }

        for entry in WalkDir::new(path).into_iter().filter_map(|e| e.ok()) {
            let path = entry.path();
            if path.is_file() {
                if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
                    let ext_lower = ext.to_lowercase();
                    let file_type = if video_extensions.contains(&ext_lower.as_str()) {
                        "video".to_string()
                    } else if doc_extensions.contains(&ext_lower.as_str()) {
                        "document".to_string()
                    } else {
                        continue;
                    };

                    if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
                        files.push(FileEntry {
                            name: name.to_string(),
                            path: path.to_string_lossy().to_string(),
                            file_type,
                        });
                    }
                }
            }
        }
    }
    files
}
