import { motion, AnimatePresence } from "framer-motion";
import { Home, Play, FileText, Folder, Settings as SettingsIcon, Video, FileType } from "lucide-react";
import { useTranslation } from 'react-i18next';
import { cn } from "@/lib/utils";
import { Directory } from "../contexts/FilesContext";

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

export default function Sidebar({
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
}: SidebarProps) {
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

      {/* Main Navigation */}
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

      {/* File Types */}
      <div className="mt-4">
        <div className="px-4 py-2 text-[13px] font-bold text-muted-foreground uppercase tracking-wider mb-1">{t('sidebar.file_types')}</div>
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

      {/* Directories */}
      <div className="mt-4">
        <div className="px-4 py-2 text-[13px] font-bold text-muted-foreground uppercase tracking-wider mb-1">{t('sidebar.directories')}</div>
        <nav className="flex flex-col gap-1 p-4 pt-2 max-h-[200px] overflow-y-auto">
          <AnimatePresence>
            {directories.slice(0, 5).map((dir, index) => (
              <motion.button
                key={dir.path}
                className={cn(
                  "relative flex items-center gap-2 px-4 py-2.5 border-none bg-transparent text-sidebar-foreground/70 text-[15px] font-medium text-left cursor-pointer rounded-md transition-all overflow-hidden mb-1 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground dark:hover:bg-white/10 dark:hover:text-white",
                  browserPath === dir.path && "bg-sidebar-accent text-sidebar-primary font-semibold dark:bg-white/10 dark:text-white"
                )}
                onClick={() => navigateToDirectory(dir.path)}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ delay: index * 0.05 }}
                whileHover={{ x: 4 }}
                whileTap={{ scale: 0.98 }}
              >
                <Folder size={18} />
                <span>{dir.name}</span>
              </motion.button>
            ))}
          </AnimatePresence>
        </nav>
      </div>

      {/* Settings Button */}
      <motion.button
        className={cn(
          "flex items-center gap-2 mx-4 mb-4 p-3 px-4 bg-sidebar-primary text-sidebar-primary-foreground border-none rounded-md text-sm font-medium cursor-pointer transition-all shadow-sm hover:bg-sidebar-primary/90 hover:shadow-md",
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
    </aside>
  );
}
