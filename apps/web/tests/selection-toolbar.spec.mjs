/**
 * Real-browser checks for the selection toolbar — STYLEGUIDE §6.8.
 *
 *     BASE=http://127.0.0.1:5173 node --input-type=module -e "$(cat apps/web/tests/selection-toolbar.spec.mjs)"
 *
 * Same harness as page-options.spec.mjs / inline-font.spec.mjs: installed Chrome
 * via playwright-core, the seeded demo user, its own scratch page created and
 * permanently deleted at the end.
 *
 * Every assertion reads the DOCUMENT MODEL (`window.__weftEditor.document`), not
 * the DOM — "bold was applied" means the stored run really carries the style, and
 * "only the selection changed" means the neighbouring runs really do not.
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
    body: JSON.stringify({ workspaceId: ws, title: 'Selection toolbar test' }),
  }).then(j);
  return '/p/' + c.page.id;
});
const pageId = href.replace('/p/', '');
await page.goto(BASE + href, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('.ProseMirror.bn-editor');
await page.waitForTimeout(900);

// ── helpers ────────────────────────────────────────────────────────────────

// A block's inline content is a tree: a `link` node carries its own styled text
// runs as children. These helpers flatten that, so an assertion about "the run
// that says docs" doesn't care whether it happens to sit inside a link.
const blocks = () =>
  page.evaluate(() => {
    const flat = (nodes) =>
      (nodes ?? []).flatMap((n) =>
        n.type === 'link' ? (n.content ?? []).map((c) => ({ ...c, href: n.href })) : [n],
      );
    return (window.__weftEditor?.document ?? []).map((b) => ({
      type: b.type,
      props: b.props,
      text: flat(b.content)
        .map((n) => n.text ?? '')
        .join(''),
    }));
  });

/** The styles stored on the run that starts with `word`, anywhere in the doc. */
const stylesOf = (word) =>
  page.evaluate((w) => {
    const flat = (nodes) =>
      (nodes ?? []).flatMap((n) =>
        n.type === 'link' ? (n.content ?? []).map((c) => ({ ...c, href: n.href })) : [n],
      );
    const walk = (bs) => {
      for (const b of bs) {
        for (const n of flat(b.content)) {
          if ((n.text ?? '').startsWith(w)) return n.styles ?? {};
        }
        const nested = walk(b.children ?? []);
        if (nested) return nested;
      }
      return null;
    };
    return walk(window.__weftEditor?.document ?? []) ?? 'NO-SUCH-RUN';
  }, word);

/** The inline-content nodes of block `i`, flattened, as [{text, styles, href}]. */
const runs = (i = 0) =>
  page.evaluate((idx) => {
    const flat = (nodes) =>
      (nodes ?? []).flatMap((n) =>
        n.type === 'link'
          ? (n.content ?? []).map((c) => ({ ...c, href: n.href, inLink: true }))
          : [n],
      );
    return flat((window.__weftEditor?.document ?? [])[idx]?.content).map((n) => ({
      type: n.type,
      text: n.text ?? '',
      styles: n.styles ?? {},
      href: n.href,
      inLink: !!n.inLink,
    }));
  }, i);

/** Blocks that actually hold text — BlockNote keeps a trailing empty paragraph
 *  after a whole-document `replaceBlocks`, which is scaffolding, not content. */
const filledBlocks = async () => (await blocks()).filter((b) => b.text.length > 0);

const railVisible = () =>
  page.locator('[data-weft-selection-toolbar]').isVisible().catch(() => false);

/**
 * Click on the document's first real character. Clicking a block *element*
 * is unreliable — the editor's box is much taller than its text, and Weft's
 * custom blocks (quote, callout, toggle) wrap their editable in padding and
 * non-editable chrome — so we measure the first editable text node and click
 * exactly on it. Still a genuine mouse click, just an accurately aimed one.
 */
async function clickFirstText() {
  const at = await page.evaluate(() => {
    const root = document.querySelector('.ProseMirror.bn-editor');
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: (n) =>
        n.nodeValue.trim() && !n.parentElement.closest('[contenteditable="false"]')
          ? NodeFilter.FILTER_ACCEPT
          : NodeFilter.FILTER_REJECT,
    });
    const node = walker.nextNode();
    if (!node) return null;
    const r = document.createRange();
    r.selectNode(node);
    const b = r.getBoundingClientRect();
    return { x: b.left + 2, y: b.top + b.height / 2 };
  });
  if (!at) throw new Error('no editable text to click');
  await page.mouse.click(at.x, at.y);
}

/** Replace the document with a single paragraph and type `text` into it. */
async function reset(text = 'Alpha bravo charlie delta') {
  await page.evaluate(() => {
    const e = window.__weftEditor;
    e.replaceBlocks(e.document, [{ type: 'paragraph', content: 'x' }]);
  });
  await page.waitForTimeout(150);
  await clickFirstText();
  await page.keyboard.press('Home');
  await page.keyboard.down('Shift');
  await page.keyboard.press('End');
  await page.keyboard.up('Shift');
  await page.keyboard.type(text);
  await page.waitForTimeout(250);
}

/**
 * Select `len` characters starting at `start` inside the first block, and check
 * the browser really made that selection before moving on.
 *
 * The re-check is not superstition. Driving Shift+→ at CDP speed straight after
 * focus has returned to the editor (which is what closing any overlay does)
 * occasionally loses keystrokes: ProseMirror's DOM observer flushes late and
 * re-asserts the previous state selection over the one being extended. It is a
 * pre-existing ProseMirror/focus race, not toolbar behaviour — the app's own
 * command palette (Ctrl+K), with no toolbar mounted at all, reproduces it
 * identically — and no human types 22 extension keys in 40ms. So the harness
 * verifies its own input rather than asserting against a selection it never
 * actually made.
 */
async function selectChars(start, len) {
  for (let attempt = 0; attempt < 4; attempt++) {
    await clickFirstText();
    await page.keyboard.press('Home');
    for (let i = 0; i < start; i++) await page.keyboard.press('ArrowRight');
    await page.keyboard.down('Shift');
    for (let i = 0; i < len; i++) await page.keyboard.press('ArrowRight');
    await page.keyboard.up('Shift');
    await page.waitForTimeout(400);
    const got = await page.evaluate(() => window.getSelection()?.toString().length ?? -1);
    if (got === len) return;
    await page.waitForTimeout(200);
  }
  throw new Error(`could not select ${len} chars from ${start}`);
}

const clickFormat = async (key) => {
  await page.locator(`[data-weft-format="${key}"]`).click();
  await page.waitForTimeout(300);
};

try {
  // ── 1. The toolbar itself ────────────────────────────────────────────────
  await reset();
  await selectChars(0, 5); // "Alpha"
  check('toolbar appears on a text selection', await railVisible());
  const railBox = await page.locator('[data-weft-selection-toolbar]').boundingBox();
  check(
    'toolbar stays inside the viewport',
    railBox.x >= 0 && railBox.y >= 0 && railBox.x + railBox.width <= 1400 && railBox.y + railBox.height <= 950,
    JSON.stringify(railBox),
  );
  check(
    'block-type control names the current block',
    (await page.locator('[data-weft-block-type]').innerText()).includes('Text'),
    await page.locator('[data-weft-block-type]').innerText(),
  );

  // ── 2. Inline formatting, on the selection only ──────────────────────────
  await clickFormat('bold');
  check('Bold applies to the selection', (await stylesOf('Alpha')).bold === true, JSON.stringify(await stylesOf('Alpha')));
  check(
    'Bold leaves the rest of the paragraph alone',
    (await stylesOf(' bravo')).bold === undefined,
    JSON.stringify(await stylesOf(' bravo')),
  );
  check(
    'the Bold button reports "on"',
    (await page.getAttribute('[data-weft-format="bold"]', 'aria-pressed')) === 'true',
  );

  await clickFormat('italic');
  check('Italic applies on top of Bold', (await stylesOf('Alpha')).italic === true);
  await clickFormat('underline');
  check('Underline applies', (await stylesOf('Alpha')).underline === true);
  await clickFormat('strike');
  check('Strikethrough applies', (await stylesOf('Alpha')).strike === true);
  await clickFormat('code');
  check('Inline code applies', (await stylesOf('Alpha')).code === true);

  await clickFormat('bold');
  check('Bold toggles back off', (await stylesOf('Alpha')).bold === undefined);

  // ── 3. Mixed state ───────────────────────────────────────────────────────
  await reset('Normal FETT normal');
  await selectChars(7, 4); // "FETT"
  await clickFormat('bold');
  await selectChars(0, 18); // the whole line: partly bold
  check(
    'a partly-bold selection reports "mixed"',
    (await page.getAttribute('[data-weft-format="bold"]', 'aria-pressed')) === 'mixed',
    String(await page.getAttribute('[data-weft-format="bold"]', 'aria-pressed')),
  );
  await clickFormat('bold');
  const mixedRuns = await runs(0);
  check(
    'toggling a mixed selection makes all of it bold',
    mixedRuns.every((r) => r.styles.bold === true),
    JSON.stringify(mixedRuns.map((r) => [r.text, r.styles.bold])),
  );

  // ── 4. Colour and highlight, on the selection only ───────────────────────
  await reset('Colour me impressed');
  await selectChars(0, 6); // "Colour"
  await page.locator('[data-weft-format="color"]').click();
  await page.waitForSelector('[aria-label="Text color: Red"]');
  check('toolbar survives opening the colour panel', await railVisible());
  await page.locator('[aria-label="Text color: Red"]').click();
  await page.waitForTimeout(300);
  check('text colour lands on the selection', (await stylesOf('Colour')).textColor === 'red', JSON.stringify(await stylesOf('Colour')));
  check('text colour leaves the rest alone', (await stylesOf(' me impressed')).textColor === undefined);
  await page.locator('[aria-label="Highlight: Yellow"]').click();
  await page.waitForTimeout(300);
  check(
    'highlight is an inline mark on the selection, not a new block',
    (await stylesOf('Colour')).backgroundColor === 'yellow',
    JSON.stringify(await stylesOf('Colour')),
  );
  check('highlight did not create a callout block', (await blocks()).every((b) => b.type === 'paragraph'));
  check('the colour panel stays open between picks', await page.locator('[aria-label="Highlight: Yellow"]').isVisible());
  await page.keyboard.press('Escape');
  await page.waitForTimeout(250);

  // ── 5. Clear formatting ──────────────────────────────────────────────────
  await reset('Formatted heading text');
  await selectChars(0, 22);
  await clickFormat('bold');
  await clickFormat('italic');
  // Make it a heading first, so we can prove the block type survives.
  await page.locator('[data-weft-block-type]').click();
  await page.waitForSelector('[data-block-key="heading_2"]');
  await page.locator('[data-block-key="heading_2"]').click();
  await page.waitForTimeout(400);
  check('turn into Heading 2 keeps the text bold', (await stylesOf('Formatted')).bold === true, JSON.stringify(await runs(0)));
  check('turn into Heading 2 changed the block', (await blocks())[0].type === 'heading', JSON.stringify((await blocks())[0]));

  await selectChars(0, 22);
  await page.locator('[data-weft-selection-more]').click();
  await page.waitForSelector('[data-command-key="fmt:clear"]');
  await page.locator('[data-command-key="fmt:clear"]').click();
  await page.waitForTimeout(400);
  const cleared = await runs(0);
  check(
    'Clear formatting strips every inline style',
    cleared.every((r) => Object.keys(r.styles).length === 0),
    JSON.stringify(cleared),
  );
  check(
    'Clear formatting leaves the block a Heading 2',
    (await blocks())[0].type === 'heading' && (await blocks())[0].props.level === 2,
    JSON.stringify((await blocks())[0]),
  );

  // ── 6. Block transformations from the toolbar ────────────────────────────
  const turnInto = async (key) => {
    await selectChars(0, 5);
    await page.locator('[data-weft-block-type]').click();
    await page.waitForSelector(`[data-block-key="${key}"]`, { timeout: 5000 });
    await page.locator(`[data-block-key="${key}"]`).click();
    await page.waitForTimeout(400);
    return (await blocks())[0];
  };
  await reset('Alpha bravo');
  let b = await turnInto('heading_1');
  check('Turn into Heading 1', b.type === 'heading' && b.props.level === 1, JSON.stringify(b));
  b = await turnInto('heading_3');
  check('Turn into Heading 3', b.type === 'heading' && b.props.level === 3, JSON.stringify(b));
  b = await turnInto('bullet_list');
  check('Turn into Bulleted list', b.type === 'bulletListItem', JSON.stringify(b));
  b = await turnInto('numbered_list');
  check('Turn into Numbered list', b.type === 'numberedListItem', JSON.stringify(b));
  b = await turnInto('check_list');
  check('Turn into Checklist', b.type === 'checkListItem', JSON.stringify(b));
  b = await turnInto('quote');
  check('Turn into Quote', b.type === 'quote', JSON.stringify(b));
  b = await turnInto('toggle_list');
  check('Turn into Toggle', b.type === 'toggle', JSON.stringify(b));
  b = await turnInto('highlight');
  check('Turn into Highlight (callout block)', b.type === 'callout', JSON.stringify(b));
  b = await turnInto('paragraph');
  check('Turn into Text', b.type === 'paragraph', JSON.stringify(b));
  check('every transformation kept the words', b.text === 'Alpha bravo', b.text);

  // ── 7. Multi-block selections ────────────────────────────────────────────
  await page.evaluate(() => {
    const e = window.__weftEditor;
    e.replaceBlocks(e.document, [
      { type: 'paragraph', content: 'First paragraph' },
      { type: 'paragraph', content: 'Second paragraph' },
      { type: 'paragraph', content: 'Third paragraph' },
    ]);
  });
  await page.waitForTimeout(300);
  const selectTwoBlocks = async () => {
    await clickFirstText();
    await page.keyboard.press('Home');
    await page.keyboard.down('Shift');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('End');
    await page.keyboard.up('Shift');
    await page.waitForTimeout(450);
  };
  await selectTwoBlocks();
  check('toolbar appears for a multi-block selection', await railVisible());
  await clickFormat('bold');
  const after = await filledBlocks();
  check(
    'Bold crosses block boundaries',
    (await stylesOf('First paragraph')).bold === true && (await stylesOf('Second paragraph')).bold === true,
    JSON.stringify([await stylesOf('First paragraph'), await stylesOf('Second paragraph')]),
  );
  check('the untouched third block stayed plain', (await stylesOf('Third paragraph')).bold === undefined);
  check(
    'multi-block bold did not merge the blocks',
    after.map((x) => x.text).join('|') === 'First paragraph|Second paragraph|Third paragraph',
    after.map((x) => x.text).join('|'),
  );

  await selectTwoBlocks();
  await page.locator('[data-weft-block-type]').click();
  await page.waitForSelector('[data-block-key="heading_2"]');
  await page.locator('[data-block-key="heading_2"]').click();
  await page.waitForTimeout(500);
  const multi = await filledBlocks();
  check(
    'Turn into converts every selected block',
    multi[0].type === 'heading' && multi[1].type === 'heading' && multi[2].type === 'paragraph',
    JSON.stringify(multi.map((x) => x.type)),
  );

  // A selection spanning two different block types must not claim one of them.
  await clickFirstText();
  await page.keyboard.press('Home');
  await page.keyboard.down('Shift');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('End');
  await page.keyboard.up('Shift');
  await page.waitForTimeout(450);
  check(
    'a selection over mixed block types reads "Mixed"',
    (await page.locator('[data-weft-block-type]').innerText()).includes('Mixed'),
    await page.locator('[data-weft-block-type]').innerText(),
  );

  // ── 8. Links ─────────────────────────────────────────────────────────────
  await reset('Visit the docs today');
  await selectChars(10, 4); // "docs"
  await clickFormat('bold');
  await page.locator('[data-weft-format="link"]').click();
  await page.waitForSelector('input[aria-label="Link address"]');
  check('toolbar survives opening the link form', await railVisible());
  await page.fill('input[aria-label="Link address"]', 'weft.app/docs');
  await page.locator('button:has-text("Add link")').click();
  await page.waitForTimeout(400);
  const linked = await runs(0);
  const linkNode = linked.find((n) => n.inLink);
  check('the selected text became a link', !!linkNode, JSON.stringify(linked));
  check('a bare domain is normalised to https', linkNode?.href === 'https://weft.app/docs', String(linkNode?.href));
  check(
    'linking preserved the bold already on the run',
    (await stylesOf('docs')).bold === true,
    JSON.stringify(await stylesOf('docs')),
  );
  check(
    'only the selected word is linked',
    linked.filter((n) => n.inLink).map((n) => n.text).join('') === 'docs' &&
      (await blocks())[0].text === 'Visit the docs today',
    `${linked.filter((n) => n.inLink).map((n) => n.text).join('')} / ${(await blocks())[0].text}`,
  );

  await selectChars(10, 4);
  await page.locator('[data-weft-format="link"]').click();
  await page.waitForSelector('input[aria-label="Link address"]');
  check('the link form opens pre-filled for an existing link', (await page.inputValue('input[aria-label="Link address"]')) === 'https://weft.app/docs');
  await page.locator('[aria-label="Remove link"]').click();
  await page.waitForTimeout(400);
  check(
    'Remove link unlinks the text but keeps it',
    !(await runs(0)).some((n) => n.inLink) && (await blocks())[0].text === 'Visit the docs today',
    JSON.stringify(await runs(0)),
  );

  // ── 9. Search across formatting AND block types ──────────────────────────
  await reset('Searchable text here');
  await selectChars(0, 10);
  await page.locator('[data-weft-selection-more]').click();
  await page.waitForSelector('input[aria-label="Search formatting or block type"]');
  check('toolbar survives typing in the command search', await railVisible());

  const searchKeys = async (q) => {
    await page.fill('input[aria-label="Search formatting or block type"]', q);
    await page.waitForTimeout(250);
    return page.$$eval('[data-command-key]', (els) => els.map((e) => e.dataset.commandKey));
  };
  let keys = await searchKeys('heading');
  check('"heading" finds the heading transformations', keys.filter((k) => k.startsWith('turn:heading_')).length >= 3, keys.slice(0, 6).join(','));
  keys = await searchKeys('bold');
  check('"bold" finds Bold, ranked first', keys[0] === 'fmt:bold', keys.slice(0, 3).join(','));
  keys = await searchKeys('highlight');
  check('"highlight" finds the inline Highlight', keys.includes('fmt:highlight'), keys.slice(0, 4).join(','));
  keys = await searchKeys('strong');
  check('an alias ("strong") finds Bold', keys.includes('fmt:bold'), keys.slice(0, 3).join(','));
  keys = await searchKeys('delte');
  check('a typo ("delte") still finds Delete', keys.includes('act:delete'), keys.slice(0, 3).join(','));
  keys = await searchKeys('bulleted');
  check('"bulleted" finds the list transformation', keys.some((k) => k === 'turn:bullet_list'), keys.slice(0, 3).join(','));

  // Keyboard: ↓ then Enter runs the highlighted row.
  await page.fill('input[aria-label="Search formatting or block type"]', 'italic');
  await page.waitForTimeout(200);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(350);
  check('Enter runs the highlighted command', (await stylesOf('Searchable')).italic === true, JSON.stringify(await stylesOf('Searchable')));

  await page.keyboard.press('Escape');
  await page.waitForTimeout(250);
  check('Escape closes the command panel', !(await page.locator('input[aria-label="Search formatting or block type"]').isVisible().catch(() => false)));

  // ── 10. Selection preservation across a panel ────────────────────────────
  await reset('one two three four');
  await selectChars(4, 3); // "two"
  await page.locator('[data-weft-selection-more]').click();
  await page.waitForSelector('input[aria-label="Search formatting or block type"]');
  await page.fill('input[aria-label="Search formatting or block type"]', 'underline');
  await page.waitForTimeout(200);
  await page.locator('[data-command-key="fmt:underline"]').click();
  await page.waitForTimeout(400);
  const preserved = await runs(0);
  check(
    'a command run from a focused panel formats exactly the original selection',
    preserved.length === 3 &&
      preserved[0].text === 'one ' &&
      preserved[1].text === 'two' &&
      preserved[1].styles.underline === true &&
      preserved[2].text === ' three four' &&
      !preserved[2].styles.underline,
    JSON.stringify(preserved.map((r) => [r.text, r.styles])),
  );
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);

  // ── 11. Existing keyboard shortcuts still work ───────────────────────────
  await reset('Shortcut still works');
  await selectChars(0, 8);
  await page.keyboard.press('Control+b');
  await page.waitForTimeout(300);
  check('Ctrl+B still bolds', (await stylesOf('Shortcut')).bold === true, JSON.stringify(await stylesOf('Shortcut')));
  await page.keyboard.press('Control+i');
  await page.waitForTimeout(300);
  check('Ctrl+I still italicises', (await stylesOf('Shortcut')).italic === true);
  check('the toolbar tracks a shortcut-applied mark', (await page.getAttribute('[data-weft-format="bold"]', 'aria-pressed')) === 'true');

  // ── 11b. Reaching and driving the rail from the keyboard ─────────────────
  await reset('Keyboard reachable text');
  await selectChars(0, 8); // "Keyboard"
  await page.keyboard.press('Alt+F10');
  await page.waitForTimeout(250);
  check(
    'Alt+F10 moves focus into the rail',
    await page.evaluate(() => !!document.activeElement?.closest('[data-weft-selection-toolbar]')),
    await page.evaluate(() => document.activeElement?.getAttribute('aria-label') ?? '?'),
  );
  check(
    'it lands on the first control',
    await page.evaluate(() => document.activeElement?.hasAttribute('data-weft-block-type')),
  );
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(150);
  check(
    'ArrowRight walks to the next control',
    (await page.evaluate(() => document.activeElement?.getAttribute('data-weft-format'))) === 'bold',
    String(await page.evaluate(() => document.activeElement?.getAttribute('data-weft-format'))),
  );
  await page.keyboard.press('Enter');
  await page.waitForTimeout(350);
  check(
    'Enter on a focused control toggles the mark exactly once',
    (await stylesOf('Keyboard')).bold === true,
    JSON.stringify(await stylesOf('Keyboard')),
  );
  await page.keyboard.press('Enter');
  await page.waitForTimeout(350);
  check(
    'and pressing it again toggles back off (no double-fire)',
    (await stylesOf('Keyboard')).bold === undefined,
    JSON.stringify(await stylesOf('Keyboard')),
  );
  await page.keyboard.press('Escape');
  await page.waitForTimeout(250);
  check(
    'Escape returns focus to the editor',
    await page.evaluate(() => !!document.activeElement?.classList.contains('bn-editor')),
  );

  // ── 12. Block actions from the More menu ─────────────────────────────────
  await reset('Duplicate me');
  await selectChars(0, 9);
  await page.locator('[data-weft-selection-more]').click();
  await page.waitForSelector('[data-command-key="act:duplicate"]');
  await page.locator('[data-command-key="act:duplicate"]').click();
  await page.waitForTimeout(400);
  const dup = await filledBlocks();
  check(
    'Duplicate copies the block',
    dup.length === 2 && dup[0].text === 'Duplicate me' && dup[1].text === 'Duplicate me',
    JSON.stringify(dup.map((x) => x.text)),
  );

  await selectChars(0, 9);
  await page.locator('[data-weft-selection-more]').click();
  await page.waitForSelector('[data-command-key="act:delete"]');
  await page.locator('[data-command-key="act:delete"]').click();
  await page.waitForTimeout(400);
  check(
    'Delete removes the selected block',
    (await filledBlocks()).length === 1,
    JSON.stringify((await blocks()).map((x) => x.text)),
  );

  // ── 13. Positioning near the viewport edges ──────────────────────────────
  // Where the selected text actually is on screen, so we can prove the rail
  // sits above it — or flips below when there is no room above.
  const selectionBox = () =>
    page.evaluate(() => {
      const s = window.getSelection();
      if (!s || s.rangeCount === 0) return null;
      const r = s.getRangeAt(0).getBoundingClientRect();
      return { top: r.top, bottom: r.bottom };
    });

  await reset('Roomy paragraph near the middle');
  await selectChars(0, 5);
  let sel = await selectionBox();
  let bar = await page.locator('[data-weft-selection-toolbar]').boundingBox();
  check(
    'with room above, the rail sits above the selection',
    bar && sel && bar.y + bar.height <= sel.top + 1,
    JSON.stringify({ bar, sel }),
  );

  // Scroll the paragraph up against the top of the window: no room above.
  await page.evaluate(() => {
    const el = document.querySelector('.ProseMirror.bn-editor');
    el?.scrollIntoView({ block: 'start' });
    window.scrollBy(0, 0);
    const scroller = document.scrollingElement;
    const main = [...document.querySelectorAll('*')].find(
      (n) => n.scrollHeight > n.clientHeight + 50 && n.clientHeight > 200,
    );
    (main ?? scroller).scrollTop = (main ?? scroller).scrollHeight;
  });
  await page.waitForTimeout(400);
  await selectChars(0, 5);
  sel = await selectionBox();
  bar = await page.locator('[data-weft-selection-toolbar]').boundingBox();
  check(
    'the rail never leaves the viewport, whatever it has to flip',
    bar && bar.y >= 0 && bar.y + bar.height <= 950 && bar.x >= 0 && bar.x + bar.width <= 1400,
    JSON.stringify({ bar, sel }),
  );
  check(
    'and it is placed above or below the text, never over it',
    bar && sel && (bar.y + bar.height <= sel.top + 1 || bar.y >= sel.bottom - 1),
    JSON.stringify({ bar, sel }),
  );

  await page.setViewportSize({ width: 1400, height: 400 });
  await page.waitForTimeout(300);
  await selectChars(0, 3);
  const nearTop = await page.locator('[data-weft-selection-toolbar]').boundingBox();
  check(
    'a short viewport keeps the rail on screen',
    nearTop && nearTop.y >= 0 && nearTop.y + nearTop.height <= 400,
    JSON.stringify(nearTop),
  );

  await page.setViewportSize({ width: 460, height: 800 });
  await page.waitForTimeout(400);
  await selectChars(0, 3);
  const narrow = await page.locator('[data-weft-selection-toolbar]').boundingBox();
  check(
    'on a narrow viewport the rail still fits',
    narrow && narrow.x >= 0 && narrow.x + narrow.width <= 460,
    JSON.stringify(narrow),
  );
  check(
    'the controls it dropped are still reachable in More',
    await page.locator('[data-weft-selection-more]').isVisible(),
  );
  await page.locator('[data-weft-selection-more]').click();
  await page.waitForSelector('[data-command-key="fmt:link"]');
  check('More holds the full command set on a narrow viewport', (await page.locator('[data-command-key]').count()) > 15);
  await page.keyboard.press('Escape');
  await page.setViewportSize({ width: 1400, height: 950 });
} catch (e) {
  check('suite ran to completion', false, String(e).split('\n').slice(0, 4).join(' | '));
}

if (process.env.SHOT) await page.screenshot({ path: process.env.SHOT });

await page.evaluate(async (id) => {
  await fetch(`/api/pages/${id}`, { method: 'DELETE', credentials: 'include' });
  await fetch(`/api/pages/${id}/permanent`, { method: 'DELETE', credentials: 'include' });
}, pageId);

await browser.close();
console.log('\n' + results.join('\n'));
console.log(`\n${results.length - failures}/${results.length} passed`);
process.exit(failures ? 1 : 0);
