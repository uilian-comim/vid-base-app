import { createContext, useContext, useState, useEffect, ReactNode, useCallback, useMemo, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { readDir } from '@tauri-apps/plugin-fs';
import { useSettings } from './SettingsContext';

export interface FileEntry {
  name: string;
  path: string;
  file_type: "video" | "document";
}

export interface Directory {
  name: string;
  path: string;
  fileCount: number;
  color: "blue" | "purple" | "green" | "orange";
}

interface FilesContextType {
  files: FileEntry[];
  directories: Directory[];
  isLoading: boolean;
  refreshFiles: () => Promise<void>;
  listDirectory: (path: string) => Promise<FileSystemEntry[]>;
}

const FilesContext = createContext<FilesContextType | undefined>(undefined);

const VIDEO_EXTENSIONS = ['.mp4', '.m4v', '.mpeg4', '.mkv', '.ts', '.avi', '.mov', '.wmv', '.flv', '.webm'];
const DOCUMENT_EXTENSIONS = ['.pdf', '.html'];

const DIRECTORY_COLORS: Array<"blue" | "purple" | "green" | "orange"> = ["blue", "purple", "green", "orange"];

/** Appends a file name to a directory path using that path's own separator (no IPC round trip). */
function joinPath(dir: string, name: string): string {
  const separator = dir.includes('/') ? '/' : '\\';
  return dir.endsWith('/') || dir.endsWith('\\') ? dir + name : dir + separator + name;
}

export function FilesProvider({ children }: { children: ReactNode }) {
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [directories, setDirectories] = useState<Directory[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { settings } = useSettings();

  // Bumped on every scan so a slow, superseded scan can't overwrite a newer result.
  const scanIdRef = useRef(0);

  const refreshFiles = useCallback(async () => {
    const scanId = ++scanIdRef.current;
    const roots = settings.directories;

    if (roots.length === 0) {
      setFiles([]);
      setDirectories([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      // The whole library is walked natively in one call (see src-tauri/src/files.rs),
      // returning one file list per root.
      const filesByRoot = await invoke<FileEntry[][]>('list_media_files', { paths: roots });
      if (scanId !== scanIdRef.current) return;

      setFiles(filesByRoot.flat());
      setDirectories(roots.map((dirPath, index) => ({
        name: dirPath.split(/[\\/]/).pop() || dirPath,
        path: dirPath,
        fileCount: filesByRoot[index]?.length ?? 0,
        color: DIRECTORY_COLORS[index % DIRECTORY_COLORS.length],
      })));
    } catch (error) {
      if (scanId !== scanIdRef.current) return;
      console.error('Failed to scan library:', error);
    }
    setIsLoading(false);
  }, [settings.directories]);

  // Refresh files when directories change in settings
  useEffect(() => {
    refreshFiles();
  }, [refreshFiles]);

  const listDirectory = useCallback(async (path: string): Promise<FileSystemEntry[]> => {
    try {
      const entries = await readDir(path);
      const processedEntries: FileSystemEntry[] = [];

      for (const entry of entries) {
        const fullPath = joinPath(path, entry.name);

        if (entry.isDirectory) {
          processedEntries.push({
            name: entry.name,
            path: fullPath,
            type: 'directory'
          });
        } else if (entry.isFile) {
          const lowerName = entry.name.toLowerCase();
          const isVideo = VIDEO_EXTENSIONS.some(ext => lowerName.endsWith(ext));
          const isDocument = DOCUMENT_EXTENSIONS.some(ext => lowerName.endsWith(ext));
          
          if (isVideo) {
            processedEntries.push({
              name: entry.name,
              path: fullPath,
              type: 'video'
            });
          } else if (isDocument) {
            processedEntries.push({
              name: entry.name,
              path: fullPath,
              type: 'document'
            });
          }
        }
      }
      
      // Sort: directories first, then files, in natural order ("Episode 2" before "Episode 10")
      return processedEntries.sort((a, b) => {
        if (a.type === 'directory' && b.type !== 'directory') return -1;
        if (a.type !== 'directory' && b.type === 'directory') return 1;
        return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
      });
    } catch (error) {
      console.error(`Error listing directory ${path}:`, error);
      return [];
    }
  }, []);

  const contextValue = useMemo(() => ({
    files,
    directories,
    isLoading,
    refreshFiles,
    listDirectory
  }), [files, directories, isLoading, refreshFiles, listDirectory]);

  return (
    <FilesContext.Provider value={contextValue}>
      {children}
    </FilesContext.Provider>
  );
}

export function useFiles() {
  const context = useContext(FilesContext);
  if (context === undefined) {
    throw new Error('useFiles must be used within a FilesProvider');
  }
  return context;
}

export interface FileSystemEntry {
  name: string;
  path: string;
  type: 'directory' | 'video' | 'document';
}
