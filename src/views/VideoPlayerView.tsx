import { useRef, useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { X, Play, Check, List, Folder } from 'lucide-react';
import { convertFileSrc } from '@tauri-apps/api/core';
import { FileEntry } from '../contexts/FilesContext';
import { useWatchHistory } from '../contexts/WatchHistoryContext';
import { useSettings } from '../contexts/SettingsContext';
import { cn } from "@/lib/utils";
import VideoControls from '../components/player/VideoControls';
import EpisodesList from '../components/player/EpisodesList';
import { useVideoShortcuts } from '../hooks/useVideoShortcuts';
import { useDiscordRPC } from '../hooks/useDiscordRPC';
import { useFolderSiblings } from '../hooks/useFolderSiblings';

interface VideoPlayerViewProps {
  file: FileEntry;
  onClose: () => void;
  onPlayFile: (file: FileEntry) => void;
  onNavigate?: (path: string) => void;
}

export default function VideoPlayerView({ file, onClose, onPlayFile, onNavigate }: VideoPlayerViewProps) {
  const { t } = useTranslation();
  const videoRef = useRef<HTMLVideoElement>(null);
  const previewVideoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const controlsTimeoutRef = useRef<number | null>(null);
  
  const { history, updateProgress, toggleWatchedStatus, checkWatchedStatus } = useWatchHistory();
  const { settings } = useSettings();
  
  const { siblings, isLoadingSiblings } = useFolderSiblings(file.path, 'video');
  
  const isWatched = checkWatchedStatus(file.path);

  // Player State
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1.0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [activeMenu, setActiveMenu] = useState<'main' | 'speed'>('main');
  const [showControls, setShowControls] = useState(true);
  const [showSidebar, setShowSidebar] = useState(true);

  // Preview Tooltip State
  const [previewTime, setPreviewTime] = useState<number | null>(null);
  const [previewLeft, setPreviewLeft] = useState<number>(0);

  // FMP4 Streaming State
  const initialOffset = (() => {
      const historyItem = history.find(h => h.filePath === file.path);
      return historyItem ? historyItem.currentTime : 0;
  })();
  const [streamOffset, setStreamOffset] = useState(initialOffset);
  const streamOffsetRef = useRef(initialOffset);
  const currentDurationRef = useRef(0);
  const lastKnownTimeRef = useRef(initialOffset);

  // Stabilized streamable handling

  const isStreamableFormat = (path: string) => {
      const lower = path.toLowerCase();
      // MKV and TS formats will hit the rust Axum server which runs ffmpeg behind the scenes
      // and converts the stream to fragmented MP4.
      return lower.endsWith('.ts') || lower.endsWith('.mkv');
  };

  // Video Logic
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let progressInterval: number;

    const setupStream = async () => {
        if (isStreamableFormat(file.path)) {
            try {
                // 1. Fetch exact duration natively parsed by ffprobe
                const response = await fetch(`http://127.0.0.1:8765/video-info?path=${encodeURIComponent(file.path)}`);
                const data = await response.json();
                if (data.duration) {
                    setDuration(data.duration);
                    currentDurationRef.current = data.duration;
                }
            } catch (error) {
                console.error("Failed to get video info:", error);
            }
        }
    };
    
    setupStream();

    const handleTimeUpdate = () => {
      let t = video.currentTime;
      if (isStreamableFormat(file.path)) {
          t += streamOffsetRef.current;
      }
      lastKnownTimeRef.current = t;
      setCurrentTime(t);
    };

    const handleLoadedMetadata = () => {
      if (!isStreamableFormat(file.path)) {
          if (video.duration && video.duration !== Infinity && !isNaN(video.duration)) {
              setDuration(video.duration);
              currentDurationRef.current = video.duration;
          }
      }
      
      
      progressInterval = window.setInterval(() => {
         let t = lastKnownTimeRef.current;
         if (t > 0) {
           updateProgress(file.path, t, currentDurationRef.current);
         }
       }, 5000);
    };

    if (video.readyState >= 1) {
        handleLoadedMetadata();
    } else {
        video.addEventListener('loadedmetadata', handleLoadedMetadata);
    }

    const handlePlayPause = () => setIsPlaying(!video.paused);
    const handleVolumeChange = () => {
        setVolume(video.volume);
        setIsMuted(video.muted);
    };
    const handleRateChange = () => setPlaybackRate(video.playbackRate);

    const handleEnded = () => {
      setIsPlaying(false);
      const d = currentDurationRef.current;
      updateProgress(file.path, d, d);
    };

    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('play', handlePlayPause);
    video.addEventListener('pause', handlePlayPause);
    video.addEventListener('volumechange', handleVolumeChange);
    video.addEventListener('ratechange', handleRateChange);
    video.addEventListener('ended', handleEnded);

    return () => {
      clearInterval(progressInterval);
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('play', handlePlayPause);
      video.removeEventListener('pause', handlePlayPause);
      video.removeEventListener('volumechange', handleVolumeChange);
      video.removeEventListener('ratechange', handleRateChange);
      video.removeEventListener('ended', handleEnded);
      
      let t = lastKnownTimeRef.current;
      if (t > 0) {
        updateProgress(file.path, t, currentDurationRef.current);
      }
      
      // Explicitly stop playback
      try {
        video.pause();
      } catch (e) {
        // Ignore errors on unmount
      }
    };
  }, [file.path, updateProgress]);

  // Restore time for non-streamable formats
  const lastRestoredPathRef = useRef<string | null>(null);

  useEffect(() => {
      if (lastRestoredPathRef.current === file.path) return;
      
      const playVideo = () => {
          if (videoRef.current) {
              const p = videoRef.current.play();
              if (p !== undefined) p.catch((e) => console.warn("Auto-play failed:", e));
          }
      };

      if (isStreamableFormat(file.path)) {
          playVideo();
          return; // natively handled by URL parameter
      }

      const historyItem = history.find(h => h.filePath === file.path);
      if (historyItem && videoRef.current) {
          lastRestoredPathRef.current = file.path;
          const restoreTime = () => {
             if (videoRef.current && !videoRef.current.played.length) { 
                 videoRef.current.currentTime = historyItem.currentTime;
                 playVideo();
             }
          }
          if (videoRef.current.readyState >= 1) {
              restoreTime();
          } else {
              videoRef.current.addEventListener('loadedmetadata', restoreTime, { once: true });
          }
      } else {
          playVideo();
      }
  }, [file.path, history]);
  const lastToggleRef = useRef<number>(0);

  const togglePlay = useCallback((e?: React.MouseEvent) => {
    if (e && e.stopPropagation) {
        e.stopPropagation();
    }
    
    // Previne duplo clic e surtos de play() cancelados pelo pause() seguinte
    const now = Date.now();
    if (now - lastToggleRef.current < 250) return;
    lastToggleRef.current = now;

    if (videoRef.current) {
        if (videoRef.current.paused) {
            const p = videoRef.current.play();
            if (p !== undefined) p.catch((e) => console.warn("Play failed:", e));
        }
        else videoRef.current.pause();
    }
  }, []);

  const handleSeek = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
      const time = parseFloat(e.target.value);
      if (isStreamableFormat(file.path)) {
          streamOffsetRef.current = time;
          setStreamOffset(time); // React will update `<video src>` to the exact timestamp
          if (videoRef.current) {
              setTimeout(() => {
                  if (videoRef.current) {
                      videoRef.current.load();
                      const p = videoRef.current.play();
                      if (p !== undefined) p.catch(() => {});
                  }
              }, 50);
          }
      } else {
          if (videoRef.current) {
              videoRef.current.currentTime = time;
          }
      }
      setCurrentTime(time);
  }, [file.path]);

  const skip = useCallback((seconds: number) => {
      if (videoRef.current) {
          let expectedTime = (isStreamableFormat(file.path) ? streamOffsetRef.current + videoRef.current.currentTime : videoRef.current.currentTime) + seconds;
          expectedTime = Math.max(0, expectedTime); // prevent negative seek
          if (isStreamableFormat(file.path)) {
              streamOffsetRef.current = expectedTime;
              setStreamOffset(expectedTime);
              setTimeout(() => {
                  if (videoRef.current) {
                      videoRef.current.load();
                      const p = videoRef.current.play();
                      if (p !== undefined) p.catch(() => {});
                  }
              }, 50);
          } else {
              videoRef.current.currentTime += seconds;
          }
      }
  }, [file.path]);

  // Keyboard shortcuts
  useVideoShortcuts({
    skip,
    togglePlay,
    videoSkipBackward: settings.videoSkipBackward,
    videoSkipForward: settings.videoSkipForward
  });

  const toggleMute = useCallback(() => {
      if (videoRef.current) {
          videoRef.current.muted = !videoRef.current.muted;
      }
  }, []);

  const changeVolume = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
      const val = parseFloat(e.target.value);
      if (videoRef.current) {
          videoRef.current.volume = val;
          videoRef.current.muted = val === 0;
      }
  }, []);

  const toggleFullscreen = useCallback(() => {
      if (!document.fullscreenElement) {
          containerRef.current?.requestFullscreen();
      } else {
          document.exitFullscreen();
      }
  }, []);

  useEffect(() => {
      const handleFullscreenChange = () => {
          setIsFullscreen(!!document.fullscreenElement);
      };

      document.addEventListener('fullscreenchange', handleFullscreenChange);
      return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const handleMouseMove = useCallback(() => {
      setShowControls(true);
      if (controlsTimeoutRef.current) window.clearTimeout(controlsTimeoutRef.current);
      if (isPlaying) {
          controlsTimeoutRef.current = window.setTimeout(() => setShowControls(false), 2000);
      }
  }, [isPlaying]);

  const handleMouseLeave = useCallback(() => {
      if (isPlaying) setShowControls(false);
  }, [isPlaying]);

  const handleToggleWatched = useCallback(() => {
      toggleWatchedStatus(file.path, !isWatched);
  }, [file.path, isWatched, toggleWatchedStatus]);

  const handleProgressMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const percentage = Math.max(0, Math.min(1, x / rect.width));
      const time = percentage * (duration || 0);
      
      setPreviewTime(time);
      
      const tooltipHalfWidth = 92; 
      const clampedX = Math.max(tooltipHalfWidth, Math.min(x, rect.width - tooltipHalfWidth));
      setPreviewLeft(clampedX);

      if (previewVideoRef.current) {
          previewVideoRef.current.currentTime = time;
      }
  }, [duration]);

  const handleProgressMouseLeave = useCallback(() => {
      setPreviewTime(null);
  }, []);

  const handlePlaybackRateChange = useCallback((rate: number) => {
      if (videoRef.current) {
          videoRef.current.playbackRate = rate;
          setPlaybackRate(rate);
      }
  }, []);

  // Discord Rich Presence Integration
  const startTs = isPlaying && videoRef.current 
    ? Math.floor(Date.now() / 1000) - Math.floor(videoRef.current.currentTime)
    : undefined;

  useDiscordRPC({
    activityState: isPlaying ? t('video.watching', 'Assistindo') : t('video.paused', 'Pausado'),
    details: file.name,
    startTimestamp: startTs
  });

  return (
    <motion.div 
      className={cn("fixed z-50 bg-background flex flex-col", isFullscreen ? "inset-0" : "inset-x-0 bottom-0 top-8")}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="absolute top-5 right-5 z-[60] pointer-events-auto bg-transparent p-0 block w-auto">
        <button 
          className="w-10 h-10 rounded-full flex items-center justify-center bg-black/60 border border-white/10 text-slate-200 cursor-pointer backdrop-blur-sm shadow-lg transition-all hover:bg-red-600/80 hover:text-white hover:scale-110 hover:border-red-600/50" 
          onClick={onClose} 
          title={t('video.close')}
        >
            <X size={24} />
        </button>
      </div>

      <div className={cn("grid h-full overflow-hidden", showSidebar ? "grid-cols-[1fr_400px]" : "grid-cols-1")}>
        {/* Main Player Area */}
        <div className="p-8 pr-16 bg-black relative flex flex-col justify-center overflow-y-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/10 hover:scrollbar-thumb-white/20">
          <div 
            className={cn(
              "w-full overflow-hidden relative flex items-center justify-center bg-black",
              isFullscreen ? "h-full rounded-none" : "aspect-video max-h-[80vh] rounded-2xl shadow-2xl border border-white/5"
            )}
            ref={containerRef}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            onClick={togglePlay}
            onDoubleClick={toggleFullscreen}
          >
            <video 
              key={file.path}
              ref={videoRef}
              className="w-full h-full object-contain"
              src={isStreamableFormat(file.path) 
                  ? `http://127.0.0.1:8765/play?path=${encodeURIComponent(file.path)}&start=${streamOffset}`
                  : convertFileSrc(file.path)}
            />
            
            {/* Play overlay when paused */}
            {!isPlaying && (
                <div 
                  className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-20 bg-black/40 backdrop-blur-sm rounded-full flex items-center justify-center cursor-pointer z-[5] transition-all border-2 border-white/10 hover:bg-primary/80 hover:scale-110" 
                  onClick={togglePlay}
                >
                    <Play size={64} fill="white" />
                </div>
            )}

            {/* Custom Controls Overlay */}
            <VideoControls 
                show={showControls}
                isPlaying={isPlaying}
                togglePlay={togglePlay}
                currentTime={currentTime}
                duration={duration}
                handleSeek={handleSeek}
                previewTime={previewTime}
                previewLeft={previewLeft}
                handleProgressMouseMove={handleProgressMouseMove}
                handleProgressMouseLeave={handleProgressMouseLeave}
                previewVideoRef={previewVideoRef}
                filePath={file.path}
                skip={skip}
                volume={volume}
                isMuted={isMuted}
                toggleMute={toggleMute}
                changeVolume={changeVolume}
                isFullscreen={isFullscreen}
                toggleFullscreen={toggleFullscreen}
                showSettingsMenu={showSettingsMenu}
                setShowSettingsMenu={setShowSettingsMenu}
                activeMenu={activeMenu}
                setActiveMenu={setActiveMenu}
                playbackRate={playbackRate}
                setPlaybackRate={setPlaybackRate}
                videoHeight={videoRef.current?.videoHeight}
                onPlaybackRateChange={handlePlaybackRateChange}
                isStreamableFormat={isStreamableFormat(file.path)}
            />
          </div>

          <div className="mt-6 flex justify-between items-start px-2">
            <div className="flex flex-col gap-1">
                <h1 className="text-2xl font-bold text-white tracking-tight">{file.name}</h1>
                <button 
                    className="text-sm text-slate-400 hover:text-primary hover:underline text-left transition-colors flex items-center gap-1"
                    onClick={() => {
                        if (onNavigate) {
                            const separator = file.path.includes('/') ? '/' : '\\';
                            const parentPath = file.path.substring(0, file.path.lastIndexOf(separator));
                            onNavigate(parentPath);
                            onClose();
                        }
                    }}
                >
                    <div className="flex items-center gap-1">
                        <Folder size={14} />
                        <span className="truncate max-w-md">{file.path}</span>
                    </div>
                </button>
            </div>
            
            <div className="flex gap-4">
                <button 
                    className={cn(
                        "flex items-center gap-2.5 px-5 py-2.5 rounded-xl border border-white/10 bg-white/5 text-slate-200 text-sm font-semibold transition-all hover:bg-white/10 hover:border-white/20 hover:text-white hover:-translate-y-0.5 hover:shadow-lg", 
                        isWatched && "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 hover:border-emerald-500/40 hover:text-emerald-300"
                    )}
                    onClick={handleToggleWatched}
                >
                    {isWatched ? <Check size={18} /> : <Check size={18} className="opacity-50" />}
                    <span>{isWatched ? t('video.watched') : t('video.mark_as_watched')}</span>
                </button>
                
                <button 
                    className={cn(
                        "flex items-center gap-2.5 px-5 py-2.5 rounded-xl border border-white/10 bg-white/5 text-slate-200 text-sm font-semibold transition-all hover:bg-white/10 hover:border-white/20 hover:text-white hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/5",
                        showSidebar && "bg-primary/10 border-primary/30 text-primary-300 shadow-lg shadow-primary/5"
                    )}
                    onClick={() => setShowSidebar(!showSidebar)}
                >
                    <List size={18} />
                    <span>{t('video.episodes')}</span>
                </button>
            </div>
          </div>
        </div>

        {/* Sidebar - Episodes */}
        {showSidebar && (
            <EpisodesList 
                siblings={siblings}
                isLoading={isLoadingSiblings}
                currentFile={file}
                onPlayFile={onPlayFile}
                checkWatchedStatus={checkWatchedStatus}
            />
        )}
      </div>
    </motion.div>
  );
}
