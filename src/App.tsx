import { useState } from "react";

import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from "framer-motion";
import { SettingsProvider, useSettings } from "./contexts/SettingsContext";
import { WatchHistoryProvider, useWatchHistory } from "./contexts/WatchHistoryContext";
import { FilesProvider, useFiles, FileEntry } from "./contexts/FilesContext";
import Settings from "./views/SettingsView";
import AllFilesView from "./views/AllFilesView";

import FileBrowserView from "./views/FileBrowserView";
import ContinueWatchingView from "./views/ContinueWatchingView";

import VideoPlayerView from "./views/VideoPlayerView";
import DocumentViewer from "./views/DocumentViewer";
import HomeView from "./views/HomeView";
import Sidebar from "./components/Sidebar";



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
  
  useSettings();
  const { addToHistory, getLastWatched } = useWatchHistory();


  // Get last watched video
  const lastWatched = getLastWatched();

  function openFile(file: FileEntry) {
    setPlayingFile(file);
    // Add to watch history when opening a file
    addToHistory({
      filePath: file.path,
      fileName: file.name,
      fileType: file.file_type,
      currentTime: 0,
      duration: 0,
      completed: false,
    });
  }

  function closePlayer() {
    setPlayingFile(null);
  }

  function openDirectorySettings() {
    setActiveNav("configuracoes");
    setShowSettings(true);
  }

  function navigateToDirectory(path: string | null) {
    if (path === null) {
       // Sidebar click or explicit reset
       setPreviousTab(null);
       setBrowserRoot(null);
       setBrowserPath(null);
       setActiveNav("diretorios");
       setShowSettings(false);
       return;
    }

    // If we are in "arquivos" tab, stay there
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
  }

  function handleBrowserNavigate(path: string | null) {
    if (path === null && previousTab) {
      setActiveNav(previousTab);
      setPreviousTab(null);
      setBrowserPath(null);
      setBrowserRoot(null);
    } else {
      setBrowserPath(path);
    }
  }

  function navigateToType(type: 'video' | 'document' | null) {
    setFileTypeFilter(type);
    setActiveNav("arquivos");
    setShowSettings(false);
  }



  // Get recent files (last 3)
  const recentFiles = files.slice(0, 3);

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
    <div className="flex h-screen w-screen bg-background text-foreground overflow-hidden">
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
        />
      )}

      {/* Main Content - Hide if playing video (or keep it but hidden to avoid unmounting if expensive? No, unmount is cleaner for now or use styles) */}
      {/* Actually, if we hide sidebar, we want VideoPlayerView to take full width. VideoPlayerView is fixed and 100vw, so it covers main content anyway. 
          But hiding sidebar ensures no weird z-index bleeding or pointer events if any. 
      */}
      {!isPlayingVideo && (
      <main className="flex-1 overflow-y-auto overflow-x-hidden bg-background relative">
        <AnimatePresence mode="wait">
          {showSettings ? (
            <motion.div
              key="settings"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              <Settings onClose={() => {
                setShowSettings(false);
                setActiveNav("inicio");
              }} />
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
      </main>
      )}

      {/* Video Player Overlay */}
      <AnimatePresence>
        {playingFile && (
          // Using new VideoPlayerView for videos, but keeping fallback for documents if needed or wrapping matches
          playingFile.file_type === 'video' ? (
             <VideoPlayerView 
                key="video-player"
                file={playingFile} 
                onClose={closePlayer} 
                onPlayFile={openFile}
                onNavigate={(path) => {
                     // If navigating via breadcrumbs in player, maybe just close player and navigate browser?
                     // Or navigate within player Context? 
                     // Valid decision: Close player and navigate app to that path
                     closePlayer();
                     handleBrowserNavigate(path); 
                     // Also switch tab to files/browser
                     setActiveNav('arquivos');
                     setBrowserPath(path);
                     if (path) {
                       setBrowserPath(path);
                       // Find if this path belongs to a registered directory
                       const normalize = (p: string) => p.toLowerCase().replace(/[\\/]/g, '/');
                       
                       const sortedDirs = [...directories].sort((a, b) => b.path.length - a.path.length);
                       const matchedRoot = sortedDirs.find(dir => {
                           const normPath = normalize(path);
                           const normDir = normalize(dir.path);
                           return normPath.startsWith(normDir);
                       });
                       
                       setBrowserRoot(matchedRoot ? matchedRoot.path : path);
                     }
                }}
             />
          ) : (
             // Simple PDF viewer fallback (keeping existing style for now, or wrapping)
             <DocumentViewer 
                key="doc-viewer"
                file={playingFile}
                onClose={closePlayer}
                onOpenFile={openFile}
                onNavigate={(path) => {
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
                }}
             />
          )
        )}
      </AnimatePresence>
    </div>
  );
}

function App() {
  return (
    <SettingsProvider>
      <WatchHistoryProvider>
        <FilesProvider>
          <AppContent />
        </FilesProvider>
      </WatchHistoryProvider>
    </SettingsProvider>
  );
}

export default App;
