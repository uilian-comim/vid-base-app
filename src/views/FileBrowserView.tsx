import { useState, useEffect } from "react";
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from "framer-motion";
import { useFiles, FileSystemEntry, Directory, FileEntry } from "../contexts/FilesContext";
import { useWatchHistory } from "../contexts/WatchHistoryContext";
import LoadingSpinner from "../components/LoadingSpinner";
import Breadcrumbs from "../components/Breadcrumbs";
import DirectoryCard from "../components/DirectoryCard";
import FileCard from "../components/FileCard";
import SearchBar from "../components/SearchBar";
import { ArrowLeft, Plus } from "lucide-react";


interface FileBrowserViewProps {
  directories: Directory[];
  onFileClick: (file: FileEntry) => void;
  onAddDirectory: () => void;
  currentPath: string | null;
  onNavigate: (path: string | null) => void;
  customRoot?: string | null;
  fileTypeFilter?: 'video' | 'document' | null;
}

export default function FileBrowserView({ 
  directories, 
  onFileClick, 
  onAddDirectory,
  currentPath,
  onNavigate,
  customRoot,
  fileTypeFilter
}: FileBrowserViewProps) {
  const { t } = useTranslation();
  const [currentEntries, setCurrentEntries] = useState<FileSystemEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const { listDirectory, files } = useFiles();
  const { history } = useWatchHistory();

  // Helper to get directory name from path
  const getDirName = (path: string) => path.split(/[\\/]/).pop() || path;
  
  // Helper to get file count for a directory
  const getFileCountForPath = (path: string): number => {
    // Normalize path for consistent matching
    const normalizedPath = path.replace(/[\\/]/g, '/').toLowerCase();
    
    return files.filter(file => {
      // Check file type filter
      if (fileTypeFilter && file.file_type !== fileTypeFilter) {
        return false;
      }
      
      const fileDir = file.path.replace(/[\\/]/g, '/').toLowerCase();
      return fileDir.startsWith(normalizedPath + '/') || fileDir === normalizedPath;
    }).length; 
  };
  
  // Load entries when currentPath changes
  useEffect(() => {
    async function loadEntries() {
      if (!currentPath) {
        setCurrentEntries([]);
        return;
      }

      setLoading(true);
      try {
        const entries = await listDirectory(currentPath);
        setCurrentEntries(entries);
      } catch (error) {
        console.error("Failed to list directory:", error);
      } finally {
        setLoading(false);
      }
    }

    loadEntries();
  }, [currentPath, listDirectory]);

  const handleDirectoryClick = (path: string) => {
    onNavigate(path);
  };

  const handleBackClick = () => {
    if (!currentPath) return;

    if (customRoot && currentPath === customRoot) {
      onNavigate(null);
      return;
    }

    const isRoot = directories.some(d => d.path === currentPath);
    if (isRoot && !customRoot) {
      onNavigate(null);
      return;
    }

    const separator = currentPath.includes('/') ? '/' : '\\';
    const parts = currentPath.split(separator);
    parts.pop();
    const parentPath = parts.join(separator);
    
    if (customRoot && parentPath.length < customRoot.length) {
       onNavigate(null);
       return;
    }
    
    onNavigate(parentPath);
  };

  const currentDirName = currentPath ? getDirName(currentPath) : t('file_browser.local_dirs');

  // Filter entries based on search and type
  const filteredEntries = currentEntries.filter(entry => {
    const matchesSearch = entry.name.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (entry.type === 'directory') {
      const count = getFileCountForPath(entry.path);
      return matchesSearch && count > 0;
    }
    
    const matchesType = !fileTypeFilter || entry.type === fileTypeFilter;
    return matchesSearch && matchesType;
  });

  const filteredDirectories = directories.filter(dir =>
    dir.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <motion.div 
      className="p-8 space-y-8 max-w-[1600px] mx-auto w-full"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      <header className="flex flex-col gap-4 mb-8">
        <div className="flex items-center gap-4 mb-4">
          {currentPath && (
            <motion.button 
              onClick={handleBackClick}
              className="p-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm hover:shadow-md transition-all flex items-center justify-center"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <ArrowLeft size={20} />
            </motion.button>
          )}
          <div className="flex-1 min-w-0">
            <h1 className="text-3xl font-bold tracking-tight text-foreground truncate">{currentDirName}</h1>
            {currentPath && (
              <div className="mt-2">
                <Breadcrumbs 
                  path={currentPath} 
                  onNavigate={onNavigate} 
                  rootPath={customRoot}
                  rootName={customRoot ? directories.find(d => d.path === customRoot)?.name : undefined}
                />
              </div>
            )}
            {!currentPath && <p className="text-muted-foreground text-lg">{t('file_browser.manage_media')}</p>}
          </div>
        </div>
        
        <SearchBar 
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder={currentPath ? t('file_browser.search_this_folder') : t('file_browser.search_dirs')}
        />
      </header>

      <section className="space-y-6">
        <AnimatePresence mode="wait">
          {loading ? (
            <LoadingSpinner message={t('file_browser.loading')} />
          ) : (
            <motion.div 
              className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-6"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {/* If at root, show configured directories */}
              {!currentPath && filteredDirectories.map((dir, index) => (
                <DirectoryCard
                  key={index}
                  name={dir.name}
                  path={dir.path}
                  fileCount={dir.fileCount}
                  color={dir.color}
                  onClick={() => handleDirectoryClick(dir.path)}
                  index={index}
                />
              ))}

              {/* If in a directory, show contents */}
              {currentPath && filteredEntries.map((entry, index) => {
                if (entry.type === 'directory') {
                  const count = getFileCountForPath(entry.path);
                  return (
                    <DirectoryCard
                      key={index}
                      name={entry.name}
                      path={entry.path}
                      fileCount={count}
                      color="blue"
                      onClick={() => handleDirectoryClick(entry.path)}
                      index={index}
                    />
                  );
                } else {
                  const historyEntry = history.find(h => h.filePath === entry.path);
                  const progress = historyEntry ? (historyEntry.currentTime / historyEntry.duration) * 100 : 0;
                  
                  return (
                    <FileCard
                      key={index}
                      file={{
                        name: entry.name,
                        path: entry.path,
                        file_type: entry.type as "video" | "document"
                      }}
                      onClick={() => onFileClick({
                        name: entry.name,
                        path: entry.path,
                        file_type: entry.type as "video" | "document"
                      })}
                      index={index}
                      progress={progress}
                      completed={historyEntry?.completed}
                    />
                  );
                }
              })}
              
              {!currentPath && (
                <motion.div 
                  className="border-2 border-dashed border-muted-foreground/20 rounded-xl flex flex-col items-center justify-center p-6 gap-4 cursor-pointer hover:border-primary/50 hover:bg-muted/50 transition-all group min-h-[160px]" 
                  onClick={onAddDirectory}
                  whileHover={{ scale: 1.02, borderColor: 'var(--color-primary)' }}
                  whileTap={{ scale: 0.98 }}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: filteredDirectories.length * 0.05 }}
                >
                  <motion.div 
                    className="w-12 h-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-colors"
                    whileHover={{ rotate: 90 }}
                    transition={{ type: "spring", stiffness: 400 }}
                  >
                    <Plus size={32} />
                  </motion.div>
                  <div className="font-medium text-muted-foreground group-hover:text-foreground">{t('all_files.add_directory')}</div>
                </motion.div>
              )}

              {currentPath && filteredEntries.length === 0 && (
                 <motion.div 
                   className="flex flex-col items-center justify-center py-20 text-center space-y-4 opacity-70 col-span-full" 
                   initial={{ opacity: 0, y: 20 }}
                   animate={{ opacity: 1, y: 0 }}
                 >
                  <p className="text-lg text-muted-foreground">
                    {searchQuery ? 'Nenhum resultado encontrado' : 'Pasta vazia'}
                  </p>
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {!currentPath && filteredDirectories.length === 0 && !loading && (
          <motion.div 
            className="flex flex-col items-center justify-center py-20 text-center space-y-4 opacity-70"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="text-6xl mb-4 grayscale opacity-50">💾</div>
            <p className="text-lg text-muted-foreground">
              {searchQuery ? t('file_browser.no_results') : t('file_browser.no_dirs_added')}
            </p>
            {!searchQuery && (
              <p className="text-sm text-muted-foreground">{t('file_browser.click_to_start')}</p>
            )}
          </motion.div>
        )}
      </section>
    </motion.div>
  );
}
