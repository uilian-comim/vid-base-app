import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import i18n from '../utils/i18n';
import { getCurrentWindow, LogicalSize } from '@tauri-apps/api/window';
import { Store } from '@tauri-apps/plugin-store';
import { documentDir, join } from '@tauri-apps/api/path';
import { exists, mkdir } from '@tauri-apps/plugin-fs';

interface Resolution {
  width: number;
  height: number;
  label: string;
}

export const AVAILABLE_RESOLUTIONS: Resolution[] = [
  { width: 1024, height: 768, label: '1024x768 (4:3)' },
  { width: 1280, height: 720, label: '1280x720 (HD)' },
  { width: 1280, height: 800, label: '1280x800 (WXGA)' },
  { width: 1366, height: 768, label: '1366x768 (HD)' },
  { width: 1920, height: 1080, label: '1920x1080 (Full HD)' },
  { width: 2560, height: 1440, label: '2560x1440 (2K)' },
];

export type Theme = 'light' | 'dark';
export type Language = 'pt-BR' | 'en' | 'es';

interface AppSettings {
  theme: Theme;
  language: Language;
  resolution: Resolution;
  videoSkipBackward: number; // in seconds
  videoSkipForward: number; // in seconds
  directories: string[];
  groupByRoot: boolean;
  viewMode: 'grid' | 'list';
}

const DEFAULT_SETTINGS: AppSettings = {
  theme: 'light',
  language: 'pt-BR',
  resolution: AVAILABLE_RESOLUTIONS[2], // 1280x800
  videoSkipBackward: 10,
  videoSkipForward: 10,
  directories: [],
  groupByRoot: false,
  viewMode: 'grid',
};

interface SettingsContextType {
  settings: AppSettings;
  updateTheme: (theme: Theme) => void;
  updateLanguage: (language: Language) => void;
  updateResolution: (resolution: Resolution) => Promise<void>;
  updateVideoSkipBackward: (seconds: number) => void;
  updateVideoSkipForward: (seconds: number) => void;
  updateGroupByRoot: (enabled: boolean) => void;
  updateViewMode: (mode: 'grid' | 'list') => void;
  addDirectory: (path: string) => void;
  removeDirectory: (path: string) => void;
  clearAllDirectories: () => void;
  resetSettings: () => Promise<void>;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

// Create a persistent store that saves to Documents/vidbase folder
let store: Store | null = null;

async function getStore(): Promise<Store> {
  if (!store) {
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
      const storePath = await join(vidbasePath, 'settings.json');
      store = await Store.load(storePath);
    } catch (error) {
      console.error('Failed to initialize store:', error);
      // Fallback to default store location
      store = await Store.load('settings.json');
    }
  }
  return store;
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load settings from Tauri Store on mount
  useEffect(() => {
    async function loadSettings() {
      try {
        const storeInstance = await getStore();
        const stored = await storeInstance.get<AppSettings>('settings');
        
        if (stored) {
          setSettings({ ...DEFAULT_SETTINGS, ...stored });
        }
      } catch (error) {
        console.error('Failed to load settings:', error);
      } finally {
        setIsLoaded(true);
      }
    }
    
    loadSettings();
  }, []);

  // Save settings to Tauri Store whenever they change
  useEffect(() => {
    if (!isLoaded) return; // Don't save during initial load
    
    async function saveSettings() {
      try {
        const storeInstance = await getStore();
        await storeInstance.set('settings', settings);
        await storeInstance.save(); // Persist to disk
      } catch (error) {
        console.error('Failed to save settings:', error);
      }
    }
    
    saveSettings();
  }, [settings, isLoaded]);

  // Apply theme
  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(settings.theme);
    root.setAttribute('data-theme', settings.theme);
  }, [settings.theme]);

  // Apply language
  useEffect(() => {
    i18n.changeLanguage(settings.language);
  }, [settings.language]);

  const updateTheme = (theme: Theme) => {
    setSettings(prev => ({ ...prev, theme }));
  };

  const updateLanguage = (language: Language) => {
    setSettings(prev => ({ ...prev, language }));
  };

  const updateResolution = async (resolution: Resolution) => {
    try {
      const appWindow = getCurrentWindow();
      const size = new LogicalSize(resolution.width, resolution.height);
      await appWindow.setSize(size);
      setSettings(prev => ({ ...prev, resolution }));
    } catch (error) {
      console.error('Failed to update resolution:', error);
    }
  };

  const updateVideoSkipBackward = (seconds: number) => {
    setSettings(prev => ({ ...prev, videoSkipBackward: seconds }));
  };

  const updateVideoSkipForward = (seconds: number) => {
    setSettings(prev => ({ ...prev, videoSkipForward: seconds }));
  };

  const updateGroupByRoot = (enabled: boolean) => {
    setSettings(prev => ({ ...prev, groupByRoot: enabled }));
  };

  const updateViewMode = (mode: 'grid' | 'list') => {
    setSettings(prev => ({ ...prev, viewMode: mode }));
  };

  const addDirectory = (path: string) => {
    setSettings(prev => ({
      ...prev,
      directories: prev.directories.includes(path) 
        ? prev.directories 
        : [...prev.directories, path]
    }));
  };

  const removeDirectory = (path: string) => {
    setSettings(prev => ({
      ...prev,
      directories: prev.directories.filter(d => d !== path)
    }));
  };

  const clearAllDirectories = () => {
    setSettings(prev => ({ ...prev, directories: [] }));
  };

  const resetSettings = async () => {
    setSettings(DEFAULT_SETTINGS);
    await updateResolution(DEFAULT_SETTINGS.resolution);
  };

  return (
    <SettingsContext.Provider
      value={{
        settings,
        updateTheme,
        updateLanguage,
        updateResolution,
        updateVideoSkipBackward,
        updateVideoSkipForward,
        updateGroupByRoot,
        updateViewMode,
        addDirectory,
        removeDirectory,
        clearAllDirectories,
        resetSettings,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}
