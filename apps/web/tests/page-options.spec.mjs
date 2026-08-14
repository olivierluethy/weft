/**
 * Real-browser checks for the page options control panel (STYLEGUIDE §6.7).
 *
 * Run it against a running dev stack (`pnpm dev`, vite :5173 → fastify :4000)
 * with a seeded database (`pnpm seed`):
 *
 *     node --input-type=module -e "$(cat apps/web/tests/page-options.spec.mjs)"
 *     BASE=http://127.0.0.1:5199 node --input-type=module -e "$(cat ...)"   # other port
 *
 * It drives the installed Chrome through `playwright-core` — no browser
 * download — signs in as the seeded demo user, and works on a page it creates
 * and deletes itself, so it never touches real content.
 *
 * Every assertion reads the actual page: the rendered column width, the
 * computed font-family, the `spellcheck` attribute on the ProseMirror root. The
 * point of the suite is the one rule that is easy to regress — a live setting
 * must never close the panel — so almost every step re-asserts that the panel
 * is still open afterwards.
 */
import { chromium } from 'playwright-core';

const BASE = process.env.BASE || 'http://127.0.0.1:5173';
const results = [];
let failures = 0;

function check(name, ok, detail = '') {
  results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`);
  if (!ok) failures++;
}

const browser = await chromium.launch({
  executablePath: '/usr/bin/google-chrome',
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
const page = await browser.newPage({ viewport: { width: 1400, height: 950 } });
page.on('pageerror', (e) => console.log('PAGE ERROR:', e.message));

// ── Sign in and open a page ───────────────────────────────────────────────
await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await page.evaluate(() =>
  fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'demo@weft.local', password: 'weftdemo1' }),
    credentials: 'include',
  }).then((r) => r.json()),
);
// A page of our own, so the suite never rewrites the user's real content.
const href = await page.evaluate(async () => {
  const j = (r) => r.json();
  const me = await fetch('/api/auth/me', { credentials: 'include' }).then(j);
  const workspaceId = (me.workspaces ?? me.user?.workspaces ?? [])[0]?.id ?? me.workspaces?.[0]?.id;
  const created = await fetch('/api/pages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ workspaceId, title: 'Options panel test' }),
  }).then(j);
  return `/p/${created.page.id}`;
});
await page.goto(`${BASE}${href}`, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('[data-page-scroll] .pb-40', { timeout: 20000 });
await page.waitForSelector('.ProseMirror.bn-editor', { timeout: 20000 });
console.log('page under test:', href);

// ── Helpers that read the real page ───────────────────────────────────────
const panel = () => page.locator('input[aria-label="Search settings"]');
const panelOpen = () => panel().isVisible().catch(() => false);
const openPanel = async () => {
  if (await panelOpen()) return;
  await page.click('[data-weft-more-options]');
  await page.waitForSelector('input[aria-label="Search settings"]', { timeout: 5000 });
};
const columnWidth = () =>
  page.evaluate(() => {
    const el = document.querySelector('[data-page-scroll] .pb-40');
    return el ? Math.round(el.getBoundingClientRect().width) : -1;
  });
const bodyFont = () =>
  page.evaluate(() => {
    const el = document.querySelector('[data-page-scroll]');
    return el ? getComputedStyle(el).getPropertyValue('--wf-body-font').trim() : '';
  });
const titleFont = () =>
  page.evaluate(() => {
    const el = document.querySelector('.weft-title');
    return el ? getComputedStyle(el).fontFamily : '';
  });
const editorSpellcheck = () =>
  page.evaluate(() => document.querySelector('.ProseMirror.bn-editor')?.getAttribute('spellcheck'));
const checkboxState = (label) =>
  page.evaluate((l) => {
    const el = [...document.querySelectorAll('[role="checkbox"]')].find((n) =>
      n.textContent?.includes(l),
    );
    return el ? el.getAttribute('aria-checked') : null;
  }, label);
const segmentChecked = () =>
  page.evaluate(() => {
    const group = document.querySelector('[role="radiogroup"][aria-label="Page width"]');
    if (!group) return null;
    const on = [...group.querySelectorAll('[role="radio"]')].find(
      (n) => n.getAttribute('aria-checked') === 'true',
    );
    return on?.textContent?.trim() ?? null;
  });
const clickSegment = async (label) => {
  await page.locator(`[role="radiogroup"][aria-label="Page width"] [role="radio"]`, { hasText: label }).first().click();
};

// ═══ 1. Spellcheck — a checkbox that can be flipped repeatedly ════════════
await openPanel();
check('panel opens from the "…" button', await panelOpen());

const before = await checkboxState('Spellcheck');
const beforeAttr = await editorSpellcheck();
await page.locator('[role="checkbox"]', { hasText: 'Spellcheck' }).first().click();
await page.waitForFunction(
  (prev) => document.querySelector('.ProseMirror.bn-editor')?.getAttribute('spellcheck') !== prev,
  beforeAttr,
  { timeout: 5000 },
);
const afterOne = await checkboxState('Spellcheck');
check('spellcheck checkbox toggles', before !== afterOne, `${before} → ${afterOne}`);
check('panel stays open after toggling spellcheck (1)', await panelOpen());
check(
  'editor spellcheck attribute follows the checkbox',
  (await editorSpellcheck()) === afterOne,
  `attr=${await editorSpellcheck()} checkbox=${afterOne}`,
);

await page.locator('[role="checkbox"]', { hasText: 'Spellcheck' }).first().click();
await page.waitForFunction(
  (prev) => document.querySelector('.ProseMirror.bn-editor')?.getAttribute('spellcheck') !== prev,
  await editorSpellcheck(),
  { timeout: 5000 },
).catch(() => {});
const afterTwo = await checkboxState('Spellcheck');
check('spellcheck can be flipped straight back', afterTwo === before, `${afterOne} → ${afterTwo}`);
check('panel stays open after toggling spellcheck (2)', await panelOpen());

// A third flip, without reopening anything — the whole point of the change.
await page.locator('[role="checkbox"]', { hasText: 'Spellcheck' }).first().click();
check('panel stays open after a third flip', await panelOpen());
await page.locator('[role="checkbox"]', { hasText: 'Spellcheck' }).first().click();
check('spellcheck ends back on', (await editorSpellcheck()) === 'true', await editorSpellcheck());

// ═══ 2. Width — live, exclusive, panel stays open ═════════════════════════
check('panel still open before width test', await panelOpen());
await clickSegment('Narrower');
await page.waitForTimeout(250);
const narrow = await columnWidth();
check('panel stays open after Narrower', await panelOpen());
check('Narrower is the checked segment', (await segmentChecked()) === 'Narrower', await segmentChecked());

await clickSegment('Wider');
await page.waitForFunction(
  (w) => Math.round(document.querySelector('[data-page-scroll] .pb-40').getBoundingClientRect().width) !== w,
  narrow,
  { timeout: 5000 },
);
const wide = await columnWidth();
check('page really gets wider', wide > narrow, `${narrow}px → ${wide}px`);
check('panel stays open after Wider', await panelOpen());
check('Wider is the checked segment', (await segmentChecked()) === 'Wider', await segmentChecked());

await clickSegment('Full');
await page.waitForFunction(
  (w) => Math.round(document.querySelector('[data-page-scroll] .pb-40').getBoundingClientRect().width) !== w,
  wide,
  { timeout: 5000 },
);
const full = await columnWidth();
check('page really goes full width', full > wide, `${wide}px → ${full}px`);
check('panel stays open after Full', await panelOpen());
check('Full is the checked segment', (await segmentChecked()) === 'Full', await segmentChecked());

await clickSegment('Default');
await page.waitForFunction(
  (w) => Math.round(document.querySelector('[data-page-scroll] .pb-40').getBoundingClientRect().width) !== w,
  full,
  { timeout: 5000 },
);
const dflt = await columnWidth();
check('back to Default narrows again', dflt < full && dflt > narrow, `${full}px → ${dflt}px`);
check('panel stays open after Default', await panelOpen());

// ═══ 3. Font family — live switching inside the panel ═════════════════════
await page.locator('[data-entry="font"]').click();
await page.waitForSelector('input[aria-label="Search fonts"]', { timeout: 5000 });
check('Font family opens in place (sub-view, panel not closed)', true);

const fontBefore = await bodyFont();
await page.locator('[data-font-key="poppins"]').click();
await page.waitForFunction(
  (prev) =>
    getComputedStyle(document.querySelector('[data-page-scroll]'))
      .getPropertyValue('--wf-body-font')
      .trim() !== prev,
  fontBefore,
  { timeout: 5000 },
);
const poppins = await bodyFont();
check('picking Poppins re-faces the page', /Poppins/i.test(poppins), poppins);
check('title takes the new face too', /Poppins/i.test(await titleFont()), await titleFont());
check('font list stays open after a pick', await page.locator('input[aria-label="Search fonts"]').isVisible());

await page.locator('[data-font-key="lora"]').click();
await page.waitForFunction(
  () =>
    /Lora/i.test(
      getComputedStyle(document.querySelector('[data-page-scroll]')).getPropertyValue('--wf-body-font'),
    ),
  null,
  { timeout: 5000 },
);
check('a second pick switches again, no reopening', /Lora/i.test(await bodyFont()), await bodyFont());
check(
  'the picked face is marked active',
  (await page.getAttribute('[data-font-key="lora"]', 'aria-checked')) === 'true',
);

// How many faces does the library actually offer?
const faceCount = await page.locator('[data-font-key]').count();
check('font library is substantially bigger than three', faceCount >= 20, `${faceCount} faces`);

// The list must never advertise a face the browser can't load.
const unloadable = await page.evaluate(async () => {
  const keys = [...document.querySelectorAll('[data-font-key]')];
  const bad = [];
  for (const el of keys) {
    const family = getComputedStyle(el.querySelector('span[aria-hidden]')).fontFamily
      .split(',')[0]
      .replace(/["']/g, '')
      .trim();
    // A generic family has no @font-face; skip those, they are fallbacks.
    if (['system-ui', 'sans-serif', 'serif', 'monospace', 'ui-monospace'].includes(family)) continue;
    await document.fonts.load(`16px "${family}"`);
    if (!document.fonts.check(`16px "${family}"`)) bad.push(family);
  }
  return bad;
});
check('every offered face actually loads', unloadable.length === 0, unloadable.join(', ') || 'all 21 load');

// Escape steps back to the root instead of closing the whole panel.
await page.keyboard.press('Escape');
await page.waitForTimeout(150);
check('Escape leaves the font sub-view, panel still open', await panelOpen());

// ═══ 4. Search — fuzzy and relevance ranked ═══════════════════════════════
const search = async (q) => {
  await panel().fill(q);
  await page.waitForTimeout(120);
  return page.evaluate(() => {
    const root = document.querySelector('input[aria-label="Search settings"]').closest('div').parentElement;
    return [...root.querySelectorAll('[data-entry], [role="checkbox"], [role="radiogroup"]')].map((n) =>
      n.getAttribute('data-entry') ?? n.getAttribute('aria-label') ?? n.textContent.trim().split('\n')[0],
    );
  });
};

const fontHits = await search('font');
check('"font" finds Font family', fontHits.includes('font'), JSON.stringify(fontHits));

const widthHits = await search('width');
check('"width" finds the Width control', widthHits.includes('Page width'), JSON.stringify(widthHits));

const typoHits = await search('spellcheque');
check('typo "spellcheque" still finds Spellcheck', typoHits.some((h) => /Spellcheck/i.test(h)), JSON.stringify(typoHits));

const partialHits = await search('narrow');
check('"narrow" surfaces the width control', partialHits.includes('Page width'), JSON.stringify(partialHits));

const pdfHits = await search('pdf');
check('"pdf" finds the PDF export first', pdfHits[0] === 'export-pdf', JSON.stringify(pdfHits));

const expHits = await search('expot');
check('typo "expot" still finds exports', expHits.some((h) => String(h).startsWith('export-')), JSON.stringify(expHits));

// Searching then using a live control must not tear anything down.
await search('spell');
await page.locator('[role="checkbox"]', { hasText: 'Spellcheck' }).first().click();
check('toggling from a search result keeps the panel open', await panelOpen());
await page.locator('[role="checkbox"]', { hasText: 'Spellcheck' }).first().click();
await panel().fill('');

// ═══ 5. Persistence across a reload ═══════════════════════════════════════
await clickSegment('Wider');
await page.waitForTimeout(400);
await page.locator('[data-entry="font"]').click();
await page.waitForSelector('input[aria-label="Search fonts"]');
await page.locator('[data-font-key="merriweather"]').click();
await page.waitForTimeout(400);
await page.keyboard.press('Escape');
await page.locator('[role="checkbox"]', { hasText: 'Spellcheck' }).first().click(); // → off
await page.waitForTimeout(600);

const expectWidth = await columnWidth();
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForSelector('[data-page-scroll] .pb-40');
await page.waitForSelector('.ProseMirror.bn-editor');
await page.waitForTimeout(600);

check('font survives a reload', /Merriweather/i.test(await bodyFont()), await bodyFont());
check('width survives a reload', Math.abs((await columnWidth()) - expectWidth) < 2, `${await columnWidth()} vs ${expectWidth}`);
check('spellcheck survives a reload', (await editorSpellcheck()) === 'false', await editorSpellcheck());

await openPanel();
check('reopened panel shows the stored width', (await segmentChecked()) === 'Wider', await segmentChecked());
check('reopened panel shows spellcheck off', (await checkboxState('Spellcheck')) === 'false');
const detail = await page.locator('[data-entry="font"]').innerText();
check('reopened panel names the stored font', /Merriweather/.test(detail), detail);

// ═══ 6. Dismissal still works the way it should ═══════════════════════════
await page.mouse.click(700, 700); // genuine outside click, in the page body
await page.waitForTimeout(250);
check('a real outside click still closes the panel', !(await panelOpen()));

await openPanel();
await page.keyboard.press('Escape');
await page.waitForTimeout(250);
check('Escape at the root closes the panel', !(await panelOpen()));

// Restore the page to something sane for the human who looks at it next.
await openPanel();
await clickSegment('Default');
await page.waitForTimeout(300);
await page.locator('[data-entry="font"]').click();
await page.waitForSelector('input[aria-label="Search fonts"]');
await page.locator('[data-font-key="serif"]').click();
await page.waitForTimeout(300);
await page.keyboard.press('Escape');
await page.locator('[role="checkbox"]', { hasText: 'Spellcheck' }).first().click();
await page.waitForTimeout(400);
if (process.env.SHOT) await page.screenshot({ path: process.env.SHOT });

// Remove the scratch page again — the suite leaves no trace in the workspace.
await page.evaluate(async (id) => {
  await fetch(`/api/pages/${id}`, { method: 'DELETE', credentials: 'include' });
  await fetch(`/api/pages/${id}/permanent`, { method: 'DELETE', credentials: 'include' });
}, href.replace('/p/', ''));

await browser.close();

console.log('\n' + results.join('\n'));
console.log(`\n${results.length - failures}/${results.length} passed`);
process.exit(failures ? 1 : 0);
