import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';

export interface ContextMenuItem {
  label: string;
  icon?: ReactNode;
  onSelect: () => void;
  disabled?: boolean;
  /** Draws a divider above this item. */
  separatorBefore?: boolean;
}

interface ContextMenuProps {
  /** Viewport coordinates of the click that opened the menu. */
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
  /** Extra classes for the panel, e.g. `dark` to match an always-dark surface. */
  className?: string;
}

const VIEWPORT_MARGIN = 8;

export default function ContextMenu({ x, y, items, onClose, className }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ left: x, top: y });

  // Keep the menu inside the window when opened near the right/bottom edge.
  useLayoutEffect(() => {
    const menu = menuRef.current;
    if (!menu) return;
    const { width, height } = menu.getBoundingClientRect();
    setPosition({
      left: Math.max(VIEWPORT_MARGIN, Math.min(x, window.innerWidth - width - VIEWPORT_MARGIN)),
      top: Math.max(VIEWPORT_MARGIN, Math.min(y, window.innerHeight - height - VIEWPORT_MARGIN)),
    });
    menu.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus();
  }, [x, y]);

  useEffect(() => {
    const closeOnOutsidePress = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) onClose();
    };
    // Capture phase: also catches scrolling inside nested containers.
    document.addEventListener('mousedown', closeOnOutsidePress, true);
    document.addEventListener('scroll', onClose, true);
    window.addEventListener('resize', onClose);
    window.addEventListener('blur', onClose);
    return () => {
      document.removeEventListener('mousedown', closeOnOutsidePress, true);
      document.removeEventListener('scroll', onClose, true);
      window.removeEventListener('resize', onClose);
      window.removeEventListener('blur', onClose);
    };
  }, [onClose]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    // While the menu is open its keys must not reach global shortcuts (e.g. the video player's).
    e.stopPropagation();
    if (e.key === 'Escape' || e.key === 'Tab') {
      e.preventDefault();
      onClose();
      return;
    }
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const buttons = Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? []);
    if (buttons.length === 0) return;
    const current = buttons.indexOf(document.activeElement as HTMLButtonElement);
    const step = e.key === 'ArrowDown' ? 1 : -1;
    buttons[(current + step + buttons.length) % buttons.length].focus();
  };

  // Rendered in <body>: ancestors with backdrop-filter/transform would otherwise offset `fixed`.
  return createPortal(
    <div
      ref={menuRef}
      role="menu"
      className={cn(
        "fixed z-[100] min-w-[220px] rounded-xl border border-border bg-popover p-1.5 text-popover-foreground shadow-2xl",
        className
      )}
      style={position}
      onKeyDown={handleKeyDown}
      onClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
    >
      {items.map((item, index) => (
        <div key={index}>
          {item.separatorBefore && <div className="my-1.5 h-px bg-border" />}
          <button
            type="button"
            role="menuitem"
            disabled={item.disabled}
            className="flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-left text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:text-accent-foreground disabled:cursor-default disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-inherit"
            onClick={() => {
              onClose();
              item.onSelect();
            }}
          >
            {item.icon && <span className="flex h-4 w-4 shrink-0 items-center justify-center">{item.icon}</span>}
            <span className="truncate">{item.label}</span>
          </button>
        </div>
      ))}
    </div>,
    document.body
  );
}
