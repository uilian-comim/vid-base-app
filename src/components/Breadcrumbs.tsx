import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { ChevronRight, Home } from 'lucide-react';
import { cn } from "@/lib/utils";
// import './Breadcrumbs.css';

interface BreadcrumbsProps {
  path: string | null;
  onNavigate: (path: string | null) => void;
  rootPath?: string | null;
  rootName?: string;
}

export default function Breadcrumbs({ path, onNavigate, rootPath, rootName }: BreadcrumbsProps) {
  const { t } = useTranslation();
  if (!path) return null;

  const separator = path.includes('/') ? '/' : '\\';

  let breadcrumbs: Array<{ label: string, path: string | null }> = [
    { label: t('breadcrumbs.home'), path: null }
  ];

  // If we have a rootPath and the current path starts with it, use relative display
  if (rootPath && path.toLowerCase().startsWith(rootPath.toLowerCase())) {
     const rootLabel = rootName || rootPath.split(separator).pop() || rootPath;
     breadcrumbs.push({ label: rootLabel, path: rootPath });

     if (path.length > rootPath.length) {
         let relative = path.slice(rootPath.length);
         if (relative.startsWith(separator)) relative = relative.slice(1);
         
         const relParts = relative.split(separator).filter(Boolean);
         
         let currentPath = rootPath;
         relParts.forEach(part => {
             // Ensure we don't double separator if rootPath already has one at end (unlikely for norm paths but good to be safe)
             const needsSep = !currentPath.endsWith(separator);
             currentPath = `${currentPath}${needsSep ? separator : ''}${part}`;
             breadcrumbs.push({ label: part, path: currentPath });
         });
     }
  } else {
    // Fallback: Show full path logic 
    const parts = path.split(separator).filter(Boolean);
    parts.forEach((part, index) => {
        breadcrumbs.push({
            label: part,
            path: parts.slice(0, index + 1).join(separator)
        });
    });
  }

  return (
    <motion.div 
      className="flex items-center flex-wrap gap-1 mb-4 select-none"
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3 }}
    >
      {breadcrumbs.map((crumb, index) => {
        // With the new logic, we don't really need to disable parents because we aren't showing them!
        // We only show "Início" (safe), "Root" (safe), and children of Root (safe).
        // The only "parent" we show is the Root itself, which is a registered safe path.
        
        return (
        <div key={index} className="flex items-center">
          {index > 0 && <ChevronRight size={14} className="text-muted-foreground mx-1 opacity-50" />}
          <motion.button
            className={cn(
              "flex items-center gap-1.5 px-2 py-1 rounded-md text-sm transition-colors",
              index === breadcrumbs.length - 1 
                ? "text-foreground font-medium pointer-events-none" 
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            )}
            onClick={() => onNavigate(crumb.path)}
            whileHover={index !== breadcrumbs.length - 1 ? { scale: 1.05 } : {}}
            whileTap={index !== breadcrumbs.length - 1 ? { scale: 0.95 } : {}}
          >
            {index === 0 ? <Home size={14} /> : null}
            <span className="truncate max-w-[200px]">{crumb.label === t('breadcrumbs.home') && index === 0 ? '' : crumb.label}</span>
            {index === 0 && crumb.label === t('breadcrumbs.home') && <span>{t('breadcrumbs.home')}</span>}
          </motion.button>
        </div>
      )})}
    </motion.div>
  );
}
