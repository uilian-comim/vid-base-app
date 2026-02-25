import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Wrench, RotateCcw, Trash2 } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { useSettings } from '../../contexts/SettingsContext';
import { useWatchHistory } from '../../contexts/WatchHistoryContext';
import ConfirmationModal from '../ConfirmationModal';

export default function AdvancedSettings() {
  const { t } = useTranslation();
  const { resetSettings } = useSettings();
  const { clearHistory } = useWatchHistory();

  const [modalOpen, setModalOpen] = useState(false);
  const [modalConfig, setModalConfig] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
    variant: 'danger' | 'info';
  }>({
    title: '',
    message: '',
    onConfirm: () => {},
    variant: 'danger'
  });

  const handleResetSettings = async () => {
    if (confirm(t('settings.confirm_reset'))) {
      await resetSettings();
      window.location.reload(); 
    }
  };

  const executeClearCache = async () => {
    try {
      // 1. Force the Rust server to kill any active FFmpeg processes
      await fetch('http://127.0.0.1:8765/stop-stream').catch(() => {});
      
      // 2. Clear the video cache via Tauri
      await invoke('clear_video_cache');
      
      // 3. Clear the watch history
      clearHistory();
      
      alert(t('settings.cache_cleared', 'Video cache successfully cleared.'));
    } catch (error) {
      console.error(error);
      alert(t('settings.cache_clear_error', 'Error clearing cache. A video might currently be playing.'));
    }
  };

  const handleClearCache = () => {
    setModalConfig({
        title: t('settings.clear_cache', 'Clear Video Cache'),
        message: t('settings.confirm_clear_cache', 'Are you sure you want to clear the video cache? This will delete temporary playback files.'),
        onConfirm: executeClearCache,
        variant: 'danger'
    });
    setModalOpen(true);
  };

  return (
    <motion.section 
      className="flex flex-col gap-6 mb-8"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.5 }}
    >
      <ConfirmationModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onConfirm={modalConfig.onConfirm}
        title={modalConfig.title}
        message={modalConfig.message}
        variant={modalConfig.variant}
      />
      
      <div className="flex items-center gap-3 mb-2 text-primary">
        <Wrench size={24} />
        <h2 className="text-xl font-bold font-heading m-0 text-foreground">{t('settings.advanced')}</h2>
      </div>
      
      <div className="flex flex-col gap-4 bg-red-500/5 border border-red-500/10 rounded-xl p-5 backdrop-blur-sm">
        <label className="text-sm font-medium text-foreground mb-1 block">{t('settings.reset')}</label>
        <p className="text-sm text-muted-foreground">{t('settings.reset_desc')}</p>
        <motion.button 
          className="flex items-center justify-center gap-2 px-6 py-2.5 bg-destructive text-destructive-foreground rounded-lg font-medium transition-all hover:bg-destructive/90 hover:shadow-lg hover:shadow-destructive/20 active:scale-[0.98] w-full sm:w-auto" 
          onClick={handleResetSettings}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <RotateCcw size={18} />
          {t('settings.reset')}
        </motion.button>
      </div>

      <div className="flex flex-col gap-4 bg-orange-500/5 border border-orange-500/10 rounded-xl p-5 backdrop-blur-sm mt-4">
        <label className="text-sm font-medium text-foreground mb-1 block">{t('settings.clear_cache', 'Clear Video Cache')}</label>
        <p className="text-sm text-muted-foreground">{t('settings.clear_cache_desc', 'Deletes temporary video streaming files (.ts, .mkv) to free up disk space.')}</p>
        <motion.button 
          className="flex items-center justify-center gap-2 px-6 py-2.5 bg-orange-500/10 text-orange-500 rounded-lg font-medium transition-all hover:bg-orange-500 hover:text-white active:scale-[0.98] w-full sm:w-auto" 
          onClick={handleClearCache}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <Trash2 size={18} />
          {t('settings.clear_cache', 'Clear Video Cache')}
        </motion.button>
      </div>
    </motion.section>
  );
}
