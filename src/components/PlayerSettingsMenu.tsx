import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Zap, ChevronRight, Check } from 'lucide-react';
import { cn } from "@/lib/utils";

interface PlayerSettingsMenuProps {
  show: boolean;
  activeMenu: 'main' | 'speed';
  setActiveMenu: (menu: 'main' | 'speed') => void;
  playbackRate: number;
  onPlaybackRateChange: (rate: number) => void;
  videoHeight?: number;
}

export default function PlayerSettingsMenu({
  show,
  activeMenu,
  setActiveMenu,
  playbackRate,
  onPlaybackRateChange,
  videoHeight
}: PlayerSettingsMenuProps) {
  const { t } = useTranslation();

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
              <div 
                className="flex justify-between items-center p-3 rounded-xl cursor-pointer hover:bg-white/5 transition-colors group"
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
              </div>

              <div className="flex justify-between items-center p-3 rounded-xl cursor-default opacity-80">
                <div className="flex items-center gap-3">
                  <span className="w-7 h-7 flex items-center justify-center font-bold text-xs text-slate-400 border border-slate-600 rounded px-1 h-5 leading-none">HD</span>
                  <span className="font-medium text-slate-100">{t('video.quality')}</span>
                </div>
                <div className="flex items-center gap-2">
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
              <div className="flex items-center gap-3 p-3 mb-1 border-b border-white/5 cursor-pointer hover:text-white text-slate-200" onClick={() => setActiveMenu('main')}>
                <ChevronRight size={20} className="rotate-180" />
                <span className="font-bold">{t('video.playback_speed')}</span>
              </div>
              <div className="flex flex-col gap-0.5 max-h-64 overflow-y-auto px-1 pb-1">
                {[0.5, 0.75, 1, 1.25, 1.5, 2].map(rate => (
                  <div 
                    key={rate}
                    className={cn("flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors", playbackRate === rate ? "text-blue-400" : "text-slate-300 hover:bg-white/5 hover:text-white")}
                    onClick={() => {
                        onPlaybackRateChange(rate);
                        setActiveMenu('main');
                    }}
                  >
                    <span className="font-medium">{rate === 1 ? t('video.normal') : `${rate}x`}</span>
                    {playbackRate === rate && <Check size={16} />}
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
