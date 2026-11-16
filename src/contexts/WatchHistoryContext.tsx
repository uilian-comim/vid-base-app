import { createContext, useContext, useState, useEffect, ReactNode, useCallback, useMemo, useRef } from 'react';
import { Store } from '@tauri-apps/plugin-store';
import { documentDir, join } from '@tauri-apps/api/path';
import { exists, mkdir } from '@tauri-apps/plugin-fs';
import { useSettings } from './SettingsContext';

export interface WatchHistoryEntry {
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
  /**
   * Records the playback position. Reports are cheap and can be frequent: they are only
   * committed to the history (and written to disk) every 30 s, or right away when
   * `immediate` is set (pause, end of video, closing the player).
   */
  updateProgress: (filePath: string, currentTime: number, duration: number, immediate?: boolean) => void;
  getEntry: (filePath: string) => WatchHistoryEntry | undefined;
  getLastWatched: () => WatchHistoryEntry | null;
  getContinueWatching: () => WatchHistoryEntry[];
  clearHistory: () => void;
  toggleWatchedStatus: (filePath: string, isWatched: boolean) => void;
  checkWatchedStatus: (filePath: string) => boolean;
}

const WatchHistoryContext = createContext<WatchHistoryContextType | undefined>(undefined);

// Unfinished entries only matter for "continue watching", so just the most recent are kept.
// Completed entries are the "watched" marks of the library and must not expire as more
// videos are opened; the cap on them is only a guard against unbounded growth.
const MAX_IN_PROGRESS_ITEMS = 50;
const MAX_COMPLETED_ITEMS = 10_000;
const MAX_CONTINUE_WATCHING = 10;

const PROGRESS_COMMIT_INTERVAL_MS = 30_000;
// Latest reported position, kept in localStorage so that at most a few seconds are lost if
// the app quits between two commits. It is merged back into the history on the next start.
const PROGRESS_JOURNAL_KEY = 'vidbase:progress-journal';

interface ProgressReport {
  filePath: string;
  currentTime: number;
  duration: number;
  at: number;
}

/** Expects entries ordered from most to least recent. */
function trimHistory(entries: WatchHistoryEntry[]): WatchHistoryEntry[] {
  let inProgress = 0;
  let completed = 0;
  return entries.filter((entry) =>
    entry.completed ? ++completed <= MAX_COMPLETED_ITEMS : ++inProgress <= MAX_IN_PROGRESS_ITEMS
  );
}

function applyProgress(entries: WatchHistoryEntry[], report: ProgressReport): WatchHistoryEntry[] {
  const index = entries.findIndex(item => item.filePath === report.filePath);
  if (index === -1) return entries;

  const { currentTime, duration } = report;
  // Consider video completed if watched more than 95% or within 10 seconds of end
  const completed = duration > 0 ? (currentTime >= duration - 10 || (currentTime / duration) >= 0.95) : false;
  const item = entries[index];
  const updated: WatchHistoryEntry = {
    ...item,
    currentTime,
    duration,
    completed: item.completed || completed, // Keep completed if already true
    lastWatchedAt: report.at,
  };

  // Move to front since it's being watched
  return [updated, ...entries.slice(0, index), ...entries.slice(index + 1)];
}

function readJournal(): ProgressReport | null {
  try {
    const report = JSON.parse(localStorage.getItem(PROGRESS_JOURNAL_KEY) ?? 'null');
    return report && typeof report.filePath === 'string' && typeof report.at === 'number' ? report : null;
  } catch {
    return null;
  }
}

function writeJournal(report: ProgressReport | null) {
  try {
    if (report) localStorage.setItem(PROGRESS_JOURNAL_KEY, JSON.stringify(report));
    else localStorage.removeItem(PROGRESS_JOURNAL_KEY);
  } catch {
    // Storage unavailable: progress is still committed on the regular interval.
  }
}

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

const normalizePath = (path: string) => path.toLowerCase().replace(/[\\/]/g, '/');

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
        let loaded = stored && Array.isArray(stored) ? stored : [];

        // Recover a position reported after the last commit of the previous session.
        const journal = readJournal();
        const journaled = journal && loaded.find(item => item.filePath === journal.filePath);
        if (journal && journaled && journal.at > journaled.lastWatchedAt) {
          loaded = applyProgress(loaded, journal);
        }

        if (loaded.length > 0) setHistory(loaded);
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

      return trimHistory([newEntry, ...filtered]);
    });
  }, []);

  // Position reported by the player but not yet committed to `history`.
  const pendingRef = useRef<ProgressReport | null>(null);
  const commitTimerRef = useRef<number | null>(null);

  const commitPendingProgress = useCallback(() => {
    if (commitTimerRef.current !== null) {
      window.clearTimeout(commitTimerRef.current);
      commitTimerRef.current = null;
    }
    const report = pendingRef.current;
    if (!report) return;
    pendingRef.current = null;
    setHistory(prev => applyProgress(prev, report));
  }, []);

  useEffect(() => () => {
    if (commitTimerRef.current !== null) window.clearTimeout(commitTimerRef.current);
  }, []);

  const updateProgress = useCallback((filePath: string, currentTime: number, duration: number, immediate = false) => {
    // Never let one file's report replace another's that is still waiting to be committed.
    if (pendingRef.current && pendingRef.current.filePath !== filePath) commitPendingProgress();

    const report: ProgressReport = { filePath, currentTime, duration, at: Date.now() };
    pendingRef.current = report;
    writeJournal(report);

    if (immediate) {
      commitPendingProgress();
    } else if (commitTimerRef.current === null) {
      commitTimerRef.current = window.setTimeout(commitPendingProgress, PROGRESS_COMMIT_INTERVAL_MS);
    }
  }, [commitPendingProgress]);

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
             return trimHistory([newEntry, ...prev]);
          }
          return prev;
      }

      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        completed: isWatched,
        lastWatchedAt: Date.now(),
      };

      return trimHistory(updated);
    });
  }, []);

  const entriesByPath = useMemo(() => new Map(history.map(item => [item.filePath, item])), [history]);

  const getEntry = useCallback((filePath: string) => entriesByPath.get(filePath), [entriesByPath]);

  const checkWatchedStatus = useCallback(
    (filePath: string): boolean => entriesByPath.get(filePath)?.completed ?? false,
    [entriesByPath]
  );

  // Videos that are still inside a configured directory, most recent first.
  const libraryVideos = useMemo(() => {
    const roots = settings.directories.map(normalizePath);
    if (roots.length === 0) return [];
    return history.filter(item => {
      if (item.fileType !== 'video') return false;
      const path = normalizePath(item.filePath);
      return roots.some(root => path.startsWith(root));
    });
  }, [history, settings.directories]);

  const lastWatched = libraryVideos[0] ?? null;
  const continueWatching = useMemo(
    () => libraryVideos.filter(item => !item.completed).slice(0, MAX_CONTINUE_WATCHING),
    [libraryVideos]
  );

  const getLastWatched = useCallback(() => lastWatched, [lastWatched]);
  const getContinueWatching = useCallback(() => continueWatching, [continueWatching]);

  const clearHistory = useCallback(() => {
    if (commitTimerRef.current !== null) {
      window.clearTimeout(commitTimerRef.current);
      commitTimerRef.current = null;
    }
    pendingRef.current = null;
    writeJournal(null);
    setHistory([]);
  }, []);

  const contextValue = useMemo(() => ({
    history,
    addToHistory,
    updateProgress,
    getEntry,
    getLastWatched,
    getContinueWatching,
    clearHistory,
    toggleWatchedStatus,
    checkWatchedStatus,
  }), [history, addToHistory, updateProgress, getEntry, getLastWatched, getContinueWatching, clearHistory, toggleWatchedStatus, checkWatchedStatus]);

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
