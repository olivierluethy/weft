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
  type LucideIcon,
} from 'lucide-react';
import { api } from '@/lib/api';
import { HEADING_LABELS, HEADING_LEVELS } from './headingScale';

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
  | { kind: 'page' };

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
}

const HEADING_ICONS: Record<number, LucideIcon> = {
  1: Heading1,
  2: Heading2,
  3: Heading3,
  4: Heading4,
  5: Heading5,
  6: Heading6,
};

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
    case 'page':
      return block.type === 'pageLink';
    case 'file':
      return block.type === def.spec.type;
    case 'simple':
      if (def.spec.type === 'heading') {
        return block.type === 'heading' && block.props?.level === (def.spec.props?.level as number);
      }
      return block.type === def.spec.type;
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

/**
 * Slash-menu verb: insert this block type at the cursor. `insertOrUpdateBlock`
 * converts the current block when it's empty (the usual slash case) or inserts
 * a fresh one otherwise.
 */
export async function insertBlockType(def: BlockTypeDef, ctx: BlockTypeCtx): Promise<void> {
  const { editor } = ctx;
  switch (def.spec.kind) {
    case 'simple': {
      insertOrUpdateBlock(editor, {
        type: def.spec.type,
        ...(def.spec.props ? { props: def.spec.props } : {}),
        ...(def.spec.content ? { content: def.spec.content } : {}),
      } as never);
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
