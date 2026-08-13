import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api, ApiError } from '@/lib/api';
import { Logo } from '@/components/Logo';
import { Spinner } from '@/components/ui/Spinner';
import { toHtml } from '@/features/export/exporters';
import { PageIcon } from '@/features/editor/pickers/IconPicker';
import { coverImageStyle } from '@/features/editor/cover';

interface PublicData {
  permission: string;
  page: {
    id: string;
    title: string;
    icon: string | null;
    coverUrl: string | null;
    coverOffsetX?: number;
    coverOffsetY?: number;
    coverScale?: number;
    content: unknown;
    customCss: string | null;
    workspaceName: string;
    globalCss: string | null;
    author: string | null;
  };
  children: { id: string; title: string; icon: string | null }[];
}

export default function PublicPage() {
  const { token } = useParams();
  const [data, setData] = useState<PublicData | null>(null);
  const [error, setError] = useState('');
  const [childId, setChildId] = useState<string | null>(null);
  const [child, setChild] = useState<{ page: any; children: any[] } | null>(null);

  useEffect(() => {
    api
      .get<PublicData>(`/public/${token}`)
      .then(setData)
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Not available'));
  }, [token]);

  useEffect(() => {
    if (!childId) {
      setChild(null);
      return;
    }
    api.get<{ page: any; children: any[] }>(`/public/${token}/page/${childId}`).then(setChild).catch(() => setChild(null));
  }, [token, childId]);

  const active = child?.page ?? data?.page;
  const activeChildren = child?.children ?? data?.children ?? [];
  const html = useMemo(
    () => (active ? toHtml((Array.isArray(active.content) ? active.content : []) as any[]) : ''),
    [active],
  );

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 bg-paper text-center">
        <Logo size={40} />
        <p className="text-ink-muted">{error}</p>
      </div>
    );
  }
  if (!data || !active) {
    return (
      <div className="flex h-full items-center justify-center bg-paper">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="min-h-full bg-paper">
      {data.page.globalCss && <style>{data.page.globalCss}</style>}
      {active.customCss && <style>{`.weft-page-content { ${active.customCss} }`}</style>}

      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-paper/85 px-5 py-2.5 backdrop-blur">
        <div className="flex items-center gap-2">
          <Logo size={22} />
          <span className="font-display text-sm font-semibold">Weft</span>
          <span className="text-ink-faint">·</span>
          <span className="text-sm text-ink-muted">{data.page.workspaceName}</span>
        </div>
        <span className="rounded bg-sunk px-2 py-0.5 text-xs text-ink-muted">Read-only</span>
      </header>

      {active.coverUrl && (
        <div className="h-[220px] w-full overflow-hidden">
          <img
            src={active.coverUrl}
            alt=""
            style={coverImageStyle(
              active.coverOffsetX ?? 50,
              active.coverOffsetY ?? 50,
              active.coverScale ?? 1,
            )}
          />
        </div>
      )}

      <article className="weft-page-content mx-auto max-w-[720px] px-6 py-10">
        {childId && (
          <button
            onClick={() => setChildId(null)}
            className="mb-4 text-sm text-thread hover:underline"
          >
            ← Back to {data.page.title || 'top'}
          </button>
        )}
        <div className="mb-4 flex items-center gap-3">
          {active.icon && <PageIcon icon={active.icon} size={48} />}
          <h1 className="font-display text-4xl font-semibold tracking-tight text-ink">
            {active.title || 'Untitled'}
          </h1>
        </div>
        {data.page.author && !childId && (
          <p className="mb-6 text-sm text-ink-faint">Shared by {data.page.author}</p>
        )}
        <div
          className="prose-weft font-serif text-[17px] leading-[28px] text-ink [&_a]:text-thread [&_blockquote]:border-l-2 [&_blockquote]:border-thread [&_blockquote]:pl-4 [&_blockquote]:text-ink-muted [&_h1]:font-display [&_h2]:mt-6 [&_h2]:font-display [&_h2]:text-2xl [&_h2]:font-semibold [&_h3]:font-display [&_img]:rounded-lg [&_pre]:rounded-md [&_pre]:bg-sunk [&_pre]:p-3 [&_table]:w-full [&_td]:border [&_td]:border-line [&_td]:p-2 [&_th]:border [&_th]:border-line [&_th]:p-2"
          dangerouslySetInnerHTML={{ __html: html }}
        />

        {activeChildren.length > 0 && (
          <div className="mt-10 border-t border-line pt-5">
            <p className="mb-2 text-2xs font-semibold uppercase tracking-wide text-ink-faint">
              Sub-pages
            </p>
            <ul className="space-y-1">
              {activeChildren.map((c) => (
                <li key={c.id}>
                  <button
                    onClick={() => setChildId(c.id)}
                    className="flex items-center gap-2 rounded px-2 py-1.5 text-sm text-ink transition hover:bg-sunk"
                  >
                    {c.icon ? <PageIcon icon={c.icon} size={16} /> : '📄'}
                    {c.title || 'Untitled'}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </article>
    </div>
  );
}
