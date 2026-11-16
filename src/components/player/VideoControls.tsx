import { memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Play, Pause, SkipBack, SkipForward, VolumeX, Volume2, Settings, Minimize, Maximize } from 'lucide-react';
import { cn } from "@/lib/utils";
import PlayerSettingsMenu, { type PlayerMenu } from './PlayerSettingsMenu';
import { SeekBar, PlaybackTime } from './SeekBar';
import { type AudioStreamInfo, type SubtitleTrackInfo } from '../../lib/mediaServer';

interface VideoControlsProps {
  show: boolean;
  isPlaying: boolean;
  togglePlay: () => void;
  /** The seek bar and time label read the position from the element themselves. */
  videoRef: React.RefObject<HTMLVideoElement | null>;
  duration: number;
  filePath: string;
  /** Undefined when there is no previous/next episode in the folder. */
  onPreviousEpisode?: () => void;
  onNextEpisode?: () => void;
  volume: number;
  isMuted: boolean;
  toggleMute: () => void;
  changeVolume: (e: React.ChangeEvent<HTMLInputElement>) => void;
  isFullscreen: boolean;
  toggleFullscreen: () => void;
  showSettingsMenu: boolean;
  setShowSettingsMenu: (show: boolean) => void;
  activeMenu: PlayerMenu;
  setActiveMenu: (menu: PlayerMenu) => void;
  playbackRate: number;
  videoHeight?: number;
  onPlaybackRateChange: (rate: number) => void;
  /** Seek previews come from ffmpeg when the webview can't decode the file itself. */
  useServerPreview: boolean;
  isTranscoding: boolean;
  audioTracks: AudioStreamInfo[];
  audioIndex?: number;
  onAudioChange: (index: number) => void;
  subtitleTracks: SubtitleTrackInfo[];
  subtitleId: string | null;
  onSubtitleChange: (id: string | null) => void;
}

export default memo(function VideoControls({
  show,
  isPlaying,
  togglePlay,
  videoRef,
  duration,
  filePath,
  onPreviousEpisode,
  onNextEpisode,
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
  useServerPreview,
  isTranscoding,
  audioTracks,
  audioIndex,
  onAudioChange,
  subtitleTracks,
  subtitleId,
  onSubtitleChange
}: VideoControlsProps) {
  const { t } = useTranslation();
  const episodeButton = "p-2 rounded-full hover:bg-white/15 text-white/90 hover:text-white transition-all active:scale-90 disabled:opacity-35 disabled:pointer-events-none";

  return (
    <AnimatePresence>
      {show && (
        <motion.div 
          className="absolute bottom-0 left-0 right-0 px-8 pb-6 pt-28 bg-gradient-to-t from-black/95 via-black/50 to-transparent flex flex-col gap-2 z-10"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          transition={{ duration: 0.2 }}
          onClick={(e) => e.stopPropagation()}
          onDoubleClick={(e) => e.stopPropagation()}
        >
          <SeekBar videoRef={videoRef} duration={duration} filePath={filePath} useServerPreview={useServerPreview} />

          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <button className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-black shadow-lg transition-transform hover:scale-105 active:scale-95" onClick={togglePlay}>
                {isPlaying ? <Pause size={20} fill="black" /> : <Play size={20} fill="black" className="ml-0.5" />}
              </button>
              
              <div className="flex items-center gap-2">
                <button
                  className={episodeButton}
                  onClick={onPreviousEpisode}
                  disabled={!onPreviousEpisode}
                  title={`${t('video.previous_episode')} (Shift+P)`}
                  aria-label={t('video.previous_episode')}
                >
                  <SkipBack size={20} />
                </button>
                <button
                  className={episodeButton}
                  onClick={onNextEpisode}
                  disabled={!onNextEpisode}
                  title={`${t('video.next_episode')} (Shift+N)`}
                  aria-label={t('video.next_episode')}
                >
                  <SkipForward size={20} />
                </button>
              </div>

              <div className="flex items-center gap-2 group/volume relative">
                <button className="p-2 rounded-full hover:bg-white/15 text-white/90 hover:text-white transition-all active:scale-90" onClick={toggleMute}>
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

              <div className="text-[13px] text-white/70 tabular-nums tracking-wide ml-2">
                <PlaybackTime videoRef={videoRef} duration={duration} />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative">
                <button 
                  className={cn("p-2 rounded-full hover:bg-white/15 text-white/90 hover:text-white transition-all active:scale-90", showSettingsMenu && "bg-white/20")} 
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
                  isTranscoding={isTranscoding}
                  audioTracks={audioTracks}
                  audioIndex={audioIndex}
                  onAudioChange={onAudioChange}
                  subtitleTracks={subtitleTracks}
                  subtitleId={subtitleId}
                  onSubtitleChange={onSubtitleChange}
                />
              </div>

              <button className="p-2 rounded-full hover:bg-white/15 text-white/90 hover:text-white transition-all active:scale-90" onClick={toggleFullscreen}>
                {isFullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
});
