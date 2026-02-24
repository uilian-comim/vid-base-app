import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Video } from 'lucide-react';
import { useSettings } from '../../contexts/SettingsContext';

export default function VideoSettings() {
  const { t } = useTranslation();
  const { settings, updateVideoSkipBackward, updateVideoSkipForward } = useSettings();

  const [skipBackward, setSkipBackward] = useState(settings.videoSkipBackward.toString());
  const [skipForward, setSkipForward] = useState(settings.videoSkipForward.toString());

  const handleSkipBackwardChange = (value: string) => {
    setSkipBackward(value);
    const num = parseInt(value);
    if (!isNaN(num) && num > 0) {
      updateVideoSkipBackward(num);
    }
  };

  const handleSkipForwardChange = (value: string) => {
    setSkipForward(value);
    const num = parseInt(value);
    if (!isNaN(num) && num > 0) {
      updateVideoSkipForward(num);
    }
  };

  return (
    <motion.section 
      className="flex flex-col gap-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.4 }}
    >
      <div className="flex items-center gap-3 mb-2 text-primary">
        <Video size={24} />
        <h2 className="text-xl font-bold font-heading m-0 text-foreground">{t('settings.video')}</h2>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="flex flex-col gap-4 bg-card/40 backdrop-blur-sm rounded-xl p-5 border border-border/40 hover:border-primary/20 transition-colors">
          <div className="flex justify-between items-center">
            <label className="text-sm font-medium text-foreground">{t('settings.skip_backward')}</label>
            <span className="text-xs font-mono bg-primary/10 text-primary px-2 py-1 rounded-md border border-primary/20">
              {skipBackward}s
            </span>
          </div>
          <input
            type="range"
            className="w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
            min="1"
            max="60"
            value={skipBackward}
            onChange={(e) => handleSkipBackwardChange(e.target.value)}
          />
          <div className="flex justify-between text-xs text-muted-foreground px-1">
            <span>1s</span>
            <span>60s</span>
          </div>
        </div>

        <div className="flex flex-col gap-4 bg-card/40 backdrop-blur-sm rounded-xl p-5 border border-border/40 hover:border-primary/20 transition-colors">
          <div className="flex justify-between items-center">
            <label className="text-sm font-medium text-foreground">{t('settings.skip_forward')}</label>
            <span className="text-xs font-mono bg-primary/10 text-primary px-2 py-1 rounded-md border border-primary/20">
              {skipForward}s
            </span>
          </div>
          <input
            type="range"
            className="w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
            min="1"
            max="60"
            value={skipForward}
            onChange={(e) => handleSkipForwardChange(e.target.value)}
          />
           <div className="flex justify-between text-xs text-muted-foreground px-1">
            <span>1s</span>
            <span>60s</span>
          </div>
        </div>
      </div>
    </motion.section>
  );
}
