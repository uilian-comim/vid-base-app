import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Wrench, RotateCcw, Trash2, Gamepad2 } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { useSettings } from '../../contexts/SettingsContext';
import { useWatchHistory } from '../../contexts/WatchHistoryContext';
import { useToast } from '../../contexts/ToastContext';
import ConfirmationModal from '../ConfirmationModal';

export default function AdvancedSettings() {
  const { t } = useTranslation();
  const { settings, resetSettings, updateDiscordRichPresence } = useSettings();
  const { clearHistory } = useWatchHistory();
  const { showToast } = useToast();

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
    setModalConfig({
        title: t('settings.reset'),
        message: t('settings.confirm_reset'),
        onConfirm: async () => {
          await resetSettings();
          showToast(t('settings.reset_success', 'Settings successfully restored.'), 'success');
        },
        variant: 'danger'
    });
    setModalOpen(true);
  };

  const executeClearCache = async () => {
    try {
      // 1. Force the Rust server to kill any active FFmpeg processes
      await fetch('http://127.0.0.1:8765/stop-stream').catch(() => {});
      
      // 2. Clear the video cache via Tauri
      await invoke('clear_video_cache');
      
      // 3. Clear the watch history
      clearHistory();
      
      showToast(t('settings.cache_cleared', 'Video cache successfully cleared.'), 'success');
    } catch (error) {
      console.error(error);
      showToast(t('settings.cache_clear_error', 'Error clearing cache. A video might currently be playing.'), 'error');
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
        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
          <Wrench size={20} />
        </div>
        <div>
          <h2 className="text-xl font-bold font-heading m-0 text-foreground">{t('settings.advanced')}</h2>
          <p className="text-xs text-muted-foreground mt-0.5">{t('settings.advanced_desc', 'Manage advanced application preferences and data.')}</p>
        </div>
      </div>
      
      <div className="flex flex-col gap-4 mt-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-orange-500/5 border border-orange-500/10 rounded-xl p-5 backdrop-blur-sm group hover:bg-orange-500/10 transition-colors">
          <div className="flex-1 pr-4">
            <label className="text-base font-medium text-foreground mb-1 flex items-center gap-2">
              <Trash2 size={16} className="text-orange-500" />
              {t('settings.clear_cache', 'Clear Video Cache')}
            </label>
            <p className="text-sm text-muted-foreground leading-relaxed">{t('settings.clear_cache_desc', 'Deletes temporary video streaming files (.ts, .mkv) to free up disk space.')}</p>
          </div>
          <motion.button 
            className="flex-shrink-0 flex items-center justify-center px-6 py-2.5 bg-orange-500/10 text-orange-500 rounded-lg font-medium transition-all hover:bg-orange-500 hover:text-white active:scale-[0.98] w-full sm:w-auto mt-2 sm:mt-0" 
            onClick={handleClearCache}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            {t('settings.clear_cache', 'Clear Video Cache')}
          </motion.button>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-indigo-500/5 border border-indigo-500/10 rounded-xl p-5 backdrop-blur-sm group hover:bg-indigo-500/10 transition-colors">
          <div className="flex-1 pr-4">
            <label className="text-base font-medium text-foreground mb-1 flex items-center gap-2">
              <Gamepad2 size={16} className="text-indigo-500" />
              {t('settings.discord_rpc', 'Discord Rich Presence')}
            </label>
            <p className="text-sm text-muted-foreground leading-relaxed">{t('settings.discord_rpc_desc', 'Show what you are currently watching on your Discord profile status.')}</p>
          </div>
          <div className="flex-shrink-0 flex items-center justify-end w-full sm:w-auto mt-2 sm:mt-0">
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                className="sr-only peer" 
                checked={settings.enableDiscordRichPresence}
                onChange={(e) => updateDiscordRichPresence(e.target.checked)}
              />
              <div className="w-11 h-6 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-500"></div>
            </label>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-destructive/5 border border-destructive/10 rounded-xl p-5 backdrop-blur-sm group hover:bg-destructive/10 transition-colors">
          <div className="flex-1 pr-4">
            <label className="text-base font-medium text-foreground mb-1 flex items-center gap-2">
              <RotateCcw size={16} className="text-destructive" />
              {t('settings.reset')}
            </label>
            <p className="text-sm text-muted-foreground leading-relaxed">{t('settings.reset_desc')}</p>
          </div>
          <motion.button 
            className="flex-shrink-0 flex items-center justify-center px-6 py-2.5 bg-destructive/10 text-destructive rounded-lg font-medium transition-all hover:bg-destructive hover:text-destructive-foreground active:scale-[0.98] w-full sm:w-auto mt-2 sm:mt-0" 
            onClick={handleResetSettings}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            {t('settings.reset')}
          </motion.button>
        </div>
      </div>
    </motion.section>
  );
}
