import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { 
  X, List, Folder, FileText
} from 'lucide-react';
import { convertFileSrc, invoke } from '@tauri-apps/api/core';
import { FileEntry, useFiles } from '../contexts/FilesContext';
import { useSettings } from '../contexts/SettingsContext';
import { cn } from "@/lib/utils";

interface DocumentViewerProps {
  file: FileEntry;
  onClose: () => void;
  onOpenFile: (file: FileEntry) => void;
  onNavigate?: (path: string) => void;
}

export default function DocumentViewer({ file, onClose, onOpenFile, onNavigate }: DocumentViewerProps) {
  const { t } = useTranslation();
  const { listDirectory } = useFiles();
  const { settings } = useSettings();
  
  const [siblings, setSiblings] = useState<FileEntry[]>([]);
  const [isLoadingSiblings, setIsLoadingSiblings] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);

  // Discord Rich Presence Integration
  useEffect(() => {
    if (!settings.enableDiscordRichPresence) {
      invoke('clear_discord_activity').catch(() => {});
      return;
    }

    const updatePresence = async () => {
      try {
        await invoke('set_discord_activity', {
          activityState: t('document_viewer.reading', 'Lendo'),
          details: file.name,
          startTimestamp: Math.floor(Date.now() / 1000)
        });
      } catch (error) {
        console.error('Failed to update Discord presence for document:', error);
      }
    };
    
    updatePresence();
  }, [file.name, settings.enableDiscordRichPresence, t]);

  useEffect(() => {
    // Clear presence when component unmounts
    return () => {
      invoke('clear_discord_activity').catch(() => {});
    };
  }, []);

  // Load Siblings (Other documents in same folder)
  useEffect(() => {
    async function loadSiblings() {
        setIsLoadingSiblings(true);
        try {
            const separator = file.path.includes('/') ? '/' : '\\';
            const parts = file.path.split(separator);
            parts.pop();
            const parentPath = parts.join(separator);

            const entries = await listDirectory(parentPath);
            const docSiblings: FileEntry[] = entries
                .filter(entry => entry.type === 'document')
                .map(entry => ({
                    name: entry.name,
                    path: entry.path,
                    file_type: 'document'
                }));
            
            setSiblings(docSiblings);
        } catch (error) {
            console.error("Failed to load siblings:", error);
        } finally {
            setIsLoadingSiblings(false);
        }
    }
    loadSiblings();
  }, [file.path, listDirectory]);

  return (
    <motion.div 
      className="fixed inset-0 z-50 bg-background flex flex-col"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="absolute top-4 right-4 z-[60] pointer-events-auto bg-transparent p-0 block w-auto">
        <button 
          className="w-10 h-10 rounded-full flex items-center justify-center bg-black/60 border border-white/10 text-slate-200 cursor-pointer backdrop-blur-sm shadow-lg transition-all hover:bg-red-600/80 hover:text-white hover:scale-110 hover:border-red-600/50" 
          onClick={onClose} 
          title={t('document_viewer.close')}
        >
            <X size={24} />
        </button>
      </div>

      <div className={cn("grid h-screen overflow-hidden", showSidebar ? "grid-cols-[1fr_350px]" : "grid-cols-1")}>
        {/* Main Content Area */}
        <div className="flex flex-col h-full bg-[#0a0a0c] relative overflow-hidden">
          {/* Header Info (Visible on hover or always? Let's keep it clean but accessible) */}
          <div className="absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/80 to-transparent z-10 flex justify-between items-start pointer-events-none">
             <div className="flex flex-col gap-1 pointer-events-auto">
                <h1 className="text-xl font-bold text-white tracking-tight drop-shadow-md">{file.name}</h1>
                 <button 
                    className="text-xs text-slate-300 hover:text-primary hover:underline text-left transition-colors flex items-center gap-1 w-fit"
                    onClick={() => {
                        if (onNavigate) {
                            const separator = file.path.includes('/') ? '/' : '\\';
                            const parentPath = file.path.substring(0, file.path.lastIndexOf(separator));
                            onNavigate(parentPath);
                            onClose();
                        }
                    }}
                >
                    <Folder size={12} />
                    <span className="truncate max-w-md opacity-80">{file.path}</span>
                </button>
             </div>
          </div>

          {/* Document Iframe */}
          <div className="flex-1 w-full h-full bg-slate-900 flex items-center justify-center p-0 md:p-4">
             <iframe 
                src={convertFileSrc(file.path)}
                className="w-full h-full rounded-none md:rounded-lg shadow-2xl bg-white border-none"
                title={t('document_viewer.title')}
                style={{ height: '100%', width: '100%' }}
             />
          </div>
          
           {/* Bottom Bar Controls */}
           <div className="p-4 bg-black/40 backdrop-blur-md border-t border-white/5 flex justify-between items-center">
              <div /> {/* Spacer */}
              <button 
                    className={cn(
                        "flex items-center gap-2 px-4 py-2 rounded-lg border border-white/10 bg-white/5 text-slate-200 text-sm font-semibold transition-all hover:bg-white/10 hover:border-white/20 hover:text-white hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/5",
                        showSidebar && "bg-primary/10 border-primary/30 text-primary-300 shadow-lg shadow-primary/5"
                    )}
                    onClick={() => setShowSidebar(!showSidebar)}
                >
                    <List size={18} />
                    <span>{t('document_viewer.other_files')}</span>
                </button>
           </div>
        </div>

        {/* Sidebar - Other Docs */}
        {showSidebar && (
            <div className="bg-[#121217]/95 border-l border-white/5 flex flex-col backdrop-blur-3xl z-20 overflow-hidden h-full">
                <div className="p-6 border-b border-white/5">
                    <h2 className="text-lg font-bold text-white mb-1">{t('document_viewer.files_in_folder')}</h2>
                    <span className="text-sm text-slate-400">{siblings.length} {t('document_viewer.documents')}</span>
                </div>

                <div className="p-4 flex flex-col gap-2 overflow-y-auto flex-1 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/10 hover:scrollbar-thumb-white/20">
                    {isLoadingSiblings ? (
                        <div className="py-8 text-center opacity-50 text-slate-400">{t('document_viewer.loading')}</div>
                    ) : (
                        siblings.map((sibling) => {
                            const isCurrent = sibling.path === file.path;

                            return (
                                <div 
                                    key={sibling.path} 
                                    className={cn(
                                        "flex gap-3 p-3 rounded-xl cursor-pointer transition-all border border-transparent group items-center",
                                        isCurrent ? "bg-primary/10 border-primary/20" : "hover:bg-white/10 hover:border-white/10"
                                    )}
                                    onClick={() => onOpenFile(sibling)}
                                >
                                    <div className={cn(
                                        "w-10 h-10 rounded-lg flex items-center justify-center shrink-0",
                                        isCurrent ? "bg-primary/20 text-primary" : "bg-white/5 text-slate-400 group-hover:bg-white/10 group-hover:text-slate-200"
                                    )}>
                                       <FileText size={20} />
                                    </div>
                                    
                                    <div className="flex flex-col justify-center gap-0.5 min-w-0">
                                        <div className={cn("text-sm font-medium leading-snug line-clamp-2 transition-colors", isCurrent ? "text-primary-300 font-bold" : "text-slate-300 group-hover:text-white")}>
                                            {sibling.name}
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        )}
      </div>
    </motion.div>
  );
}
