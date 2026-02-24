import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import AppearanceSettings from '../components/settings/AppearanceSettings';
import DisplaySettings from '../components/settings/DisplaySettings';
import DirectorySettings from '../components/settings/DirectorySettings';
import VideoSettings from '../components/settings/VideoSettings';
import AdvancedSettings from '../components/settings/AdvancedSettings';

interface SettingsProps {
  onClose: () => void;
}

export default function Settings({ onClose }: SettingsProps) {
  const { t } = useTranslation();

  return (
    <motion.div 
      className="fixed inset-0 z-50 bg-background text-foreground overflow-y-auto w-full h-full flex flex-col"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-md border-b border-border p-6 flex justify-between items-center">
        <h1 className="text-3xl font-bold font-heading m-0 text-foreground">{t('settings.title')}</h1>
        <motion.button 
          className="p-2 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors" 
          onClick={onClose}
          title={t('settings.close')}
          whileHover={{ scale: 1.1, rotate: 90 }}
          whileTap={{ scale: 0.9 }}
        >
          <X size={24} />
        </motion.button>
      </div>

      <div className="flex-1 p-8 max-w-4xl mx-auto w-full flex flex-col gap-10">
        <AppearanceSettings />
        <DisplaySettings />
        <DirectorySettings />
        <VideoSettings />
        <AdvancedSettings />
      </div>
    </motion.div>
  );
}
