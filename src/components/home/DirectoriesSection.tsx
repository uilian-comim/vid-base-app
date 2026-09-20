import { motion } from "framer-motion";
import { useTranslation } from 'react-i18next';
import { Plus } from "lucide-react";
import React from "react";
import DirectoryCard from "../DirectoryCard";

interface DirectoriesSectionProps {
  directories: any[];
  onNavigateDirectory: (path: string) => void;
  onAddDirectory: () => void;
}

const DirectoriesSection = React.memo(({ directories, onNavigateDirectory, onAddDirectory }: DirectoriesSectionProps) => {
  const { t } = useTranslation();

  return (
    <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-heading text-lg font-semibold">{t('palette.your_folders')}</h2>
      </div>

      <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4">
        {directories.map((dir, index) => (
          <DirectoryCard
            key={dir.path}
            name={dir.name}
            path={dir.path}
            fileCount={dir.fileCount}
            color={dir.color}
            onClick={() => onNavigateDirectory(dir.path)}
            index={index}
          />
        ))}
        <button
          onClick={onAddDirectory}
          className="group flex min-h-[148px] cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-foreground/15 text-muted-foreground transition-all hover:border-primary/60 hover:bg-primary/5 hover:text-primary"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-foreground/[0.06] transition-transform group-hover:scale-110 group-hover:rotate-90">
            <Plus size={20} />
          </span>
          <span className="text-sm font-medium">{t('palette.add_folder')}</span>
        </button>
      </div>
    </motion.section>
  );
});

DirectoriesSection.displayName = 'DirectoriesSection';
export default DirectoriesSection;
