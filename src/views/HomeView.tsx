import { useTranslation } from 'react-i18next';
import { motion } from "framer-motion";
import { Video, FileText, Play, Clock, ChevronRight } from "lucide-react";
import { FileEntry } from "../contexts/FilesContext";
import VideoThumbnail from "../components/player/VideoThumbnail";
import PathTooltip from "../components/PathTooltip";
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

export default function HomeView({
  lastWatched,
  recentFiles,
  directories,
  isLoading,
  videoCount,
  documentCount,
  onOpenFile,
  onNavigateDirectory,
  onNavigateType,
  onAddDirectory
}: HomeViewProps) {
  const { t } = useTranslation();
  

  return (
    <motion.div 
      className="max-w-full m-0 p-8 min-h-full relative"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      style={{ zIndex: 1 }}
    >
      {/* Ambient Background */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden bg-[radial-gradient(circle_at_15%_50%,rgba(99,102,241,0.05),transparent_25%),radial-gradient(circle_at_85%_30%,rgba(139,92,246,0.05),transparent_25%)]">
        <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] rounded-full blur-[100px] opacity-20 bg-primary animate-[pulse_25s_infinite_ease-in-out]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[60vw] h-[60vw] rounded-full blur-[100px] opacity-20 bg-[#8B5CF6] animate-[pulse_30s_infinite_ease-in-out] delay-[-5s]"></div>
      </div>



      {/* Hero Section - Continue Watching */}
      {lastWatched && lastWatched.fileType === 'video' && (
        <motion.section 
          className="mb-12 relative z-10" 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <div 
            className="relative rounded-3xl overflow-hidden bg-white dark:bg-card shadow-2xl border border-white/20 dark:border-white/10 group transition-all duration-300 hover:-translate-y-1 hover:shadow-3xl"
            style={{ cursor: 'default' }}
          >
           {/* Background Image with Blur */}
           <div className="absolute inset-0 opacity-20 dark:opacity-40 blur-[80px] z-0 overflow-hidden">
             <VideoThumbnail filePath={lastWatched.filePath} time={lastWatched.completed ? 10 : lastWatched.currentTime} maxWidth={200} />
             <div className="absolute inset-0 bg-gradient-to-r from-white/90 to-white/50 dark:from-black/80 dark:to-black/40"></div>
           </div>

           <div className="relative z-10 p-10 flex gap-12 items-center">
             {/* Thumbnail */}
             <motion.div 
               whileHover={{ scale: 1.02, rotate: 1 }}
               className="w-[320px] rounded-2xl overflow-hidden shadow-2xl shrink-0 border border-black/5 dark:border-white/10"
             >
                <VideoThumbnail 
                  filePath={lastWatched.filePath} 
                  time={lastWatched.completed ? 10 : lastWatched.currentTime} 
                  maxWidth={640} 
                />
             </motion.div>

             {/* Content */}
             <div className="flex-1">
               <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 backdrop-blur-md text-xs font-bold tracking-wider uppercase text-primary border border-primary/20 mb-4">
                 <Clock size={12} />
                 {t('home.continue_watching')}
               </div>
               
               <h2 className="text-[2.5rem] font-bold mb-2 leading-[1.1] text-foreground drop-shadow-sm">
                 {lastWatched.fileName}
               </h2>
               
               <div className="mb-4 flex items-center gap-1.5 text-muted-foreground">
                 <PathTooltip path={lastWatched.filePath} />
               </div>
               
               <div className="flex items-center gap-4 mb-8 text-base font-medium text-foreground/80">
                 <span className="text-primary">{formatRelativeTime(lastWatched.lastWatchedAt)}</span>
                 <span className="opacity-40">•</span>
                 <span>{formatTime(lastWatched.duration - lastWatched.currentTime)} {t('home.remaining')}</span>
               </div>

               {/* Progress Bar */}
               <div className="mb-8 max-w-[400px]">
                  <div className="flex justify-between text-sm mb-2 font-medium text-foreground/80">
                    <span>{formatTime(lastWatched.currentTime)}</span>
                    <span className="opacity-60">{formatTime(lastWatched.duration)}</span>
                  </div>
                  <div className="h-2 bg-black/5 dark:bg-white/10 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-primary to-violet-500 rounded-full shadow-[0_0_10px_rgba(139,92,246,0.3)]"
                      style={{ 
                        width: `${lastWatched.duration > 0 ? (lastWatched.currentTime / lastWatched.duration) * 100 : 0}%`
                      }} 
                    />
                  </div>
               </div>

               <motion.button 
                 onClick={(e) => {
                   e.stopPropagation();
                   onOpenFile({ 
                     name: lastWatched.fileName, 
                     path: lastWatched.filePath, 
                     file_type: lastWatched.fileType 
                   });
                 }}
                 whileHover={{ scale: 1.05 }}
                 whileTap={{ scale: 0.95 }}
                 className="flex items-center gap-2.5 bg-foreground text-background border-none px-8 py-3.5 rounded-2xl text-lg font-bold cursor-pointer shadow-xl hover:shadow-2xl transition-transform"
               >
                 <Play size={22} className="fill-background" />
                 {lastWatched.completed ? t('home.watch_again') : t('home.continue_watching')}
               </motion.button>
             </div>
           </div>
          </div>
        </motion.section>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '3rem', position: 'relative', zIndex: 1 }}>
        
        {/* Left Column: Recent Files & Directories */}
        <div className="flex flex-col gap-10">
          
          {/* Recent Files */}
          <RecentFilesSection 
            isLoading={isLoading} 
            recentFiles={recentFiles} 
            onOpenFile={onOpenFile} 
          />

          {/* Directories */}
          <DirectoriesSection 
            directories={directories} 
            onNavigateDirectory={onNavigateDirectory} 
            onAddDirectory={onAddDirectory} 
          />
        </div>

        {/* Right Column: Stats/Types */}
        <div className="flex flex-col gap-10">
          <motion.section 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <h2 className="text-2xl font-bold font-heading mb-6 text-foreground">{t('home.library')}</h2>
            
            <div className="grid grid-cols-1 gap-6">
              <motion.div 
                className="relative overflow-hidden rounded-3xl p-6 transition-all duration-300 border border-white/20 bg-gradient-to-br from-[#6366f1] to-[#4f46e5] shadow-lg shadow-indigo-500/30 text-white cursor-pointer hover:-translate-y-1 hover:shadow-xl hover:shadow-indigo-500/40"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => onNavigateType('video')}
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/10">
                    <Video size={24} color="white" />
                  </div>
                  <ChevronRight size={20} className="opacity-60" />
                </div>
                
                <div className="text-[2.5rem] font-bold leading-none mb-1">{videoCount}</div>
                <div className="text-base font-medium opacity-80">{t('home.videos')}</div>
                
                <div className="absolute -right-5 -bottom-5 opacity-10 pointer-events-none">
                  <Video size={120} />
                </div>
              </motion.div>

              <motion.div 
                className="relative overflow-hidden rounded-3xl p-6 transition-all duration-300 border border-white/20 bg-gradient-to-br from-[#f97316] to-[#ea580c] shadow-lg shadow-orange-500/30 text-white cursor-pointer hover:-translate-y-1 hover:shadow-xl hover:shadow-orange-500/40"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => onNavigateType('document')}
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/10">
                    <FileText size={24} color="white" />
                  </div>
                  <ChevronRight size={20} className="opacity-60" />
                </div>
                
                <div className="text-[2.5rem] font-bold leading-none mb-1">{documentCount}</div>
                <div className="text-base font-medium opacity-80">{t('home.documents')}</div>

                <div className="absolute -right-5 -bottom-5 opacity-10 pointer-events-none">
                  <FileText size={120} />
                </div>
              </motion.div>
            </div>
          </motion.section>
        </div>

      </div>
    </motion.div>
  );
}
