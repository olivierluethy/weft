import { useEffect, useState } from 'react';
import { Search, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';

interface ImageResult {
  id: string;
  url: string;
  thumbnail: string;
  title: string;
  creator?: string;
  source: string;
  license?: string;
}

/** Keyless image search (Openverse → Wikimedia fallback), served by the server proxy. */
export function ImageSearch({ onPick }: { onPick: (url: string) => void }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<ImageResult[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    const handle = setTimeout(async () => {
      try {
        const res = await api.get<{ results: ImageResult[] }>(
          `/images/search?q=${encodeURIComponent(q)}`,
        );
        setResults(res.results);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 350);
    return () => clearTimeout(handle);
  }, [q]);

  return (
    <div>
      <div className="mb-3 flex items-center gap-2 rounded border border-line-strong bg-surface px-2.5">
        <Search size={15} className="text-ink-faint" />
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search free images (Openverse)…"
          className="h-8 flex-1 bg-transparent text-sm outline-none placeholder:text-ink-faint"
        />
        {loading && <Loader2 size={14} className="animate-spin text-ink-faint" />}
      </div>
      {results.length === 0 ? (
        <p className="py-8 text-center text-sm text-ink-faint">
          {q.trim().length < 2 ? 'Type to search millions of openly-licensed images.' : 'No results.'}
        </p>
      ) : (
        <div className="grid max-h-[320px] grid-cols-3 gap-2 overflow-y-auto pr-1">
          {results.map((r) => (
            <button
              key={r.id}
              onClick={() => onPick(r.url)}
              title={`${r.title}${r.creator ? ` — ${r.creator}` : ''}${r.license ? ` (${r.license})` : ''}`}
              className="group relative aspect-[4/3] overflow-hidden rounded border border-line bg-sunk"
            >
              <img
                src={r.thumbnail}
                alt={r.title}
                loading="lazy"
                className="h-full w-full object-cover transition group-hover:scale-105"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
