import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { X, Palette, Monitor, FolderOpen, Video, Wrench } from 'lucide-react';
import AppearanceSettings from '../components/settings/AppearanceSettings';
import DisplaySettings from '../components/settings/DisplaySettings';
import DirectorySettings from '../components/settings/DirectorySettings';
import VideoSettings from '../components/settings/VideoSettings';
import AdvancedSettings from '../components/settings/AdvancedSettings';

interface SettingsProps {
  onClose: () => void;
}

type TabId = 'appearance' | 'display' | 'directories' | 'video' | 'advanced';

export default function Settings({ onClose }: SettingsProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<TabId>('appearance');

  const tabs = [
    { id: 'appearance', label: t('settings.appearance'), icon: Palette, component: AppearanceSettings },
    { id: 'display', label: t('settings.display'), icon: Monitor, component: DisplaySettings },
    { id: 'directories', label: t('settings.directories'), icon: FolderOpen, component: DirectorySettings },
    { id: 'video', label: t('settings.video'), icon: Video, component: VideoSettings },
    { id: 'advanced', label: t('settings.advanced'), icon: Wrench, component: AdvancedSettings },
  ] as const;

  const ActiveComponent = tabs.find(tab => tab.id === activeTab)?.component || AppearanceSettings;

  return (
    <motion.div 
      className="fixed inset-0 z-50 bg-background text-foreground overflow-hidden w-full h-full flex flex-col"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="flex-none z-10 bg-background/80 backdrop-blur-md border-b border-border p-6 flex justify-between items-center">
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

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <div className="w-64 border-r border-border bg-card/10 overflow-y-auto p-4 flex flex-col gap-2 relative z-10">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                  isActive 
                    ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20 scale-[1.02]' 
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground hover:scale-[1.01]'
                }`}
              >
                <Icon size={18} className={isActive ? 'animate-pulse-slow' : ''} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-8 relative bg-background/50">
          <div className="max-w-3xl mx-auto w-full">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 10, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.98 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
              >
                <ActiveComponent />
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
