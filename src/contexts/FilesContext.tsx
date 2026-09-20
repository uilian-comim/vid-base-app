import { createContext, useContext, useState, useEffect, ReactNode, useCallback, useMemo } from 'react';
import { readDir } from '@tauri-apps/plugin-fs';
import { join } from '@tauri-apps/api/path';
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

export function FilesProvider({ children }: { children: ReactNode }) {
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [directories, setDirectories] = useState<Directory[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { settings } = useSettings();

  const scanDirectoryRecursively = async (dirPath: string): Promise<FileEntry[]> => {
    let foundFiles: FileEntry[] = [];
    
    try {
      const entries = await readDir(dirPath);
      
      for (const entry of entries) {
        const fullPath = await join(dirPath, entry.name);
        
        if (entry.isDirectory) {
          const subFiles = await scanDirectoryRecursively(fullPath);
          foundFiles = [...foundFiles, ...subFiles];
        } else if (entry.isFile) {
          const lowerName = entry.name.toLowerCase();
          const isVideo = VIDEO_EXTENSIONS.some(ext => lowerName.endsWith(ext));
          const isDocument = DOCUMENT_EXTENSIONS.some(ext => lowerName.endsWith(ext));
          
          if (isVideo || isDocument) {
            foundFiles.push({
              name: entry.name,
              path: fullPath,
              file_type: isVideo ? 'video' : 'document'
            });
          }
        }
      }
    } catch (error) {
      console.error(`Error scanning directory ${dirPath}:`, error);
    }
    
    return foundFiles;
  };

  const refreshFiles = useCallback(async () => {
    if (settings.directories.length === 0) {
      setFiles([]);
      setDirectories([]);
      return;
    }

    setIsLoading(true);
    let allFiles: FileEntry[] = [];
    let newDirectories: Directory[] = [];
    
    // Process each configured directory
    for (const [index, dirPath] of settings.directories.entries()) {
      try {
        const dirFiles = await scanDirectoryRecursively(dirPath);
        allFiles = [...allFiles, ...dirFiles];
        
        // Extract directory name from path
        // Using string manipulation as a fallback if basename isn't readily available or async
        const dirName = dirPath.split(/[\\/]/).pop() || dirPath;
        
        newDirectories.push({
          name: dirName,
          path: dirPath,
          fileCount: dirFiles.length,
          color: DIRECTORY_COLORS[index % DIRECTORY_COLORS.length]
        });
      } catch (error) {
        console.error(`Failed to process directory ${dirPath}:`, error);
      }
    }

    setFiles(allFiles);
    setDirectories(newDirectories);
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
        const fullPath = await join(path, entry.name);
        
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
      
      // Sort: Directories first, then files, alphabetically
      return processedEntries.sort((a, b) => {
        if (a.type === 'directory' && b.type !== 'directory') return -1;
        if (a.type !== 'directory' && b.type === 'directory') return 1;
        return a.name.localeCompare(b.name);
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
