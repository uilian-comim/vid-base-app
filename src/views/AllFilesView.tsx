import { motion } from 'framer-motion';
import { useState, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { FileEntry } from '../contexts/FilesContext';
import DirectoryCard from '../components/DirectoryCard';
import SearchBar from '../components/SearchBar';
import { Plus, LayoutGrid, List, ArrowUpAZ, ArrowDownAZ, Folder, ChevronRight, Layers } from 'lucide-react';
import { useSettings } from '../contexts/SettingsContext';
import Select from '../components/Select';
import { useGroupedFiles } from '../hooks/useGroupedFiles';

interface AllFilesViewProps {
  files: FileEntry[];
  onAddDirectory: () => void;
  title?: string;
  onDirectoryClick: (path: string) => void;
}

export default function AllFilesView({ 
  files, 
  onAddDirectory, 
  title = "Todos os Arquivos",
  onDirectoryClick
}: AllFilesViewProps) {
  const { t } = useTranslation();
  const { settings, updateGroupByRoot, updateViewMode } = useSettings();
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  // viewMode state removed, using settings.viewMode
  const [sortBy, setSortBy] = useState<'name' | 'count'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  
  // Optimize search with debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);
  
  // Group files using custom hook to keep this component clean
  const directories = useGroupedFiles(files, settings.groupByRoot, settings.directories);

  // Filter directories based on search - Memoized
  const filteredDirectories = useMemo(() => {
    return directories.filter(([path, info]) =>
      info.name.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) ||
      path.toLowerCase().includes(debouncedSearchQuery.toLowerCase())
    );
  }, [directories, debouncedSearchQuery]);

  // Sort directories - Memoized
  const sortedDirectories = useMemo(() => {
    return [...filteredDirectories].sort((a, b) => {
      const [pathA, infoA] = a;
      const [pathB, infoB] = b;
      
      let comparison = 0;
      if (sortBy === 'name') {
        // Sort by full path to respect parent directory order
        comparison = pathA.localeCompare(pathB, undefined, { numeric: true, sensitivity: 'base' });
      } else {
        comparison = infoA.count - infoB.count;
      }
      
      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }, [filteredDirectories, sortBy, sortOrder]);

  return (
    <motion.div 
      className="p-8 space-y-8 max-w-[1600px] mx-auto w-full h-full flex flex-col"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      <header className="flex flex-col gap-6 mb-2 shrink-0">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground mb-1">{title}</h1>
            <p className="text-muted-foreground text-sm">
              {t('all_files.folders_found', { count: filteredDirectories.length })}
            </p>
          </div>
          <div className="flex items-center gap-3 bg-secondary/30 p-1 rounded-lg border border-border/50">
             {settings.directories.length > 1 && (
               <div className="flex items-center gap-2 px-2 border-r border-border/50 mr-1">
                 <button
                   onClick={() => updateGroupByRoot(!settings.groupByRoot)}
                   className={`p-2 rounded-md transition-all flex items-center gap-2 text-sm font-medium ${settings.groupByRoot ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-background/50 hover:text-foreground'}`}
                   title={settings.groupByRoot ? t('all_files.show_all') : t('all_files.group_by_root')}
                 >
                   <Layers size={16} />
                   <span className="hidden sm:inline">{t('all_files.group_by_origin')}</span>
                 </button>
               </div>
             )}

             <div className="flex items-center gap-1 pr-2 border-r border-border/50 mr-2">
                <button 
                  onClick={() => updateViewMode('grid')}
                  className={`p-2 rounded-md transition-all ${settings.viewMode === 'grid' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:bg-background/50'}`}
                  title={t('all_files.grid_view')}
                >
                  <LayoutGrid size={18} />
                </button>
                <button 
                  onClick={() => updateViewMode('list')}
                  className={`p-2 rounded-md transition-all ${settings.viewMode === 'list' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:bg-background/50'}`}
                  title={t('all_files.list_view')}
                >
                  <List size={18} />
                </button>
             </div>
             
             <div className="flex items-center gap-2 text-sm text-muted-foreground px-2">
                <span className="text-xs font-semibold uppercase tracking-wider">{t('all_files.sort_by')}</span>
                <Select 
                  className="px-8 py-1.5 text-sm bg-transparent border-none w-auto"
                  containerClassName="w-auto"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as 'name' | 'count')}
                >
                  <option value="name">{t('all_files.sort_name')}</option>
                  <option value="count">{t('all_files.sort_count')}</option>
                </Select>
                <button 
                  onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                  className="p-1 hover:bg-background/50 rounded transition-colors"
                  title={sortOrder === 'asc' ? t('all_files.sort_asc') : t('all_files.sort_desc')}
                >
                  {sortOrder === 'asc' ? <ArrowUpAZ size={16} /> : <ArrowDownAZ size={16} />}
                </button>
             </div>
          </div>
        </div>
        
        <div className="w-full max-w-md">
          <SearchBar 
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder={t('all_files.search_placeholder')}
          />
        </div>
      </header>

      <section className="flex-1 overflow-y-auto p-6 -mx-6">
        {sortedDirectories.length > 0 ? (
          settings.viewMode === 'grid' ? (
            <motion.div 
              className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 gap-6"
              layout
            >
              <motion.div 
                layout
                className="border-2 border-dashed border-muted-foreground/20 rounded-xl flex flex-col items-center justify-center p-6 gap-4 cursor-pointer hover:border-primary/50 hover:bg-muted/50 transition-all group min-h-[220px] h-full" 
                onClick={onAddDirectory}
                whileHover={{ scale: 1.02, borderColor: 'hsl(var(--primary))' }}
                whileTap={{ scale: 0.98 }}
              >
                <motion.div 
                  className="w-12 h-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-colors"
                  whileHover={{ rotate: 90 }}
                  transition={{ type: "spring", stiffness: 400 }}
                >
                  <Plus size={32} />
                </motion.div>
                <div className="font-medium text-muted-foreground group-hover:text-foreground">{t('all_files.add')}</div>
              </motion.div>

              {sortedDirectories.map(([path, info], index) => (
                <DirectoryCard
                  key={path}
                  name={info.name}
                  path={path}
                  fileCount={info.count}
                  color="blue"
                  onClick={() => onDirectoryClick(path)}
                  index={index}
                />
              ))}
            </motion.div>
          ) : (
            <motion.div className="flex flex-col gap-2" layout>
               <motion.div 
                layout
                className="flex items-center gap-4 p-4 rounded-lg border-2 border-dashed border-muted-foreground/20 cursor-pointer hover:border-primary/50 hover:bg-muted/50 transition-all group"
                onClick={onAddDirectory}
                whileHover={{ scale: 1.005, borderColor: 'hsl(var(--primary))' }}
                whileTap={{ scale: 0.995 }}
              >
                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                  <Plus size={20} />
                </div>
                <div className="font-medium text-muted-foreground group-hover:text-foreground">{t('all_files.add_directory')}</div>
              </motion.div>

              {sortedDirectories.map(([path, info], index) => (
                <motion.div
                  key={path}
                  layout
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.03 }}
                  className="group flex items-center gap-4 p-4 rounded-lg bg-card border border-border/50 hover:border-primary/50 hover:shadow-lg transition-all cursor-pointer hover:bg-accent/10 relative"
                  onClick={() => onDirectoryClick(path)}
                  whileHover={{ scale: 1.02, zIndex: 10, x: 4 }}
                  whileTap={{ scale: 0.99 }}
                >
                  <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-500 group-hover:scale-110 transition-transform duration-300">
                    <Folder size={20} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base font-semibold text-foreground truncate group-hover:text-primary transition-colors">{info.name}</h3>
                    <p className="text-sm text-muted-foreground truncate opacity-70 group-hover:opacity-100 transition-opacity">{path}</p>
                  </div>
                  <div className="text-sm font-medium text-muted-foreground whitespace-nowrap px-4 py-1 rounded-full bg-secondary group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                    {t('common.items', { count: info.count })}
                  </div>
                  <ChevronRight size={18} className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-all transform group-hover:translate-x-1" />
                </motion.div>
              ))}
            </motion.div>
          )
        ) : (
          <motion.div 
            className="flex flex-col items-center justify-center py-20 text-center space-y-4 opacity-70"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="text-6xl mb-4 grayscale opacity-50">📁</div>
            <p className="text-lg text-muted-foreground">
              {searchQuery ? t('all_files.no_folders_found') : t('all_files.no_dirs_with_files')}
            </p>
            {!searchQuery && (
              <>
                <p className="text-sm text-muted-foreground">{t('all_files.add_to_start')}</p>
                <motion.button 
                  className="mt-4 px-6 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors shadow-lg hover:shadow-primary/25" 
                  onClick={onAddDirectory} 
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  {t('all_files.add_directories')}
                </motion.button>
              </>
            )}
          </motion.div>
        )}
      </section>
    </motion.div>
  );
}
