import { config } from 'dotenv';
import { resolve } from 'node:path';

// Load the root .env (monorepo-wide) then any server-local override.
config({ path: resolve(process.cwd(), '../../.env') });
config({ path: resolve(process.cwd(), '.env') });

function str(key: string, fallback: string): string {
  const v = process.env[key];
  return v === undefined || v === '' ? fallback : v;
}
function num(key: string, fallback: number): number {
  const v = process.env[key];
  const n = v ? Number(v) : NaN;
  return Number.isFinite(n) ? n : fallback;
}
function bool(key: string, fallback: boolean): boolean {
  const v = process.env[key];
  if (v === undefined) return fallback;
  return v === 'true' || v === '1';
}

export const env = {
  nodeEnv: str('NODE_ENV', 'development'),
  isProd: str('NODE_ENV', 'development') === 'production',
  port: num('PORT', 4000),
  host: str('HOST', '127.0.0.1'),
  webOrigin: str('WEB_ORIGIN', 'http://localhost:5173'),
  corsOrigins: str('CORS_ORIGINS', str('WEB_ORIGIN', 'http://localhost:5173'))
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),

  jwtAccessSecret: str('JWT_ACCESS_SECRET', 'dev-access-secret-change-me'),
  jwtRefreshSecret: str('JWT_REFRESH_SECRET', 'dev-refresh-secret-change-me'),
  accessTtl: str('ACCESS_TOKEN_TTL', '15m'),
  refreshTtlDays: num('REFRESH_TOKEN_TTL_DAYS', 7),
  refreshTtlDaysRemember: num('REFRESH_TOKEN_TTL_DAYS_REMEMBER', 90),
  cookieSecure: bool('COOKIE_SECURE', false),

  smtpHost: str('SMTP_HOST', ''),
  smtpPort: num('SMTP_PORT', 587),
  smtpUser: str('SMTP_USER', ''),
  smtpPass: str('SMTP_PASS', ''),
  smtpSecure: bool('SMTP_SECURE', false),
  mailFrom: str('MAIL_FROM', 'Weft <no-reply@weft.local>'),

  uploadDir: str('UPLOAD_DIR', './uploads'),
  maxUploadMb: num('MAX_UPLOAD_MB', 25),

  collabPath: str('COLLAB_PATH', '/collab'),

  openverseApi: str('OPENVERSE_API', 'https://api.openverse.org/v1'),
  wikimediaApi: str('WIKIMEDIA_API', 'https://commons.wikimedia.org/w/api.php'),
  geoApi: str('GEO_API', 'http://ip-api.com/json'),
} as const;

export const COOKIE = {
  access: 'weft_at',
  refresh: 'weft_rt',
} as const;
