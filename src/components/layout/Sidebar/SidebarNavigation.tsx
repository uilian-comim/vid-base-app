import { motion } from "framer-motion";
import { Home, Play, FileText } from "lucide-react";
import { useTranslation } from 'react-i18next';
import { cn } from "@/lib/utils";
import React from "react";

interface SidebarNavigationProps {
  activeNav: string;
  setActiveNav: (nav: string) => void;
  showSettings: boolean;
  setShowSettings: (show: boolean) => void;
  setBrowserPath: (path: string | null) => void;
  fileTypeFilter: 'video' | 'document' | null;
  setFileTypeFilter: (type: 'video' | 'document' | null) => void;
}

const SidebarNavigation = React.memo(({
  activeNav,
  setActiveNav,
  showSettings,
  setShowSettings,
  setBrowserPath,
  fileTypeFilter,
  setFileTypeFilter
}: SidebarNavigationProps) => {
  const { t } = useTranslation();

  return (
    <nav className="flex flex-col gap-1 p-4 pt-2">
      <motion.button
        className={cn(
          "relative flex items-center gap-2 px-4 py-2.5 border-none bg-transparent text-sidebar-foreground/70 text-[15px] font-medium text-left cursor-pointer rounded-md transition-all overflow-hidden mb-1 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground dark:hover:bg-white/10 dark:hover:text-white",
          activeNav === 'inicio' && !showSettings && "bg-sidebar-accent text-sidebar-primary font-semibold dark:bg-white/10 dark:text-white"
        )}
        onClick={() => {
          setActiveNav('inicio');
          setBrowserPath('');
          setFileTypeFilter(null);
          setShowSettings(false);
        }}
        whileHover={{ x: 4 }}
        whileTap={{ scale: 0.98 }}
      >
        <Home size={20} />
        <span>{t('sidebar.home')}</span>
        {activeNav === 'inicio' && !showSettings && (
          <motion.div
            className="absolute left-0 top-0 bottom-0 w-[3px] bg-sidebar-primary rounded-r-sm"
            layoutId="activeNav"
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
          />
        )}
      </motion.button>

      <motion.button
        className={cn(
          "relative flex items-center gap-2 px-4 py-2.5 border-none bg-transparent text-sidebar-foreground/70 text-[15px] font-medium text-left cursor-pointer rounded-md transition-all overflow-hidden mb-1 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground dark:hover:bg-white/10 dark:hover:text-white",
          activeNav === 'continuar' && !showSettings && "bg-sidebar-accent text-sidebar-primary font-semibold dark:bg-white/10 dark:text-white"
        )}
        onClick={() => {
          setActiveNav('continuar');
          setBrowserPath('');
          setFileTypeFilter(null);
          setShowSettings(false);
        }}
        whileHover={{ x: 4 }}
        whileTap={{ scale: 0.98 }}
      >
        <Play size={20} />
        <span>{t('sidebar.continue_watching')}</span>
        {activeNav === 'continuar' && !showSettings && (
          <motion.div
            className="absolute left-0 top-0 bottom-0 w-[3px] bg-sidebar-primary rounded-r-sm"
            layoutId="activeNav"
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
          />
        )}
      </motion.button>

      <motion.button
        className={cn(
          "relative flex items-center gap-2 px-4 py-2.5 border-none bg-transparent text-sidebar-foreground/70 text-[15px] font-medium text-left cursor-pointer rounded-md transition-all overflow-hidden mb-1 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground dark:hover:bg-white/10 dark:hover:text-white",
          activeNav === 'arquivos' && !fileTypeFilter && !showSettings && "bg-sidebar-accent text-sidebar-primary font-semibold dark:bg-white/10 dark:text-white"
        )}
        onClick={() => {
          setActiveNav('arquivos');
          setBrowserPath('');
          setFileTypeFilter(null);
          setShowSettings(false);
        }}
        whileHover={{ x: 4 }}
        whileTap={{ scale: 0.98 }}
      >
        <FileText size={20} />
        <span>{t('sidebar.all_files')}</span>
        {activeNav === 'arquivos' && !fileTypeFilter && !showSettings && (
          <motion.div
            className="absolute left-0 top-0 bottom-0 w-[3px] bg-sidebar-primary rounded-r-sm"
            layoutId="activeNav"
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
          />
        )}
      </motion.button>
    </nav>
  );
});

SidebarNavigation.displayName = 'SidebarNavigation';

export default SidebarNavigation;
