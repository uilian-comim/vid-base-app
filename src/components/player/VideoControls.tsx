import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, SkipBack, SkipForward, VolumeX, Volume2, Settings, Minimize, Maximize } from 'lucide-react';
import { cn } from "@/lib/utils";
import PlayerSettingsMenu from './PlayerSettingsMenu';
import { formatTime } from '../../utils/utils';
import { convertFileSrc } from '@tauri-apps/api/core';
import { useSettings } from '../../contexts/SettingsContext';

interface VideoControlsProps {
  show: boolean;
  isPlaying: boolean;
  togglePlay: () => void;
  currentTime: number;
  duration: number;
  handleSeek: (e: React.ChangeEvent<HTMLInputElement>) => void;
  previewTime: number | null;
  previewLeft: number;
  handleProgressMouseMove: (e: React.MouseEvent<HTMLDivElement>) => void;
  handleProgressMouseLeave: () => void;
  previewVideoRef: React.RefObject<HTMLVideoElement | null>;
  filePath: string;
  skip: (seconds: number) => void;
  volume: number;
  isMuted: boolean;
  toggleMute: () => void;
  changeVolume: (e: React.ChangeEvent<HTMLInputElement>) => void;
  isFullscreen: boolean;
  toggleFullscreen: () => void;
  showSettingsMenu: boolean;
  setShowSettingsMenu: (show: boolean) => void;
  activeMenu: 'main' | 'speed';
  setActiveMenu: (menu: 'main' | 'speed') => void;
  playbackRate: number;
  setPlaybackRate: (rate: number) => void;
  videoHeight?: number;
  onPlaybackRateChange: (rate: number) => void;
  isStreamableFormat: boolean;
}

export default function VideoControls({
  show,
  isPlaying,
  togglePlay,
  currentTime,
  duration,
  handleSeek,
  previewTime,
  previewLeft,
  handleProgressMouseMove,
  handleProgressMouseLeave,
  previewVideoRef,
  filePath,
  skip,
  volume,
  isMuted,
  toggleMute,
  changeVolume,
  isFullscreen,
  toggleFullscreen,
  showSettingsMenu,
  setShowSettingsMenu,
  activeMenu,
  setActiveMenu,
  playbackRate,
  videoHeight,
  onPlaybackRateChange,
  isStreamableFormat
}: VideoControlsProps) {
  const { settings } = useSettings();

  return (
    <AnimatePresence>
      {show && (
        <motion.div 
          className="absolute bottom-0 left-0 right-0 p-6 pt-24 bg-gradient-to-t from-black via-black/60 to-transparent flex flex-col gap-2 z-10"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          transition={{ duration: 0.2 }}
          onClick={(e) => e.stopPropagation()}
          onDoubleClick={(e) => e.stopPropagation()}
        >
          {/* Progress Bar */}
          <div 
            className="relative w-full h-1.5 bg-white/20 rounded-full cursor-pointer group mb-2 hover:h-2 transition-all"
            onMouseMove={handleProgressMouseMove}
            onMouseLeave={handleProgressMouseLeave}

          >
            {previewTime !== null && (
              <div 
                className="absolute bottom-8 -translate-x-1/2 bg-zinc-900 border border-white/10 rounded-xl p-1 flex flex-col items-center pointer-events-none z-20 shadow-2xl overflow-hidden min-w-[160px]"
                style={{ left: previewLeft }}
              >
                {!isStreamableFormat ? (
                  <div className="w-[180px] aspect-video bg-black flex items-center justify-center overflow-hidden rounded-lg relative">
                    <video
                      ref={previewVideoRef}
                      src={convertFileSrc(filePath)}
                      className="w-full h-full object-cover"
                      muted
                      preload="auto"
                      disablePictureInPicture
                    />
                  </div>
                ) : (
                  <div className="w-[180px] aspect-video bg-black flex items-center justify-center overflow-hidden rounded-lg relative">
                    <img 
                      src={`http://127.0.0.1:8765/thumbnail?path=${encodeURIComponent(filePath)}&time=${previewTime !== null ? Math.floor(previewTime) : 0}`}
                      className="w-full h-full object-cover"
                      alt="Preview"
                    />
                  </div>
                )}
                <span className="w-full text-center py-2 text-base font-bold text-white font-sans tracking-wide drop-shadow-md">{formatTime(previewTime)}</span>
              </div>
            )}
            <div 
              className="h-full rounded-full bg-primary relative w-full"
              style={{
                width: `${(currentTime / (duration || 1)) * 100}%`,
                background: `linear-gradient(to right, #6366f1 0%, #6366f1 100%)`
              }}
            >
              <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-primary rounded-full opacity-0 group-hover:opacity-100 transition-opacity scale-0 group-hover:scale-125 shadow-lg ring-2 ring-white/20" />
            </div>
            
            <input 
              type="range" 
              min="0" 
              max={duration || 100} 
              value={currentTime} 
              onChange={handleSeek}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
            />
          </div>

          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <button className="p-2 rounded-full hover:bg-white/20 text-white transition-all transform hover:scale-110" onClick={togglePlay}>
                {isPlaying ? <Pause size={24} fill="white" /> : <Play size={24} fill="white" />}
              </button>
              
              <div className="flex items-center gap-2">
                <button className="p-2 rounded-full hover:bg-white/20 text-white transition-all transform hover:scale-110" onClick={() => skip(-settings.videoSkipBackward)}>
                  <SkipBack size={20} />
                </button>
                <button className="p-2 rounded-full hover:bg-white/20 text-white transition-all transform hover:scale-110" onClick={() => skip(settings.videoSkipForward)}>
                  <SkipForward size={20} />
                </button>
              </div>

              <div className="flex items-center gap-2 group/volume relative">
                <button className="p-2 rounded-full hover:bg-white/20 text-white transition-all transform hover:scale-110" onClick={toggleMute}>
                  {isMuted || volume === 0 ? <VolumeX size={20} /> : <Volume2 size={20} />}
                </button>
                <input 
                  type="range" 
                  min="0" 
                  max="1" 
                  step="0.05"
                  value={isMuted ? 0 : volume}
                  onChange={changeVolume}
                  className="w-24 h-1 bg-white/30 rounded-full appearance-none accent-white cursor-pointer"
                  style={{
                    background: `linear-gradient(to right, #ffffff 0%, #ffffff ${(isMuted ? 0 : volume) * 100}%, rgba(255,255,255,0.3) ${(isMuted ? 0 : volume) * 100}%, rgba(255,255,255,0.3) 100%)`
                  }}
                />
              </div>

              <div className="text-sm text-slate-300 font-mono tracking-wide ml-2">
                {formatTime(currentTime)} / {formatTime(duration)}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative">
                <button 
                  className={cn("p-2 rounded-full hover:bg-white/20 text-white transition-all transform hover:scale-110", showSettingsMenu && "bg-white/20")} 
                  onClick={() => setShowSettingsMenu(!showSettingsMenu)}
                >
                  <Settings size={20} />
                </button>

                <PlayerSettingsMenu
                  show={showSettingsMenu}
                  activeMenu={activeMenu}
                  setActiveMenu={setActiveMenu}
                  playbackRate={playbackRate}
                  onPlaybackRateChange={onPlaybackRateChange}
                  videoHeight={videoHeight}
                />
              </div>

              <button className="p-2 rounded-full hover:bg-white/20 text-white transition-all transform hover:scale-110" onClick={toggleFullscreen}>
                {isFullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
