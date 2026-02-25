import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useWatchHistory } from '../contexts/WatchHistoryContext';
import VideoThumbnail from '../components/player/VideoThumbnail';
import FileCard from '../components/FileCard';
import PathTooltip from '../components/PathTooltip';
import { Play, Clock } from 'lucide-react';
import { formatRelativeTime } from '../utils/utils';

// Helper function to format seconds to MM:SS or HH:MM:SS
function formatTime(seconds: number): string {
  if (!seconds || seconds < 0) return "0:00";
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}



interface ContinueWatchingViewProps {
  onFileClick: (file: { name: string; path: string; file_type: 'video' | 'document' }) => void;
}

export default function ContinueWatchingView({ onFileClick }: ContinueWatchingViewProps) {
  const { t } = useTranslation();
  const { getLastWatched, getContinueWatching } = useWatchHistory();
  
  const lastWatched = getLastWatched();
  const continueWatchingList = getContinueWatching();

  return (
    <motion.div 
      className="p-6 space-y-12 max-w-[1600px] mx-auto w-full"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">{t('continue_watching.title')}</h1>
        <p className="text-muted-foreground text-lg">{t('continue_watching.subtitle')}</p>
      </header>

      {/* Featured Last Watched */}
      {lastWatched && lastWatched.fileType === 'video' ? (
        <motion.section 
          className="mb-12"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-8 items-start">
            <motion.div 
              className="relative aspect-video rounded-xl overflow-hidden shadow-2xl bg-black group ring-1 ring-white/10" 
              whileHover={{ scale: 1.01 }}
              transition={{ duration: 0.2 }}
            >
              <VideoThumbnail 
                filePath={lastWatched.filePath} 
                time={lastWatched.completed ? 10 : lastWatched.currentTime} 
                maxWidth={1200}
                className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
              />
              
              {/* Play Overlay */}
              <motion.div
                className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-all duration-300"
                initial={{ opacity: 0 }}
                whileHover={{ opacity: 1 }}
              >
                <motion.div
                  whileHover={{ scale: 1.1 }}
                  className="w-20 h-20 rounded-full bg-primary flex items-center justify-center shadow-xl shadow-black/50"
                >
                  <Play size={40} fill="white" color="white" className="ml-1" />
                </motion.div>
              </motion.div>

              {/* Progress Bar */}
              {lastWatched.duration > 0 && !lastWatched.completed && (
                <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-black/50">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${(lastWatched.currentTime / lastWatched.duration) * 100}%` }}
                    transition={{ duration: 0.5, delay: 0.2 }}
                    className="h-full bg-gradient-to-r from-primary to-blue-500"
                  />
                </div>
              )}

              {/* Duration Badge */}
              {lastWatched.duration > 0 && (
                <div className="absolute top-3 right-3 px-3 py-1.5 rounded-md bg-black/70 backdrop-blur-md text-white text-xs font-semibold flex items-center gap-1.5 shadow-lg border border-white/10">
                  <Clock size={14} />
                  {formatTime(lastWatched.completed ? lastWatched.duration : lastWatched.currentTime)} / {formatTime(lastWatched.duration)}
                </div>
              )}
            </motion.div>
            
            <motion.div 
              className="flex flex-col gap-4 p-6 bg-card rounded-xl border border-border shadow-sm h-full"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 }}
            >
              <h3 className="text-2xl font-bold tracking-tight line-clamp-2">{lastWatched.fileName}</h3>
              <div className="mb-2 flex items-center gap-2">
                <PathTooltip path={lastWatched.filePath} />
              </div>
              <p className="text-muted-foreground line-clamp-3 mb-4">
                {lastWatched.completed 
                  ? t('continue_watching.video_completed')
                  : t('continue_watching.continue_prompt')}
              </p>
              <div className="flex items-center gap-3 text-sm text-muted-foreground font-medium mb-auto">
                {!lastWatched.completed && lastWatched.duration > 0 && (
                  <span>⏱️ {t('continue_watching.remaining')} {formatTime(lastWatched.duration - lastWatched.currentTime)}</span>
                )}
                <span>• {t('continue_watching.last_watched')} {formatRelativeTime(lastWatched.lastWatchedAt)}</span>
              </div>
              
              <motion.button 
                className="mt-6 w-full py-3 bg-primary text-primary-foreground rounded-lg font-semibold hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-2"
                onClick={() => onFileClick({ 
                  name: lastWatched.fileName, 
                  path: lastWatched.filePath, 
                  file_type: lastWatched.fileType 
                })}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Play size={18} fill="currentColor" />
                {lastWatched.completed ? t('continue_watching.watch_again') : t('continue_watching.continue')}
              </motion.button>
            </motion.div>
          </div>
        </motion.section>
      ) : null}

      {/* Continue Watching List */}
      <section className="space-y-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold tracking-tight">{t('continue_watching.history_title')}</h2>
          </div>
        </div>

        {continueWatchingList.length > 0 ? (
          <motion.div 
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3, delay: 0.2 }}
          >
            {continueWatchingList.map((item, index) => (
              <FileCard
                key={index}
                file={{
                  name: item.fileName,
                  path: item.filePath,
                  file_type: item.fileType
                }}
                onClick={() => onFileClick({ 
                  name: item.fileName, 
                  path: item.filePath, 
                  file_type: item.fileType 
                })}
                index={index}
                progress={item.duration > 0 ? (item.currentTime / item.duration) * 100 : undefined}
                lastWatched={formatRelativeTime(item.lastWatchedAt)}
                completed={item.completed}
              />
            ))}
          </motion.div>
        ) : (
          <motion.div 
            className="flex flex-col items-center justify-center py-20 text-center space-y-4 opacity-70"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="text-6xl mb-4 grayscale opacity-50">▶️</div>
            <p className="text-lg text-muted-foreground">{t('continue_watching.no_videos')}</p>
            <p className="text-sm text-muted-foreground">{t('continue_watching.start_watching')}</p>
          </motion.div>
        )}
      </section>
    </motion.div>
  );
}
