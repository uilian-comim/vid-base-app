import { motion } from "framer-motion";
import { Video, FileType } from "lucide-react";
import { useTranslation } from 'react-i18next';
import { cn } from "@/lib/utils";
import React from "react";

interface SidebarFileTypesProps {
  activeNav: string;
  setActiveNav: (nav: string) => void;
  showSettings: boolean;
  setShowSettings: (show: boolean) => void;
  setBrowserPath: (path: string | null) => void;
  fileTypeFilter: 'video' | 'document' | null;
  setFileTypeFilter: (type: 'video' | 'document' | null) => void;
  videoCount: number;
  documentCount: number;
}

const SidebarFileTypes = React.memo(({
  activeNav,
  setActiveNav,
  showSettings,
  setShowSettings,
  setBrowserPath,
  fileTypeFilter,
  setFileTypeFilter,
  videoCount,
  documentCount
}: SidebarFileTypesProps) => {
  const { t } = useTranslation();

  return (
    <div className="mt-4">
      <div className="px-4 py-2 text-[13px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
        {t('sidebar.file_types')}
      </div>
      <nav className="flex flex-col gap-1 p-4 pt-2">
        <motion.button
          className={cn(
            "relative flex items-center gap-2 px-4 py-2.5 border-none bg-transparent text-sidebar-foreground/70 text-[15px] font-medium text-left cursor-pointer rounded-md transition-all overflow-hidden mb-1 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground dark:hover:bg-white/10 dark:hover:text-white",
            activeNav === 'arquivos' && fileTypeFilter === 'video' && !showSettings && "bg-sidebar-accent text-sidebar-primary font-semibold dark:bg-white/10 dark:text-white"
          )}
          onClick={() => {
            setActiveNav('arquivos');
            setFileTypeFilter('video');
            setBrowserPath('');
            setShowSettings(false);
          }}
          whileHover={{ x: 4 }}
          whileTap={{ scale: 0.98 }}
        >
          <Video size={18} />
          <span>{t('sidebar.videos')}</span>
          <span className={cn(
            "ml-auto px-2 py-0.5 bg-sidebar-primary/10 text-sidebar-primary rounded-full text-xs font-semibold",
             activeNav === 'arquivos' && fileTypeFilter === 'video' && !showSettings && "bg-sidebar-primary text-sidebar-primary-foreground"
          )}>{videoCount}</span>
        </motion.button>

        <motion.button
          className={cn(
            "relative flex items-center gap-2 px-4 py-2.5 border-none bg-transparent text-sidebar-foreground/70 text-[15px] font-medium text-left cursor-pointer rounded-md transition-all overflow-hidden mb-1 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground dark:hover:bg-white/10 dark:hover:text-white",
            activeNav === 'arquivos' && fileTypeFilter === 'document' && !showSettings && "bg-sidebar-accent text-sidebar-primary font-semibold dark:bg-white/10 dark:text-white"
          )}
          onClick={() => {
            setActiveNav('arquivos');
            setFileTypeFilter('document');
            setBrowserPath('');
            setShowSettings(false);
          }}
          whileHover={{ x: 4 }}
          whileTap={{ scale: 0.98 }}
        >
          <FileType size={18} />
          <span>{t('sidebar.documents')}</span>
          <span className={cn(
            "ml-auto px-2 py-0.5 bg-sidebar-primary/10 text-sidebar-primary rounded-full text-xs font-semibold",
             activeNav === 'arquivos' && fileTypeFilter === 'document' && !showSettings && "bg-sidebar-primary text-sidebar-primary-foreground"
          )}>{documentCount}</span>
        </motion.button>
      </nav>
    </div>
  );
});

SidebarFileTypes.displayName = 'SidebarFileTypes';

export default SidebarFileTypes;
