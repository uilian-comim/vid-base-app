import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { Folder, FolderOpen, Plus, Trash2, X } from 'lucide-react';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { useSettings } from '../../contexts/SettingsContext';
import ConfirmationModal from '../ConfirmationModal';

export default function DirectorySettings() {
  const { t } = useTranslation();
  const { settings, addDirectory, removeDirectory, clearAllDirectories } = useSettings();

  const [modalOpen, setModalOpen] = useState(false);
  const [modalConfig, setModalConfig] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
    variant: 'danger' | 'info';
  }>({
    title: '',
    message: '',
    onConfirm: () => {},
    variant: 'danger'
  });

  const handleAddDirectory = async () => {
    try {
      const selected = await openDialog({
        directory: true,
        multiple: false,
      });

      if (selected && typeof selected === 'string') {
        addDirectory(selected);
      }
    } catch (err) {
      console.error('Failed to select directory', err);
    }
  };

  const openConfirmation = (title: string, message: string, onConfirm: () => void) => {
    setModalConfig({
      title,
      message,
      onConfirm,
      variant: 'danger'
    });
    setModalOpen(true);
  };

  const handleRemoveDirectory = (dir: string) => {
    openConfirmation(
      t('settings.remove_dir'),
      t('settings.confirm_remove_dir'),
      () => removeDirectory(dir)
    );
  };

  const handleClearDirectories = () => {
    openConfirmation(
      t('settings.clear_all'),
      t('settings.confirm_clear_dirs'),
      () => clearAllDirectories()
    );
  };

  return (
    <motion.section 
      className="flex flex-col gap-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.3 }}
    >
      <ConfirmationModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onConfirm={modalConfig.onConfirm}
        title={modalConfig.title}
        message={modalConfig.message}
        variant={modalConfig.variant}
      />
      
      <div className="flex items-center gap-3 mb-2 text-primary">
        <FolderOpen size={24} />
        <h2 className="text-xl font-bold font-heading m-0 text-foreground">{t('settings.directories')}</h2>
      </div>
      
      <div className="flex flex-col gap-3 bg-card/50 rounded-xl p-6 border border-border/50">
        <label className="text-sm font-medium text-foreground mb-1 block">{t('settings.manage_dirs')}</label>
        <div className="flex flex-col gap-2 min-h-[100px] max-h-[300px] overflow-y-auto pr-1">
          <AnimatePresence mode="popLayout">
            {settings.directories.length === 0 ? (
              <motion.div 
                className="flex flex-col items-center justify-center py-8 text-muted-foreground opacity-60 bg-muted/30 rounded-lg border-2 border-dashed border-border"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
              >
                <FolderOpen size={48} className="mb-2" />
                <p className="font-medium text-sm">{t('settings.no_dirs')}</p>
              </motion.div>
            ) : (
              settings.directories.map((dir, index) => (
                <motion.div 
                  key={dir} 
                  className="flex items-center justify-between p-3 rounded-lg bg-background border border-border hover:border-primary/50 transition-colors group"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ delay: index * 0.05 }}
                  layout
                >
                  <div className="flex items-center gap-3 overflow-hidden">
                    <Folder size={18} className="text-primary shrink-0" />
                    <span className="text-sm font-mono truncate text-foreground/80">{dir}</span>
                  </div>
                  <motion.button
                    className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors opacity-0 group-hover:opacity-100"
                    onClick={() => handleRemoveDirectory(dir)}
                    title={t('settings.remove_dir')}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                  >
                    <X size={16} />
                  </motion.button>
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </div>
        <div className="flex gap-4 mt-4">
          <motion.button 
            className="flex flex-1 items-center justify-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-all text-sm" 
            onClick={handleAddDirectory}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Plus size={16} />
            {t('settings.add_dir')}
          </motion.button>
          {settings.directories.length > 0 && (
            <motion.button 
              className="flex items-center justify-center gap-2 px-4 py-2 bg-destructive/10 text-destructive rounded-lg font-medium hover:bg-destructive hover:text-destructive-foreground transition-all text-sm" 
              onClick={handleClearDirectories}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Trash2 size={16} />
              {t('settings.clear_all')}
            </motion.button>
          )}
        </div>
      </div>
    </motion.section>
  );
}
