import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Wrench, RotateCcw } from 'lucide-react';
import { useSettings } from '../../contexts/SettingsContext';

export default function AdvancedSettings() {
  const { t } = useTranslation();
  const { resetSettings } = useSettings();

  const handleResetSettings = async () => {
    if (confirm(t('settings.confirm_reset'))) {
      await resetSettings();
      // Values in other components will update automatically via context/reactive state if they subscribe to it.
      // However, local state like skipBackward/Forward in VideoSettings needs to be reset too.
      // But since they initialized from settings, and settings changed, we might need a way to force re-render or side-effect.
      // Actually VideoSettings initializes state once.
      // We might want to pass a key to re-mount or handle it inside VideoSettings with useEffect.
      // For now, let's just reset settings.
      // To properly reset local states, forcing a remount of the whole Settings view or components is one way.
      // Or simply reloading the page? No.
      // We can expose a reset trigger?
      // Or just accept that slider positions might desync until closed/reopened?
      // Let's reload window? No.
      window.location.reload(); 
    }
  };

  return (
    <motion.section 
      className="flex flex-col gap-6 mb-8"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.5 }}
    >
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
    </motion.section>
  );
}
