import { motion } from 'framer-motion';
import { Search, X } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from "@/lib/utils";
// import './SearchBar.css';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export default function SearchBar({ value, onChange, placeholder }: SearchBarProps) {
  const { t } = useTranslation();
  const actualPlaceholder = placeholder || t('search_bar.placeholder_default');
  const [isFocused, setIsFocused] = useState(false);

  return (
    <motion.div 
      className={cn(
        "relative flex items-center w-full max-w-md bg-muted/50 border border-transparent rounded-xl px-3 py-2.5 transition-all",
        isFocused ? "bg-muted border-primary/50 ring-2 ring-primary/20 shadow-lg shadow-primary/5" : "hover:bg-muted/80"
      )}
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Search className={cn("mr-2 text-muted-foreground transition-colors", isFocused ? "text-primary" : "")} size={18} />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        placeholder={actualPlaceholder}
        className="flex-1 bg-transparent border-none outline-none text-sm text-foreground placeholder:text-muted-foreground/70"
      />
      {value && (
        <motion.button
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          exit={{ scale: 0 }}
          className="ml-2 p-1 rounded-full hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors"
          onClick={() => onChange('')}
        >
          <X size={16} />
        </motion.button>
      )}
    </motion.div>
  );
}
