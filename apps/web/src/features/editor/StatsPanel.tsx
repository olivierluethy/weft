import { formatDistanceToNow } from 'date-fns';
import type { DocStats } from './stats';

export function StatsPanel({ stats, updatedAt }: { stats: DocStats; updatedAt?: string }) {
  const rows: [string, string][] = [
    ['Words', stats.words.toLocaleString()],
    ['Characters', stats.characters.toLocaleString()],
    ['Characters (no spaces)', stats.charactersNoSpaces.toLocaleString()],
    ['Sentences', stats.sentences.toLocaleString()],
    ['Reading time', `${stats.readingMinutes} min`],
  ];
  return (
    <div className="w-[240px] rounded-md border border-line bg-surface p-1 shadow-md">
      <p className="px-3 pb-1 pt-2 text-2xs font-semibold uppercase tracking-wide text-ink-faint">
        Page stats
      </p>
      {rows.map(([label, value]) => (
        <div key={label} className="flex items-center justify-between px-3 py-1.5 text-sm">
          <span className="text-ink-muted">{label}</span>
          <span className="font-medium text-ink">{value}</span>
        </div>
      ))}
      {updatedAt && (
        <div className="mt-1 border-t border-line px-3 py-2 text-xs text-ink-faint">
          Edited {formatDistanceToNow(new Date(updatedAt), { addSuffix: true })}
        </div>
      )}
    </div>
  );
}
