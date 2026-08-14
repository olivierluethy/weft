import { DragHandleButton } from '@blocknote/react';
import { Plus, Check, AlertTriangle } from 'lucide-react';
import { Popover } from '@/components/ui/Popover';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import { BLOCK_TYPE_DEFS, matchesBlock, type BlockTypeDef } from './blockTypes';

/**
 * Contents of the "+" popover: convert the current block into any other block
 * type. Driven entirely by the shared `BLOCK_TYPE_DEFS` registry, so it lists
 * exactly the same items (and groups) as the "/" slash menu — see blockTypes.tsx.
 */
function BlockConvertMenu({
  block,
  isPage,
  onPick,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  block: any;
  isPage: boolean;
  onPick: (def: BlockTypeDef) => void;
}) {
  // Group in first-appearance order (Headings → Basic blocks → Advanced → Media),
  // matching the slash menu's grouped layout.
  const groups: { name: string; defs: BlockTypeDef[] }[] = [];
  for (const def of BLOCK_TYPE_DEFS) {
    let g = groups.find((x) => x.name === def.group);
    if (!g) {
      g = { name: def.group, defs: [] };
      groups.push(g);
    }
    g.defs.push(def);
  }

  return (
    <div className="flex max-h-[min(380px,72vh)] w-72 flex-col overflow-hidden rounded-lg border border-line bg-surface shadow-lg">
      <div className="border-b border-line px-3 pb-2 pt-2.5">
        <p className="text-2xs font-semibold uppercase tracking-wide text-ink-faint">Turn into</p>
        {isPage && (
          <p className="mt-1 text-2xs leading-snug text-ink-faint">
            Converts this sub-page reference into another block.
          </p>
        )}
      </div>
      <div className="flex-1 overflow-y-auto overscroll-contain p-1">
        {groups.map((group) => (
          <div key={group.name}>
            <p className="px-2 pb-1 pt-2 text-2xs font-semibold uppercase tracking-wide text-ink-faint">
              {group.name}
            </p>
            <div className="flex flex-col gap-0.5">
              {group.defs.map((def) => {
                const active = matchesBlock(def, block);
                const Icon = def.Icon;
                return (
                  <button
                    key={def.key}
                    data-convert={def.key}
                    onClick={() => onPick(def)}
                    className={cn(
                      'flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left transition',
                      active ? 'bg-thread-soft' : 'hover:bg-sunk',
                    )}
                  >
                    <span
                      className={cn(
                        'flex h-7 w-7 shrink-0 items-center justify-center rounded-md border',
                        active
                          ? 'border-thread/40 bg-surface text-thread'
                          : 'border-line-strong bg-paper text-ink-muted',
                      )}
                    >
                      <Icon size={15} />
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span
                        className={cn('truncate text-sm font-medium', active ? 'text-thread' : 'text-ink')}
                      >
                        {def.title}
                      </span>
                      <span className="truncate text-2xs text-ink-faint">{def.subtext}</span>
                    </span>
                    {active && <Check size={15} className="shrink-0 text-thread" />}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Weft's block side menu. Replaces BlockNote's default "+" (which inserted a
 * blank paragraph on every click) with a menu that converts the CURRENT block's
 * type into any block type in the shared registry. The drag handle (⠿) keeps
 * BlockNote's native drag + drag-handle menu. Vertical centering is handled by
 * the controller's `placement: 'left'`.
 */
export function WeftSideMenu(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  props: any & { onConvert: (block: any, def: BlockTypeDef) => void },
) {
  const { block, freezeMenu, unfreezeMenu, onConvert } = props;
  const isPage = block.type === 'pageLink';

  return (
    <div className="bn-side-menu flex items-center gap-0.5">
      <Popover
        align="start"
        registerOverlay={false}
        onOpenChange={(open) => (open ? freezeMenu() : unfreezeMenu())}
        trigger={
          <button
            type="button"
            data-weft-plus="true"
            aria-label="Turn block into…"
            title="Turn into…"
            className="flex h-6 w-5 items-center justify-center rounded text-ink-faint transition-colors hover:bg-sunk hover:text-ink"
          >
            <Plus size={18} />
          </button>
        }
      >
        {(close) => (
          <BlockConvertMenu
            block={block}
            isPage={isPage}
            onPick={(def) => {
              close();
              onConvert(block, def);
            }}
          />
        )}
      </Popover>

      {/* Native drag handle + its menu (drag to reorder, delete, colors, …). */}
      <DragHandleButton {...(props as any)} />
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
