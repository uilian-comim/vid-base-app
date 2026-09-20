import { memo } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Film, FileText, Clock, Check, Play } from 'lucide-react';
import PathTooltip from './PathTooltip';
import { FileEntry } from '../contexts/FilesContext';
import { cn } from "@/lib/utils";

interface FileCardProps {
  file: FileEntry;
  onClick: () => void;
  index?: number;
  progress?: number;
  lastWatched?: string;
  completed?: boolean;
}

export default memo(function FileCard({ file, onClick, index = 0, progress, lastWatched, completed }: FileCardProps) {
  const { t } = useTranslation();
  const isVideo = file.file_type === 'video';
  const Icon = isVideo ? Film : FileText;

  return (
    <motion.div
      role="button"
      tabIndex={0}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onClick()}
      className="surface surface-hover group relative flex cursor-pointer items-center gap-4 overflow-hidden rounded-2xl p-4"
      onClick={onClick}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: Math.min(index, 12) * 0.03, ease: [0.2, 0.8, 0.2, 1] }}
      whileTap={{ scale: 0.985 }}
    >
      <div
        className={cn(
          "relative flex h-14 w-14 shrink-0 items-center justify-center rounded-xl text-white shadow-md transition-transform duration-300 group-hover:scale-105",
          isVideo ? "bg-gradient-to-br from-indigo-500 to-fuchsia-500 shadow-indigo-500/30" : "bg-gradient-to-br from-amber-400 to-orange-500 shadow-orange-500/30"
        )}
      >
        <Icon size={24} className="transition-opacity group-hover:opacity-0" />
        {isVideo && <Play size={22} className="absolute fill-white opacity-0 transition-opacity group-hover:opacity-100" />}
        {completed && (
          <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 ring-2 ring-card">
            <Check size={12} strokeWidth={3} />
          </span>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <h4 className="line-clamp-2 break-words text-[14px] font-semibold leading-snug">{file.name}</h4>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="rounded-md bg-foreground/[0.06] px-1.5 py-0.5 font-medium">
            {isVideo ? t('file_card.video') : t('file_card.document')}
          </span>
          {lastWatched && (
            <span className="flex items-center gap-1"><Clock size={11} />{lastWatched}</span>
          )}
        </div>
        <div className="opacity-70"><PathTooltip path={file.path} /></div>
      </div>

      {progress !== undefined && progress > 0 && (
        <div className="absolute inset-x-0 bottom-0 h-[3px] bg-foreground/10">
          <motion.div
            className="brand-bg h-full rounded-r-full"
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(progress, 100)}%` }}
            transition={{ duration: 0.6, delay: 0.15 }}
          />
        </div>
      )}
    </motion.div>
  );
});
