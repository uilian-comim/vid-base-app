import { motion } from "framer-motion";
import { Film, FileText } from "lucide-react";
import { useTranslation } from 'react-i18next';
import { cn } from "@/lib/utils";
import React from "react";
import { FileEntry } from "../../contexts/FilesContext";
import PathTooltip from "../PathTooltip";

interface RecentFilesSectionProps {
  isLoading: boolean;
  recentFiles: FileEntry[];
  onOpenFile: (file: FileEntry) => void;
}

const RecentFilesSection = React.memo(({ isLoading, recentFiles, onOpenFile }: RecentFilesSectionProps) => {
  const { t } = useTranslation();

  return (
    <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
      <h2 className="mb-4 font-heading text-lg font-semibold">{t('home.recent')}</h2>

      {isLoading ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-3">
          {[0, 1, 2].map((i) => <div key={i} className="h-[76px] animate-pulse rounded-2xl bg-foreground/[0.06]" />)}
        </div>
      ) : recentFiles.length > 0 ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-3">
          {recentFiles.map((file, index) => {
            const isVideo = file.file_type === 'video';
            return (
              <motion.button
                key={file.path}
                onClick={() => onOpenFile(file)}
                className="surface surface-hover group flex cursor-pointer items-center gap-3 rounded-2xl p-3 text-left"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 + index * 0.05 }}
                whileTap={{ scale: 0.98 }}
              >
                <div className={cn(
                  "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white",
                  isVideo ? "bg-gradient-to-br from-indigo-500 to-fuchsia-500" : "bg-gradient-to-br from-amber-400 to-orange-500"
                )}>
                  {isVideo ? <Film size={19} /> : <FileText size={19} />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13.5px] font-semibold">{file.name}</div>
                  <div className="mt-0.5 truncate text-xs text-muted-foreground"><PathTooltip path={file.path} /></div>
                </div>
              </motion.button>
            );
          })}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-foreground/15 p-8 text-center text-sm text-muted-foreground">
          {t('home.no_recent_files')}
        </div>
      )}
    </motion.section>
  );
});

RecentFilesSection.displayName = 'RecentFilesSection';
export default RecentFilesSection;
