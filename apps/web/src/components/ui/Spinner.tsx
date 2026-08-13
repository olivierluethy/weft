import { Logo } from '@/components/Logo';

export function Spinner() {
  return <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-line border-t-thread" />;
}

/** Full-screen brand loading state (used while auth resolves). */
export function FullScreenLoader() {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-4 bg-paper">
      <div className="animate-pulse">
        <Logo size={44} />
      </div>
      <span className="font-display text-sm text-ink-faint">Weaving your workspace…</span>
    </div>
  );
}
