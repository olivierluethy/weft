// Rasterises the master brand SVG into the PNG favicon set.
// Run automatically after install (see package.json). Safe to re-run.
import sharp from 'sharp';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const pub = resolve(here, '../public');
const svg = await readFile(resolve(pub, 'favicon.svg'));

const targets = [
  ['favicon-16.png', 16],
  ['favicon-32.png', 32],
  ['favicon-48.png', 48],
  ['apple-touch-icon.png', 180],
  ['icon-192.png', 192],
  ['icon-512.png', 512],
];

for (const [name, size] of targets) {
  const png = await sharp(svg, { density: 384 }).resize(size, size).png().toBuffer();
  await writeFile(resolve(pub, name), png);
  console.log(`  ✓ ${name} (${size}×${size})`);
}
console.log('Favicon set generated.');
