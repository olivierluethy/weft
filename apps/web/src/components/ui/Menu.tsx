import {
  useState,
  useRef,
  useEffect,
  cloneElement,
  type ReactNode,
  type ReactElement,
} from 'react';
import { cn } from '@/lib/utils';

export interface MenuItem {
  label: string;
  icon?: ReactNode;
  onClick?: () => void;
  danger?: boolean;
  disabled?: boolean;
  divider?: boolean;
  checked?: boolean;
}

/** Lightweight dropdown menu anchored to a trigger element. */
export function Menu({
  trigger,
  items,
  align = 'start',
}: {
  trigger: ReactElement;
  items: MenuItem[];
  align?: 'start' | 'end';
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const triggerEl = cloneElement(trigger as ReactElement<any>, {
    onClick: (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      setOpen((v) => !v);
    },
  });

  return (
    <div ref={ref} className="relative inline-flex">
      {triggerEl}
      {open && (
        <div
          className={cn(
            'absolute top-full z-40 mt-1 min-w-[190px] animate-[fade_.12s_ease] overflow-hidden rounded-md border border-line bg-surface py-1 shadow-md',
            align === 'end' ? 'right-0' : 'left-0',
          )}
          onClick={(e) => e.stopPropagation()}
        >
          {items.map((item, i) =>
            item.divider ? (
              <div key={i} className="my-1 h-px bg-line" />
            ) : (
              <button
                key={i}
                disabled={item.disabled}
                onClick={() => {
                  setOpen(false);
                  item.onClick?.();
                }}
                className={cn(
                  'flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-sm transition',
                  item.danger ? 'text-danger hover:bg-danger-soft' : 'text-ink hover:bg-sunk',
                  item.disabled && 'cursor-not-allowed opacity-50',
                )}
              >
                {item.icon && <span className="flex h-4 w-4 items-center justify-center">{item.icon}</span>}
                <span className="flex-1">{item.label}</span>
                {item.checked && <span className="text-thread">✓</span>}
              </button>
            ),
          )}
        </div>
      )}
    </div>
  );
}
