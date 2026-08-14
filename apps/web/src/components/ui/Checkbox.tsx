import { Check } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * A labelled boolean control — a real checkbox the user can hit, not the word
 * "On"/"Off" (docs/STYLEGUIDE.md §6.7).
 *
 * It is a `role="checkbox"` button rather than a native `<input>` so the whole
 * row is the hit target and the box, icon, label and hint can share one focus
 * ring; `aria-checked` carries the state to assistive tech either way.
 *
 * Deliberately it does **not** close anything. Boolean settings are the
 * canonical "live" control: the caller flips a value, the page changes, and the
 * surface this lives in stays exactly where it was so the change can be judged
 * and reversed.
 */
export function Checkbox({
  checked,
  onChange,
  label,
  hint,
  icon,
  disabled,
  className,
  ...rest
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: ReactNode;
  /** Secondary line under the label — say what the setting *does*. */
  hint?: ReactNode;
  /** Optional leading icon, matching the other rows in a list. */
  icon?: ReactNode;
  disabled?: boolean;
  className?: string;
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onChange' | 'className' | 'type'>) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'group flex w-full items-start gap-2.5 rounded-md px-2 py-1.5 text-left transition',
        'hover:bg-sunk disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-transparent',
        className,
      )}
      {...rest}
    >
      <span
        aria-hidden
        className={cn(
          'mt-px flex h-[17px] w-[17px] shrink-0 items-center justify-center rounded-[5px] border transition',
          checked
            ? 'border-thread bg-thread text-surface'
            : 'border-line-strong bg-surface text-transparent group-hover:border-ink-faint',
        )}
      >
        <Check size={12} strokeWidth={3} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="flex items-center gap-2 text-sm text-ink">
          {icon && <span className="flex h-4 w-4 items-center justify-center text-ink-faint">{icon}</span>}
          {label}
        </span>
        {hint && <span className="mt-0.5 text-2xs leading-snug text-ink-faint">{hint}</span>}
      </span>
    </button>
  );
}
