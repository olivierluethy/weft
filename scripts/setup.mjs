// Zero-config bootstrap: ensure .env exists and the SQLite schema is in sync.
// Runs before `pnpm dev` and via `pnpm setup`. Idempotent and fast.
import { existsSync, copyFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const env = resolve(root, '.env');

if (!existsSync(env)) {
  copyFileSync(resolve(root, '.env.example'), env);
  console.log('• Created .env from .env.example');
}

// Push the Prisma schema to SQLite (creates dev.db + tables if missing).
// Run from repo root so Prisma loads the root .env; the sqlite path resolves
// relative to schema.prisma regardless of cwd.
try {
  execSync('pnpm exec prisma db push --schema apps/server/prisma/schema.prisma --skip-generate', {
    cwd: root,
    stdio: 'inherit',
  });
} catch {
  console.error('! Could not sync the database schema. Run `pnpm setup` manually.');
  process.exit(0); // don't block dev startup
}
