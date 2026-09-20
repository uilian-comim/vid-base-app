import { useEffect, useState } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { invoke } from '@tauri-apps/api/core';
import { Minus, Square, X, Copy } from 'lucide-react';

const IS_MAC = navigator.userAgent.includes('Macintosh');

export default function Titlebar() {
  const [isMaximized, setIsMaximized] = useState(false);
  const appWindow = getCurrentWindow();

  useEffect(() => {
    // macOS uses native traffic lights; querying isMaximized there re-triggers resize events in a loop
    if (IS_MAC) return;

    appWindow.isMaximized().then(setIsMaximized);
    const unlisten = appWindow.onResized(async () => {
      const maximized = await appWindow.isMaximized();
      setIsMaximized((prev) => (prev === maximized ? prev : maximized));
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  // Native traffic lights overlay the top-left corner; keep only a drag region
  if (IS_MAC) {
    return <div data-tauri-drag-region className="h-9 w-full shrink-0 select-none" />;
  }

  const btn = "inline-flex h-full w-11 cursor-pointer items-center justify-center text-muted-foreground transition-colors hover:bg-foreground/10 hover:text-foreground";

  return (
    <div className="flex h-9 w-full shrink-0 select-none justify-between">
      <div data-tauri-drag-region className="flex flex-1 items-center px-4" />
      <div className="flex h-full shrink-0">
        <button onClick={() => invoke('window_minimize')} className={btn} title="Minimizar"><Minus size={15} /></button>
        <button onClick={() => invoke('window_toggle_maximize')} className={btn} title={isMaximized ? "Restaurar" : "Maximizar"}>
          {isMaximized ? <Copy size={13} className="rotate-180" /> : <Square size={12} />}
        </button>
        <button onClick={() => invoke('window_close')} className={`${btn} hover:!bg-red-500 hover:!text-white`} title="Fechar"><X size={16} /></button>
      </div>
    </div>
  );
}
