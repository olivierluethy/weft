import type { FastifyInstance } from 'fastify';
import { prisma } from '../db.js';
import { requireMembership } from '../lib/permissions.js';

/** Plain text of a single block's own inline content (children are separate blocks). */
function inlineText(nodes: any): string {
  if (!Array.isArray(nodes)) return typeof nodes === 'string' ? nodes : '';
  const out: string[] = [];
  for (const n of nodes) {
    if (typeof n === 'string') out.push(n);
    else if (n?.type === 'text' && typeof n.text === 'string') out.push(n.text);
    else if (Array.isArray(n?.content)) out.push(inlineText(n.content));
    else if (n?.text) out.push(String(n.text));
  }
  return out.join('');
}

/** Flatten a BlockNote document into { blockId, text } entries (recursing children). */
function blockTexts(content: unknown): { blockId: string | null; text: string }[] {
  const out: { blockId: string | null; text: string }[] = [];
  const walk = (b: any) => {
    if (!b) return;
    const text = inlineText(b.content).replace(/\s+/g, ' ').trim();
    if (text) out.push({ blockId: b.id ?? null, text });
    if (Array.isArray(b.children)) b.children.forEach(walk);
  };
  const blocks = Array.isArray(content) ? content : (content as any)?.content;
  if (Array.isArray(blocks)) blocks.forEach(walk);
  return out;
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function buildMatcher(q: string, wholeWord: boolean, caseSensitive: boolean): RegExp {
  const core = escapeRe(q.trim());
  const pattern = wholeWord ? `(?<![\\p{L}\\p{N}_])${core}(?![\\p{L}\\p{N}_])` : core;
  return new RegExp(pattern, `g${caseSensitive ? '' : 'i'}u`);
}

interface Occurrence {
  blockId: string | null;
  before: string;
  match: string;
  after: string;
}

function findOccurrences(
  entries: { blockId: string | null; text: string }[],
  re: RegExp,
  cap: number,
): { count: number; occurrences: Occurrence[] } {
  let count = 0;
  const occurrences: Occurrence[] = [];
  for (const { blockId, text } of entries) {
    re.lastIndex = 0;
    for (const m of text.matchAll(re)) {
      count++;
      if (occurrences.length < cap) {
        const idx = m.index ?? 0;
        const start = Math.max(0, idx - 40);
        occurrences.push({
          blockId,
          before: (start > 0 ? '…' : '') + text.slice(start, idx),
          match: m[0],
          after: text.slice(idx + m[0].length, idx + m[0].length + 60) + (idx + m[0].length + 60 < text.length ? '…' : ''),
        });
      }
    }
  }
  return { count, occurrences };
}

export default async function searchRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate);

  app.get('/', async (req) => {
    const { q, workspaceId, mode, caseSensitive } = req.query as {
      q?: string;
      workspaceId?: string;
      mode?: string; // 'whole' | 'contains' (default)
      caseSensitive?: string; // 'true' | 'false' (default false)
    };
    if (!q || !q.trim() || !workspaceId) return { results: [] };
    await requireMembership(workspaceId, req.currentUser!.id);

    const wholeWord = mode === 'whole';
    const sensitive = caseSensitive === 'true' || caseSensitive === '1';
    let re: RegExp;
    try {
      re = buildMatcher(q, wholeWord, sensitive);
    } catch {
      return { results: [] };
    }

    const pages = await prisma.page.findMany({
      where: { workspaceId, deletedAt: null, isTemplate: false },
      select: { id: true, title: true, icon: true, parentId: true, content: true, updatedAt: true },
      orderBy: { updatedAt: 'desc' },
      take: 800,
    });

    // Ancestor map for breadcrumb paths.
    const meta = new Map(pages.map((p) => [p.id, { title: p.title || 'Untitled', parentId: p.parentId }]));
    const pathOf = (id: string): { id: string; title: string }[] => {
      const chain: { id: string; title: string }[] = [];
      let cur = meta.get(id)?.parentId ?? null;
      const guard = new Set<string>();
      while (cur && meta.has(cur) && !guard.has(cur)) {
        guard.add(cur);
        chain.unshift({ id: cur, title: meta.get(cur)!.title });
        cur = meta.get(cur)!.parentId;
      }
      return chain;
    };

    const results = pages
      .map((p) => {
        const entries = [
          { blockId: null, text: p.title || '' },
          ...blockTexts(p.content),
        ];
        const { count, occurrences } = findOccurrences(entries, re, 25);
        if (count === 0) return null;
        const titleHit = occurrences.some((o) => o.blockId === null);
        return {
          id: p.id,
          title: p.title || 'Untitled',
          icon: p.icon,
          path: pathOf(p.id),
          count,
          occurrences,
          score: (titleHit ? 100 : 0) + count,
          updatedAt: p.updatedAt.toISOString(),
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)
      .sort((a, b) => b.score - a.score)
      .slice(0, 40);

    return { results };
  });
}
