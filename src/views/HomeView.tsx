import { useTranslation } from 'react-i18next';
import { motion } from "framer-motion";
import { Film, FileText, Play, ChevronRight, FolderPlus, Sparkles } from "lucide-react";
import { FileEntry } from "../contexts/FilesContext";
import VideoThumbnail from "../components/player/VideoThumbnail";
import { formatTime, formatRelativeTime } from "../utils/utils";
import RecentFilesSection from "../components/home/RecentFilesSection";
import DirectoriesSection from "../components/home/DirectoriesSection";

interface HomeViewProps {
  lastWatched: any;
  recentFiles: FileEntry[];
  directories: any[];
  isLoading: boolean;
  videoCount: number;
  documentCount: number;
  onOpenFile: (file: FileEntry) => void;
  onNavigateDirectory: (path: string) => void;
  onNavigateType: (type: 'video' | 'document') => void;
  onAddDirectory: () => void;
}

function useGreeting() {
  const { t } = useTranslation();
  const h = new Date().getHours();
  return h < 12 ? t('palette.greet_morning') : h < 18 ? t('palette.greet_afternoon') : t('palette.greet_evening');
}

function StatTile({ icon, value, label, gradient, onClick }: { icon: React.ReactNode; value: number; label: string; gradient: string; onClick: () => void }) {
  return (
    <motion.button
      onClick={onClick}
      whileTap={{ scale: 0.98 }}
      className="surface surface-hover group flex cursor-pointer items-center gap-4 rounded-2xl p-4 text-left"
    >
      <div className={`flex h-12 w-12 items-center justify-center rounded-xl text-white shadow-lg ${gradient}`}>{icon}</div>
      <div className="flex-1">
        <div className="font-heading text-2xl font-bold leading-none tabular-nums">{value}</div>
        <div className="mt-1 text-xs font-medium text-muted-foreground">{label}</div>
      </div>
      <ChevronRight size={18} className="text-muted-foreground/40 transition-transform group-hover:translate-x-1 group-hover:text-foreground" />
    </motion.button>
  );
}

export default function HomeView({
  lastWatched, recentFiles, directories, isLoading, videoCount, documentCount,
  onOpenFile, onNavigateDirectory, onNavigateType, onAddDirectory
}: HomeViewProps) {
  const { t } = useTranslation();
  const greeting = useGreeting();
  const hasHero = lastWatched && lastWatched.fileType === 'video';
  const isEmpty = !isLoading && directories.length === 0;
  const progress = hasHero && lastWatched.duration > 0 ? (lastWatched.currentTime / lastWatched.duration) * 100 : 0;
  const thumbTime = hasHero ? (lastWatched.completed ? 10 : lastWatched.currentTime) : 0;

  return (
    <motion.div
      className="mx-auto flex min-h-full w-full max-w-[1280px] flex-col gap-10 px-10 pb-16 pt-10"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
    >
      <header>
        <motion.h1
          className="font-heading text-[34px] font-bold leading-tight"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
        >
          {greeting} <span className="brand-text">👋</span>
        </motion.h1>
        <p className="mt-1 text-[15px] text-muted-foreground">{t('palette.tagline')}</p>
      </header>

      {isEmpty && (
        <motion.section
          className="noise relative overflow-hidden rounded-3xl border border-foreground/10 p-12 text-center"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="brand-bg absolute inset-0 opacity-[0.12]" />
          <div className="relative mx-auto flex max-w-md flex-col items-center gap-5">
            <div className="brand-bg flex h-16 w-16 items-center justify-center rounded-2xl shadow-2xl shadow-primary/40">
              <Sparkles size={30} className="text-white" />
            </div>
            <h2 className="font-heading text-2xl font-bold">{t('palette.add_folder')}</h2>
            <p className="text-sm text-muted-foreground">{t('home.no_recent_files')}</p>
            <button
              onClick={onAddDirectory}
              className="brand-bg inline-flex cursor-pointer items-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold text-white shadow-xl shadow-primary/30 transition-transform hover:scale-105 active:scale-95"
            >
              <FolderPlus size={18} /> {t('palette.add_folder')}
            </button>
          </div>
        </motion.section>
      )}

      {hasHero && (
        <motion.section
          className="noise group relative isolate overflow-hidden rounded-3xl border border-foreground/10 bg-black shadow-2xl shadow-black/30"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, ease: [0.2, 0.8, 0.2, 1] }}
        >
          <div className="absolute inset-0 -z-10 scale-110 transition-transform duration-[1200ms] ease-out group-hover:scale-100">
            <VideoThumbnail filePath={lastWatched.filePath} time={thumbTime} maxWidth={960} />
          </div>
          <div className="absolute inset-0 -z-10 bg-gradient-to-r from-black/90 via-black/60 to-black/10" />
          <div className="absolute inset-0 -z-10 bg-gradient-to-t from-black/70 via-transparent to-transparent" />

          <div className="flex min-h-[340px] max-w-[640px] flex-col justify-end gap-4 p-10 text-white">
            <span className="inline-flex w-fit items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] backdrop-blur-md">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
              {t('palette.pick_up')}
            </span>

            <h2 className="line-clamp-2 font-heading text-[32px] font-bold leading-[1.1] drop-shadow-lg">{lastWatched.fileName}</h2>

            <div className="flex items-center gap-3 text-sm text-white/70">
              <span>{formatRelativeTime(lastWatched.lastWatchedAt)}</span>
              <span className="opacity-40">•</span>
              <span>{formatTime(lastWatched.duration - lastWatched.currentTime)} {t('home.remaining')}</span>
            </div>

            <div className="max-w-[420px]">
              <div className="h-1.5 overflow-hidden rounded-full bg-white/20">
                <motion.div
                  className="brand-bg h-full rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(progress, 100)}%` }}
                  transition={{ duration: 0.9, delay: 0.4, ease: [0.2, 0.8, 0.2, 1] }}
                />
              </div>
              <div className="mt-1.5 flex justify-between text-[11px] tabular-nums text-white/60">
                <span>{formatTime(lastWatched.currentTime)}</span>
                <span>{formatTime(lastWatched.duration)}</span>
              </div>
            </div>

            <button
              onClick={() => onOpenFile({ name: lastWatched.fileName, path: lastWatched.filePath, file_type: lastWatched.fileType })}
              className="mt-1 inline-flex w-fit cursor-pointer items-center gap-2.5 rounded-full bg-white px-7 py-3 text-[15px] font-bold text-black shadow-2xl transition-transform hover:scale-105 active:scale-95"
            >
              <Play size={18} className="fill-black" />
              {lastWatched.completed ? t('home.watch_again') : t('palette.resume')}
            </button>
          </div>
        </motion.section>
      )}

      {!isEmpty && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <StatTile icon={<Film size={22} />} value={videoCount} label={t('home.videos')} gradient="bg-gradient-to-br from-indigo-500 to-fuchsia-500 shadow-indigo-500/30" onClick={() => onNavigateType('video')} />
          <StatTile icon={<FileText size={22} />} value={documentCount} label={t('home.documents')} gradient="bg-gradient-to-br from-amber-400 to-orange-500 shadow-orange-500/30" onClick={() => onNavigateType('document')} />
        </div>
      )}

      {!isEmpty && <RecentFilesSection isLoading={isLoading} recentFiles={recentFiles} onOpenFile={onOpenFile} />}
      {!isEmpty && <DirectoriesSection directories={directories} onNavigateDirectory={onNavigateDirectory} onAddDirectory={onAddDirectory} />}
    </motion.div>
  );
}
