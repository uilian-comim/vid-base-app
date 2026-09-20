import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Folder, ArrowUpRight } from 'lucide-react';

interface DirectoryCardProps {
  name: string;
  path: string;
  fileCount: number;
  color?: 'blue' | 'purple' | 'green' | 'orange';
  onClick: () => void;
  index?: number;
}

const HUES = { blue: 215, purple: 268, green: 158, orange: 28 };

export default memo(function DirectoryCard({ name, path, fileCount, color = 'blue', onClick, index = 0 }: DirectoryCardProps) {
  const { t } = useTranslation();
  const hue = HUES[color];

  return (
    <motion.button
      type="button"
      onClick={onClick}
      className="surface surface-hover group relative flex h-full min-h-[148px] w-full cursor-pointer flex-col justify-between overflow-hidden rounded-2xl p-5 text-left"
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: Math.min(index, 12) * 0.04, ease: [0.2, 0.8, 0.2, 1] }}
      whileTap={{ scale: 0.98 }}
      style={{ ['--h' as string]: hue }}
    >
      <div
        className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full opacity-40 blur-3xl transition-opacity duration-300 group-hover:opacity-80"
        style={{ background: `hsl(${hue} 90% 60%)` }}
      />
      <div className="relative flex items-start justify-between">
        <div
          className="flex h-11 w-11 items-center justify-center rounded-xl text-white shadow-lg transition-transform duration-300 group-hover:-rotate-3 group-hover:scale-105"
          style={{ background: `linear-gradient(135deg, hsl(${hue} 90% 62%), hsl(${hue + 30} 85% 50%))`, boxShadow: `0 8px 20px -6px hsl(${hue} 90% 55% / .55)` }}
        >
          <Folder size={22} className="fill-white/25" />
        </div>
        <ArrowUpRight size={18} className="text-muted-foreground/40 transition-all duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-foreground" />
      </div>

      <div className="relative mt-5 min-w-0">
        <h3 className="truncate font-heading text-[16px] font-semibold leading-tight">{name}</h3>
        <p className="mt-1 truncate font-mono text-[11px] text-muted-foreground/60" title={path}>{path}</p>
        <span className="mt-3 inline-flex items-center rounded-full bg-foreground/[0.06] px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
          {t('common.items', { count: fileCount })}
        </span>
      </div>
    </motion.button>
  );
});
