import { useRef, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface SegmentOption<T extends string> {
  value: T;
  label: ReactNode;
  /** Icon above the label. Optional — a text-only control is fine. */
  icon?: ReactNode;
  /** Native tooltip / accessible name when the label is an abbreviation. */
  title?: string;
  disabled?: boolean;
}

/**
 * One exclusive choice out of a small set, shown as a segmented track
 * (docs/STYLEGUIDE.md §6.7).
 *
 * Chosen over a dropdown wherever the *current* value matters as much as the
 * alternatives — page width, for instance, where you want to see "Wider" is
 * active and switch to "Full" without opening anything. Like `Checkbox`, using
 * it changes the value and nothing else: it never closes its container.
 *
 * Keyboard model is the standard radiogroup one: a single tab stop lands on the
 * selected segment, then `←`/`→` (and `Home`/`End`) move *and* select, so
 * arrowing through the options previews each one live.
 */
export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  label,
  className,
  disabled,
}: {
  value: T;
  onChange: (next: T) => void;
  options: SegmentOption<T>[];
  /** Accessible name for the group (the visible section heading, usually). */
  label: string;
  className?: string;
  disabled?: boolean;
}) {
  const trackRef = useRef<HTMLDivElement>(null);

  const move = (from: number, delta: number) => {
    const enabled = options.map((o, i) => ({ o, i })).filter(({ o }) => !o.disabled);
    if (!enabled.length) return;
    const pos = enabled.findIndex(({ i }) => i === from);
    const next = enabled[(pos + delta + enabled.length) % enabled.length]!;
    onChange(next.o.value);
    trackRef.current?.querySelectorAll<HTMLButtonElement>('[role="radio"]')[next.i]?.focus();
  };

  // Only the horizontal arrows are ours. `↑`/`↓` are left alone deliberately:
  // this control sits inside vertical lists (the page options panel) that use
  // them to move between rows, and swallowing them there would trap focus.
  const onKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      move(index, 1);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      move(index, -1);
    } else if (e.key === 'Home') {
      e.preventDefault();
      move(-1, 1);
    } else if (e.key === 'End') {
      e.preventDefault();
      move(options.length, -1);
    }
  };

  return (
    <div
      ref={trackRef}
      role="radiogroup"
      aria-label={label}
      className={cn(
        'flex gap-0.5 rounded-lg border border-line bg-sunk p-0.5',
        disabled && 'pointer-events-none opacity-60',
        className,
      )}
    >
      {options.map((opt, i) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            title={opt.title}
            disabled={disabled || opt.disabled}
            tabIndex={active ? 0 : -1}
            onKeyDown={(e) => onKeyDown(e, i)}
            onClick={() => onChange(opt.value)}
            className={cn(
              'flex flex-1 flex-col items-center justify-center gap-1 rounded-[6px] px-2 py-1.5 text-2xs font-medium transition',
              'disabled:cursor-not-allowed disabled:opacity-50',
              active
                ? 'bg-surface text-thread shadow-[0_1px_3px_-1px_rgba(33,31,28,0.25)] ring-1 ring-thread/25'
                : 'text-ink-muted hover:bg-surface/70 hover:text-ink',
            )}
          >
            {opt.icon && <span className="flex h-4 items-center justify-center">{opt.icon}</span>}
            <span className="leading-none">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}
