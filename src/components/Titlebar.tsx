import { useEffect, useState } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { invoke } from '@tauri-apps/api/core';
import { Minus, Square, X, Copy } from 'lucide-react';

export default function Titlebar() {
  const [isMaximized, setIsMaximized] = useState(false);
  const appWindow = getCurrentWindow();

  useEffect(() => {
    // Check initial state
    appWindow.isMaximized().then(setIsMaximized);

    // Listen for resize events to update the maximize icon
    const unlisten = appWindow.onResized(async () => {
      const maximized = await appWindow.isMaximized();
      setIsMaximized(maximized);
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  const handleMinimize = () => invoke('window_minimize');
  const handleToggleMaximize = () => invoke('window_toggle_maximize');
  const handleClose = () => invoke('window_close');

  return (
    <div className="h-8 flex select-none justify-between bg-background border-b border-border/50 text-foreground w-full">
      {/* Área arrastável customizada, ocupa todo o espaço que sobra */}
      <div 
        data-tauri-drag-region
        className="flex-1 flex h-full items-center px-4" 
      >
        <span className="text-xs font-semibold tracking-wide text-foreground/80 pointer-events-none">
          Minha Biblioteca
        </span>
      </div>

      {/* Container dos botões fora da área de drag */}
      <div className="flex h-full shrink-0">
        <button
          onClick={handleMinimize}
          className="inline-flex h-full w-12 cursor-pointer items-center justify-center transition-colors hover:bg-muted/50 text-foreground/80 hover:text-foreground"
          title="Minimizar"
        >
          <Minus size={16} />
        </button>
        <button
          onClick={handleToggleMaximize}
          className="inline-flex h-full w-12 cursor-pointer items-center justify-center transition-colors hover:bg-muted/50 text-foreground/80 hover:text-foreground"
          title={isMaximized ? "Restaurar" : "Maximizar"}
        >
          {isMaximized ? <Copy size={14} className="rotate-180" /> : <Square size={14} />}
        </button>
        <button
          onClick={handleClose}
          className="inline-flex h-full w-12 cursor-pointer items-center justify-center transition-colors hover:bg-red-500 hover:text-white text-foreground/80"
          title="Fechar"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
