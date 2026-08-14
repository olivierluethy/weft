import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Code,
  Link2,
  Baseline,
  Highlighter,
  Type,
  RemoveFormatting,
  Copy,
  Trash2,
  CornerUpRight,
  type LucideIcon,
} from 'lucide-react';
import {
  BLOCK_TYPE_DEFS,
  convertBlockType,
  matchesBlock,
  type BlockTypeCtx,
  type BlockTypeDef,
} from './blockTypes';
import { copyBlockLink, deleteBlock, duplicateBlock } from './blockActions';
import {
  runOnSelection,
  selectedBlocks,
  type LinkInfo,
  type MarkState,
  type PmRange,
  type SelectionScan,
} from './selectionModel';

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * What the selection toolbar can do, declared once.
 *
 * The rule this file enforces (§23–24 of the brief): the toolbar owns **no**
 * editing logic of its own. Block transformations go through the same
 * `convertBlockType` verb and the same `BLOCK_TYPE_DEFS` registry the "/" slash
 * menu and the "＋ Add block" menu are built from; block actions go through the
 * same `blockActions` verbs the six-dots menu uses; inline styles go through the
 * editor's own style schema. Adding a block type to the registry therefore adds
 * it here too, and nothing can drift.
 */

/**
 * Everything a surface needs to read and change the current selection, assembled
 * once by the toolbar and handed to whatever renders next (the toolbar's own
 * buttons, the command menu, its sub-views). One object means the direct button
 * and the same command reached through search run *the identical code path*.
 */
export interface SelectionApi {
  editor: any;
  ctx: BlockTypeCtx;
  range: PmRange | null;
  scan: SelectionScan;
  /** The blocks the selection touches, in document order. */
  blocks: any[];
  /** Page tree, for "Move to". */
  tree: { id: string; title: string; icon?: string | null }[];
  /** on / off / mixed for a boolean inline style. */
  stateOf: (style: string) => MarkState;
  textColor: MarkState;
  highlight: MarkState;
  font: MarkState;
  link: LinkInfo | null;
  toggle: (style: string) => void;
  setColor: (kind: 'textColor' | 'backgroundColor', value: string | null) => void;
  setFont: (key: string) => void;
  clearFormatting: () => void;
  convert: (def: BlockTypeDef) => void;
  setLink: (url: string, text: string) => void;
  clearLink: () => void;
}

// ── Inline formats ──────────────────────────────────────────────────────────

export interface InlineFormatDef {
  /** Key in the editor's style schema — also the ProseMirror mark name. */
  style: string;
  label: string;
  Icon: LucideIcon;
  /** Displayed in the tooltip; the shortcut itself is BlockNote's, not ours. */
  shortcut?: string;
  keywords: string[];
}

/** The five boolean marks, in the order muscle memory expects them. */
export const INLINE_FORMATS: InlineFormatDef[] = [
  { style: 'bold', label: 'Bold', Icon: Bold, shortcut: 'Mod+B', keywords: ['bold', 'strong', 'heavy', 'b'] },
  { style: 'italic', label: 'Italic', Icon: Italic, shortcut: 'Mod+I', keywords: ['italic', 'emphasis', 'oblique', 'i'] },
  { style: 'underline', label: 'Underline', Icon: Underline, shortcut: 'Mod+U', keywords: ['underline', 'underscore', 'u'] },
  { style: 'strike', label: 'Strikethrough', Icon: Strikethrough, shortcut: 'Mod+Shift+X', keywords: ['strikethrough', 'strike', 'crossed out', 'delete', 's'] },
  { style: 'code', label: 'Inline code', Icon: Code, shortcut: 'Mod+E', keywords: ['code', 'monospace', 'inline code', 'tt'] },
];

/** Render the platform's modifier glyph for a shortcut hint. */
export function shortcutLabel(shortcut: string | undefined): string | undefined {
  if (!shortcut) return undefined;
  const mac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || '');
  return shortcut.replace('Mod', mac ? '⌘' : 'Ctrl').replace(/\+/g, mac ? '' : '+');
}

// ── Block transformations ───────────────────────────────────────────────────

/**
 * Can this registry entry be applied to *selected text*?
 *
 * The toolbar refuses to show anything it cannot honestly perform (§26). Three
 * kinds are ruled out on principle rather than by taste:
 *
 * - `action` entries (mention, emoji, date, the file imports) are not block
 *   types at all — there is nothing to turn the text *into*.
 * - `file` entries (image, video, audio, file) would replace the selected text
 *   with an empty media block and silently discard the words.
 * - `simple` entries whose schema content is not `inline` (divider, table,
 *   chart, database views, equation…) cannot hold text either.
 *
 * `page` and `columns` genuinely work but only make sense for one block at a
 * time, so they are offered only for a single-block selection. Everything else
 * the Add-block menu offers is available here.
 */
export function canConvertSelection(
  def: BlockTypeDef,
  editor: any,
  blockCount: number,
): boolean {
  switch (def.spec.kind) {
    case 'action':
    case 'file':
      return false;
    case 'page':
    case 'columns':
      return blockCount === 1;
    case 'simple':
      return editor?.schema?.blockSchema?.[def.spec.type]?.content === 'inline';
  }
}

/** Every block type the current selection can be turned into. */
export function turnIntoDefs(editor: any, blockCount: number): BlockTypeDef[] {
  return BLOCK_TYPE_DEFS.filter((d) => canConvertSelection(d, editor, blockCount));
}

/** The handful shown before you search — the transformations people reach for
 *  daily. The rest stay one keystroke away in the full block list. */
const PRIMARY_TURN_INTO = [
  'paragraph',
  'heading_1',
  'heading_2',
  'heading_3',
  'bullet_list',
  'numbered_list',
  'check_list',
  'quote',
  'toggle_list',
  'highlight',
  'code_block',
];

export function primaryTurnIntoDefs(editor: any, blockCount: number): BlockTypeDef[] {
  const allowed = turnIntoDefs(editor, blockCount);
  return PRIMARY_TURN_INTO.map((k) => allowed.find((d) => d.key === k)).filter(
    (d): d is BlockTypeDef => !!d,
  );
}

/** The def matching every selected block, or `null` when the selection mixes
 *  types — the toolbar says "Mixed" rather than inventing one (§18). */
export function activeTurnIntoDef(blocks: any[]): BlockTypeDef | null | undefined {
  if (!blocks.length) return undefined;
  const first = BLOCK_TYPE_DEFS.find((d) => matchesBlock(d, blocks[0]));
  if (!first) return undefined;
  return blocks.every((b) => matchesBlock(first, b)) ? first : null;
}

/**
 * Turn every block the selection touches into `def` (§17). Each block keeps its
 * own inline content — no `seedText` is passed, because these blocks already
 * carry their text and re-seeding it would flatten the bold/italic runs inside.
 * The selection is re-asserted afterwards so the toolbar stays open on the same
 * words and the result is visible immediately.
 */
export async function convertSelection(
  def: BlockTypeDef,
  editor: any,
  ctx: BlockTypeCtx,
  range: PmRange | null,
): Promise<void> {
  const blocks = selectedBlocks(editor, range);
  if (!blocks.length) return;
  runOnSelection(editor, range, () => undefined);
  for (const block of blocks) {
    // eslint-disable-next-line no-await-in-loop
    await convertBlockType(def, block, ctx);
  }
  // `updateBlock` keeps block ids, so the recorded range still addresses the
  // same characters unless the transformation replaced the block outright
  // (columns / page), where restoring is a no-op guarded inside runOnSelection.
  runOnSelection(editor, range, () => undefined);
}

// ── Block actions ───────────────────────────────────────────────────────────

export interface SelectionAction {
  key: string;
  label: string;
  Icon: LucideIcon;
  keywords: string[];
  danger?: boolean;
  /** Opens a sub-view rather than acting immediately. */
  panel?: 'moveTo';
  run?: () => void;
}

/**
 * The block-level actions that make sense from a text selection, wired to the
 * very same verbs as the six-dots block menu (`blockActions.ts`). Duplicate and
 * Delete operate on **every** block the selection touches; Copy link addresses
 * the first one (a link points at a block, and a selection has a beginning).
 */
export function selectionActions(
  editor: any,
  ctx: BlockTypeCtx,
  blocks: any[],
  close: () => void,
): SelectionAction[] {
  const first = blocks[0];
  const plural = blocks.length > 1 ? ` (${blocks.length} blocks)` : '';
  return [
    {
      key: 'duplicate',
      label: `Duplicate${plural}`,
      Icon: Copy,
      keywords: ['duplicate', 'copy', 'clone'],
      run: () => {
        for (const b of [...blocks].reverse()) duplicateBlock(editor, b);
        close();
      },
    },
    {
      key: 'copyLink',
      label: 'Copy link to block',
      Icon: Link2,
      keywords: ['link', 'anchor', 'url', 'share', 'permalink'],
      run: () => {
        if (first) void copyBlockLink(ctx.pageId, first).then(close);
        else close();
      },
    },
    {
      key: 'moveTo',
      label: 'Move to',
      Icon: CornerUpRight,
      keywords: ['move', 'relocate', 'page', 'send to'],
      panel: 'moveTo',
    },
    {
      key: 'delete',
      label: `Delete${plural}`,
      Icon: Trash2,
      keywords: ['delete', 'remove', 'trash', 'del'],
      danger: true,
      run: () => {
        for (const b of blocks) deleteBlock(editor, b);
        close();
      },
    },
  ];
}

// ── The extra inline commands (not simple boolean marks) ────────────────────

export interface SelectionExtra {
  key: string;
  label: string;
  Icon: LucideIcon;
  keywords: string[];
  panel?: 'link' | 'textColor' | 'highlight' | 'font';
  run?: () => void;
}

/** Link, colour, highlight, font and clear formatting — the inline commands
 *  that need a panel or are one-shot, kept beside the boolean marks so the
 *  command search sees one "Format" section rather than two half-lists. */
export function inlineExtras(onClear: () => void): SelectionExtra[] {
  return [
    { key: 'link', label: 'Link', Icon: Link2, keywords: ['link', 'url', 'href', 'hyperlink', 'web'], panel: 'link' },
    { key: 'textColor', label: 'Text color', Icon: Baseline, keywords: ['color', 'colour', 'text color', 'foreground', 'font color'], panel: 'textColor' },
    { key: 'highlight', label: 'Highlight', Icon: Highlighter, keywords: ['highlight', 'marker', 'mark', 'background', 'background color', 'colour'], panel: 'highlight' },
    { key: 'font', label: 'Font', Icon: Type, keywords: ['font', 'typeface', 'family', 'serif', 'sans', 'mono'], panel: 'font' },
    {
      key: 'clear',
      label: 'Clear formatting',
      Icon: RemoveFormatting,
      keywords: ['clear', 'reset', 'remove formatting', 'plain', 'strip', 'normal'],
      run: onClear,
    },
  ];
}
