import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Search, Home, PlayCircle, Library, Film, FileText, Folder, Settings, CornerDownLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Directory, FileEntry } from '../contexts/FilesContext';

export interface PaletteAction {
  id: string;
  label: string;
  run: () => void;
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  files: FileEntry[];
  directories: Directory[];
  onOpenFile: (file: FileEntry) => void;
  onOpenDirectory: (path: string) => void;
  onNav: (target: 'inicio' | 'continuar' | 'arquivos' | 'video' | 'document' | 'settings') => void;
}

interface Item {
  id: string;
  group: 'go' | 'folders' | 'files';
  label: string;
  hint?: string;
  icon: React.ReactNode;
  run: () => void;
}

const MAX_FILES = 8;

export default function CommandPalette({ open, onClose, files, directories, onOpenFile, onOpenDirectory, onNav }: CommandPaletteProps) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setQuery('');
      setCursor(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const items = useMemo<Item[]>(() => {
    const q = query.trim().toLowerCase();
    const match = (s: string) => !q || s.toLowerCase().includes(q);

    const nav: Item[] = [
      { id: 'n-home', group: 'go' as const, label: t('sidebar.home'), icon: <Home size={16} />, run: () => onNav('inicio') },
      { id: 'n-cont', group: 'go' as const, label: t('sidebar.continue_watching'), icon: <PlayCircle size={16} />, run: () => onNav('continuar') },
      { id: 'n-all', group: 'go' as const, label: t('sidebar.all_files'), icon: <Library size={16} />, run: () => onNav('arquivos') },
      { id: 'n-vid', group: 'go' as const, label: t('sidebar.videos'), icon: <Film size={16} />, run: () => onNav('video') },
      { id: 'n-doc', group: 'go' as const, label: t('sidebar.documents'), icon: <FileText size={16} />, run: () => onNav('document') },
      { id: 'n-set', group: 'go' as const, label: t('sidebar.settings'), icon: <Settings size={16} />, run: () => onNav('settings') },
    ].filter((i) => match(i.label));

    const dirs: Item[] = directories
      .filter((d) => match(d.name))
      .slice(0, 5)
      .map((d) => ({ id: `d-${d.path}`, group: 'folders' as const, label: d.name, hint: d.path, icon: <Folder size={16} />, run: () => onOpenDirectory(d.path) }));

    const fs: Item[] = q
      ? files
          .filter((f) => match(f.name))
          .slice(0, MAX_FILES)
          .map((f) => ({
            id: `f-${f.path}`,
            group: 'files' as const,
            label: f.name,
            hint: f.path,
            icon: f.file_type === 'video' ? <Film size={16} /> : <FileText size={16} />,
            run: () => onOpenFile(f),
          }))
      : [];

    return [...fs, ...dirs, ...nav];
  }, [query, files, directories, t, onNav, onOpenDirectory, onOpenFile]);

  useEffect(() => setCursor(0), [query]);

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-idx="${cursor}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [cursor]);

  const choose = (item?: Item) => {
    if (!item) return;
    onClose();
    item.run();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setCursor((c) => Math.min(c + 1, items.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setCursor((c) => Math.max(c - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); choose(items[cursor]); }
    else if (e.key === 'Escape') { e.preventDefault(); onClose(); }
  };

  const groupLabel = { files: t('palette.files'), folders: t('palette.folders'), go: t('palette.go_to') };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-start justify-center bg-black/50 px-6 pt-[14vh] backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onMouseDown={onClose}
        >
          <motion.div
            className="glass w-full max-w-[600px] overflow-hidden rounded-2xl bg-popover/90 shadow-2xl shadow-black/50"
            initial={{ opacity: 0, y: -12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 500, damping: 36 }}
            onMouseDown={(e) => e.stopPropagation()}
            onKeyDown={onKeyDown}
          >
            <div className="flex items-center gap-3 border-b border-foreground/10 px-4">
              <Search size={18} className="text-muted-foreground" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t('palette.search_placeholder')}
                className="h-14 flex-1 bg-transparent text-[15px] outline-none placeholder:text-muted-foreground/60"
              />
              <kbd className="kbd">esc</kbd>
            </div>

            <div ref={listRef} className="max-h-[52vh] overflow-y-auto p-2">
              {items.length === 0 && (
                <div className="py-12 text-center text-sm text-muted-foreground">{t('palette.no_results')}</div>
              )}
              {items.map((item, idx) => (
                <div key={item.id}>
                  {(idx === 0 || items[idx - 1].group !== item.group) && (
                    <div className="px-3 pt-3 pb-1 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/60">
                      {groupLabel[item.group]}
                    </div>
                  )}
                  <button
                    data-idx={idx}
                    onMouseMove={() => setCursor(idx)}
                    onClick={() => choose(item)}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors cursor-pointer',
                      idx === cursor ? 'bg-primary/15 text-foreground' : 'text-foreground/80'
                    )}
                  >
                    <span className={cn('shrink-0', idx === cursor ? 'text-primary' : 'text-muted-foreground')}>{item.icon}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{item.label}</span>
                      {item.hint && <span className="block truncate text-xs text-muted-foreground/70">{item.hint}</span>}
                    </span>
                    {idx === cursor && <CornerDownLeft size={14} className="shrink-0 text-muted-foreground" />}
                  </button>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-4 border-t border-foreground/10 px-4 py-2.5 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1.5"><kbd className="kbd">↑</kbd><kbd className="kbd">↓</kbd>{t('palette.hint_navigate')}</span>
              <span className="flex items-center gap-1.5"><kbd className="kbd">↵</kbd>{t('palette.hint_open')}</span>
              <span className="flex items-center gap-1.5"><kbd className="kbd">esc</kbd>{t('palette.hint_close')}</span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
