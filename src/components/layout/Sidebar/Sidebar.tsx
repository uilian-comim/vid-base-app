import { motion } from "framer-motion";
import { Home, PlayCircle, Library, Film, FileText, Folder, Settings as SettingsIcon, Search, Plus } from "lucide-react";
import { useTranslation } from 'react-i18next';
import { cn } from "@/lib/utils";
import React from "react";
import { Directory } from "../../../contexts/FilesContext";

interface SidebarProps {
  activeNav: string;
  setActiveNav: (nav: string) => void;
  showSettings: boolean;
  setShowSettings: (show: boolean) => void;
  browserPath: string | null;
  setBrowserPath: (path: string | null) => void;
  fileTypeFilter: 'video' | 'document' | null;
  setFileTypeFilter: (type: 'video' | 'document' | null) => void;
  videoCount: number;
  documentCount: number;
  directories: Directory[];
  filesCount: number;
  navigateToDirectory: (path: string) => void;
  onOpenSearch: () => void;
}

const IS_MAC = navigator.userAgent.includes('Macintosh');

interface ItemProps {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
  badge?: number;
}

function NavItem({ icon, label, active, onClick, badge }: ItemProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "group relative flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-[13.5px] font-medium transition-colors cursor-pointer",
        active ? "text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-foreground/5"
      )}
    >
      {active && (
        <motion.span
          layoutId="nav-pill"
          className="absolute inset-0 rounded-xl bg-foreground/[0.07] ring-1 ring-foreground/10"
          transition={{ type: "spring", stiffness: 500, damping: 38 }}
        />
      )}
      <span className={cn("relative z-10 shrink-0 transition-colors", active && "text-primary")}>{icon}</span>
      <span className="relative z-10 truncate">{label}</span>
      {badge !== undefined && (
        <span className="relative z-10 ml-auto text-[11px] tabular-nums text-muted-foreground/80">{badge}</span>
      )}
    </button>
  );
}

function SectionLabel({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="mt-6 mb-1.5 flex items-center justify-between px-3 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/60">
      <span>{children}</span>
      {action}
    </div>
  );
}

const Sidebar = React.memo(({
  activeNav, setActiveNav, showSettings, setShowSettings,
  browserPath, setBrowserPath, fileTypeFilter, setFileTypeFilter,
  videoCount, documentCount, directories, filesCount, navigateToDirectory, onOpenSearch
}: SidebarProps) => {
  const { t } = useTranslation();

  const go = (nav: string, filter: 'video' | 'document' | null = null) => {
    setActiveNav(nav);
    setBrowserPath('');
    setFileTypeFilter(filter);
    setShowSettings(false);
  };

  const inApp = !showSettings;

  return (
    <aside className="flex w-[248px] shrink-0 flex-col px-3 pb-3">
      {/* Brand */}
      <div className="flex items-center gap-2.5 px-3 pt-1 pb-4">
        <div className="brand-bg flex h-7 w-7 items-center justify-center rounded-lg shadow-lg shadow-primary/30">
          <PlayCircle size={16} className="text-white" strokeWidth={2.5} />
        </div>
        <span className="font-heading text-[17px] font-bold tracking-tight">VidBase</span>
      </div>

      {/* Search trigger */}
      <button
        onClick={onOpenSearch}
        className="mb-4 flex w-full items-center gap-2 rounded-xl border border-foreground/10 bg-foreground/[0.04] px-3 py-2 text-[13px] text-muted-foreground transition-colors hover:bg-foreground/[0.08] cursor-pointer"
      >
        <Search size={15} />
        <span>{t('palette.search')}</span>
        <span className="ml-auto flex gap-1"><kbd className="kbd">{IS_MAC ? '⌘' : 'Ctrl'}</kbd><kbd className="kbd">K</kbd></span>
      </button>

      <nav className="flex flex-col gap-0.5">
        <NavItem icon={<Home size={17} />} label={t('sidebar.home')} active={inApp && activeNav === 'inicio'} onClick={() => go('inicio')} />
        <NavItem icon={<PlayCircle size={17} />} label={t('sidebar.continue_watching')} active={inApp && activeNav === 'continuar'} onClick={() => go('continuar')} />
        <NavItem icon={<Library size={17} />} label={t('sidebar.all_files')} active={inApp && activeNav === 'arquivos' && !fileTypeFilter} onClick={() => go('arquivos')} badge={filesCount} />
      </nav>

      <SectionLabel>{t('sidebar.file_types')}</SectionLabel>
      <nav className="flex flex-col gap-0.5">
        <NavItem icon={<Film size={17} />} label={t('sidebar.videos')} active={inApp && activeNav === 'arquivos' && fileTypeFilter === 'video'} onClick={() => go('arquivos', 'video')} badge={videoCount} />
        <NavItem icon={<FileText size={17} />} label={t('sidebar.documents')} active={inApp && activeNav === 'arquivos' && fileTypeFilter === 'document'} onClick={() => go('arquivos', 'document')} badge={documentCount} />
      </nav>

      <SectionLabel
        action={
          <button onClick={() => setShowSettings(true)} title={t('palette.add_folder')} className="rounded-md p-0.5 transition-colors hover:bg-foreground/10 hover:text-foreground cursor-pointer">
            <Plus size={14} />
          </button>
        }
      >
        {t('sidebar.directories')}
      </SectionLabel>
      <nav className="-mr-1 flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto pr-1">
        {directories.map((dir) => (
          <NavItem
            key={dir.path}
            icon={<Folder size={17} />}
            label={dir.name}
            active={inApp && activeNav === 'diretorios' && browserPath === dir.path}
            onClick={() => navigateToDirectory(dir.path)}
          />
        ))}
      </nav>

      <div className="mt-3 border-t border-foreground/10 pt-3">
        <NavItem icon={<SettingsIcon size={17} />} label={t('sidebar.settings')} active={showSettings} onClick={() => setShowSettings(true)} />
      </div>
    </aside>
  );
});

Sidebar.displayName = 'Sidebar';

export default Sidebar;
