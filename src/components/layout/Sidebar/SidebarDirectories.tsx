import { motion, AnimatePresence } from "framer-motion";
import { Folder } from "lucide-react";
import { useTranslation } from 'react-i18next';
import { cn } from "@/lib/utils";
import React from "react";
import { Directory } from "../../../contexts/FilesContext";

interface SidebarDirectoriesProps {
  browserPath: string | null;
  directories: Directory[];
  navigateToDirectory: (path: string) => void;
}

const SidebarDirectories = React.memo(({
  browserPath,
  directories,
  navigateToDirectory
}: SidebarDirectoriesProps) => {
  const { t } = useTranslation();

  return (
    <div className="mt-4">
      <div className="px-4 py-2 text-[13px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
        {t('sidebar.directories')}
      </div>
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
  );
});

SidebarDirectories.displayName = 'SidebarDirectories';

export default SidebarDirectories;
