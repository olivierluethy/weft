import { useState, useRef, useEffect, cloneElement, type ReactElement, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** Click-triggered floating panel with outside-click + Escape to close. */
export function Popover({
  trigger,
  children,
  align = 'start',
  className,
}: {
  trigger: ReactElement;
  children: ReactNode | ((close: () => void) => ReactNode);
  align?: 'start' | 'end' | 'center';
  className?: string;
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
      setOpen((v) => !v);
    },
  });

  const alignClass = align === 'end' ? 'right-0' : align === 'center' ? 'left-1/2 -translate-x-1/2' : 'left-0';

  return (
    <div ref={ref} className="relative inline-flex">
      {triggerEl}
      {open && (
        <div className={cn('absolute top-full z-50 mt-1.5 animate-[fade_.12s_ease]', alignClass, className)}>
          {typeof children === 'function' ? children(() => setOpen(false)) : children}
        </div>
      )}
    </div>
  );
}
