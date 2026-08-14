import type { ReactNode } from 'react';
import { insertOrUpdateBlock } from '@blocknote/core';
import type { DefaultReactSuggestionItem } from '@blocknote/react';
import {
  Type,
  Heading1,
  Heading2,
  Heading3,
  Heading4,
  Heading5,
  Heading6,
  ListOrdered,
  List,
  ListChecks,
  Code,
  Table as TableIcon,
  Image as ImageIcon,
  Video,
  AudioLines,
  Paperclip,
  FileText,
  Highlighter,
  Quote,
  Minus,
  Link2,
  Bookmark,
  Table2,
  Kanban,
  LayoutGrid,
  Rss,
  LayoutDashboard,
  Calendar,
  GanttChart,
  Map,
  ClipboardList,
  Database,
  BarChart3,
  BarChart2,
  LineChart,
  PieChart,
  Hash,
  ListTree,
  ListCollapse,
  Sigma,
  MousePointerClick,
  ChevronsRight,
  PanelTop,
  RefreshCw,
  Columns2,
  Columns3,
  Columns4,
  Sparkles,
  Workflow,
  UserRound,
  AtSign,
  CalendarClock,
  Smile,
  FunctionSquare,
  FileSpreadsheet,
  FileDown,
  FileArchive,
  FileType,
  type LucideIcon,
} from 'lucide-react';
import { format } from 'date-fns';
import { api } from '@/lib/api';
import { HEADING_LABELS, HEADING_LEVELS } from './headingScale';
import { weftCustomBlockSpecs } from './blocks';

/**
 * Land the caret inside a just-inserted custom-inline block so the first keystroke
 * types into it — the "text jumps to the next line" bug for Toggle / Highlight
 * (callout) / Quote.
 *
 * WHAT ACTUALLY BREAKS (measured, not assumed — headless CDP, driving the real app)
 * — these are *custom React* blocks. On insert, BlockNote's model selection IS put
 * inside the new block (the block even gets `data-is-empty-and-focused`), but for an
 * EMPTY custom node view ProseMirror never syncs the *browser* caret into the
 * content element: the DOM selection strands at the block-container boundary
 * (`DIV.bn-block`, offset 1), outside the editable. `editor.setTextCursorPosition`
 * cannot move it there either — re-asserting the model caret, on one frame or on
 * twenty, changes nothing because the failure is purely on the DOM-selection side.
 * The first keystroke, landing at that boundary, spawns a *new* block instead of
 * typing inline. Built-in blocks (paragraph, lists, heading) build their editable
 * synchronously with a real caret target, so they never hit this and must not be
 * touched. A mouse click "fixes" it precisely because a click drops a native DOM
 * caret into the content element — which is the workaround users were forced into.
 *
 * THE FIX — do programmatically what the click does: once the node view has
 * committed, drop a collapsed DOM Range into the block's (empty) content element
 * and let ProseMirror adopt it. Verified end-to-end: after this the selection sits
 * inside the block (`anchorType` = callout/quote/toggle) and instant typing lands
 * inline with no stray block. Runs on animation frames until the content element
 * exists and the caret is confirmed inside it (the node view mounts within a frame
 * or two), with a safety cap. `editor.setTextCursorPosition` is kept as the model
 * counterpart so undo/history and BlockNote's own state agree with the DOM.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function focusInsertedInlineBlock(editor: any, blockId: string): void {
  // Safety cap so a block that never mounts an editable can't spin forever
  // (~30 frames ≈ 0.5s). The call-site guard limits this to custom inline blocks,
  // which always mount an editable, so the cap is a backstop, not the normal exit.
  const MAX_FRAMES = 30;
  let frames = 0;

  const blockEl = (): HTMLElement | null =>
    document.querySelector(`[data-id="${CSS.escape(blockId)}"]`);

  // The editable "content hole": the element ProseMirror uses as the block's inline
  // contentDOM. While empty it has no element children (or just a trailing <br>) and
  // is never one of the block's `contenteditable="false"` chrome (emoji, chevron).
  const findContentHole = (root: HTMLElement): HTMLElement | null => {
    const bc = root.querySelector<HTMLElement>('.bn-block-content[data-content-type]');
    if (!bc) return null;
    const candidates = [...bc.querySelectorAll<HTMLElement>('*')].reverse();
    return (
      candidates.find(
        (el) =>
          el.getAttribute('contenteditable') !== 'false' &&
          !el.closest('[contenteditable="false"]') &&
          (el.childElementCount === 0 ||
            (el.childElementCount === 1 && el.firstElementChild!.tagName === 'BR')),
      ) ?? null
    );
  };

  const caretInsideBlock = (): boolean => {
    const el = blockEl();
    const sel = window.getSelection();
    return !!(el && sel && sel.anchorNode && el.contains(sel.anchorNode));
  };

  const attempt = (): void => {
    const el = blockEl();
    if (!el) return; // block removed before we could focus it

    const hole = findContentHole(el);
    if (hole) {
      try {
        editor.focus();
        // Model caret — keeps BlockNote/PM state and undo history in agreement.
        editor.setTextCursorPosition(blockId, 'end');
        // Browser caret — the part setTextCursorPosition can't do for an empty
        // custom node view. Mirrors a mouse click into the block.
        const range = document.createRange();
        range.selectNodeContents(hole);
        range.collapse(true);
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
      } catch {
        /* transient during mount — retried next frame */
      }
      if (caretInsideBlock()) return; // done
    }

    if (++frames < MAX_FRAMES) requestAnimationFrame(attempt);
  };

  requestAnimationFrame(attempt);
}

/**
 * Single source of truth for the editor's block-type set.
 *
 * BOTH the "/" slash menu and the "+" / "Turn into" side-menu are built from
 * `BLOCK_TYPE_DEFS` below, so the two menus can never drift apart again: the
 * slash menu maps each def through its *insert* verb (`insertBlockType`), the
 * "+" menu through its *convert* verb (`convertBlockType`). Same list → same
 * items, same groups, same order.
 *
 * This replaces the old split where the slash menu used BlockNote's
 * `getDefaultReactSlashMenuItems` while the "+" menu had a hard-coded four-item
 * array (Text / H1–H3) that could only ever reach paragraphs and headings.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyEditor = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyBlock = any;

/** How a def is materialised into an actual block. */
type BlockSpec =
  | { kind: 'simple'; type: string; props?: Record<string, unknown>; content?: unknown }
  // File-style blocks (image/video/audio/file): create the block then open
  // BlockNote's file panel so the user can pick a source.
  | { kind: 'file'; type: string }
  // A sub-page reference (`pageLink`) backed by a real child page row.
  | { kind: 'page' }
  // A multi-column layout: inserts BlockNote's `columnList` with `count` real
  // `column` containers, each holding an empty paragraph (drag blocks in/out).
  | { kind: 'columns'; count: number }
  // An action (not a block type): mentions, emoji, date, imports. Runs `run`
  // and inserts inline content / blocks itself. Never matches an existing block.
  | { kind: 'action'; run: (ctx: BlockTypeCtx) => void | Promise<void> };

export interface BlockTypeDef {
  key: string;
  title: string;
  subtext: string;
  /** Group header shown in both menus (Headings / Basic blocks / Advanced / Media). */
  group: string;
  aliases: string[];
  badge?: string;
  Icon: LucideIcon;
  spec: BlockSpec;
}

/** Context the insert/convert verbs need to reach the backend + collab tree. */
export interface BlockTypeCtx {
  editor: AnyEditor;
  workspaceId: string;
  pageId: string;
  /** Refetch the sidebar tree after a child page is created/removed. */
  invalidateTree: () => void | Promise<void>;
  /** Optional transient feedback (used by import actions). */
  toast?: (msg: string) => void;
  /** Navigate the SPA (used by database full-page action). */
  navigate?: (to: string) => void;
  /** Display name for the "Mention a person" baseline chip. */
  currentUserName?: string;
}

const HEADING_ICONS: Record<number, LucideIcon> = {
  1: Heading1,
  2: Heading2,
  3: Heading3,
  4: Heading4,
  5: Heading5,
  6: Heading6,
};

/** Terse builder for the many extra defs below. */
const mk = (
  key: string,
  title: string,
  subtext: string,
  group: string,
  Icon: LucideIcon,
  spec: BlockSpec,
  aliases: string[] = [],
): BlockTypeDef => ({ key, title, subtext, group, aliases, Icon, spec });

// Every block/menu item from the extended spec. Grouped Notion-style. Items whose
// group already exists (Basic blocks, Media, Advanced) are appended to that group
// by the menu renderers; genuinely new groups (Database, Charts, Inline, Import)
// render in first-appearance order. See docs status table for per-item maturity.
const EXTRA_DEFS: BlockTypeDef[] = [
  // ── Basic blocks ─────────────────────────────────────────────────────────
  mk('toggle_list', 'Toggle list', 'Collapsible list of blocks', 'Basic blocks', ListCollapse, { kind: 'simple', type: 'toggle', props: { open: true, level: 0 } }, ['toggle', 'collapsible', 'collapse']),
  mk('highlight', 'Highlight', 'Callout box to draw attention', 'Basic blocks', Highlighter, { kind: 'simple', type: 'callout' }, ['callout', 'highlight', 'note', 'info']),
  mk('quote', 'Quote', 'Capture a quotation', 'Basic blocks', Quote, { kind: 'simple', type: 'quote' }, ['quote', 'blockquote']),
  mk('divider', 'Divider', 'Visually divide blocks', 'Basic blocks', Minus, { kind: 'simple', type: 'divider' }, ['divider', 'hr', 'rule', 'line', 'separator']),
  mk('link_to_page', 'Link to page', 'Link to an existing page', 'Basic blocks', Link2, { kind: 'action', run: (c) => c.editor.openSuggestionMenu('@') }, ['link', 'mention', 'reference']),
  // ── Media ────────────────────────────────────────────────────────────────
  mk('bookmark', 'Web bookmark', 'Save a link as a visual card', 'Media', Bookmark, { kind: 'simple', type: 'bookmark' }, ['bookmark', 'link', 'url', 'web']),
  // ── Database ──────────────────────────────────────────────────────────────
  mk('db_table', 'Table view', 'Database as a table', 'Database', Table2, { kind: 'simple', type: 'dataView', props: { view: 'table' } }, ['database', 'grid']),
  mk('db_board', 'Board view', 'Database as a kanban board', 'Database', Kanban, { kind: 'simple', type: 'dataView', props: { view: 'board' } }, ['kanban', 'board']),
  mk('db_gallery', 'Gallery view', 'Database as cards', 'Database', LayoutGrid, { kind: 'simple', type: 'dataView', props: { view: 'gallery' } }, ['gallery', 'cards']),
  mk('db_list', 'List view', 'Database as a list', 'Database', List, { kind: 'simple', type: 'dataView', props: { view: 'list' } }, ['list']),
  mk('db_feed', 'Feed view', 'Database as a feed', 'Database', Rss, { kind: 'simple', type: 'dataView', props: { view: 'feed' } }, ['feed']),
  mk('db_dashboard', 'Dashboard view', 'Database as stat tiles', 'Database', LayoutDashboard, { kind: 'simple', type: 'dataView', props: { view: 'dashboard' } }, ['dashboard', 'stats']),
  mk('db_calendar', 'Calendar view', 'Database as a calendar', 'Database', Calendar, { kind: 'simple', type: 'dataView', props: { view: 'calendar' } }, ['calendar']),
  mk('db_timeline', 'Timeline view', 'Database as a timeline', 'Database', GanttChart, { kind: 'simple', type: 'dataView', props: { view: 'timeline' } }, ['timeline', 'gantt']),
  mk('db_map', 'Map view', 'Database as a map', 'Database', Map, { kind: 'simple', type: 'dataView', props: { view: 'map' } }, ['map']),
  mk('form', 'Form', 'Collect responses', 'Database', ClipboardList, { kind: 'simple', type: 'weftForm' }, ['form', 'survey']),
  mk('db_inline', 'Database - Inline', 'Inline database', 'Database', Database, { kind: 'simple', type: 'database', props: { mode: 'inline' } }, ['database', 'inline']),
  mk('db_full', 'Database - Full page', 'Full-page database', 'Database', Database, { kind: 'simple', type: 'database', props: { mode: 'full' } }, ['database', 'full page']),
  mk('db_linked', 'Linked view of data source', 'Linked database view', 'Database', Link2, { kind: 'simple', type: 'database', props: { mode: 'linked' } }, ['linked', 'data source']),
  // ── Charts ────────────────────────────────────────────────────────────────
  mk('chart_vbar', 'Vertical bar chart', 'Bar chart (vertical)', 'Charts', BarChart3, { kind: 'simple', type: 'chart', props: { variant: 'verticalBar' } }, ['chart', 'bar']),
  mk('chart_hbar', 'Horizontal bar chart', 'Bar chart (horizontal)', 'Charts', BarChart2, { kind: 'simple', type: 'chart', props: { variant: 'horizontalBar' } }, ['chart', 'bar']),
  mk('chart_line', 'Line chart', 'Line chart', 'Charts', LineChart, { kind: 'simple', type: 'chart', props: { variant: 'line' } }, ['chart', 'line']),
  mk('chart_donut', 'Donut chart', 'Donut chart', 'Charts', PieChart, { kind: 'simple', type: 'chart', props: { variant: 'donut' } }, ['chart', 'donut', 'pie']),
  mk('chart_number', 'Number chart', 'Single number metric', 'Charts', Hash, { kind: 'simple', type: 'chart', props: { variant: 'number' } }, ['chart', 'number', 'metric']),
  // ── Advanced ──────────────────────────────────────────────────────────────
  mk('toc', 'Table of contents', 'Links to every heading', 'Advanced', ListTree, { kind: 'simple', type: 'tableOfContents' }, ['toc', 'contents', 'outline']),
  mk('block_equation', 'Block equation', 'Display a LaTeX equation', 'Advanced', Sigma, { kind: 'simple', type: 'equation' }, ['equation', 'math', 'latex', 'katex']),
  mk('button', 'Button', 'A labelled action button', 'Advanced', MousePointerClick, { kind: 'simple', type: 'weftButton' }, ['button', 'cta']),
  mk('breadcrumb', 'Breadcrumb', 'Show the page path', 'Advanced', ChevronsRight, { kind: 'simple', type: 'breadcrumb' }, ['breadcrumb', 'path']),
  mk('tabs', 'Tabs', 'Switchable tabbed sections', 'Advanced', PanelTop, { kind: 'simple', type: 'tabs' }, ['tabs']),
  mk('synced', 'Synced block', 'A synced content block', 'Advanced', RefreshCw, { kind: 'simple', type: 'syncedBlock' }, ['synced', 'sync']),
  mk('toggle_h1', 'Toggle heading 1', 'Collapsible heading 1', 'Advanced', Heading1, { kind: 'simple', type: 'toggle', props: { open: true, level: 1 } }, ['toggle heading', 'h1']),
  mk('toggle_h2', 'Toggle heading 2', 'Collapsible heading 2', 'Advanced', Heading2, { kind: 'simple', type: 'toggle', props: { open: true, level: 2 } }, ['toggle heading', 'h2']),
  mk('toggle_h3', 'Toggle heading 3', 'Collapsible heading 3', 'Advanced', Heading3, { kind: 'simple', type: 'toggle', props: { open: true, level: 3 } }, ['toggle heading', 'h3']),
  mk('columns_2', '2 columns', 'Two-column layout', 'Advanced', Columns2, { kind: 'columns', count: 2 }, ['columns', '2 columns']),
  mk('columns_3', '3 columns', 'Three-column layout', 'Advanced', Columns3, { kind: 'columns', count: 3 }, ['columns', '3 columns']),
  mk('columns_4', '4 columns', 'Four-column layout', 'Advanced', Columns4, { kind: 'columns', count: 4 }, ['columns', '4 columns']),
  mk('columns_5', '5 columns', 'Five-column layout', 'Advanced', Columns4, { kind: 'columns', count: 5 }, ['columns', '5 columns']),
  mk('smart_notes', 'Smart Notes', 'An AI-notes container', 'Advanced', Sparkles, { kind: 'simple', type: 'smartNotes' }, ['smart notes', 'ai']),
  mk('mermaid', 'Code - Mermaid', 'Mermaid diagram source', 'Advanced', Workflow, { kind: 'simple', type: 'mermaid' }, ['mermaid', 'diagram', 'graph']),
  // ── Inline ────────────────────────────────────────────────────────────────
  mk('mention_person', 'Mention a person', 'Insert a person mention', 'Inline', UserRound, { kind: 'action', run: (c) => c.editor.insertInlineContent([{ type: 'mention', props: { pageId: '', title: c.currentUserName || 'Someone', icon: '' } }, ' ']) }, ['mention', 'person', 'user']),
  mk('mention_page', 'Mention a page or data source', 'Insert a page mention', 'Inline', AtSign, { kind: 'action', run: (c) => c.editor.openSuggestionMenu('@') }, ['mention', 'page']),
  mk('date', 'Date or reminder', "Insert today's date", 'Inline', CalendarClock, { kind: 'action', run: (c) => c.editor.insertInlineContent([{ type: 'text', text: format(new Date(), 'MMM d, yyyy'), styles: {} }, ' ']) }, ['date', 'reminder', 'today']),
  mk('emoji', 'Emoji', 'Search for and insert an emoji', 'Inline', Smile, { kind: 'action', run: (c) => c.editor.openSuggestionMenu(':') }, ['emoji', 'emote']),
  mk('inline_equation', 'Inline equation', 'Insert an inline LaTeX equation', 'Inline', FunctionSquare, { kind: 'action', run: (c) => c.editor.insertInlineContent([{ type: 'inlineEquation', props: { latex: 'x^2' } }, ' ']) }, ['equation', 'inline math', 'latex']),
  // ── Import ────────────────────────────────────────────────────────────────
  mk('import_csv', 'Import CSV', 'Import a CSV file as a table', 'Import', FileSpreadsheet, { kind: 'action', run: importCsv }, ['import', 'csv']),
  mk('import_md', 'Import text & Markdown', 'Import a Markdown/text file', 'Import', FileDown, { kind: 'action', run: importMarkdown }, ['import', 'markdown', 'md', 'text']),
  mk('import_zip', 'Import Zip', 'Attach a Zip file', 'Import', FileArchive, { kind: 'action', run: (c) => importAsFile(c, '.zip,application/zip', 'Zip') }, ['import', 'zip']),
  mk('import_pdf', 'Import PDF', 'Attach a PDF file', 'Import', FileType, { kind: 'action', run: (c) => importAsFile(c, '.pdf,application/pdf', 'PDF') }, ['import', 'pdf']),
];

// Order mirrors BlockNote's own slash-menu order so the grouped rendering lands
// exactly where users expect: Headings → Basic blocks → Advanced → Media. Page
// is slotted at the end of Basic blocks (as the old slash menu did).
export const BLOCK_TYPE_DEFS: BlockTypeDef[] = [
  ...HEADING_LEVELS.map(
    (level): BlockTypeDef => ({
      key: `heading_${level}`,
      title: HEADING_LABELS[level],
      subtext: `Level ${level} heading`,
      group: 'Headings',
      aliases: [`h${level}`, `heading${level}`, `heading ${level}`],
      Icon: HEADING_ICONS[level]!,
      spec: { kind: 'simple', type: 'heading', props: { level } },
    }),
  ),
  {
    key: 'numbered_list',
    title: 'Numbered List',
    subtext: 'List with ordered items',
    group: 'Basic blocks',
    aliases: ['ol', 'li', 'list', 'numberedlist', 'numbered list'],
    Icon: ListOrdered,
    spec: { kind: 'simple', type: 'numberedListItem' },
  },
  {
    key: 'bullet_list',
    title: 'Bullet List',
    subtext: 'List with unordered items',
    group: 'Basic blocks',
    aliases: ['ul', 'li', 'list', 'bulletlist', 'bullet list'],
    Icon: List,
    spec: { kind: 'simple', type: 'bulletListItem' },
  },
  {
    key: 'check_list',
    title: 'Check List',
    subtext: 'List with checkboxes',
    group: 'Basic blocks',
    aliases: ['ul', 'li', 'list', 'checklist', 'check list', 'checked list', 'checkbox'],
    Icon: ListChecks,
    spec: { kind: 'simple', type: 'checkListItem' },
  },
  {
    key: 'paragraph',
    title: 'Text',
    subtext: 'Plain paragraph — the body of your document',
    group: 'Basic blocks',
    aliases: ['p', 'paragraph', 'text', 'plain'],
    Icon: Type,
    spec: { kind: 'simple', type: 'paragraph' },
  },
  {
    key: 'code_block',
    title: 'Code Block',
    subtext: 'Code block with syntax highlighting',
    group: 'Basic blocks',
    aliases: ['code', 'pre'],
    Icon: Code,
    spec: { kind: 'simple', type: 'codeBlock' },
  },
  {
    key: 'page',
    title: 'Page',
    subtext: 'Sub-page nested in this one',
    group: 'Basic blocks',
    aliases: ['page', 'subpage', 'sub-page'],
    Icon: FileText,
    spec: { kind: 'page' },
  },
  {
    key: 'table',
    title: 'Table',
    subtext: 'Table with editable cells',
    group: 'Advanced',
    aliases: ['table'],
    Icon: TableIcon,
    spec: {
      kind: 'simple',
      type: 'table',
      content: {
        type: 'tableContent',
        rows: [{ cells: ['', '', ''] }, { cells: ['', '', ''] }],
      },
    },
  },
  {
    key: 'image',
    title: 'Image',
    subtext: 'Resizable image with caption',
    group: 'Media',
    aliases: ['image', 'img', 'picture', 'media', 'upload'],
    Icon: ImageIcon,
    spec: { kind: 'file', type: 'image' },
  },
  {
    key: 'video',
    title: 'Video',
    subtext: 'Resizable video with caption',
    group: 'Media',
    aliases: ['video', 'mp4', 'film', 'media', 'upload'],
    Icon: Video,
    spec: { kind: 'file', type: 'video' },
  },
  {
    key: 'audio',
    title: 'Audio',
    subtext: 'Embedded audio with caption',
    group: 'Media',
    aliases: ['audio', 'mp3', 'sound', 'media', 'upload'],
    Icon: AudioLines,
    spec: { kind: 'file', type: 'audio' },
  },
  {
    key: 'file',
    title: 'File',
    subtext: 'Embedded file',
    group: 'Media',
    aliases: ['file', 'upload', 'embed', 'media'],
    Icon: Paperclip,
    spec: { kind: 'file', type: 'file' },
  },
  ...EXTRA_DEFS,
];

/** Flatten a block's inline content to plain text (pageLink/file blocks → ''). */
export function blockPlainText(block: AnyBlock): string {
  const content = block?.content;
  if (!Array.isArray(content)) return '';
  return content.map((n: { text?: unknown }) => (typeof n?.text === 'string' ? n.text : '')).join('');
}

/** Does `block` already have the type this def produces? (active tick / self.) */
export function matchesBlock(def: BlockTypeDef, block: AnyBlock): boolean {
  if (!block) return false;
  switch (def.spec.kind) {
    case 'action':
      return false;
    case 'page':
      return block.type === 'pageLink';
    case 'columns':
      return block.type === 'columnList';
    case 'file':
      return block.type === def.spec.type;
    case 'simple': {
      if (block.type !== def.spec.type) return false;
      // Also match every discriminating prop the def pins (heading level, chart
      // variant, dataView view, toggle level, columns count, database mode …) so
      // the active tick lands on the exact variant.
      const props = def.spec.props;
      if (!props) return true;
      return Object.entries(props).every(([k, v]) => block.props?.[k] === v);
    }
  }
}

export function findActiveDef(block: AnyBlock): BlockTypeDef | undefined {
  return BLOCK_TYPE_DEFS.find((d) => matchesBlock(d, block));
}

/** Open BlockNote's file panel on `block` (same mechanism as the default slash menu). */
function openFilePanel(editor: AnyEditor, block: AnyBlock) {
  try {
    editor.dispatch(editor._tiptapEditor.state.tr.setMeta(editor.filePanel.plugin, { block }));
  } catch {
    /* file panel unavailable — the empty block is still inserted, no-op */
  }
}

/** Create a real child page row and return its id (empty string on failure). */
async function createChildPage(ctx: BlockTypeCtx, title: string): Promise<string> {
  const res = await api.post<{ page: { id: string } }>('/pages', {
    workspaceId: ctx.workspaceId,
    parentId: ctx.pageId,
  });
  const id = res.page.id;
  // Seed the new page's title from the source block's text so a Text → Page →
  // Text round-trip keeps the words.
  if (title.trim()) {
    await api.patch(`/pages/${id}`, { title: title.trim() }).catch(() => undefined);
  }
  return id;
}

// ── Action helpers (mentions / emoji / date / imports) ──────────────────────

/** The block just below the cursor, used as an insert anchor. */
function cursorBlock(editor: AnyEditor): AnyBlock {
  try {
    return editor.getTextCursorPosition().block;
  } catch {
    const doc = editor.document as AnyBlock[];
    return doc[doc.length - 1];
  }
}

/** Prompt the user for a file via a transient <input type=file>. */
function pickFile(accept: string): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.style.display = 'none';
    input.onchange = () => resolve(input.files?.[0] ?? null);
    document.body.appendChild(input);
    input.click();
    setTimeout(() => input.remove(), 1000);
  });
}

/** Minimal RFC-4180-ish CSV parser (handles quoted fields + escaped quotes). */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (c !== '\r') field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim().length));
}

async function importCsv(ctx: BlockTypeCtx) {
  const file = await pickFile('.csv,text/csv');
  if (!file) return;
  const rows = parseCsv(await file.text());
  if (!rows.length) return ctx.toast?.('CSV is empty');
  const width = Math.max(...rows.map((r) => r.length));
  const content = {
    type: 'tableContent',
    rows: rows.map((r) => ({ cells: Array.from({ length: width }, (_, i) => r[i] ?? '') })),
  };
  ctx.editor.insertBlocks([{ type: 'table', content }], cursorBlock(ctx.editor), 'after');
  ctx.toast?.(`Imported ${rows.length} rows from ${file.name}`);
}

async function importMarkdown(ctx: BlockTypeCtx) {
  const file = await pickFile('.md,.markdown,.txt,text/markdown,text/plain');
  if (!file) return;
  const blocks = await ctx.editor.tryParseMarkdownToBlocks(await file.text());
  if (!blocks?.length) return ctx.toast?.('Nothing to import');
  ctx.editor.insertBlocks(blocks, cursorBlock(ctx.editor), 'after');
  ctx.toast?.(`Imported ${file.name}`);
}

/** Import a Zip/PDF by attaching it as a real uploaded file block (no extraction). */
async function importAsFile(ctx: BlockTypeCtx, accept: string, label: string) {
  const file = await pickFile(accept);
  if (!file) return;
  try {
    const { upload } = await api.upload<{ upload: { url: string } }>('/uploads', file, {
      workspaceId: ctx.workspaceId,
    });
    ctx.editor.insertBlocks(
      [{ type: 'file', props: { url: location.origin + upload.url, name: file.name } }],
      cursorBlock(ctx.editor),
      'after',
    );
    ctx.toast?.(`Attached ${file.name}`);
  } catch {
    ctx.toast?.(`Could not import ${label}`);
  }
}

/**
 * Slash-menu verb: insert this block type at the cursor. `insertOrUpdateBlock`
 * converts the current block when it's empty (the usual slash case) or inserts
 * a fresh one otherwise.
 */
export async function insertBlockType(def: BlockTypeDef, ctx: BlockTypeCtx): Promise<void> {
  const { editor } = ctx;
  switch (def.spec.kind) {
    case 'action': {
      await def.spec.run(ctx);
      return;
    }
    case 'simple': {
      const newBlock = insertOrUpdateBlock(editor, {
        type: def.spec.type,
        ...(def.spec.props ? { props: def.spec.props } : {}),
        ...(def.spec.content ? { content: def.spec.content } : {}),
      } as never);
      // Custom React blocks that hold inline content (toggle, callout, quote, …)
      // mount their editable a frame late; re-assert the caret so the first
      // keystroke lands inline. Scoped to Weft's custom inline blocks — built-in
      // blocks already place the caret correctly and are left untouched.
      const content = editor.schema.blockSchema[def.spec.type]?.content;
      if (content === 'inline' && def.spec.type in weftCustomBlockSpecs) {
        focusInsertedInlineBlock(editor, newBlock.id);
      }
      return;
    }
    case 'file': {
      const block = insertOrUpdateBlock(editor, { type: def.spec.type } as never);
      openFilePanel(editor, block);
      return;
    }
    case 'page': {
      try {
        const id = await createChildPage(ctx, '');
        insertOrUpdateBlock(editor, {
          type: 'pageLink',
          props: { pageId: id, workspaceId: ctx.workspaceId, title: '', icon: '' },
        } as never);
        await ctx.invalidateTree();
      } catch {
        /* page creation failed — leave the editor untouched */
      }
      return;
    }
    case 'columns': {
      insertColumns(editor, def.spec.count);
      return;
    }
  }
}

/**
 * Insert a real BlockNote `columnList` of `count` empty columns and drop the caret
 * into the first column, so the user can type immediately. Each column starts with
 * one empty paragraph (a `column` cannot be empty). Replaces the current block when
 * it's an empty paragraph (the usual slash case), otherwise inserts after it.
 */
function insertColumns(editor: AnyEditor, count: number): void {
  const n = Math.max(2, Math.min(5, count));
  const columnList = {
    type: 'columnList',
    children: Array.from({ length: n }, () => ({
      type: 'column',
      children: [{ type: 'paragraph' }],
    })),
  };
  const cur = editor.getTextCursorPosition().block;
  const curEmpty =
    cur?.type === 'paragraph' &&
    blockPlainText(cur) === '' &&
    (!cur.children || cur.children.length === 0);

  let insertedList: AnyBlock | undefined;
  if (curEmpty) {
    insertedList = editor.replaceBlocks([cur], [columnList as never]).insertedBlocks?.[0];
  } else {
    insertedList = editor.insertBlocks([columnList as never], cur, 'after')?.[0];
  }

  // Land the caret in the first column's paragraph so typing starts there.
  const firstPara = insertedList?.children?.[0]?.children?.[0];
  if (firstPara?.id) {
    try {
      editor.setTextCursorPosition(firstPara.id, 'start');
    } catch {
      /* structure moved under us — leave the caret where it is */
    }
  }
}

/**
 * "Turn into" verb: convert an existing `block` in place. Unlike insert, this
 * always rewrites the current block's type via `updateBlock`, preserving its
 * inline content where the target type can hold it.
 *
 * `seedText` is used when the source block carries no inline content of its own
 * (a `pageLink`): the page's title is injected as the new block's text so the
 * words survive the conversion.
 */
export async function convertBlockType(
  def: BlockTypeDef,
  block: AnyBlock,
  ctx: BlockTypeCtx,
  seedText?: string,
): Promise<void> {
  const { editor } = ctx;
  switch (def.spec.kind) {
    case 'action': {
      // Actions aren't block types; "turn into" just performs the action.
      await def.spec.run(ctx);
      return;
    }
    case 'simple': {
      const seed =
        seedText && seedText.trim()
          ? { content: [{ type: 'text', text: seedText, styles: {} }] }
          : {};
      editor.updateBlock(block, {
        type: def.spec.type,
        ...(def.spec.props ? { props: def.spec.props } : {}),
        ...(def.spec.content ? { content: def.spec.content } : seed),
      } as never);
      return;
    }
    case 'file': {
      editor.updateBlock(block, { type: def.spec.type } as never);
      openFilePanel(editor, editor.getBlock(block.id) ?? block);
      return;
    }
    case 'page': {
      const id = await createChildPage(ctx, seedText ?? blockPlainText(block));
      editor.updateBlock(block, {
        type: 'pageLink',
        props: { pageId: id, workspaceId: ctx.workspaceId, title: '', icon: '' },
      } as never);
      await ctx.invalidateTree();
      return;
    }
    case 'columns': {
      // "Turn into columns": wrap the current block's text into the first column,
      // the rest empty, so no content is silently lost.
      const n = Math.max(2, Math.min(5, def.spec.count));
      const text = (seedText ?? blockPlainText(block)).trim();
      const first = {
        type: 'column',
        children: [
          text
            ? { type: 'paragraph', content: [{ type: 'text', text, styles: {} }] }
            : { type: 'paragraph' },
        ],
      };
      const rest = Array.from({ length: n - 1 }, () => ({
        type: 'column',
        children: [{ type: 'paragraph' }],
      }));
      editor.replaceBlocks([block], [{ type: 'columnList', children: [first, ...rest] } as never]);
      return;
    }
  }
}

/** Build the "/" slash-menu items from the shared registry (insert verb). */
export function getSlashBlockItems(ctx: BlockTypeCtx): DefaultReactSuggestionItem[] {
  return BLOCK_TYPE_DEFS.map((def): DefaultReactSuggestionItem => {
    const Icon = def.Icon;
    const icon: ReactNode = <Icon size={18} />;
    return {
      title: def.title,
      subtext: def.subtext,
      group: def.group,
      aliases: def.aliases,
      badge: def.badge,
      icon,
      key: def.key,
      onItemClick: () => void insertBlockType(def, ctx),
    } as DefaultReactSuggestionItem;
  });
}
