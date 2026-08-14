import { GripVertical, Plus, AlertTriangle } from 'lucide-react';
import { Popover } from '@/components/ui/Popover';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Tooltip } from '@/components/ui/Tooltip';
import { BlockPicker } from './BlockPicker';
import { BlockActionMenu } from './BlockActionMenu';
import type { BlockTypeCtx, BlockTypeDef } from './blockTypes';

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Weft's block side menu. Two controls with two clearly-separated jobs (§42):
 *
 * - **＋ Add block** — inserts a *new* block below this one (the "+" no longer
 *   means "turn into"). Opens the searchable, recommendation-aware block picker.
 * - **⠿ Handle** — drags to move (native BlockNote drag, wired exactly as
 *   BlockNote's own `DragHandleButton`: `draggable` + `blockDragStart`), and on
 *   click opens the full block-action menu (Turn into, Colour, Copy link,
 *   Duplicate, Move to, Delete, plus last-edited).
 *
 * Both menus open through the shared `Popover` (portalled, viewport-flipping,
 * Escape / outside-click), with `registerOverlay={false}` so the handle they're
 * anchored to stays visible and the panel stays glued to it. Vertical centring
 * comes from the controller's `placement: 'left'`.
 */
export function WeftSideMenu(
  props: any & {
    onConvert: (block: any, def: BlockTypeDef) => void;
    onAddBlock: (block: any, def: BlockTypeDef) => void;
    ctx: BlockTypeCtx;
    tree: { id: string; title: string; icon?: string | null }[];
    pageUpdatedAt?: string;
  },
) {
  const {
    block,
    freezeMenu,
    unfreezeMenu,
    blockDragStart,
    blockDragEnd,
    onConvert,
    onAddBlock,
    ctx,
    tree,
    pageUpdatedAt,
  } = props;

  return (
    <div className="bn-side-menu flex items-center gap-0.5">
      {/* ＋ Add block */}
      <Tooltip label="Add a block below" side="bottom">
        <Popover
          align="start"
          registerOverlay={false}
          onOpenChange={(open) => (open ? freezeMenu() : unfreezeMenu())}
          trigger={
            <button
              type="button"
              data-weft-plus="true"
              aria-label="Add a block below"
              className="flex h-6 w-5 items-center justify-center rounded text-ink-faint transition-colors hover:bg-sunk hover:text-ink"
            >
              <Plus size={18} />
            </button>
          }
        >
          {(close) => (
            <BlockPicker
              showRecommended
              title="Add block"
              placeholder="Search for a block…"
              onPick={(def) => {
                close();
                onAddBlock(block, def);
              }}
            />
          )}
        </Popover>
      </Tooltip>

      {/* ⠿ Drag handle + block-action menu */}
      <Tooltip label={<span>Drag to move · click for actions</span>} side="bottom">
        <Popover
          align="start"
          registerOverlay={false}
          onOpenChange={(open) => (open ? freezeMenu() : unfreezeMenu())}
          trigger={
            <button
              type="button"
              data-weft-handle="true"
              aria-label="Block actions — drag to move, click for actions"
              draggable
              onDragStart={(e) => blockDragStart(e, block)}
              onDragEnd={blockDragEnd}
              className="flex h-6 w-5 cursor-grab items-center justify-center rounded text-ink-faint transition-colors hover:bg-sunk hover:text-ink active:cursor-grabbing"
            >
              <GripVertical size={16} />
            </button>
          }
        >
          {(close) => (
            <BlockActionMenu
              block={block}
              ctx={ctx}
              tree={tree}
              onConvert={onConvert}
              pageUpdatedAt={pageUpdatedAt}
              close={close}
            />
          )}
        </Popover>
      </Tooltip>
    </div>
  );
}

/**
 * Confirmation shown when converting a Page (sub-page reference) that still has
 * content. Converting deletes the page's content and replaces it with a block.
 */
export function PageConvertDialog({
  pageTitle,
  onCancel,
  onConfirm,
}: {
  pageTitle: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal open onClose={onCancel} title="Replace page with a block?" width="sm">
      <div className="flex gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-danger-soft text-danger">
          <AlertTriangle size={18} />
        </span>
        <div className="min-w-0 text-sm leading-relaxed text-ink-muted">
          <p>
            <span className="font-medium text-ink">“{pageTitle || 'Untitled'}”</span> still has content
            inside. Converting it to a block will <span className="font-medium text-ink">delete that
            content</span> and replace the sub-page with the block.
          </p>
          <p className="mt-2 text-xs text-ink-faint">The page is moved to Trash, so you can still recover it there.</p>
        </div>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="secondary" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button variant="danger" size="sm" onClick={onConfirm} data-page-convert-confirm="true">
          Delete content & convert
        </Button>
      </div>
    </Modal>
  );
}
