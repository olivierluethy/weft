import { UAParser } from 'ua-parser-js';

export interface DeviceInfo {
  device: string;
  browser: string;
  os: string;
}

/** Turn a raw User-Agent string into human-readable device/browser/os labels. */
export function parseUserAgent(ua: string | undefined): DeviceInfo {
  if (!ua) return { device: 'Unknown device', browser: 'Unknown', os: 'Unknown' };
  const p = new UAParser(ua);
  const b = p.getBrowser();
  const os = p.getOS();
  const d = p.getDevice();

  const deviceType = d.type ? d.type.charAt(0).toUpperCase() + d.type.slice(1) : 'Desktop';
  const deviceName = [d.vendor, d.model].filter(Boolean).join(' ');

  return {
    device: deviceName || deviceType,
    browser: [b.name, b.version?.split('.')[0]].filter(Boolean).join(' ') || 'Unknown',
    os: [os.name, os.version].filter(Boolean).join(' ') || 'Unknown',
  };
}
