import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Monitor } from 'lucide-react';
import { useSettings, AVAILABLE_RESOLUTIONS } from '../../contexts/SettingsContext';
import Select from '../Select';

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
        <Select
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
        </Select>
      </div>
    </motion.section>
  );
}
