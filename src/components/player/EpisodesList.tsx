import { memo, useCallback, useState } from 'react';
import { Check, CheckCircle2, Circle, Copy, Play } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from "@/lib/utils";
import VideoThumbnail from './VideoThumbnail';
import ContextMenu, { type ContextMenuItem } from '../ContextMenu';
import { FileEntry } from '../../contexts/FilesContext';

interface EpisodesListProps {
  siblings: FileEntry[];
  isLoading: boolean;
  currentFile: FileEntry;
  onPlayFile: (file: FileEntry) => void;
  checkWatchedStatus: (path: string) => boolean;
  onToggleWatched: (path: string, isWatched: boolean) => void;
  onCopyPath: (path: string) => void;
}

const EpisodesList = memo(function EpisodesList({
  siblings,
  isLoading,
  currentFile,
  onPlayFile,
  checkWatchedStatus,
  onToggleWatched,
  onCopyPath
}: EpisodesListProps) {
  const { t } = useTranslation();
  const [menu, setMenu] = useState<{ x: number; y: number; file: FileEntry } | null>(null);
  const closeMenu = useCallback(() => setMenu(null), []);

  const menuItems = (file: FileEntry): ContextMenuItem[] => {
    const watched = checkWatchedStatus(file.path);
    return [
      {
        label: t('video.play'),
        icon: <Play size={15} />,
        onSelect: () => onPlayFile(file),
        disabled: file.path === currentFile.path,
      },
      {
        label: watched ? t('video.mark_as_unwatched') : t('video.mark_as_watched'),
        icon: watched ? <Circle size={15} /> : <CheckCircle2 size={15} />,
        onSelect: () => onToggleWatched(file.path, !watched),
      },
      {
        label: t('video.copy_path'),
        icon: <Copy size={15} />,
        onSelect: () => onCopyPath(file.path),
        separatorBefore: true,
      },
    ];
  };

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
            const isMenuTarget = menu?.file.path === sibling.path;

            return (
              <div
                key={sibling.path}
                className={cn(
                  "flex gap-4 p-3 rounded-xl cursor-pointer transition-all border border-transparent group",
                  isCurrent ? "bg-primary/10 border-primary/20" : "hover:bg-white/10 hover:border-white/10",
                  isMenuTarget && !isCurrent && "bg-white/10 border-white/10"
                )}
                onClick={() => onPlayFile(sibling)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setMenu({ x: e.clientX, y: e.clientY, file: sibling });
                }}
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
                  <div className={cn("text-sm font-medium leading-snug line-clamp-2 group-hover:text-white transition-colors", isCurrent ? "text-primary font-semibold" : "text-slate-300")}>
                    {sibling.name}
                  </div>
                  <div className="text-xs text-slate-500 font-medium">
                    {isCurrent ? (
                      <span className="flex items-center gap-1.5 text-primary">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
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

      {menu && (
        // The menu is portaled to <body>, outside the player's dark scope, so it opts in itself.
        <ContextMenu
          x={menu.x}
          y={menu.y}
          items={menuItems(menu.file)}
          onClose={closeMenu}
          className="dark"
        />
      )}
    </div>
  );
});

export default EpisodesList;
