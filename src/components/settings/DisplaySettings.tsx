import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Monitor } from 'lucide-react';
import { useSettings, AVAILABLE_RESOLUTIONS } from '../../contexts/SettingsContext';

export default function DisplaySettings() {
  const { t } = useTranslation();
  const { settings, updateResolution } = useSettings();

  return (
    <motion.section 
      className="flex flex-col gap-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.2 }}
    >
      <div className="flex items-center gap-3 mb-2 text-primary">
        <Monitor size={24} />
        <h2 className="text-xl font-bold font-heading m-0 text-foreground">{t('settings.display')}</h2>
      </div>
      
      <div className="flex flex-col gap-3 bg-card/40 backdrop-blur-sm rounded-xl p-5 border border-border/40">
        <label className="text-sm font-medium text-foreground mb-1 block">{t('settings.resolution')}</label>
        <div className="relative">
          <select
            className="w-full px-4 py-3 rounded-lg border border-border/50 bg-background/50 text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none appearance-none cursor-pointer hover:bg-background/80"
            value={`${settings.resolution.width}x${settings.resolution.height}`}
            onChange={(e) => {
              const res = AVAILABLE_RESOLUTIONS.find(
                r => `${r.width}x${r.height}` === e.target.value
              );
              if (res) updateResolution(res);
            }}
          >
            {AVAILABLE_RESOLUTIONS.map((res) => (
              <option key={res.label} value={`${res.width}x${res.height}`}>
                {res.label}
              </option>
            ))}
          </select>
          <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground">
             <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M2.5 4.5L6 8L9.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        </div>
      </div>
    </motion.section>
  );
}
