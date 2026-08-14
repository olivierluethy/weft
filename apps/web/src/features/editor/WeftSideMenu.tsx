import { DragHandleButton } from '@blocknote/react';
import { Plus, Type, Heading1, Heading2, Heading3, Check, AlertTriangle } from 'lucide-react';
import { Popover } from '@/components/ui/Popover';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';

/** A block-type the "+" menu can convert the current block into. */
export type ConvertTarget = 'text' | 'h1' | 'h2' | 'h3';

const CONVERT_OPTIONS: { key: ConvertTarget; label: string; sub: string; icon: typeof Type }[] = [
  { key: 'text', label: 'Text', sub: 'Plain paragraph', icon: Type },
  { key: 'h1', label: 'Heading 1', sub: 'Large section title', icon: Heading1 },
  { key: 'h2', label: 'Heading 2', sub: 'Medium heading', icon: Heading2 },
  { key: 'h3', label: 'Heading 3', sub: 'Small heading', icon: Heading3 },
];

/** The BlockNote update spec for a convert target (content is supplied separately). */
export function convertSpec(target: ConvertTarget) {
  if (target === 'text') return { type: 'paragraph' as const };
  return { type: 'heading' as const, props: { level: Number(target[1]) as 1 | 2 | 3 } };
}

/** Is `block` the current selection already? Used to tick the active row.
 * Typed loosely: the editor's custom (weft) schema widens the block union. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isActive(block: any, target: ConvertTarget): boolean {
  if (target === 'text') return block.type === 'paragraph';
  return block.type === 'heading' && block.props?.level === Number(target[1]);
}

/** Contents of the "+" popover: convert the current block's type (Notion-style). */
function BlockConvertMenu({
  block,
  isPage,
  onPick,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  block: any;
  isPage: boolean;
  onPick: (target: ConvertTarget) => void;
}) {
  return (
    <div className="w-64 overflow-hidden rounded-lg border border-line bg-surface p-1 shadow-lg">
      <p className="px-2 pb-1 pt-1.5 text-2xs font-semibold uppercase tracking-wide text-ink-faint">
        Turn into
      </p>
      {isPage && (
        <p className="mb-1 px-2 text-2xs leading-snug text-ink-faint">
          Converts this sub-page reference into a normal block.
        </p>
      )}
      <div className="flex flex-col gap-0.5">
        {CONVERT_OPTIONS.map((opt) => {
          const active = isActive(block, opt.key);
          const Icon = opt.icon;
          return (
            <button
              key={opt.key}
              data-convert={opt.key}
              onClick={() => onPick(opt.key)}
              className={cn(
                'flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left transition',
                active ? 'bg-thread-soft' : 'hover:bg-sunk',
              )}
            >
              <span
                className={cn(
                  'flex h-7 w-7 shrink-0 items-center justify-center rounded-md border',
                  active ? 'border-thread/40 bg-surface text-thread' : 'border-line-strong bg-paper text-ink-muted',
                )}
              >
                <Icon size={15} />
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className={cn('truncate text-sm font-medium', active ? 'text-thread' : 'text-ink')}>
                  {opt.label}
                </span>
                <span className="truncate text-2xs text-ink-faint">{opt.sub}</span>
              </span>
              {active && <Check size={15} className="shrink-0 text-thread" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Weft's block side menu. Replaces BlockNote's default "+" (which inserted a
 * blank paragraph on every click) with a menu that converts the CURRENT block's
 * type. The drag handle (⠿) keeps BlockNote's native drag + drag-handle menu.
 * Vertical centering is handled by the controller's `placement: 'left'`.
 */
export function WeftSideMenu(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  props: any & { onConvert: (block: any, target: ConvertTarget) => void },
) {
  const { block, freezeMenu, unfreezeMenu, onConvert } = props;
  const isPage = block.type === 'pageLink';

  return (
    <div className="bn-side-menu flex items-center gap-0.5">
      <Popover
        align="start"
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
            onPick={(target) => {
              close();
              onConvert(block, target);
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
