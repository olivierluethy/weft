/**
 * Real-browser checks for the inline (per-selection) font mark — STYLEGUIDE §3.4.
 *
 *     node --input-type=module -e "$(cat apps/web/tests/inline-font.spec.mjs)"
 *
 * Same harness as page-options.spec.mjs: installed Chrome via playwright-core,
 * the seeded demo user, its own scratch page created and permanently deleted.
 *
 * The assertions read the DOCUMENT MODEL (`window.__weftEditor.document`), not
 * just the DOM, so "the mark was applied" means the stored run actually carries
 * it. The load-bearing case is the toolbar surviving a focus move into the
 * picker's search field — see the `.bn-ui-container` note in §3.4.
 */
import { chromium } from 'playwright-core';

const BASE = process.env.BASE || 'http://127.0.0.1:5173';
const results = [];
let failures = 0;
const check = (n, ok, d = '') => {
  results.push(`${ok ? 'PASS' : 'FAIL'}  ${n}${d ? `  — ${d}` : ''}`);
  if (!ok) failures++;
};

const browser = await chromium.launch({
  executablePath: '/usr/bin/google-chrome',
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
const page = await browser.newPage({ viewport: { width: 1400, height: 950 } });
page.on('pageerror', (e) => console.log('PAGE ERROR:', e.message));

await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await page.evaluate(() =>
  fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'demo@weft.local', password: 'weftdemo1' }),
    credentials: 'include',
  }).then((r) => r.json()),
);
const href = await page.evaluate(async () => {
  const j = (r) => r.json();
  const me = await fetch('/api/auth/me', { credentials: 'include' }).then(j);
  const ws = (me.workspaces || [])[0]?.id;
  const c = await fetch('/api/pages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ workspaceId: ws, title: 'Inline font test' }),
  }).then(j);
  return '/p/' + c.page.id;
});
await page.goto(BASE + href, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('.ProseMirror.bn-editor');
await page.waitForTimeout(900);

// Type some text and select the first word.
await page.click('.ProseMirror.bn-editor');
await page.keyboard.type('Alpha bravo charlie');
await page.waitForTimeout(300);
await page.keyboard.press('Home');
await page.keyboard.down('Shift');
for (let i = 0; i < 5; i++) await page.keyboard.press('ArrowRight');
await page.keyboard.up('Shift');
await page.waitForTimeout(600);

const toolbarVisible = () =>
  page.evaluate(() => {
    const t = document.querySelector('.bn-formatting-toolbar');
    return !!t && t.getBoundingClientRect().width > 0;
  });
const pickerOpen = () =>
  page.locator('input[aria-label="Search fonts"]').isVisible().catch(() => false);
// The inline mark as stored in the document model, not just the DOM.
const markOf = (word) =>
  page.evaluate((w) => {
    const doc = window.__weftEditor?.document ?? [];
    for (const b of doc) {
      for (const n of b.content ?? []) {
        if ((n.text ?? '').startsWith(w)) return n.styles?.font ?? null;
      }
    }
    return 'NO-SUCH-RUN';
  }, word);
const renderedFont = (word) =>
  page.evaluate((w) => {
    const spans = [...document.querySelectorAll('.ProseMirror.bn-editor span')];
    const el = spans.find((s) => (s.textContent ?? '').startsWith(w) && s.style.fontFamily);
    return el ? getComputedStyle(el).fontFamily : null;
  }, word);

try {
check('formatting toolbar appears on a selection', await toolbarVisible());
check('inline font trigger is in the toolbar', await page.locator('[data-weft-inline-font]').isVisible());
// Unmarked text has no face of its own, and the trigger says nothing rather
// than parking the word "Default" in the rail forever (STYLEGUIDE §6.8).
check(
  'trigger names no face for unmarked text',
  (await page.locator('[data-weft-inline-font]').innerText()).trim() === '',
  JSON.stringify(await page.locator('[data-weft-inline-font]').innerText()),
);

await page.locator('[data-weft-inline-font]').click();
await page.waitForSelector('input[aria-label="Search fonts"]', { timeout: 5000 });
check('picker opens with the full library', (await page.locator('[data-font-key]').count()) >= 21,
  `${await page.locator('[data-font-key]').count()} rows (incl. Default)`);
check('toolbar survives opening the picker', await toolbarVisible());

// THE risk: typing in the search blurs the editor. BlockNote hides the toolbar
// on blur unless the focus target is inside a .bn-ui-container.
await page.fill('input[aria-label="Search fonts"]', 'poppins');
await page.waitForTimeout(300);
check('toolbar survives typing in the picker search', await toolbarVisible());
check('search narrows the list', (await page.locator('[data-font-key]').count()) <= 3,
  `${await page.locator('[data-font-key]').count()} rows`);

await page.locator('[data-font-key="poppins"]').click();
await page.waitForTimeout(400);
check('inline mark written to the document', (await markOf('Alpha')) === 'poppins', String(await markOf('Alpha')));
check('marked run renders in Poppins', /Poppins/i.test((await renderedFont('Alpha')) ?? ''), String(await renderedFont('Alpha')));
check('picker stays open after a pick', await pickerOpen());
check('toolbar stays open after a pick', await toolbarVisible());
check(
  'the trigger now names the face it applied',
  (await page.locator('[data-weft-inline-font]').innerText()).includes('Poppins'),
  await page.locator('[data-weft-inline-font]').innerText(),
);

// Second pick in a row, no reopening — the same promise as the page-level picker.
await page.fill('input[aria-label="Search fonts"]', '');
await page.waitForTimeout(200);
await page.locator('[data-font-key="playfair"]').click();
await page.waitForTimeout(400);
check('a second pick replaces the first (marks do not stack)', (await markOf('Alpha')) === 'playfair', String(await markOf('Alpha')));
check('rendered face follows the second pick', /Playfair/i.test((await renderedFont('Alpha')) ?? ''), String(await renderedFont('Alpha')));
check('picker still open after the second pick', await pickerOpen());

check(
  'active row is ticked',
  (await page.getAttribute('[data-font-key="playfair"]', 'aria-checked')) === 'true',
);

// Default clears the mark.
await page.locator('[data-font-key=""]').click();
await page.waitForTimeout(400);
check('Default clears the inline mark', (await markOf('Alpha')) === null, String(await markOf('Alpha')));
check('picker still open after clearing', await pickerOpen());

// Escape closes the picker (and leaves the toolbar alone).
await page.keyboard.press('Escape');
await page.waitForTimeout(300);
check('Escape closes the picker', !(await pickerOpen()));

// Unmarked text elsewhere must be untouched.
check('the rest of the paragraph kept no font mark', (await markOf('bravo')) !== 'playfair', String(await markOf('bravo')));

// Persistence: the mark is part of the document, so it must survive a reload.
// Click the paragraph text itself, not the editor's (much taller) box.
await page.click('.ProseMirror.bn-editor .bn-inline-content');
await page.keyboard.press('Home');
await page.keyboard.down('Shift');
for (let i = 0; i < 5; i++) await page.keyboard.press('ArrowRight');
await page.keyboard.up('Shift');
await page.waitForTimeout(600);
check('toolbar returns when text is selected again', await toolbarVisible());
await page.locator('[data-weft-inline-font]').click({ timeout: 8000 });
await page.waitForSelector('input[aria-label="Search fonts"]');
await page.locator('[data-font-key="fira-code"]').click();
await page.waitForTimeout(1200);
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForSelector('.ProseMirror.bn-editor');
await page.waitForTimeout(1200);
check('inline mark survives a reload', (await markOf('Alpha')) === 'fira-code', String(await markOf('Alpha')));
check('and still renders in that face', /Fira Code/i.test((await renderedFont('Alpha')) ?? ''), String(await renderedFont('Alpha')));

} catch (e) {
  check('suite ran to completion', false, String(e).split('\n')[0]);
}
if (process.env.SHOT) await page.screenshot({ path: process.env.SHOT });

await page.evaluate(async (id) => {
  await fetch(`/api/pages/${id}`, { method: 'DELETE', credentials: 'include' });
  await fetch(`/api/pages/${id}/permanent`, { method: 'DELETE', credentials: 'include' });
}, href.replace('/p/', ''));

await browser.close();
console.log('\n' + results.join('\n'));
console.log(`\n${results.length - failures}/${results.length} passed`);
process.exit(failures ? 1 : 0);
