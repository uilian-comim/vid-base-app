import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Palette, Sun, Moon } from 'lucide-react';
import { useSettings, Theme, Language } from '../../contexts/SettingsContext';
import { cn } from "@/lib/utils";

export default function AppearanceSettings() {
  const { t } = useTranslation();
  const { settings, updateTheme, updateLanguage } = useSettings();

  return (
    <motion.section 
      className="flex flex-col gap-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.1 }}
    >
      <div className="flex items-center gap-3 mb-2 text-primary">
        <Palette size={24} />
        <h2 className="text-xl font-bold font-heading m-0 text-foreground">{t('settings.appearance')}</h2>
      </div>
      
      <div className="flex flex-col gap-4 bg-card/40 backdrop-blur-sm rounded-xl p-5 border border-border/40">
        <label className="text-sm font-medium text-foreground mb-1 block">{t('settings.theme')}</label>
        <div className="grid grid-cols-2 gap-4">
          <motion.label 
            className={cn(
              "relative cursor-pointer rounded-xl border border-border/50 bg-background/50 p-4 transition-all hover:bg-background/80 hover:border-primary/30 flex flex-col items-center gap-3 text-center",
              settings.theme === 'light' && "border-primary bg-primary/5 text-primary ring-1 ring-primary/20"
            )}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <input
              type="radio"
              name="theme"
              value="light"
              checked={settings.theme === 'light'}
              onChange={(e) => updateTheme(e.target.value as Theme)}
              className="hidden"
            />
            <div className="flex flex-col items-center gap-2">
              <div className={cn("w-12 h-12 rounded-full flex items-center justify-center transition-colors", settings.theme === 'light' ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground")}>
                <Sun size={24} />
              </div>
              <span className="font-medium text-sm">{t('settings.light')}</span>
            </div>
          </motion.label>
          <motion.label 
            className={cn(
              "relative cursor-pointer rounded-xl border border-border/50 bg-background/50 p-4 transition-all hover:bg-background/80 hover:border-primary/30 flex flex-col items-center gap-3 text-center",
              settings.theme === 'dark' && "border-primary bg-primary/5 text-primary ring-1 ring-primary/20"
            )}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <input
              type="radio"
              name="theme"
              value="dark"
              checked={settings.theme === 'dark'}
              onChange={(e) => updateTheme(e.target.value as Theme)}
              className="hidden"
            />
            <div className="flex flex-col items-center gap-2">
              <div className={cn("w-12 h-12 rounded-full flex items-center justify-center transition-colors", settings.theme === 'dark' ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground")}>
                <Moon size={24} />
              </div>
              <span className="font-medium text-sm">{t('settings.dark')}</span>
            </div>
          </motion.label>
        </div>
      </div>

      <div className="flex flex-col gap-3 bg-card/40 backdrop-blur-sm rounded-xl p-5 border border-border/40">
        <label className="text-sm font-medium text-foreground mb-1 block">{t('settings.language')}</label>
        <div className="relative">
          <select
            className="w-full px-4 py-3 rounded-lg border border-border/50 bg-background/50 text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none appearance-none cursor-pointer hover:bg-background/80"
            value={settings.language}
            onChange={(e) => updateLanguage(e.target.value as Language)}
          >
            <option value="pt-BR">🇧🇷 {t('settings.portuguese')}</option>
            <option value="en">🇺🇸 {t('settings.english')}</option>
            <option value="es">🇪🇸 {t('settings.spanish')}</option>
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
