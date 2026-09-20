import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Download } from 'lucide-react';
import { getVersion } from '@tauri-apps/api/app';
import { check, Update } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
import { useToast } from '../../contexts/ToastContext';

type Status = 'idle' | 'checking' | 'available' | 'downloading';

export default function UpdateSettings() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [version, setVersion] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [update, setUpdate] = useState<Update | null>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    getVersion().then(setVersion).catch(() => {});
  }, []);

  const handleCheck = async () => {
    setStatus('checking');
    try {
      const result = await check();
      if (result) {
        setUpdate(result);
        setStatus('available');
      } else {
        setStatus('idle');
        showToast(t('settings.up_to_date', 'You are on the latest version.'), 'success');
      }
    } catch (error) {
      console.error(error);
      setStatus('idle');
      showToast(t('settings.update_check_error', 'Could not check for updates.'), 'error');
    }
  };

  const handleInstall = async () => {
    if (!update) return;
    setStatus('downloading');
    setProgress(0);
    try {
      let total = 0;
      let downloaded = 0;
      await update.downloadAndInstall((event) => {
        if (event.event === 'Started') total = event.data.contentLength ?? 0;
        if (event.event === 'Progress') {
          downloaded += event.data.chunkLength;
          if (total > 0) setProgress(Math.round((downloaded / total) * 100));
        }
      });
      await relaunch();
    } catch (error) {
      console.error(error);
      setStatus('available');
      showToast(t('settings.update_install_error', 'Failed to install the update.'), 'error');
    }
  };

  const busy = status === 'checking' || status === 'downloading';

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-emerald-500/5 border border-emerald-500/10 rounded-xl p-5 backdrop-blur-sm hover:bg-emerald-500/10 transition-colors">
      <div className="flex-1 pr-4">
        <label className="text-base font-medium text-foreground mb-1 flex items-center gap-2">
          <Download size={16} className="text-emerald-500" />
          {t('settings.updates', 'Updates')}
          {version && <span className="text-xs text-muted-foreground">v{version}</span>}
        </label>
        <p className="text-sm text-muted-foreground leading-relaxed">
          {status === 'available' && update
            ? t('settings.update_available', { version: update.version, defaultValue: 'Version {{version}} is available.' })
            : status === 'downloading'
              ? t('settings.update_downloading', { progress, defaultValue: 'Downloading update... {{progress}}%' })
              : t('settings.updates_desc', 'Check for new versions of the app.')}
        </p>
      </div>
      <motion.button
        className="flex-shrink-0 flex items-center justify-center px-6 py-2.5 bg-emerald-500/10 text-emerald-500 rounded-lg font-medium transition-all hover:bg-emerald-500 hover:text-white active:scale-[0.98] w-full sm:w-auto mt-2 sm:mt-0 disabled:opacity-50"
        onClick={status === 'available' ? handleInstall : handleCheck}
        disabled={busy}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        {status === 'checking'
          ? t('settings.checking', 'Checking...')
          : status === 'available'
            ? t('settings.install_update', 'Install and restart')
            : status === 'downloading'
              ? `${progress}%`
              : t('settings.check_updates', 'Check for updates')}
      </motion.button>
    </div>
  );
}
