import React, { useState, useRef, useEffect } from 'react';
import { cn } from '../lib/utils';
import { ChevronDown, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface SelectProps {
  value?: string;
  onChange?: (e: { target: { value: string } }) => void;
  className?: string;
  containerClassName?: string;
  children: React.ReactNode;
}

const Select = ({ value, onChange, className, containerClassName, children }: SelectProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Extract options from children
  const options = React.Children.toArray(children).reduce((acc, child) => {
    if (React.isValidElement(child) && child.type === 'option') {
      const optionChild = child as React.ReactElement<React.OptionHTMLAttributes<HTMLOptionElement>>;
      acc.push({
        value: optionChild.props.value as string,
        label: optionChild.props.children as React.ReactNode,
        className: optionChild.props.className
      });
    }
    return acc;
  }, [] as Array<{ value: string; label: React.ReactNode; className?: string }>);

  const selectedOption = options.find((opt) => opt.value === value) || options[0];

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const handleSelect = (newValue: string) => {
    if (onChange) {
      onChange({ target: { value: newValue } });
    }
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className={cn("relative", containerClassName)}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "w-full px-4 py-3 rounded-lg border border-border/50 bg-background/50 text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none flex items-center justify-between gap-3 min-w-[120px]",
          className
        )}
      >
        <span className="truncate">{selectedOption?.label}</span>
        <ChevronDown 
          size={16} 
          className={cn("text-muted-foreground transition-transform duration-200 shrink-0", isOpen && "rotate-180")} 
        />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15 }}
            className="absolute z-50 w-full min-w-max mt-2 py-1.5 rounded-xl border border-border/50 bg-background/95 backdrop-blur-md shadow-xl max-h-[300px] overflow-y-auto"
          >
            {options.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={cn(
                  "w-full text-left px-4 py-2.5 text-sm flex items-center justify-between gap-4 transition-colors hover:bg-primary/10 hover:text-primary",
                  opt.value === value ? "bg-primary/10 text-primary font-medium" : "text-foreground",
                  opt.className
                )}
                onClick={() => handleSelect(opt.value)}
              >
                <span className="truncate">{opt.label}</span>
                {opt.value === value && <Check size={16} className="shrink-0" />}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Select;
