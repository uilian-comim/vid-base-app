import { memo } from 'react';
import { Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from "@/lib/utils";
import VideoThumbnail from './VideoThumbnail';
import { FileEntry } from '../contexts/FilesContext';

interface EpisodesListProps {
  siblings: FileEntry[];
  isLoading: boolean;
  currentFile: FileEntry;
  onPlayFile: (file: FileEntry) => void;
  checkWatchedStatus: (path: string) => boolean;
}

const EpisodesList = memo(function EpisodesList({
  siblings,
  isLoading,
  currentFile,
  onPlayFile,
  checkWatchedStatus
}: EpisodesListProps) {
  const { t } = useTranslation();

  return (
    <div className="bg-[#121217]/95 border-l border-white/5 flex flex-col backdrop-blur-3xl z-20 overflow-hidden h-full">
      <div className="p-8 border-b border-white/5">
        <h2 className="text-lg font-bold text-white mb-1">{t('video.course_episodes')}</h2>
        <span className="text-sm text-slate-400">{siblings.length} {t('video.lessons')}</span>
      </div>

      <div className="p-6 flex flex-col gap-3 overflow-y-auto flex-1 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/10 hover:scrollbar-thumb-white/20">
        {isLoading ? (
          <div className="py-8 text-center opacity-50 text-slate-400">{t('video.loading')}</div>
        ) : (
          siblings.map((sibling, index) => {
            const isCurrent = sibling.path === currentFile.path;
            const siblingWatched = checkWatchedStatus(sibling.path);

            return (
              <div 
                key={sibling.path} 
                className={cn(
                  "flex gap-4 p-3 rounded-xl cursor-pointer transition-all border border-transparent group",
                  isCurrent ? "bg-primary/10 border-primary/20" : "hover:bg-white/10 hover:border-white/10"
                )}
                onClick={() => onPlayFile(sibling)}
              >
                <div className="w-[120px] shrink-0 rounded-lg overflow-hidden relative shadow-md group-hover:shadow-lg transition-shadow">
                  <VideoThumbnail filePath={sibling.path} time={10} maxWidth={120} className="w-full h-full object-cover aspect-video" />
                  {siblingWatched && (
                    <div className="absolute top-1 right-1 bg-emerald-500 rounded-full p-0.5 shadow-sm">
                      <Check size={10} className="text-white" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                </div>
                <div className="flex flex-col justify-center gap-1 min-w-0">
                  <div className={cn("text-sm font-medium leading-snug line-clamp-2 group-hover:text-white transition-colors", isCurrent ? "text-primary-300 font-semibold" : "text-slate-300")}>
                    {sibling.name}
                  </div>
                  <div className="text-xs text-slate-500 font-medium">
                    {isCurrent ? (
                      <span className="flex items-center gap-1.5 text-primary-400">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary-400 animate-pulse" />
                        {t('video.playing_now')}
                      </span>
                    ) : (
                      <span>{t('video.lesson')} {index + 1 < 10 ? `0${index + 1}` : index + 1}</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
});

export default EpisodesList;
