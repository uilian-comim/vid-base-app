import { motion, AnimatePresence } from 'framer-motion';
import { Folder, Info } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { cn } from "@/lib/utils";

interface PathTooltipProps {
  path: string;
  className?: string;
  icon?: 'folder' | 'info';
}

export default function PathTooltip({ path, className = '', icon = 'folder' }: PathTooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLDivElement>(null);

  const Icon = icon === 'folder' ? Folder : Info;

  const handleMouseEnter = () => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      
      // Calculate center position above the trigger
      setCoords({
        top: rect.top - 10, // 10px breathing room
        left: rect.left + (rect.width / 2)
      });
      setIsVisible(true);
    }
  };

  const handleMouseLeave = () => {
    setIsVisible(false);
  };

  // Close tooltip on scroll to update position or hide it
  useEffect(() => {
    const handleScroll = () => {
      if (isVisible) setIsVisible(false);
    };
    window.addEventListener('scroll', handleScroll, { capture: true });
    return () => window.removeEventListener('scroll', handleScroll, { capture: true });
  }, [isVisible]);

  return (
    <>
      <div 
        ref={triggerRef}
        className={cn("relative inline-flex items-center", className)}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <motion.div
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          className="cursor-help p-1 rounded-full bg-white/10 flex items-center justify-center hover:text-primary transition-colors duration-200"
        >
          <Icon size={14} className="opacity-70" />
        </motion.div>
      </div>

      {createPortal(
        <AnimatePresence>
          {isVisible && (
            <motion.div
              initial={{ opacity: 0, x: '-50%', y: '-90%', scale: 0.9 }}
              animate={{ opacity: 1, x: '-50%', y: '-100%', scale: 1 }}
              exit={{ opacity: 0, x: '-50%', y: '-90%', scale: 0.9 }}
              transition={{ duration: 0.15 }}
              className="fixed z-[9999] mb-0 px-3 py-1.5 bg-black/90 backdrop-blur-md border border-white/15 rounded-md text-white text-xs shadow-xl pointer-events-none max-w-[80vw] text-center break-all whitespace-normal"
              style={{
                top: coords.top,
                left: coords.left,
              }}
            >
              <div className="max-w-full">
                {path}
              </div>
              
              {/* Arrow */}
              <div className="absolute top-full left-1/2 -ml-1 border-4 border-solid border-t-black/90 border-x-transparent border-b-transparent" />
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  );
}
