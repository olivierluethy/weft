import { Sun, Moon, Monitor, Check, type LucideIcon } from 'lucide-react';
import { useThemeStore } from '@/hooks/useTheme';
import { cn } from '@/lib/utils';

type ThemeOption = {
  value: 'light' | 'dark' | 'system';
  label: string;
  description: string;
  icon: LucideIcon;
};

const OPTIONS: ThemeOption[] = [
  { value: 'light', label: 'Light', description: 'Warm paper canvas', icon: Sun },
  { value: 'dark', label: 'Dark', description: 'Dim, low-glare', icon: Moon },
  { value: 'system', label: 'System', description: 'Match your device', icon: Monitor },
];

export function AppearancePanel() {
  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-display text-lg font-semibold text-ink">Appearance</h2>
        <p className="mt-1 text-sm text-ink-muted">Choose how Weft looks on this device.</p>
      </div>

      <div>
        <span className="field-label">Theme</span>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {OPTIONS.map((opt) => {
            const active = theme === opt.value;
            const Icon = opt.icon;
            return (
              <button
                key={opt.value}
                type="button"
                aria-pressed={active}
                onClick={() => setTheme(opt.value)}
                className={cn(
                  'group relative flex flex-col items-start gap-3 rounded-md border p-4 text-left transition',
                  active
                    ? 'border-thread bg-thread-soft'
                    : 'border-line bg-surface hover:border-line-strong hover:bg-sunk',
                )}
              >
                {active && (
                  <span className="absolute right-3 top-3 text-thread">
                    <Check size={16} />
                  </span>
                )}
                <span className={cn(active ? 'text-thread' : 'text-ink-muted')}>
                  <Icon size={20} />
                </span>
                <span>
                  <span
                    className={cn(
                      'block text-sm font-medium',
                      active ? 'text-thread' : 'text-ink',
                    )}
                  >
                    {opt.label}
                  </span>
                  <span className="mt-0.5 block text-xs text-ink-muted">{opt.description}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
