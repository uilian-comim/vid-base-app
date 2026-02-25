import { motion } from "framer-motion";
import { Play, Video, FileText, Folder } from "lucide-react";
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

function getFileIcon(fileType: string) {
  if (fileType === "video") return <Video size={18} className="text-blue-400" />;
  if (fileType === "document") return <FileText size={18} className="text-orange-400" />;
  return <Folder size={18} />;
}

const RecentFilesSection = React.memo(({
  isLoading,
  recentFiles,
  onOpenFile
}: RecentFilesSectionProps) => {
  const { t } = useTranslation();

  function getFileTypeLabel(fileType: string): string {
    if (fileType === 'video') return t('file_types.video');
    if (fileType === 'document') return t('file_types.document');
    return fileType;
  }

  return (
    <motion.section 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
    >
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold font-heading m-0 text-foreground">{t('home.recent')}</h2>
      </div>
      
      {isLoading ? (
          <div className="bg-white/50 backdrop-blur-md rounded-2xl p-8 text-center text-muted-foreground border border-white/20">{t('home.loading')}</div>
      ) : recentFiles.length > 0 ? (
        <div className="flex flex-col gap-3">
          {recentFiles.map((file, index) => (
            <motion.div 
              key={index}
              className="flex items-center gap-4 p-4 rounded-2xl bg-white/80 backdrop-blur-md border border-white/50 shadow-sm transition-all duration-200 cursor-pointer hover:bg-white hover:border-primary/20 hover:shadow-md hover:translate-x-1 dark:bg-card/40 dark:border-white/5 dark:hover:bg-card/80"
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              onClick={() => onOpenFile(file)}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <div className={cn(
                "w-12 h-12 rounded-xl flex items-center justify-center border border-black/5 dark:border-white/5",
                file.file_type === 'video' ? "bg-blue-50/80 text-blue-500 dark:bg-blue-500/15 dark:text-blue-400" : "bg-orange-50/80 text-orange-500 dark:bg-orange-500/15 dark:text-orange-400"
              )}>
                {getFileIcon(file.file_type)}
              </div>
              
              <div className="flex-1">
                <div className="font-semibold mb-1 text-base text-foreground">{file.name}</div>
                <div className="text-sm opacity-60 flex gap-2 items-center text-muted-foreground">
                  <span>{getFileTypeLabel(file.file_type)}</span>
                  <span className="opacity-40">•</span>
                  <PathTooltip path={file.path} />
                </div>
              </div>

              <div className="flex items-center gap-2 px-3 py-1.5 bg-primary rounded-full text-white text-xs font-medium opacity-0 -translate-x-2 transition-all duration-200 group-hover:opacity-100 group-hover:translate-x-0 shadow-lg shadow-primary/30">
                <Play size={14} fill="white" />
                {t('home.play')}
              </div>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="bg-white/50 backdrop-blur-md rounded-2xl p-8 text-center text-muted-foreground border border-white/20 font-medium">
            <p>{t('home.no_recent_files')}</p>
        </div>
      )}
    </motion.section>
  );
});

RecentFilesSection.displayName = 'RecentFilesSection';

export default RecentFilesSection;
