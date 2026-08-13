import { env } from '../env.js';

const cache = new Map<string, string>();

const isPrivate = (ip: string) =>
  !ip ||
  ip === '::1' ||
  ip === '127.0.0.1' ||
  ip.startsWith('10.') ||
  ip.startsWith('192.168.') ||
  ip.startsWith('172.16.') ||
  ip.startsWith('::ffff:127.') ||
  ip.startsWith('fe80:');

/** Best-effort IP → "City, Country" via ip-api.com. Never throws; degrades to
 * "Local network" / "Unknown location" so a login is always recorded. */
export async function geolocate(ip: string): Promise<string> {
  const clean = ip.replace('::ffff:', '');
  if (isPrivate(clean)) return 'Local network';
  if (cache.has(clean)) return cache.get(clean)!;

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 2500);
    const res = await fetch(`${env.geoApi}/${clean}?fields=status,city,regionName,country`, {
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return 'Unknown location';
    const data = (await res.json()) as {
      status: string;
      city?: string;
      regionName?: string;
      country?: string;
    };
    if (data.status !== 'success') return 'Unknown location';
    const label = [data.city, data.country].filter(Boolean).join(', ') || 'Unknown location';
    cache.set(clean, label);
    return label;
  } catch {
    return 'Unknown location';
  }
}
