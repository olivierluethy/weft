import type { FastifyInstance } from 'fastify';
import { env } from '../env.js';

interface ImageResult {
  id: string;
  url: string;
  thumbnail: string;
  title: string;
  creator?: string;
  source: 'openverse' | 'wikimedia';
  license?: string;
}

async function searchOpenverse(q: string): Promise<ImageResult[]> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 5000);
  try {
    const res = await fetch(
      `${env.openverseApi}/images/?q=${encodeURIComponent(q)}&page_size=24&mature=false`,
      { signal: ctrl.signal, headers: { 'User-Agent': 'Weft/0.1 (local)' } },
    );
    if (!res.ok) return [];
    const data = (await res.json()) as { results?: any[] };
    return (data.results ?? []).map((r) => ({
      id: `ov_${r.id}`,
      url: r.url,
      thumbnail: r.thumbnail || r.url,
      title: r.title || 'Untitled',
      creator: r.creator,
      source: 'openverse' as const,
      license: r.license ? `${r.license} ${r.license_version ?? ''}`.trim() : undefined,
    }));
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

async function searchWikimedia(q: string): Promise<ImageResult[]> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 5000);
  try {
    const url =
      `${env.wikimediaApi}?action=query&generator=search&gsrnamespace=6&gsrsearch=${encodeURIComponent(q)}` +
      `&gsrlimit=24&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=400&format=json&origin=*`;
    const res = await fetch(url, { signal: ctrl.signal, headers: { 'User-Agent': 'Weft/0.1' } });
    if (!res.ok) return [];
    const data = (await res.json()) as { query?: { pages?: Record<string, any> } };
    const pages = data.query?.pages ?? {};
    return Object.values(pages)
      .filter((p: any) => p.imageinfo?.[0])
      .map((p: any) => {
        const info = p.imageinfo[0];
        return {
          id: `wm_${p.pageid}`,
          url: info.url,
          thumbnail: info.thumburl || info.url,
          title: (p.title || '').replace(/^File:/, ''),
          source: 'wikimedia' as const,
          license: info.extmetadata?.LicenseShortName?.value,
        };
      });
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

/** Keyless image search proxy. Openverse primary, Wikimedia fallback/secondary. */
export default async function imageRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate);

  app.get('/search', async (req) => {
    const { q, source } = req.query as { q?: string; source?: string };
    if (!q || q.trim().length < 2) return { results: [] };
    if (source === 'wikimedia') return { results: await searchWikimedia(q) };
    const primary = await searchOpenverse(q);
    if (primary.length > 0) return { results: primary };
    return { results: await searchWikimedia(q) };
  });
}
