import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PALETTE } from './palette';
import type { MarkState } from './selectionModel';

/**
 * Colour for **selected characters** — text colour and highlight, in one panel.
 *
 * Both are BlockNote inline styles (`textColor` / `backgroundColor` marks), so
 * they land on exactly the run the user highlighted and nothing else (§11). That
 * is the distinction this panel exists to hold: the six-dots block menu paints a
 * whole block via its colour *props*, this paints a phrase.
 *
 * A selection that mixes several colours says so — the panel ticks nothing and
 * shows a "Mixed" note — rather than picking one at random (§18).
 */
export function InlineColorMenu({
  text,
  highlight,
  onPick,
}: {
  text: MarkState;
  highlight: MarkState;
  onPick: (kind: 'textColor' | 'backgroundColor', value: string | null) => void;
}) {
  return (
    // No border, radius or shadow of its own: it always sits inside the command
    // panel, which already draws the surface. Two frames read as a bug.
    <div className="p-3">
      <Section
        title="Text"
        ariaName="Text color"
        state={text}
        onPick={(v) => onPick('textColor', v)}
        render={(c, active) => (
          <span
            className="text-sm font-semibold leading-none"
            style={{ color: c.name === 'default' ? 'var(--ink)' : c.swatch }}
          >
            {active ? <Check size={13} strokeWidth={3} /> : 'A'}
          </span>
        )}
      />
      <div className="my-3 h-px bg-line" />
      <Section
        title="Highlight"
        ariaName="Highlight"
        state={highlight}
        onPick={(v) => onPick('backgroundColor', v)}
        fill
        render={(c, active) =>
          active ? (
            <Check size={13} strokeWidth={3} className="text-ink" />
          ) : (
            <span className="sr-only">{c.label}</span>
          )
        }
      />
    </div>
  );
}

function Section({
  title,
  ariaName,
  state,
  onPick,
  render,
  fill = false,
}: {
  title: string;
  /** Spoken name of what the swatch sets — the visual heading is shorter. */
  ariaName: string;
  state: MarkState;
  onPick: (value: string | null) => void;
  render: (c: (typeof PALETTE)[number], active: boolean) => React.ReactNode;
  fill?: boolean;
}) {
  // No mark at all reads as "default" — the same thing the first swatch means.
  const current = state.mixed ? null : (state.value ?? 'default');

  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <p className="text-2xs font-semibold uppercase tracking-wide text-ink-faint">{title}</p>
        {state.mixed && <span className="text-2xs text-ink-faint">Mixed</span>}
      </div>
      <div className="grid grid-cols-5 gap-1.5">
        {PALETTE.map((c) => {
          const active = current === c.name;
          return (
            <button
              key={c.name}
              type="button"
              title={c.label}
              aria-label={`${ariaName}: ${c.label}`}
              aria-pressed={active}
              onMouseDown={(e) => {
                // Never let the picker steal the selection it is about to paint.
                e.preventDefault();
                onPick(c.name === 'default' ? null : c.name);
              }}
              className={cn(
                'flex h-8 w-8 items-center justify-center rounded-md border transition',
                active ? 'border-thread ring-2 ring-thread/25' : 'border-line-strong hover:border-ink-faint',
              )}
              style={
                fill
                  ? {
                      background:
                        c.name === 'default'
                          ? 'var(--surface)'
                          : `color-mix(in srgb, ${c.swatch} 26%, var(--surface))`,
                    }
                  : undefined
              }
            >
              {render(c, active)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
