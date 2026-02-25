import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Folder, ChevronRight, File } from 'lucide-react';
import { cn } from "@/lib/utils";

interface DirectoryCardProps {
  name: string;
  path: string;
  fileCount: number;
  color?: 'blue' | 'purple' | 'green' | 'orange';
  onClick: () => void;
  index?: number;
}

export default memo(function DirectoryCard({ 
  name, 
  path, 
  fileCount, 
  color = 'blue', 
  onClick,
  index = 0
}: DirectoryCardProps) {
  const { t } = useTranslation();
  
  const cardVariants = {
    blue: "from-blue-500/10 via-blue-500/5 to-transparent border-blue-200/50 dark:border-blue-500/20 hover:border-blue-400/50 dark:hover:border-blue-400/50 hover:shadow-blue-500/10",
    purple: "from-purple-500/10 via-purple-500/5 to-transparent border-purple-200/50 dark:border-purple-500/20 hover:border-purple-400/50 dark:hover:border-purple-400/50 hover:shadow-purple-500/10",
    green: "from-emerald-500/10 via-emerald-500/5 to-transparent border-emerald-200/50 dark:border-emerald-500/20 hover:border-emerald-400/50 dark:hover:border-emerald-400/50 hover:shadow-emerald-500/10",
    orange: "from-orange-500/10 via-orange-500/5 to-transparent border-orange-200/50 dark:border-orange-500/20 hover:border-orange-400/50 dark:hover:border-orange-400/50 hover:shadow-orange-500/10"
  };

  const iconVariants = {
    blue: "text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-500/20",
    purple: "text-purple-600 dark:text-purple-400 bg-purple-100 dark:bg-purple-500/20",
    green: "text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-500/20",
    orange: "text-orange-600 dark:text-orange-400 bg-orange-100 dark:bg-orange-500/20"
  };

  const glowVariants = {
    blue: "bg-blue-500",
    purple: "bg-purple-500",
    green: "bg-emerald-500",
    orange: "bg-orange-500"
  };

  return (
    <motion.div
      className={cn(
        "group relative rounded-2xl p-8 cursor-pointer h-full min-h-[320px] flex flex-col justify-between transition-all duration-300 hover:z-10",
        "bg-gradient-to-br bg-card/50 backdrop-blur-sm border shadow-sm hover:shadow-2xl",
        cardVariants[color]
      )}
      onClick={onClick}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ 
        duration: 0.4,
        delay: index * 0.05,
        type: "spring",
        stiffness: 100,
        damping: 15
      }}
      whileHover={{ y: -8, scale: 1.05 }}
      whileTap={{ scale: 0.98 }}
    >
      {/* Background Glow Effect */}
      <div className={cn(
        "absolute -top-20 -right-20 w-40 h-40 rounded-full blur-[60px] opacity-20 dark:opacity-10 transition-opacity group-hover:opacity-40",
        glowVariants[color]
      )} />
      
      <div className="flex justify-between items-start z-10">
        <div className={cn(
          "w-20 h-20 rounded-xl flex items-center justify-center transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3 shadow-sm",
          iconVariants[color]
        )}>
          <Folder size={40} className="fill-current opacity-90" />
        </div>
        
        <div className="opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-x-2 group-hover:translate-x-0">
          <div className="w-8 h-8 rounded-full bg-foreground/5 hover:bg-foreground/10 flex items-center justify-center backdrop-blur-sm">
            <ChevronRight size={16} className="text-muted-foreground" />
          </div>
        </div>
      </div>
      
      <div className="space-y-3 z-10 mt-4">
        <div>
          <h3 className="text-2xl font-bold text-foreground leading-tight tracking-tight line-clamp-1 group-hover:text-primary transition-colors duration-300">
            {name}
          </h3>
          <p className="text-sm text-muted-foreground/70 font-mono truncate mt-1 opacity-60 group-hover:opacity-100 transition-opacity">
            {path}
          </p>
        </div>
        
        <div className="flex items-center gap-2 pt-3 border-t border-border/10 group-hover:border-border/30 transition-colors">
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground px-2 py-1 rounded-md bg-secondary/50 group-hover:bg-secondary transition-colors">
            <File size={12} className="opacity-70" />
            <span>{t('common.items', { count: fileCount })}</span>
          </div>
        </div>
      </div>

      {/* Decorative Bottom Bar */}
      <div className={cn(
        "absolute bottom-0 left-0 h-1 w-full bg-gradient-to-r opacity-0 group-hover:opacity-100 transition-opacity duration-300",
        color === 'blue' && "from-blue-500/0 via-blue-500 to-blue-500/0",
        color === 'purple' && "from-purple-500/0 via-purple-500 to-purple-500/0",
        color === 'green' && "from-emerald-500/0 via-emerald-500 to-emerald-500/0",
        color === 'orange' && "from-orange-500/0 via-orange-500 to-orange-500/0",
      )} />
    </motion.div>
  );
});
