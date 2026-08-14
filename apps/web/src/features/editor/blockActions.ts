import { api } from '@/lib/api';
import { toast } from '@/lib/toast';
import type { BlockTypeCtx } from './blockTypes';

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * The verbs behind the six-dots block-action menu, kept out of the React
 * component so each can be reasoned about (and reused) on its own. They operate
 * on a live BlockNote block plus the shared `BlockTypeCtx` (editor + page +
 * workspace). None of them fake success: an action that can't complete surfaces
 * an error toast rather than a silent no-op.
 */

/** Deep-copy a block, dropping every id so BlockNote assigns fresh ones. Keeps
 * props, inline/table content and the whole child subtree — so duplicating a
 * table, chart, toggle or column layout copies its real data, not just the shell. */
export function cloneBlockDeep(block: any): any {
  const clone: any = { type: block.type };
  if (block.props) clone.props = { ...block.props };
  if (block.content !== undefined) clone.content = structuredClone(block.content);
  if (Array.isArray(block.children) && block.children.length) {
    clone.children = block.children.map(cloneBlockDeep);
  }
  return clone;
}

/** Insert a deep copy of `block` directly beneath it, then select the copy. */
export function duplicateBlock(editor: any, block: any): void {
  try {
    const copy = cloneBlockDeep(block);
    const inserted = editor.insertBlocks([copy], block, 'after')?.[0];
    if (inserted?.id) {
      try {
        editor.setTextCursorPosition(inserted.id, 'end');
      } catch {
        /* non-text block — nothing to place a caret in */
      }
    }
  } catch {
    toast.error("Couldn't duplicate this block.");
  }
}

/** Remove a block (and its children) from the document. */
export function deleteBlock(editor: any, block: any): void {
  try {
    editor.removeBlocks([block]);
  } catch {
    toast.error("Couldn't delete this block.");
  }
}

/** Does this block type carry text/background colour props? Weft's custom blocks
 * (toggle, callout, chart, …) don't, so the menu hides Colour for them. */
export function blockSupportsColor(editor: any, block: any): boolean {
  const schema = editor.schema?.blockSchema?.[block.type];
  const props = schema?.propSchema;
  return !!props && ('textColor' in props || 'backgroundColor' in props);
}

/** Copy a deep link to this block. Reuses the app's existing `?b=<id>` jump
 * param (PageView scrolls to and flashes the block on load — see search/jump.ts),
 * so the link genuinely lands on the block. */
export async function copyBlockLink(pageId: string, block: any): Promise<void> {
  const url = `${location.origin}/p/${pageId}?b=${encodeURIComponent(block.id)}`;
  try {
    await navigator.clipboard.writeText(url);
    toast.success('Block link copied');
  } catch {
    toast.error("Couldn't copy the link.");
  }
}

/**
 * Move a block (with its subtree) to another page: append it to that page's
 * stored content, then remove it here. Local-first and honest — the block is
 * really relocated in the persistent store. (A page that is open in another tab
 * reflects the change the next time it loads its saved content.)
 */
export async function moveBlockToPage(
  ctx: BlockTypeCtx,
  block: any,
  target: { id: string; title: string },
): Promise<void> {
  try {
    const res = await api.get<{ page: { content: unknown } }>(`/pages/${target.id}`);
    const existing = Array.isArray(res.page?.content) ? (res.page.content as any[]) : [];
    await api.patch(`/pages/${target.id}`, { content: [...existing, cloneBlockDeep(block)] });
    ctx.editor.removeBlocks([block]);
    toast.success(`Moved to ${target.title || 'Untitled'}`);
  } catch {
    toast.error("Couldn't move the block.");
  }
}
