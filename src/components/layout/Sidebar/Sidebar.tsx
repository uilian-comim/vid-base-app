import { motion } from "framer-motion";
import { Settings as SettingsIcon } from "lucide-react";
import { useTranslation } from 'react-i18next';
import { cn } from "@/lib/utils";
import React from "react";
import { Directory } from "../../../contexts/FilesContext";
import SidebarNavigation from "./SidebarNavigation";
import SidebarFileTypes from "./SidebarFileTypes";
import SidebarDirectories from "./SidebarDirectories";

interface SidebarProps {
  activeNav: string;
  setActiveNav: (nav: string) => void;
  showSettings: boolean;
  setShowSettings: (show: boolean) => void;
  browserPath: string | null;
  setBrowserPath: (path: string | null) => void;
  fileTypeFilter: 'video' | 'document' | null;
  setFileTypeFilter: (type: 'video' | 'document' | null) => void;
  videoCount: number;
  documentCount: number;
  directories: Directory[];
  filesCount: number;
  navigateToDirectory: (path: string) => void;
}

const Sidebar = React.memo(({
  activeNav,
  setActiveNav,
  showSettings,
  setShowSettings,
  browserPath,
  setBrowserPath,
  fileTypeFilter,
  setFileTypeFilter,
  videoCount,
  documentCount,
  directories,
  filesCount,
  navigateToDirectory
}: SidebarProps) => {
  const { t } = useTranslation();

  return (
    <aside className="w-[280px] bg-sidebar border-r border-sidebar-border flex flex-col overflow-y-auto shrink-0 transition-colors duration-300">
      <div className="p-6 border-b border-sidebar-border">
        <motion.h1 
          className="text-2xl font-bold font-heading bg-gradient-to-br from-sidebar-primary to-[#667eea] bg-clip-text text-transparent m-0"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          VidBase
        </motion.h1>
      </div>

      <SidebarNavigation 
        activeNav={activeNav}
        setActiveNav={setActiveNav}
        showSettings={showSettings}
        setShowSettings={setShowSettings}
        setBrowserPath={setBrowserPath}
        fileTypeFilter={fileTypeFilter}
        setFileTypeFilter={setFileTypeFilter}
      />

      <SidebarFileTypes 
        activeNav={activeNav}
        setActiveNav={setActiveNav}
        showSettings={showSettings}
        setShowSettings={setShowSettings}
        setBrowserPath={setBrowserPath}
        fileTypeFilter={fileTypeFilter}
        setFileTypeFilter={setFileTypeFilter}
        videoCount={videoCount}
        documentCount={documentCount}
      />

      <SidebarDirectories 
        browserPath={browserPath}
        directories={directories}
        navigateToDirectory={navigateToDirectory}
      />

      {/* Settings Button */}
      <div className="mt-auto pt-4 w-full flex flex-col">
        <motion.button
          className={cn(
            "flex items-center justify-center gap-2 mx-4 mb-4 p-3 active:scale-95 bg-sidebar-primary text-sidebar-primary-foreground border-none rounded-md text-sm font-medium cursor-pointer transition-all shadow-sm hover:bg-sidebar-primary/90 hover:shadow-md",
            showSettings && "bg-sidebar-primary/90 shadow-md ring-2 ring-sidebar-ring ring-offset-2"
          )}
          onClick={() => setShowSettings(true)}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <SettingsIcon size={20} className="shrink-0" />
          <span>{t('sidebar.settings')}</span>
        </motion.button>

        <div className="p-4 border-t border-sidebar-border text-xs text-muted-foreground text-center">
          {filesCount} {t('common.files')} • {directories.length} {t('common.folders')}
        </div>
      </div>
    </aside>
  );
});

Sidebar.displayName = 'Sidebar';

export default Sidebar;
