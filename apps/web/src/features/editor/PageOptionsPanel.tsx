import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ClipboardCopy,
  Code2,
  CopyPlus,
  FolderInput,
  ImagePlus,
  Link2,
  Lock,
  Search,
  SpellCheck,
  Trash2,
  Type,
  Upload,
  Wallpaper,
} from 'lucide-react';
import { PAGE_WIDTH_PRESETS } from '@weft/shared';
import type { PageDetail } from '@/lib/queries';
import { cn } from '@/lib/utils';
import { fuzzyFilter } from '@/lib/fuzzy';
import { Checkbox } from '@/components/ui/Checkbox';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { FileFormatIcon, type FileFormat } from '@/components/ui/FileFormatIcon';
import { useEditorPrefs } from '@/hooks/useEditorPrefs';
import { FontList } from './FontList';
import { pageFont } from './pageFonts';

/**
 * The page "…" surface — a persistent control panel, not a dropdown
 * (docs/STYLEGUIDE.md §6.7).
 *
 * The behaviour that defines it: **a control whose effect you can see on this
 * page must not close the panel.** Spellcheck, width, font, lock — you flip
 * them, the page changes underneath, the panel stays put and shows the new
 * state, and you keep going. Only rows that hand off to another surface (a
 * picker, a modal, a download, another page) call `close()`, and they say so in
 * one place: `kind: 'action'` below.
 *
 * That is why this is not built on `components/ui/Menu`, which closes on every
 * item click — correct for a command list, wrong for a settings list. The
 * container is a plain `Popover`, whose only dismissals are a real outside
 * pointer-down, Escape, or an explicit close.
 */

type View = 'root' | 'font';

/** Section identity, in display order. */
const SECTIONS = [
  { key: 'appearance', label: 'Appearance' },
  { key: 'page', label: 'Page' },
  { key: 'actions', label: 'Actions' },
  { key: 'export', label: 'Import & export' },
] as const;
type SectionKey = (typeof SECTIONS)[number]['key'];

interface EntryBase {
  id: string;
  /** Primary search string, and the accessible label for control rows. */
  label: string;
  keywords: string[];
  section: SectionKey;
  hidden?: boolean;
}

interface ControlEntry extends EntryBase {
  kind: 'control';
  render: () => ReactNode;
}

interface ActionEntry extends EntryBase {
  kind: 'action';
  icon: ReactNode;
  /** Right-aligned secondary text (current value, format, …). */
  detail?: string;
  danger?: boolean;
  disabled?: boolean;
  /** Shows a chevron and opens a sub-view instead of leaving the panel. */
  submenu?: boolean;
  run: () => void;
}

type Entry = ControlEntry | ActionEntry;

export interface PageOptionsHandlers {
  changeCover: () => void;
  setBackground: () => void;
  removeBackground: () => void;
  customCss: () => void;
  copyLink: () => void;
  copyContents: () => void;
  duplicate: () => void;
  moveTo: () => void;
  trash: () => void;
  /** Absent when the page can't be imported into (read-only / editor loading). */
  importFile?: () => void;
  exports: { id: string; label: string; format: FileFormat; run: () => void }[];
}

export function PageOptionsPanel({
  page,
  role,
  editable,
  onUpdate,
  handlers,
  close,
}: {
  page: PageDetail;
  role: string;
  editable: boolean;
  onUpdate: (partial: Record<string, unknown>) => void;
  handlers: PageOptionsHandlers;
  close: () => void;
}) {
  const [view, setView] = useState<View>('root');
  const [query, setQuery] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const spellcheck = useEditorPrefs((s) => s.spellcheck);
  const setSpellcheck = useEditorPrefs((s) => s.setSpellcheck);

  // Escape is owned here, in the *capture* phase on the panel element, because
  // the shared document-level dismiss never sees it: something between the
  // focused field and `document` stops it mid-bubble when the trigger lives in
  // the editor (see docs/STYLEGUIDE.md §6.1). A sub-view steps back to the root;
  // the root closes the panel.
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      if (view !== 'root') {
        e.preventDefault();
        setView('root');
      } else {
        close();
      }
    };
    el.addEventListener('keydown', onKey, true);
    return () => el.removeEventListener('keydown', onKey, true);
  }, [view, close]);

  // ── The width control ────────────────────────────────────────────────────
  // Width is persisted as it always was — a px column width plus the
  // `isFullWidth` flag — so nothing about existing pages changes. The presets
  // are a readable *view* of that pair: a page saved at some in-between width
  // (the old ±60px stepper) still shows the nearest preset as active rather
  // than nothing at all.
  const widthValue = page.isFullWidth
    ? 'full'
    : nearestWidthPreset(page.width || PAGE_WIDTH_PRESETS[1].width);

  const setWidth = (next: string) => {
    if (next === 'full') return onUpdate({ isFullWidth: true });
    const preset = PAGE_WIDTH_PRESETS.find((p) => p.key === next);
    if (preset) onUpdate({ isFullWidth: false, width: preset.width });
  };

  const font = pageFont(page.fontFamily);
  const canLock = role !== 'viewer';

  const entries = useMemo<Entry[]>(() => {
    const list: Entry[] = [
      {
        kind: 'control',
        id: 'width',
        label: 'Width',
        section: 'appearance',
        keywords: [
          'width',
          'narrower',
          'narrow',
          'default',
          'wider',
          'wide',
          'full width',
          'fullwidth',
          'column',
          'margin',
          'layout',
        ],
        render: () => (
          <Field label="Width" hint="How wide the content column runs.">
            <SegmentedControl
              label="Page width"
              value={widthValue}
              onChange={setWidth}
              disabled={!editable}
              options={[
                { value: 'narrow', label: 'Narrower', icon: <WidthGlyph span={1} /> },
                { value: 'default', label: 'Default', icon: <WidthGlyph span={2} /> },
                { value: 'wide', label: 'Wider', icon: <WidthGlyph span={3} /> },
                { value: 'full', label: 'Full', icon: <WidthGlyph span={4} /> },
              ]}
            />
          </Field>
        ),
      },
      {
        kind: 'action',
        id: 'font',
        label: 'Font family',
        section: 'appearance',
        keywords: ['font', 'typeface', 'type', 'serif', 'sans', 'mono', 'typography', 'family'],
        icon: <Type size={16} />,
        detail: font.label,
        submenu: true,
        disabled: !editable,
        run: () => setView('font'),
      },
      {
        kind: 'control',
        id: 'spellcheck',
        label: 'Spellcheck',
        section: 'appearance',
        keywords: ['spellcheck', 'spelling', 'grammar', 'squiggles', 'dictionary', 'typos'],
        render: () => (
          <Checkbox
            data-panel-row
            checked={spellcheck}
            onChange={setSpellcheck}
            label="Spellcheck"
            hint="Underline misspelled words while you type."
            icon={<SpellCheck size={15} />}
          />
        ),
      },
      {
        kind: 'control',
        id: 'lock',
        label: 'Lock page',
        section: 'appearance',
        keywords: ['lock', 'locked', 'read only', 'readonly', 'freeze', 'protect'],
        hidden: !canLock,
        render: () => (
          <Checkbox
            data-panel-row
            checked={page.isLocked}
            onChange={(v) => onUpdate({ isLocked: v })}
            label="Lock page"
            hint="Stop edits until it's unlocked again."
            icon={<Lock size={15} />}
          />
        ),
      },

      {
        kind: 'action',
        id: 'cover',
        label: page.coverUrl ? 'Change cover' : 'Add cover',
        section: 'page',
        keywords: ['cover', 'header image', 'banner', 'photo', 'image'],
        icon: <ImagePlus size={16} />,
        disabled: !editable,
        run: handlers.changeCover,
      },
      {
        kind: 'action',
        id: 'background',
        label: page.backgroundUrl ? 'Remove background' : 'Set page background',
        section: 'page',
        keywords: ['background', 'wallpaper', 'backdrop', 'page image'],
        icon: <Wallpaper size={16} />,
        disabled: !editable,
        // Both outcomes are visible on this page the moment they happen, so
        // neither closes the panel — you can put a background on, look at it,
        // and take it straight off again.
        run: page.backgroundUrl ? handlers.removeBackground : handlers.setBackground,
      },
      {
        kind: 'action',
        id: 'css',
        label: 'Custom CSS',
        section: 'page',
        keywords: ['css', 'style', 'stylesheet', 'custom', 'code'],
        icon: <Code2 size={16} />,
        disabled: !editable,
        run: () => {
          handlers.customCss();
          close();
        },
      },

      {
        kind: 'action',
        id: 'copyLink',
        label: 'Copy link',
        section: 'actions',
        keywords: ['link', 'url', 'share', 'address'],
        icon: <Link2 size={16} />,
        run: () => {
          handlers.copyLink();
          close();
        },
      },
      {
        kind: 'action',
        id: 'copyContents',
        label: 'Copy page contents',
        section: 'actions',
        keywords: ['copy', 'contents', 'markdown', 'clipboard', 'text'],
        icon: <ClipboardCopy size={16} />,
        run: () => {
          handlers.copyContents();
          close();
        },
      },
      {
        kind: 'action',
        id: 'duplicate',
        label: 'Duplicate',
        section: 'actions',
        keywords: ['duplicate', 'copy', 'clone'],
        icon: <CopyPlus size={16} />,
        disabled: !editable,
        run: () => {
          handlers.duplicate();
          close();
        },
      },
      {
        kind: 'action',
        id: 'moveTo',
        label: 'Move to',
        section: 'actions',
        keywords: ['move', 'reparent', 'relocate', 'parent'],
        icon: <FolderInput size={16} />,
        disabled: !editable,
        run: () => {
          handlers.moveTo();
          close();
        },
      },
      {
        kind: 'action',
        id: 'trash',
        label: 'Move to trash',
        section: 'actions',
        keywords: ['trash', 'delete', 'remove', 'bin'],
        icon: <Trash2 size={16} />,
        danger: true,
        disabled: role === 'viewer',
        run: () => {
          handlers.trash();
          close();
        },
      },

      {
        kind: 'action',
        id: 'import',
        label: 'Import…',
        section: 'export',
        keywords: ['import', 'upload', 'markdown', 'csv', 'docx', 'file'],
        icon: <Upload size={16} />,
        disabled: !editable || !handlers.importFile,
        run: () => {
          handlers.importFile?.();
          close();
        },
      },
      ...handlers.exports.map<ActionEntry>((e) => ({
        kind: 'action' as const,
        id: `export-${e.id}`,
        label: e.label,
        section: 'export' as const,
        keywords: ['export', 'download', 'save as', e.format, e.label],
        icon: <FileFormatIcon format={e.format} size={20} />,
        detail: `.${e.format}`,
        run: () => {
          e.run();
          close();
        },
      })),
    ];
    return list.filter((e) => !e.hidden);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, role, editable, spellcheck, widthValue, font.label, handlers, close]);

  const searching = query.trim().length > 0;
  const results = useMemo(
    () =>
      fuzzyFilter(entries, query, (e) => [
        e.label,
        SECTIONS.find((s) => s.key === e.section)!.label,
        ...e.keywords,
      ]),
    [entries, query],
  );

  // ── Vertical keyboard navigation across every row, control or action ──────
  // The tab stop of a segmented control is its selected segment, so it joins
  // the same list and `←`/`→` still work once focus lands there.
  const focusables = () =>
    Array.from(
      rootRef.current?.querySelectorAll<HTMLElement>(
        '[data-panel-row]:not([disabled]), [role="radio"][tabindex="0"]:not([disabled])',
      ) ?? [],
    );

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.defaultPrevented) return;
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    const rows = focusables();
    if (!rows.length) return;
    e.preventDefault();
    const current = rows.indexOf(document.activeElement as HTMLElement);
    const next =
      current === -1
        ? e.key === 'ArrowDown'
          ? 0
          : rows.length - 1
        : (current + (e.key === 'ArrowDown' ? 1 : -1) + rows.length) % rows.length;
    rows[next]?.focus();
  };

  return (
    <div
      ref={rootRef}
      onKeyDown={onKeyDown}
      className="flex max-h-[min(560px,80vh)] w-[320px] flex-col overflow-hidden rounded-xl border border-line bg-surface shadow-lg"
    >
      {view === 'font' ? (
        <>
          <SubHeader title="Font family" onBack={() => setView('root')} />
          <FontList
            value={page.fontFamily}
            editable={editable}
            // Live: pick a face, the page re-faces, the list stays open on the
            // same scroll position so the next one is a click away.
            onPick={(key) => onUpdate({ fontFamily: key })}
            className="min-h-0 flex-1"
          />
        </>
      ) : (
        <>
          <div className="flex items-center gap-2 border-b border-line px-3 py-2.5 focus-within:border-thread/30">
            <Search size={14} className="shrink-0 text-ink-faint" />
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search settings…"
              aria-label="Search settings"
              className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-ink-faint focus-visible:shadow-none"
            />
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-1.5 py-1.5">
            {results.length === 0 && (
              <p className="px-2 py-8 text-center text-sm text-ink-faint">
                Nothing matches “{query.trim()}”.
              </p>
            )}

            {searching
              ? // Searching flattens the sections: the ranking *is* the answer,
                // so re-grouping would only scatter the best matches.
                results.map((entry) => <EntryRow key={entry.id} entry={entry} />)
              : SECTIONS.map((section) => {
                  const rows = results.filter((e) => e.section === section.key);
                  if (!rows.length) return null;
                  return (
                    <div key={section.key} className="mb-2 last:mb-0">
                      <p className="px-2 pb-1 pt-2 text-2xs font-semibold uppercase tracking-wide text-ink-faint">
                        {section.label}
                      </p>
                      <div className="flex flex-col gap-0.5">
                        {rows.map((entry) => (
                          <EntryRow key={entry.id} entry={entry} />
                        ))}
                      </div>
                    </div>
                  );
                })}
          </div>

          <p className="border-t border-line px-3 py-2 text-2xs text-ink-faint">
            Settings apply straight away — this panel stays open.
          </p>
        </>
      )}
    </div>
  );
}

/** One row, whichever kind it is. */
function EntryRow({ entry }: { entry: Entry }) {
  if (entry.kind === 'control') return <>{entry.render()}</>;
  return (
    <button
      type="button"
      data-panel-row
      data-entry={entry.id}
      disabled={entry.disabled}
      onClick={entry.run}
      className={cn(
        'flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm transition',
        'disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent',
        entry.danger ? 'text-danger hover:bg-danger-soft' : 'text-ink hover:bg-sunk',
      )}
    >
      <span className="flex h-5 w-5 shrink-0 items-center justify-center text-ink-faint">
        {entry.icon}
      </span>
      <span className="min-w-0 flex-1 truncate">{entry.label}</span>
      {entry.detail && (
        <span className="max-w-[110px] shrink-0 truncate text-2xs text-ink-faint">
          {entry.detail}
        </span>
      )}
      {entry.submenu && <ChevronRight size={14} className="shrink-0 text-ink-faint" />}
    </button>
  );
}

/** Label + hint above a control that isn't a single clickable row. */
function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="px-2 py-1.5">
      <p className="text-sm text-ink">{label}</p>
      {hint && <p className="mb-1.5 mt-0.5 text-2xs leading-snug text-ink-faint">{hint}</p>}
      {children}
    </div>
  );
}

function SubHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <div className="flex items-center gap-1 border-b border-line px-2 py-2">
      <button
        type="button"
        onClick={onBack}
        aria-label="Back to page options"
        className="flex h-7 w-7 items-center justify-center rounded-md text-ink-muted transition hover:bg-sunk hover:text-ink"
      >
        <ChevronLeft size={16} />
      </button>
      <span className="text-sm font-semibold text-ink">{title}</span>
    </div>
  );
}

/** A tiny column-width diagram — four steps from a narrow measure to full bleed. */
function WidthGlyph({ span }: { span: 1 | 2 | 3 | 4 }) {
  const inset = [4.5, 3, 1.5, 0][span - 1]!;
  return (
    <svg width="16" height="12" viewBox="0 0 16 12" fill="none" aria-hidden>
      <rect
        x="0.5"
        y="0.5"
        width="15"
        height="11"
        rx="1.5"
        stroke="currentColor"
        strokeWidth="1"
        opacity="0.35"
      />
      <rect
        x={inset + 0.5}
        y="3"
        width={15 - inset * 2}
        height="6"
        rx="1"
        fill="currentColor"
        opacity="0.85"
      />
    </svg>
  );
}

/** The preset whose width is closest to a stored one (pages predate presets). */
function nearestWidthPreset(width: number): string {
  let best: (typeof PAGE_WIDTH_PRESETS)[number] = PAGE_WIDTH_PRESETS[0];
  for (const preset of PAGE_WIDTH_PRESETS) {
    if (Math.abs(preset.width - width) < Math.abs(best.width - width)) best = preset;
  }
  return best.key;
}
