import { cn } from '@/lib/utils';

/** The Weft brand mark — three threads woven over and under, the right one in
 * the madder accent. `badge` wraps it in the indigo rounded square (tab/app
 * icon); bare form inherits colour for use on any surface. */
export function Logo({
  size = 28,
  badge = true,
  className,
}: {
  size?: number;
  badge?: boolean;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      className={cn('shrink-0', className)}
      role="img"
      aria-label="Weft"
    >
      {badge && <rect width="64" height="64" rx="16" fill="var(--thread)" />}
      <g strokeWidth="8" strokeLinecap="round" fill="none">
        <line x1="9" y1="24" x2="55" y2="24" stroke={badge ? 'var(--paper)' : 'currentColor'} />
        <line x1="9" y1="40" x2="55" y2="40" stroke={badge ? 'var(--paper)' : 'currentColor'} />
        <line x1="24" y1="9" x2="24" y2="55" stroke={badge ? 'var(--paper)' : 'currentColor'} />
        <line x1="40" y1="9" x2="40" y2="55" stroke="var(--madder)" />
        <line x1="16" y1="40" x2="32" y2="40" stroke={badge ? 'var(--paper)' : 'currentColor'} />
        <line x1="32" y1="24" x2="48" y2="24" stroke={badge ? 'var(--paper)' : 'currentColor'} />
      </g>
    </svg>
  );
}

export function Wordmark({ size = 28 }: { size?: number }) {
  return (
    <div className="flex items-center gap-2">
      <Logo size={size} />
      <span className="font-display text-lg font-semibold tracking-tight text-ink">Weft</span>
    </div>
  );
}
