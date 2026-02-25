import { motion } from "framer-motion";
import { useTranslation } from 'react-i18next';
import React from "react";
import DirectoryCard from "../DirectoryCard";

interface DirectoriesSectionProps {
  directories: any[];
  onNavigateDirectory: (path: string) => void;
  onAddDirectory: () => void;
}

const DirectoriesSection = React.memo(({
  directories,
  onNavigateDirectory,
  onAddDirectory
}: DirectoriesSectionProps) => {
  const { t } = useTranslation();

  return (
    <motion.section 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4 }}
    >
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold font-heading m-0 text-foreground">{t('home.directories')}</h2>
        <button onClick={onAddDirectory} className="bg-transparent border-none text-primary cursor-pointer text-sm font-semibold hover:underline">
          + {t('home.add')}
        </button>
      </div>
      
      <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-6">
          {directories.map((dir, index) => (
            <motion.div
              key={index}
              whileHover={{ y: -5 }}
              className="h-full"
            >
              <DirectoryCard
                name={dir.name}
                path={dir.path}
                fileCount={dir.fileCount}
                color={dir.color}
                onClick={() => onNavigateDirectory(dir.path)}
                index={index}
              />
            </motion.div>
          ))}
          <motion.div 
            className="bg-white/40 backdrop-blur-sm border-2 border-dashed border-black/10 rounded-xl flex items-center justify-center cursor-pointer min-h-[160px] transition-all hover:bg-primary/5 hover:border-primary/40 hover:scale-105 active:scale-95 dark:bg-card/20 dark:border-white/10 dark:hover:bg-primary/10"
            onClick={onAddDirectory}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <div className="text-4xl text-muted-foreground/40 transition-colors">+</div>
          </motion.div>
      </div>
    </motion.section>
  );
});

DirectoriesSection.displayName = 'DirectoriesSection';

export default DirectoriesSection;
