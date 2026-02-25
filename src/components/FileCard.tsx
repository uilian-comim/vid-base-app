import { memo } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { FileVideo, FileText, Clock, CheckCircle } from 'lucide-react';
import PathTooltip from './PathTooltip';
import { FileEntry } from '../contexts/FilesContext';
// import './FileCard.css';
import { cn } from "@/lib/utils";

interface FileCardProps {
  file: FileEntry;
  onClick: () => void;
  index?: number;
  progress?: number;
  lastWatched?: string;
  completed?: boolean;
}

export default memo(function FileCard({ 
  file, 
  onClick, 
  index = 0,
  progress,
  lastWatched,
  completed
}: FileCardProps) {
  const { t } = useTranslation();
  const Icon = file.file_type === 'video' ? FileVideo : FileText;
  
  return (
    <motion.div
      className={cn(
        "relative bg-white rounded-xl p-6 cursor-pointer shadow-sm flex gap-4 items-start overflow-hidden transition-all duration-250 hover:shadow-lg dark:bg-card dark:shadow-md dark:hover:shadow-xl hover:bg-accent/50 dark:hover:bg-accent/10",
        "before:absolute before:inset-x-0 before:top-0 before:h-[3px] before:bg-gradient-to-r before:from-primary before:to-[#667eea] before:opacity-0 before:transition-opacity before:duration-250 hover:before:opacity-100"
      )}
      onClick={onClick}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ 
        duration: 0.3,
        delay: index * 0.05,
        type: "spring",
        stiffness: 260,
        damping: 20
      }}
      whileHover={{ 
        scale: 1.02,
        y: -4,
        transition: { duration: 0.2 }
      }}
      whileTap={{ scale: 0.98 }}
    >
      <div className="relative shrink-0">
        <motion.div 
          className={cn(
            "w-12 h-12 rounded-lg flex items-center justify-center bg-primary/10 text-primary",
            file.file_type === 'video' && "bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400",
            file.file_type === 'document' && "bg-orange-50 text-orange-600 dark:bg-orange-900/20 dark:text-orange-400"
          )}
          whileHover={{ scale: 1.1 }}
          transition={{ type: "spring", stiffness: 400 }}
        >
          <Icon size={24} />
        </motion.div>
        {completed && (
          <motion.div 
            className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-green-500 text-white flex items-center justify-center shadow-sm"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", delay: 0.2 }}
          >
            <CheckCircle size={16} />
          </motion.div>
        )}
      </div>

      <div className="flex-1 min-w-0 flex flex-col gap-1">
        <h4 className="text-base font-semibold text-foreground m-0 overflow-hidden text-ellipsis whitespace-nowrap leading-tight">{file.name}</h4>
        <p className="text-sm text-muted-foreground m-0">
          {file.file_type === 'video' ? t('file_card.video') : t('file_card.document')}
        </p>

        <div className="mt-1">
          <PathTooltip path={file.path} />
        </div>
        
        {lastWatched && (
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <Clock size={12} />
            <span>{lastWatched}</span>
          </div>
        )}
      </div>

      {progress !== undefined && progress > 0 && (
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-border overflow-hidden">
          <motion.div 
            className="h-full bg-gradient-to-r from-primary to-[#667eea] rounded-tr-sm"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.5, delay: 0.2 }}
          />
        </div>
      )}
    </motion.div>
  );
});
