import { createContext, useContext, useState, useEffect, ReactNode, useCallback, useMemo } from 'react';
import { Store } from '@tauri-apps/plugin-store';
import { documentDir, join } from '@tauri-apps/api/path';
import { exists, mkdir } from '@tauri-apps/plugin-fs';
import { useSettings } from './SettingsContext';

interface WatchHistoryEntry {
  filePath: string;
  fileName: string;
  fileType: 'video' | 'document';
  lastWatchedAt: number; // timestamp
  currentTime: number; // current playback position in seconds
  duration: number; // total duration in seconds
  completed: boolean; // whether the video was fully watched
  thumbnail?: string;
}

interface WatchHistoryContextType {
  history: WatchHistoryEntry[];
  addToHistory: (entry: Omit<WatchHistoryEntry, 'lastWatchedAt'>) => void;
  updateProgress: (filePath: string, currentTime: number, duration: number) => void;
  getLastWatched: () => WatchHistoryEntry | null;
  getContinueWatching: () => WatchHistoryEntry[];
  clearHistory: () => void;
  toggleWatchedStatus: (filePath: string, isWatched: boolean) => void;
  checkWatchedStatus: (filePath: string) => boolean;
}

const WatchHistoryContext = createContext<WatchHistoryContextType | undefined>(undefined);

const MAX_HISTORY_ITEMS = 50;

// Create a persistent store for watch history in Documents/vidbase
let historyStore: Store | null = null;

async function getHistoryStore(): Promise<Store> {
  if (!historyStore) {
    try {
      // Get Documents directory path
      const documentsPath = await documentDir();
      const vidbasePath = await join(documentsPath, 'vidbase');
      
      // Create vidbase directory if it doesn't exist
      const dirExists = await exists(vidbasePath);
      if (!dirExists) {
        await mkdir(vidbasePath, { recursive: true });
      }
      
      // Create store with path in Documents/vidbase
      const storePath = await join(vidbasePath, 'watch-history.json');
      historyStore = await Store.load(storePath);
    } catch (error) {
      console.error('Failed to initialize history store:', error);
      // Fallback to default store location
      historyStore = await Store.load('watch-history.json');
    }
  }
  return historyStore;
}

export function WatchHistoryProvider({ children }: { children: ReactNode }) {
  const [history, setHistory] = useState<WatchHistoryEntry[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const { settings } = useSettings();

  // Load history from Tauri Store on mount
  useEffect(() => {
    async function loadHistory() {
      try {
        const store = await getHistoryStore();
        const stored = await store.get<WatchHistoryEntry[]>('history');
        
        if (stored && Array.isArray(stored)) {
          setHistory(stored);
        }
      } catch (error) {
        console.error('Failed to load watch history:', error);
      } finally {
        setIsLoaded(true);
      }
    }
    
    loadHistory();
  }, []);

  // Save history to Tauri Store whenever it changes
  useEffect(() => {
    if (!isLoaded) return; // Don't save during initial load
    
    async function saveHistory() {
      try {
        const store = await getHistoryStore();
        await store.set('history', history);
        await store.save(); // Persist to disk
      } catch (error) {
        console.error('Failed to save watch history:', error);
      }
    }
    
    saveHistory();
  }, [history, isLoaded]);

  const addToHistory = useCallback((entry: Omit<WatchHistoryEntry, 'lastWatchedAt'>) => {
    setHistory(prev => {
      const existing = prev.find(item => item.filePath === entry.filePath);
      const filtered = prev.filter(item => item.filePath !== entry.filePath);
      
      const newEntry: WatchHistoryEntry = {
        ...entry,
        currentTime: existing && !existing.completed ? existing.currentTime : entry.currentTime,
        duration: existing && !existing.completed ? existing.duration : entry.duration,
        lastWatchedAt: Date.now(),
      };
      
      const updated = [newEntry, ...filtered].slice(0, MAX_HISTORY_ITEMS);
      
      return updated;
    });
  }, []);

  const updateProgress = useCallback((filePath: string, currentTime: number, duration: number) => {
    setHistory(prev => {
      const index = prev.findIndex(item => item.filePath === filePath);
      
      if (index === -1) return prev;
      
      const updated = [...prev];
      const item = updated[index];
      
      // Consider video completed if watched more than 95% or within 10 seconds of end
      const completed = duration > 0 ? (currentTime >= duration - 10 || (currentTime / duration) >= 0.95) : false;
      
      updated[index] = {
        ...item,
        currentTime,
        duration,
        completed: item.completed || completed, // Keep completed if already true
        lastWatchedAt: Date.now(),
      };
      
      // Move to front if it's being updated
      const [updatedItem] = updated.splice(index, 1);
      updated.unshift(updatedItem);
      
      return updated;
    });
  }, []);

  const toggleWatchedStatus = useCallback((filePath: string, isWatched: boolean) => {
    setHistory(prev => {
      const index = prev.findIndex(item => item.filePath === filePath);
      
      if (index === -1) {
          // If not in history but marking as watched, add it
          if (isWatched) {
             const newEntry: WatchHistoryEntry = {
                filePath,
                fileName: filePath.split(/[\\/]/).pop() || 'Unknown',
                fileType: 'video', // Assumption
                lastWatchedAt: Date.now(),
                currentTime: 0,
                duration: 0,
                completed: true,
             };
             return [newEntry, ...prev].slice(0, MAX_HISTORY_ITEMS);
          }
          return prev;
      }
      
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        completed: isWatched,
        lastWatchedAt: Date.now(),
      };
      
      return updated;
    });
  }, []);

  const checkWatchedStatus = useCallback((filePath: string): boolean => {
      const item = history.find(i => i.filePath === filePath);
      return item ? item.completed : false;
  }, [history]);

  const isValidPath = (filePath: string) => {
    if (settings.directories.length === 0) return false;
    const normalize = (p: string) => p.toLowerCase().replace(/[\\/]/g, '/');
    const normFile = normalize(filePath);
    return settings.directories.some(dir => normFile.startsWith(normalize(dir)));
  };

  const getLastWatched = useCallback((): WatchHistoryEntry | null => {
    if (history.length === 0) return null;
    // Find the first item that is a video and still in configured directories
    return history.find(item => item.fileType === 'video' && isValidPath(item.filePath)) || null;
  }, [history, settings.directories]);

  const getContinueWatching = useCallback((): WatchHistoryEntry[] => {
    // Return videos that are not completed, sorted by last watched and in configured directories
    return history
      .filter(item => item.fileType === 'video' && !item.completed && isValidPath(item.filePath))
      .slice(0, 10);
  }, [history, settings.directories]);

  const clearHistory = useCallback(() => {
    setHistory([]);
  }, []);

  const contextValue = useMemo(() => ({
    history,
    addToHistory,
    updateProgress,
    getLastWatched,
    getContinueWatching,
    clearHistory,
    toggleWatchedStatus,
    checkWatchedStatus,
  }), [history, addToHistory, updateProgress, getLastWatched, getContinueWatching, clearHistory, toggleWatchedStatus, checkWatchedStatus]);

  return (
    <WatchHistoryContext.Provider value={contextValue}>
      {children}
    </WatchHistoryContext.Provider>
  );
}

export function useWatchHistory() {
  const context = useContext(WatchHistoryContext);
  if (!context) {
    throw new Error('useWatchHistory must be used within WatchHistoryProvider');
  }
  return context;
}
