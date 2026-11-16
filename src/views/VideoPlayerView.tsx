import { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { X, Play, Check, List, Folder, AlertTriangle } from 'lucide-react';
import { FileEntry } from '../contexts/FilesContext';
import { useWatchHistory } from '../contexts/WatchHistoryContext';
import { useSettings } from '../contexts/SettingsContext';
import { cn } from "@/lib/utils";
import VideoControls from '../components/player/VideoControls';
import { type PlayerMenu, PLAYBACK_RATES } from '../components/player/PlayerSettingsMenu';
import { languageName, type AudioStreamInfo, type SubtitleTrackInfo } from '../lib/mediaServer';
import LoadingSpinner from '../components/LoadingSpinner';
import EpisodesList from '../components/player/EpisodesList';
import { useVideoShortcuts } from '../hooks/useVideoShortcuts';
import { useDiscordRPC } from '../hooks/useDiscordRPC';
import { useFolderSiblings } from '../hooks/useFolderSiblings';
import { useMediaPlayback } from '../hooks/useMediaPlayback';
import { useSubtitles } from '../hooks/useSubtitles';
import { getCurrentWindow } from '@tauri-apps/api/window';

// Shared empty lists, so "no tracks yet" doesn't look like a prop change on every render.
const NO_AUDIO_TRACKS: AudioStreamInfo[] = [];
const NO_SUBTITLE_TRACKS: SubtitleTrackInfo[] = [];

interface VideoPlayerViewProps {
  file: FileEntry;
  onClose: () => void;
  onPlayFile: (file: FileEntry) => void;
  onNavigate?: (path: string) => void;
}

export default function VideoPlayerView({ file, onClose, onPlayFile, onNavigate }: VideoPlayerViewProps) {
  const { t, i18n } = useTranslation();
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const controlsTimeoutRef = useRef<number | null>(null);
  
  const { getEntry, updateProgress, toggleWatchedStatus, checkWatchedStatus } = useWatchHistory();
  const { settings } = useSettings();
  
  const { siblings, isLoadingSiblings } = useFolderSiblings(file.path, 'video');
  
  const isWatched = checkWatchedStatus(file.path);

  const currentIndex = useMemo(() => siblings.findIndex((s) => s.path === file.path), [siblings, file.path]);
  const previousEpisode = currentIndex > 0 ? siblings[currentIndex - 1] : undefined;
  const nextEpisode = currentIndex === -1 ? undefined : siblings[currentIndex + 1];

  // Player State
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1.0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [activeMenu, setActiveMenu] = useState<PlayerMenu>('main');
  const [showControls, setShowControls] = useState(true);
  const [showSidebar, setShowSidebar] = useState(true);

  const [isBuffering, setIsBuffering] = useState(false);

  const initialTime = useMemo(
    () => getEntry(file.path)?.currentTime ?? 0,
    // Only the position at open time matters; later history updates come from this player.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [file.path]
  );
  const currentDurationRef = useRef(0);
  const lastKnownTimeRef = useRef(initialTime);

  // Native playback when the webview supports the file, otherwise HLS from the local ffmpeg server.
  const playback = useMediaPlayback({ videoRef, filePath: file.path, startTime: initialTime });
  const subtitles = useSubtitles(videoRef, playback.info);

  // Video Logic
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let progressInterval: number | undefined;

    // Kept in a ref only: the seek bar tracks the position itself, so playback doesn't
    // re-render this whole view several times per second.
    const handleTimeUpdate = () => {
      lastKnownTimeRef.current = video.currentTime;
    };

    // Committed right away at natural stopping points; the periodic reports in between
    // are batched by the history context.
    const saveProgressNow = () => {
      const t = lastKnownTimeRef.current;
      if (t > 0) updateProgress(file.path, t, currentDurationRef.current, true);
    };

    const handleDurationChange = () => {
      if (Number.isFinite(video.duration) && video.duration > 0) {
        setDuration(video.duration);
        currentDurationRef.current = video.duration;
      }
    };

    const handleLoadedMetadata = () => {
      handleDurationChange();
      if (progressInterval === undefined) {
        progressInterval = window.setInterval(() => {
          const t = lastKnownTimeRef.current;
          if (t > 0) {
            updateProgress(file.path, t, currentDurationRef.current);
          }
        }, 5000);
      }
    };

    const handlePlayPause = () => {
      setIsPlaying(!video.paused);
      if (video.paused && !video.ended) saveProgressNow();
    };
    const handleVolumeChange = () => {
        setVolume(video.volume);
        setIsMuted(video.muted);
    };
    const handleRateChange = () => setPlaybackRate(video.playbackRate);
    const handleWaiting = () => setIsBuffering(true);
    const handleResume = () => setIsBuffering(false);

    const handleEnded = () => {
      setIsPlaying(false);
      const d = currentDurationRef.current;
      updateProgress(file.path, d, d, true);
    };

    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('durationchange', handleDurationChange);
    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('play', handlePlayPause);
    video.addEventListener('pause', handlePlayPause);
    video.addEventListener('volumechange', handleVolumeChange);
    video.addEventListener('ratechange', handleRateChange);
    video.addEventListener('ended', handleEnded);
    video.addEventListener('waiting', handleWaiting);
    video.addEventListener('playing', handleResume);
    video.addEventListener('seeked', handleResume);

    return () => {
      clearInterval(progressInterval);
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('durationchange', handleDurationChange);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('play', handlePlayPause);
      video.removeEventListener('pause', handlePlayPause);
      video.removeEventListener('volumechange', handleVolumeChange);
      video.removeEventListener('ratechange', handleRateChange);
      video.removeEventListener('ended', handleEnded);
      video.removeEventListener('waiting', handleWaiting);
      video.removeEventListener('playing', handleResume);
      video.removeEventListener('seeked', handleResume);

      saveProgressNow();

      // Explicitly stop playback
      try {
        video.pause();
      } catch (e) {
        // Ignore errors on unmount
      }
    };
  }, [file.path, updateProgress]);

  // The server knows the exact duration before the first segment arrives.
  useEffect(() => {
    if (playback.info?.duration && !currentDurationRef.current) {
      setDuration(playback.info.duration);
      currentDurationRef.current = playback.info.duration;
    }
  }, [playback.info]);

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

  const skip = useCallback((seconds: number) => {
      const video = videoRef.current;
      if (!video) return;
      const end = Number.isFinite(video.duration) ? video.duration : currentDurationRef.current;
      video.currentTime = Math.max(0, Math.min(video.currentTime + seconds, end || Infinity));
  }, []);

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

  // The webview's element Fullscreen API is unavailable (macOS) or only fills the window
  // (Windows), so fullscreen is the Tauri window going fullscreen with the player covering it.
  const isFullscreenRef = useRef(false);
  // Whether the window was already fullscreen (e.g. via the OS) before the player took it over;
  // leaving player fullscreen then keeps the window as the user had it.
  const windowWasFullscreenRef = useRef(false);

  const setPlayerFullscreen = useCallback(async (next: boolean) => {
      const appWindow = getCurrentWindow();
      try {
          if (next) {
              windowWasFullscreenRef.current = await appWindow.isFullscreen();
              if (!windowWasFullscreenRef.current) await appWindow.setFullscreen(true);
          } else if (!windowWasFullscreenRef.current) {
              await appWindow.setFullscreen(false);
          }
          isFullscreenRef.current = next;
          setIsFullscreen(next);
      } catch (e) {
          console.error('Failed to toggle fullscreen:', e);
      }
  }, []);

  const toggleFullscreen = useCallback(() => {
      setPlayerFullscreen(!isFullscreenRef.current);
  }, [setPlayerFullscreen]);

  useEffect(() => {
      const appWindow = getCurrentWindow();
      // Leaving fullscreen through the OS (green button, Ctrl+Cmd+F) must restore the player layout.
      const unlistenPromise = appWindow.onResized(async () => {
          if (isFullscreenRef.current && !windowWasFullscreenRef.current && !(await appWindow.isFullscreen())) {
              isFullscreenRef.current = false;
              setIsFullscreen(false);
          }
      });
      return () => {
          unlistenPromise.then((unlisten) => unlisten());
          // Closing the player must not leave the library stuck in fullscreen.
          if (isFullscreenRef.current && !windowWasFullscreenRef.current) {
              appWindow.setFullscreen(false).catch(() => {});
          }
      };
  }, []);

  // Brief on-screen feedback for keyboard actions (volume, speed, subtitles...).
  const [osd, setOsd] = useState<{ text: string; id: number } | null>(null);
  const osdTimeoutRef = useRef<number | null>(null);
  const showOsd = useCallback((text: string) => {
      setOsd({ text, id: Date.now() });
      if (osdTimeoutRef.current) window.clearTimeout(osdTimeoutRef.current);
      osdTimeoutRef.current = window.setTimeout(() => setOsd(null), 900);
  }, []);
  useEffect(() => () => {
      if (osdTimeoutRef.current) window.clearTimeout(osdTimeoutRef.current);
  }, []);

  // Keyboard shortcuts
  useVideoShortcuts({
    videoSkipBackward: settings.videoSkipBackward,
    videoSkipForward: settings.videoSkipForward,
    isFullscreen,
    togglePlay,
    toggleFullscreen,
    skip: (seconds) => {
        skip(seconds);
        showOsd(`${seconds > 0 ? '+' : '−'}${Math.abs(seconds)}s`);
    },
    seekToFraction: (fraction) => {
        const video = videoRef.current;
        if (!video) return;
        const end = Number.isFinite(video.duration) ? video.duration : currentDurationRef.current;
        if (end) video.currentTime = Math.max(0, Math.min(fraction * end, end - 0.1));
    },
    changeVolume: (delta) => {
        const video = videoRef.current;
        if (!video) return;
        const next = Math.round(Math.max(0, Math.min(1, (video.muted ? 0 : video.volume) + delta)) * 100) / 100;
        video.volume = next;
        video.muted = next === 0;
        showOsd(next === 0 ? t('video.muted') : `${Math.round(next * 100)}%`);
    },
    toggleMute: () => {
        const video = videoRef.current;
        if (!video) return;
        video.muted = !video.muted;
        showOsd(video.muted ? t('video.muted') : `${Math.round(video.volume * 100)}%`);
    },
    changeSpeed: (direction) => {
        const current = videoRef.current?.playbackRate ?? 1;
        const index = PLAYBACK_RATES.findIndex((r) => r >= current);
        const from = index === -1 ? PLAYBACK_RATES.length - 1 : index;
        const rate = PLAYBACK_RATES[Math.max(0, Math.min(PLAYBACK_RATES.length - 1, from + direction))];
        handlePlaybackRateChange(rate);
        showOsd(rate === 1 ? t('video.normal') : `${rate}x`);
    },
    toggleSubtitles: () => {
        const tracks = playback.info?.subtitles ?? [];
        if (tracks.length === 0) {
            showOsd(t('video.no_subtitles'));
        } else if (subtitles.selectedId) {
            subtitles.setSelectedId(null);
            showOsd(`${t('video.subtitles')}: ${t('video.off')}`);
        } else {
            const track = tracks.find((s) => s.default) ?? tracks[0];
            subtitles.setSelectedId(track.id);
            const label = track.title ?? languageName(track.language, i18n.language) ?? t('video.track', { number: tracks.indexOf(track) + 1 });
            showOsd(`${t('video.subtitles')}: ${label}`);
        }
    },
    playAdjacent: (direction) => {
        const target = direction === 1 ? nextEpisode : previousEpisode;
        if (target) onPlayFile(target);
    },
  });

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

  const handleCopyPath = useCallback((path: string) => {
      navigator.clipboard.writeText(path)
          .then(() => showOsd(t('video.path_copied')))
          .catch((e) => console.error('Failed to copy path:', e));
  }, [showOsd, t]);

  // Stable identities, so the memoized controls only re-render when something they show changes.
  const playPreviousEpisode = useMemo(
    () => (previousEpisode ? () => onPlayFile(previousEpisode) : undefined),
    [previousEpisode, onPlayFile]
  );
  const playNextEpisode = useMemo(
    () => (nextEpisode ? () => onPlayFile(nextEpisode) : undefined),
    [nextEpisode, onPlayFile]
  );

  const handlePlaybackRateChange = useCallback((rate: number) => {
      if (videoRef.current) {
          videoRef.current.playbackRate = rate;
          setPlaybackRate(rate);
      }
  }, []);

  // Discord Rich Presence Integration
  // Only recomputed when playback starts/stops, otherwise the changing value would
  // re-trigger the presence update on every render and hit Discord's rate limit.
  const startTs = useMemo(
    () => isPlaying && videoRef.current
      ? Math.floor(Date.now() / 1000) - Math.floor(videoRef.current.currentTime)
      : undefined,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isPlaying]
  );

  useDiscordRPC({
    activityState: isPlaying ? t('video.watching', 'Assistindo') : t('video.paused', 'Pausado'),
    details: file.name,
    startTimestamp: startTs
  });

  return (
    <motion.div 
      className={cn("dark fixed z-50 bg-background text-foreground flex flex-col", isFullscreen ? "inset-0" : "inset-x-0 bottom-0 top-9")}
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
              isFullscreen ? "fixed inset-0 z-[70] rounded-none" : "aspect-video max-h-[80vh] rounded-2xl shadow-2xl border border-white/5"
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
            />

            {osd && (
              <div
                key={osd.id}
                className="absolute top-8 left-1/2 -translate-x-1/2 z-[8] pointer-events-none rounded-xl bg-black/70 px-5 py-2.5 text-xl font-semibold text-white backdrop-blur-sm shadow-lg"
              >
                {osd.text}
              </div>
            )}

            {/* Subtitles are rendered here (not natively) so they can sit above the controls */}
            {subtitles.cues.length > 0 && (
              <div
                className={cn(
                  "absolute inset-x-0 flex flex-col items-center gap-1 px-[8%] pointer-events-none z-[6] transition-[bottom] duration-200",
                  showControls ? "bottom-32" : "bottom-10"
                )}
              >
                {subtitles.cues.map((html, i) => (
                  <div
                    key={i}
                    className={cn(
                      "rounded-md bg-black/60 px-3 py-1 text-center font-semibold leading-snug text-white whitespace-pre-line [text-shadow:0_1px_3px_rgba(0,0,0,0.9)]",
                      isFullscreen ? "text-4xl" : "text-2xl"
                    )}
                    dangerouslySetInnerHTML={{ __html: html }}
                  />
                ))}
              </div>
            )}

            {(playback.status === 'loading' || (isBuffering && playback.status !== 'error')) && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-[4]">
                <LoadingSpinner
                  size="large"
                  message={playback.status === 'loading' ? t('video.preparing') : undefined}
                  className="rounded-2xl bg-black/40 backdrop-blur-sm"
                />
              </div>
            )}

            {playback.status === 'error' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/80 p-8 text-center z-[7]">
                <AlertTriangle size={40} className="text-amber-400" />
                <p className="text-lg font-semibold text-white">{t('video.playback_error')}</p>
                {playback.error && <p className="max-w-xl text-sm text-slate-400 break-words">{playback.error}</p>}
              </div>
            )}
            
            {/* Play overlay when paused */}
            {!isPlaying && playback.status === 'ready' && (
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
                videoRef={videoRef}
                duration={duration}
                filePath={file.path}
                onPreviousEpisode={playPreviousEpisode}
                onNextEpisode={playNextEpisode}
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
                videoHeight={videoRef.current?.videoHeight}
                onPlaybackRateChange={handlePlaybackRateChange}
                useServerPreview={playback.mode === 'hls'}
                isTranscoding={playback.isTranscoding}
                audioTracks={playback.info?.audio ?? NO_AUDIO_TRACKS}
                audioIndex={playback.audioIndex}
                onAudioChange={playback.setAudioIndex}
                subtitleTracks={playback.info?.subtitles ?? NO_SUBTITLE_TRACKS}
                subtitleId={subtitles.selectedId}
                onSubtitleChange={subtitles.setSelectedId}
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
                        showSidebar && "bg-primary/10 border-primary/30 text-primary shadow-lg shadow-primary/5"
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
                onToggleWatched={toggleWatchedStatus}
                onCopyPath={handleCopyPath}
            />
        )}
      </div>
    </motion.div>
  );
}
