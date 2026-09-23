import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Zap, ChevronRight, Check, AudioLines, Captions } from 'lucide-react';
import { cn } from "@/lib/utils";
import { type AudioStreamInfo, type SubtitleTrackInfo, channelLabel, languageName } from '../../lib/mediaServer';

export type PlayerMenu = 'main' | 'speed' | 'audio' | 'subtitles';

interface PlayerSettingsMenuProps {
  show: boolean;
  activeMenu: PlayerMenu;
  setActiveMenu: (menu: PlayerMenu) => void;
  playbackRate: number;
  onPlaybackRateChange: (rate: number) => void;
  videoHeight?: number;
  isTranscoding: boolean;
  audioTracks: AudioStreamInfo[];
  audioIndex?: number;
  onAudioChange: (index: number) => void;
  subtitleTracks: SubtitleTrackInfo[];
  subtitleId: string | null;
  onSubtitleChange: (id: string | null) => void;
}

function SubmenuHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <button type="button" className="flex w-full items-center gap-3 p-3 mb-1 border-b border-white/5 cursor-pointer hover:text-white text-slate-200 text-left" onClick={onBack}>
      <ChevronRight size={20} className="rotate-180" />
      <span className="font-bold">{title}</span>
    </button>
  );
}

function OptionRow({ label, detail, selected, onClick }: { label: string; detail?: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      className={cn("flex w-full items-center justify-between gap-3 p-3 rounded-lg cursor-pointer transition-colors text-left", selected ? "text-blue-400" : "text-slate-300 hover:bg-white/5 hover:text-white")}
      onClick={onClick}
    >
      <div className="flex flex-col min-w-0">
        <span className="font-medium truncate">{label}</span>
        {detail && <span className="text-xs text-slate-500 truncate">{detail}</span>}
      </div>
      {selected && <Check size={16} className="shrink-0" />}
    </button>
  );
}

export default function PlayerSettingsMenu({
  show,
  activeMenu,
  setActiveMenu,
  playbackRate,
  onPlaybackRateChange,
  videoHeight,
  isTranscoding,
  audioTracks,
  audioIndex,
  onAudioChange,
  subtitleTracks,
  subtitleId,
  onSubtitleChange,
}: PlayerSettingsMenuProps) {
  const { t, i18n } = useTranslation();

  const audioLabel = (track: AudioStreamInfo, position: number) =>
    track.title ?? languageName(track.language, i18n.language) ?? t('video.track', { number: position + 1 });
  const audioDetail = (track: AudioStreamInfo) =>
    [track.title ? languageName(track.language, i18n.language) : null, track.codec.toUpperCase(), channelLabel(track.channels)]
      .filter(Boolean)
      .join(' · ');

  const subtitleLabel = (track: SubtitleTrackInfo, position: number) =>
    languageName(track.language, i18n.language) ?? track.title ?? t('video.track', { number: position + 1 });
  const subtitleDetail = (track: SubtitleTrackInfo) =>
    [
      track.language ? track.title : null,
      track.forced ? t('video.forced') : null,
      track.external ? t('video.external_file') : null,
    ]
      .filter(Boolean)
      .join(' · ');

  const selectedAudio = audioTracks.findIndex((a) => a.index === audioIndex);
  const selectedSubtitle = subtitleTracks.findIndex((s) => s.id === subtitleId);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="absolute bottom-14 right-0 w-80 bg-[#0f0f12]/95 backdrop-blur-3xl border border-white/10 rounded-2xl p-2 shadow-2xl z-50 overflow-hidden origin-bottom-right"
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.1 }}
          onClick={(e) => e.stopPropagation()}
        >
          {activeMenu === 'main' && (
            <motion.div
              className="flex flex-col gap-1"
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
            >
              <button
                type="button"
                className="flex w-full justify-between items-center p-3 rounded-xl cursor-pointer hover:bg-white/5 transition-colors group text-left"
                onClick={() => setActiveMenu('speed')}
              >
                <div className="flex items-center gap-3">
                  <span className="w-7 h-7 flex items-center justify-center text-amber-400">
                    <Zap size={18} fill="currentColor" />
                  </span>
                  <span className="font-medium text-slate-100">{t('video.speed')}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-slate-400 group-hover:text-white transition-colors">{playbackRate}x</span>
                  <ChevronRight size={16} className="text-slate-500" />
                </div>
              </button>

              {audioTracks.length > 1 && (
                <button
                  type="button"
                  className="flex w-full justify-between items-center p-3 rounded-xl cursor-pointer hover:bg-white/5 transition-colors group text-left"
                  onClick={() => setActiveMenu('audio')}
                >
                  <div className="flex items-center gap-3">
                    <span className="w-7 h-7 flex items-center justify-center text-emerald-400">
                      <AudioLines size={18} />
                    </span>
                    <span className="font-medium text-slate-100">{t('video.audio')}</span>
                  </div>
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-sm font-medium text-slate-400 group-hover:text-white transition-colors truncate max-w-32">
                      {selectedAudio >= 0 ? audioLabel(audioTracks[selectedAudio], selectedAudio) : '—'}
                    </span>
                    <ChevronRight size={16} className="text-slate-500 shrink-0" />
                  </div>
                </button>
              )}

              {subtitleTracks.length > 0 && (
                <button
                  type="button"
                  className="flex w-full justify-between items-center p-3 rounded-xl cursor-pointer hover:bg-white/5 transition-colors group text-left"
                  onClick={() => setActiveMenu('subtitles')}
                >
                  <div className="flex items-center gap-3">
                    <span className="w-7 h-7 flex items-center justify-center text-sky-400">
                      <Captions size={18} />
                    </span>
                    <span className="font-medium text-slate-100">{t('video.subtitles')}</span>
                  </div>
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-sm font-medium text-slate-400 group-hover:text-white transition-colors truncate max-w-32">
                      {selectedSubtitle >= 0 ? subtitleLabel(subtitleTracks[selectedSubtitle], selectedSubtitle) : t('video.off')}
                    </span>
                    <ChevronRight size={16} className="text-slate-500 shrink-0" />
                  </div>
                </button>
              )}

              <div className="flex justify-between items-center p-3 rounded-xl cursor-default opacity-80">
                <div className="flex items-center gap-3">
                  <span className="w-7 h-7 flex items-center justify-center font-bold text-xs text-slate-400 border border-slate-600 rounded px-1 h-5 leading-none">HD</span>
                  <span className="font-medium text-slate-100">{t('video.quality')}</span>
                </div>
                <div className="flex items-center gap-2">
                  {isTranscoding && (
                    <span className="text-xs font-medium text-amber-400" title={t('video.transcoding_hint')}>
                      {t('video.transcoding')}
                    </span>
                  )}
                  <span className="text-sm font-bold text-blue-400">
                    {videoHeight ? `${videoHeight}p` : t('video.auto')}
                  </span>
                </div>
              </div>
            </motion.div>
          )}

          {activeMenu === 'speed' && (
            <motion.div
              className="flex flex-col w-full"
              initial={{ x: 20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
            >
              <SubmenuHeader title={t('video.playback_speed')} onBack={() => setActiveMenu('main')} />
              <div className="flex flex-col gap-0.5 max-h-64 overflow-y-auto px-1 pb-1">
                {[0.5, 0.75, 1, 1.25, 1.5, 2].map(rate => (
                  <OptionRow
                    key={rate}
                    label={rate === 1 ? t('video.normal') : `${rate}x`}
                    selected={playbackRate === rate}
                    onClick={() => {
                        onPlaybackRateChange(rate);
                        setActiveMenu('main');
                    }}
                  />
                ))}
              </div>
            </motion.div>
          )}

          {activeMenu === 'audio' && (
            <motion.div
              className="flex flex-col w-full"
              initial={{ x: 20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
            >
              <SubmenuHeader title={t('video.audio')} onBack={() => setActiveMenu('main')} />
              <div className="flex flex-col gap-0.5 max-h-64 overflow-y-auto px-1 pb-1">
                {audioTracks.map((track, i) => (
                  <OptionRow
                    key={track.index}
                    label={audioLabel(track, i)}
                    detail={audioDetail(track)}
                    selected={track.index === audioIndex}
                    onClick={() => {
                      onAudioChange(track.index);
                      setActiveMenu('main');
                    }}
                  />
                ))}
              </div>
            </motion.div>
          )}

          {activeMenu === 'subtitles' && (
            <motion.div
              className="flex flex-col w-full"
              initial={{ x: 20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
            >
              <SubmenuHeader title={t('video.subtitles')} onBack={() => setActiveMenu('main')} />
              <div className="flex flex-col gap-0.5 max-h-64 overflow-y-auto px-1 pb-1">
                <OptionRow
                  label={t('video.off')}
                  selected={subtitleId === null}
                  onClick={() => {
                    onSubtitleChange(null);
                    setActiveMenu('main');
                  }}
                />
                {subtitleTracks.map((track, i) => (
                  <OptionRow
                    key={track.id}
                    label={subtitleLabel(track, i)}
                    detail={subtitleDetail(track)}
                    selected={track.id === subtitleId}
                    onClick={() => {
                      onSubtitleChange(track.id);
                      setActiveMenu('main');
                    }}
                  />
                ))}
              </div>
            </motion.div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
