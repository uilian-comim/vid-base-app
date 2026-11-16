use serde::Serialize;
use std::path::Path;
use walkdir::WalkDir;

const VIDEO_EXTENSIONS: &[&str] = &["mp4", "m4v", "mpeg4", "mkv", "ts", "avi", "mov", "wmv", "flv", "webm"];
const DOCUMENT_EXTENSIONS: &[&str] = &["pdf", "html"];

#[derive(Debug, Serialize, PartialEq)]
pub struct FileEntry {
    name: String,
    path: String,
    file_type: &'static str,
}

/// Scans every library root in one call. The result holds one file list per requested
/// path, in the same order, so the caller can tell which root each file came from.
#[tauri::command]
pub async fn list_media_files(paths: Vec<String>) -> Vec<Vec<FileEntry>> {
    // Sync commands run on the main thread; walk the disk on a blocking thread instead.
    tauri::async_runtime::spawn_blocking(move || paths.iter().map(|p| scan_media_files(Path::new(p))).collect())
        .await
        .unwrap_or_default()
}

fn scan_media_files(root: &Path) -> Vec<FileEntry> {
    WalkDir::new(root)
        .sort_by_file_name()
        .into_iter()
        .filter_map(Result::ok)
        // The type comes with the directory listing, so this costs no extra stat per file.
        .filter(|entry| entry.file_type().is_file())
        .filter_map(|entry| {
            let name = entry.file_name().to_str()?;
            let ext = Path::new(name).extension()?.to_str()?.to_lowercase();
            let file_type = if VIDEO_EXTENSIONS.contains(&ext.as_str()) {
                "video"
            } else if DOCUMENT_EXTENSIONS.contains(&ext.as_str()) {
                "document"
            } else {
                return None;
            };
            Some(FileEntry {
                name: name.to_string(),
                path: entry.path().to_str()?.to_string(),
                file_type,
            })
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn scans_nested_media_and_skips_other_files() {
        let dir = tempfile::tempdir().unwrap();
        let sub = dir.path().join("Season 1");
        std::fs::create_dir(&sub).unwrap();
        for name in ["b.MKV", "a.mp4", "notes.txt", "Season 1/e1.m4v", "Season 1/guide.pdf"] {
            std::fs::write(dir.path().join(name), b"").unwrap();
        }

        let files = scan_media_files(dir.path());
        let summary: Vec<(&str, &str)> = files.iter().map(|f| (f.name.as_str(), f.file_type)).collect();
        assert_eq!(
            summary,
            vec![("e1.m4v", "video"), ("guide.pdf", "document"), ("a.mp4", "video"), ("b.MKV", "video")]
        );
        assert_eq!(files[0].path, sub.join("e1.m4v").to_str().unwrap());
    }

    #[test]
    fn missing_root_yields_no_files() {
        assert!(scan_media_files(Path::new("/definitely/not/here")).is_empty());
    }
}
