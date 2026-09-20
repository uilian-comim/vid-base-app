import { useState, lazy, Suspense, useCallback, useEffect } from "react";

import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from "framer-motion";
import { SettingsProvider, useSettings } from "./contexts/SettingsContext";
import { invoke } from '@tauri-apps/api/core';
import { WatchHistoryProvider, useWatchHistory } from "./contexts/WatchHistoryContext";
import { FilesProvider, useFiles, FileEntry } from "./contexts/FilesContext";
import { ToastProvider, useToast } from "./contexts/ToastContext";
import { check } from "@tauri-apps/plugin-updater";
import Sidebar from "./components/layout/Sidebar/Sidebar";
import Titlebar from "./components/Titlebar";
import CommandPalette from "./components/CommandPalette";

// Lazy Loaded Views
const Settings = lazy(() => import("./views/SettingsView"));
const AllFilesView = lazy(() => import("./views/AllFilesView"));
const FileBrowserView = lazy(() => import("./views/FileBrowserView"));
const ContinueWatchingView = lazy(() => import("./views/ContinueWatchingView"));
const VideoPlayerView = lazy(() => import("./views/VideoPlayerView"));
const DocumentViewer = lazy(() => import("./views/DocumentViewer"));
const HomeView = lazy(() => import("./views/HomeView"));

// Loading Fallback
const ViewLoader = () => (
  <div className="w-full h-full flex items-center justify-center">
    <div className="w-9 h-9 border-[3px] border-primary/20 border-t-primary rounded-full animate-spin" />
  </div>
);



function AppContent() {
  const { t } = useTranslation();
  const { files, directories, isLoading } = useFiles();
  const [playingFile, setPlayingFile] = useState<FileEntry | null>(null);
  const [activeNav, setActiveNav] = useState("inicio");
  const [previousTab, setPreviousTab] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [browserPath, setBrowserPath] = useState<string | null>(null);
  const [browserRoot, setBrowserRoot] = useState<string | null>(null); // New state to track the entry point
  const [fileTypeFilter, setFileTypeFilter] = useState<'video' | 'document' | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  
  const { settings } = useSettings();
  const { addToHistory, getLastWatched } = useWatchHistory();
  const { showToast } = useToast();

  // Silent update check on startup
  useEffect(() => {
    check()
      .then((update) => {
        if (update) showToast(t('settings.update_toast', { version: update.version }), 'info');
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Global Discord RPC cleanup when the feature is disabled
  useEffect(() => {
    if (!settings.enableDiscordRichPresence) {
      invoke('clear_discord_activity').catch(() => {});
    }
  }, [settings.enableDiscordRichPresence]);


  // Global Cmd/Ctrl+K opens the command palette
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Get last watched video
  const lastWatched = getLastWatched();

  const openFile = useCallback((file: FileEntry) => {
    setPlayingFile(file);
    setTimeout(() => {
        addToHistory({
          filePath: file.path,
          fileName: file.name,
          fileType: file.file_type,
          currentTime: 0,
          duration: 0,
          completed: false,
        });
    }, 50);
  }, [addToHistory]);

  const closePlayer = useCallback(() => {
    setPlayingFile(null);
  }, []);

  const openDirectorySettings = useCallback(() => {
    setActiveNav("configuracoes");
    setShowSettings(true);
  }, []);

  const navigateToDirectory = useCallback((path: string | null) => {
    if (path === null) {
       setPreviousTab(null);
       setBrowserRoot(null);
       setBrowserPath(null);
       setActiveNav("diretorios");
       setShowSettings(false);
       return;
    }

    if (activeNav === "arquivos") {
        setBrowserRoot(path);
        setBrowserPath(path);
        setShowSettings(false);
        return;
    }
    
    if (activeNav !== "diretorios") {
      setPreviousTab(activeNav);
      setBrowserRoot(path);
    }
    setBrowserPath(path);
    setActiveNav("diretorios");
    setShowSettings(false);
  }, [activeNav]);

  const handleBrowserNavigate = useCallback((path: string | null) => {
    if (path === null && previousTab) {
      setActiveNav(previousTab);
      setPreviousTab(null);
      setBrowserPath(null);
      setBrowserRoot(null);
    } else {
      setBrowserPath(path);
    }
  }, [previousTab]);

  const navigateToType = useCallback((type: 'video' | 'document' | null) => {
    setFileTypeFilter(type);
    setActiveNav("arquivos");
    setShowSettings(false);
  }, []);

  const handleCloseSettings = useCallback(() => {
    setShowSettings(false);
    setActiveNav("inicio");
  }, []);

  const handlePlayerNavigate = useCallback((path: string) => {
    closePlayer();
    handleBrowserNavigate(path); 
    setActiveNav('arquivos');
    setBrowserPath(path);
    if (path) {
      setBrowserPath(path);
      const normalize = (p: string) => p.toLowerCase().replace(/[\\/]/g, '/');
      
      const sortedDirs = [...directories].sort((a, b) => b.path.length - a.path.length);
      const matchedRoot = sortedDirs.find(dir => {
          const normPath = normalize(path);
          const normDir = normalize(dir.path);
          return normPath.startsWith(normDir);
      });
      
      setBrowserRoot(matchedRoot ? matchedRoot.path : path);
    }
  }, [closePlayer, handleBrowserNavigate, directories]);



  const paletteNav = useCallback((target: 'inicio' | 'continuar' | 'arquivos' | 'video' | 'document' | 'settings') => {
    closePlayer();
    if (target === 'settings') {
      setActiveNav('configuracoes');
      setShowSettings(true);
      return;
    }
    setShowSettings(false);
    setBrowserPath('');
    if (target === 'video' || target === 'document') {
      setFileTypeFilter(target);
      setActiveNav('arquivos');
    } else {
      setFileTypeFilter(null);
      setActiveNav(target);
    }
  }, [closePlayer]);

  // Get recent files (last 6)
  const recentFiles = files.slice(0, 6);

  // Count files by type
  const videoCount = files.filter(f => f.file_type === "video").length;
  const documentCount = files.filter(f => f.file_type === "document").length;

  // Filter files for AllFilesView
  const displayedFiles = fileTypeFilter 
    ? files.filter(f => f.file_type === fileTypeFilter)
    : files;

  // Determine if we are playing a video
  const isPlayingVideo = playingFile && playingFile.file_type === 'video';

  return (
    <div className="flex flex-col h-screen w-screen bg-sidebar text-foreground overflow-hidden">
      <Titlebar />
      <div className="flex flex-1 h-full w-full overflow-hidden relative">
        {/* Sidebar - Hide if playing video */}
        {!isPlayingVideo && (
          <Sidebar 
            activeNav={activeNav}
            setActiveNav={setActiveNav}
          showSettings={showSettings}
          setShowSettings={setShowSettings}
          browserPath={browserPath}
          setBrowserPath={setBrowserPath}
          fileTypeFilter={fileTypeFilter}
          setFileTypeFilter={setFileTypeFilter}
          videoCount={videoCount}
          documentCount={documentCount}
          directories={directories}
          filesCount={files.length}
          navigateToDirectory={navigateToDirectory}
          onOpenSearch={() => setPaletteOpen(true)}
        />
      )}

      {/* Main Content - Hide if playing video */}
      {!isPlayingVideo && (
      <main className="flex-1 overflow-y-auto overflow-x-hidden bg-background relative rounded-tl-[20px] border-t border-l border-foreground/10 shadow-[0_0_40px_-10px_hsl(var(--shadow-color)/0.4)]">
        <Suspense fallback={<ViewLoader />}>
          <AnimatePresence mode="wait">
          {showSettings ? (
            <motion.div
              key="settings"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              <Settings onClose={handleCloseSettings} />
            </motion.div>
          ) : activeNav === "continuar" ? (
            <motion.div
              key="continue"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              <ContinueWatchingView onFileClick={openFile} />
            </motion.div>
          ) : activeNav === "arquivos" ? (
            browserPath ? (
              <FileBrowserView 
                key="browser-files"
                directories={directories}
                onFileClick={openFile}
                onAddDirectory={openDirectorySettings}
                currentPath={browserPath}
                onNavigate={handleBrowserNavigate}
                customRoot={browserRoot}
                fileTypeFilter={fileTypeFilter}
              />
            ) : (
              <AllFilesView 
                key="all-files"
                files={displayedFiles}
                onAddDirectory={openDirectorySettings}
                title={fileTypeFilter === 'video' ? t('all_files.videos') : fileTypeFilter === 'document' ? t('all_files.documents') : t('all_files.title')}
                onDirectoryClick={navigateToDirectory}
              />
            )
          ) : activeNav === "diretorios" ? (
            <FileBrowserView 
              key="browser-dirs"
              directories={directories}
              onFileClick={openFile}
              onAddDirectory={openDirectorySettings}
              currentPath={browserPath}
              onNavigate={handleBrowserNavigate}
              customRoot={browserRoot}
              fileTypeFilter={fileTypeFilter}
            />
          ) : (
            <HomeView 
              key="home"
              lastWatched={lastWatched}
              recentFiles={recentFiles}
              directories={directories}
              isLoading={isLoading}
              videoCount={videoCount}
              documentCount={documentCount}
              onOpenFile={openFile}
              onNavigateDirectory={navigateToDirectory}
              onNavigateType={navigateToType}
              onAddDirectory={openDirectorySettings}
            />
          )}
        </AnimatePresence>
        </Suspense>
      </main>
      )}

      {/* Video Player Overlay */}
      <Suspense fallback={<ViewLoader />}>
        <AnimatePresence mode="wait">
        {playingFile && (
          // Using new VideoPlayerView for videos, but keeping fallback for documents if needed or wrapping matches
          playingFile.file_type === 'video' ? (
             <VideoPlayerView 
                key={playingFile.path}
                file={playingFile} 
                onClose={closePlayer} 
                onPlayFile={openFile}
                onNavigate={handlePlayerNavigate}
             />
          ) : (
             // Simple PDF viewer fallback (keeping existing style for now, or wrapping)
             <DocumentViewer 
                key="doc-viewer"
                file={playingFile}
                onClose={closePlayer}
                onOpenFile={openFile}
                onNavigate={handlePlayerNavigate}
             />
          )
        )}
        </AnimatePresence>
      </Suspense>
      </div>
      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        files={files}
        directories={directories}
        onOpenFile={openFile}
        onOpenDirectory={navigateToDirectory}
        onNav={paletteNav}
      />
    </div>
  );
}

function App() {
  return (
    <ToastProvider>
      <SettingsProvider>
        <WatchHistoryProvider>
          <FilesProvider>
            <AppContent />
          </FilesProvider>
        </WatchHistoryProvider>
      </SettingsProvider>
    </ToastProvider>
  );
}

export default App;
