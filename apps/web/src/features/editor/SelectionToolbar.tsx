import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useEditorContentOrSelectionChange } from '@blocknote/react';
import { ChevronDown, MoreHorizontal, Baseline, Link2, Type } from 'lucide-react';
import { Portal } from '@/components/ui/Portal';
import { Tooltip } from '@/components/ui/Tooltip';
import { Popover } from '@/components/ui/Popover';
import { paletteColor } from './palette';
import { pageFont } from './pageFonts';
import type { BlockTypeCtx } from './blockTypes';
import {
  INLINE_FORMATS,
  activeTurnIntoDef,
  shortcutLabel,
  convertSelection,
  type SelectionApi,
} from './selectionCommands';
import { SelectionCommandMenu, type SelectionView } from './SelectionCommandMenu';
import {
  applyLink,
  clearInlineFormatting,
  currentRange,
  linkInSelection,
  markState,
  measureSelectionRect,
  removeLink,
  scanSelection,
  selectedBlocks,
  setStringStyle,
  toggleBooleanStyle,
  type MarkState,
  type PmRange,
} from './selectionModel';

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Weft's selection toolbar — the surface that appears when text is selected
 * (docs/STYLEGUIDE.md §6.8).
 *
 * **Why it is not BlockNote's `FormattingToolbarController`.** That controller
 * positions the toolbar with floating-ui *and* attaches floating-ui's
 * `useDismiss`, which treats a pointer-down anywhere outside the toolbar
 * element — including inside a panel the toolbar itself opened — as "dismiss",
 * and re-focuses the editor. It also renders a frozen `innerHTML` clone while
 * fading out, which a React panel cannot live inside. We keep BlockNote's
 * *plugin* (it already decides, correctly, when a selection deserves a toolbar
 * and where it is) and do the rendering ourselves: one portalled, viewport-aware
 * rail with no dismissal logic of its own.
 *
 * **Layering.** The rail is an app overlay, so it sits above BlockNote's
 * reserved 2000–4000 band but below modals — `z-selection-toolbar` (§6.1). Its
 * panels use the shared `Popover` at `z-overlay`, so a panel is always above the
 * rail that opened it.
 *
 * **Why every panel carries `.bn-ui-container`.** BlockNote hides the toolbar the
 * moment the editor blurs, with exactly one exception: a focus target matching
 * `.bn-ui-container`. A panel that takes focus (search field, link form) must
 * claim that class or it dismisses the toolbar that opened it (§3.4).
 */
export function SelectionToolbar({
  editor,
  ctx,
  tree,
}: {
  editor: any;
  ctx: BlockTypeCtx;
  tree: { id: string; title: string; icon?: string | null }[];
}) {
  const [shown, setShown] = useState(false);
  const [rect, setRect] = useState<{
    top: number;
    bottom: number;
    left: number;
    right: number;
  } | null>(null);

  // BlockNote's plugin owns the "should there be a toolbar, and for which text"
  // decision — the same rules as its own toolbar (no empty selections, never
  // inside a code block, hides on drag / Escape / editor blur).
  useEffect(() => {
    return editor.formattingToolbar.onUpdate((state: any) => {
      setShown(!!state.show);
      if (state.show && state.referencePos) setRect(toBox(state.referencePos));
    });
  }, [editor]);

  const range = useRef<PmRange | null>(null);
  const [tick, setTick] = useState(0);
  const settle = useRef<ReturnType<typeof setTimeout>>();

  /**
   * Record the live selection while the toolbar is up. This is the range every
   * action is applied to, so a control that legitimately takes focus can still
   * format exactly what the user highlighted (§16).
   *
   * The range goes into a **ref** and the re-render is **coalesced**, and that
   * split is load-bearing rather than tidiness. Holding Shift+→ fires this
   * callback per keystroke; re-rendering the rail (and re-scanning the marks,
   * blocks and links under it) on each one makes the main thread busy enough
   * that ProseMirror's DOM observer flushes late — and a late flush re-asserts
   * the *previous* state selection over the DOM, visibly truncating a selection
   * mid-drag. Measured: ~50% of fast 22-key extensions lost characters before
   * this, none after. The readouts are chrome; they only have to be right once
   * the selection settles.
   */
  useEditorContentOrSelectionChange(() => {
    const r = currentRange(editor);
    if (r && r.to > r.from) range.current = r;
    clearTimeout(settle.current);
    settle.current = setTimeout(() => setTick((t) => t + 1), 60);
  }, editor);

  useEffect(() => () => clearTimeout(settle.current), []);

  // Re-measure after anything that can move the text under the toolbar: a
  // transformation that changes a line's height, a scroll, a resize.
  const remeasure = useCallback(() => {
    const box = measureSelectionRect(editor, range.current);
    if (box) setRect(box);
  }, [editor]);

  useEffect(() => {
    if (!shown) return;
    const raf = requestAnimationFrame(remeasure);
    window.addEventListener('scroll', remeasure, true);
    window.addEventListener('resize', remeasure);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', remeasure, true);
      window.removeEventListener('resize', remeasure);
    };
  }, [shown, tick, remeasure]);

  if (!shown || !rect) return null;

  return (
    <ToolbarRail
      editor={editor}
      ctx={ctx}
      tree={tree}
      rect={rect}
      range={range}
      tick={tick}
      afterAction={() => requestAnimationFrame(remeasure)}
    />
  );
}

const toBox = (r: DOMRect) => ({ top: r.top, bottom: r.bottom, left: r.left, right: r.right });

// ── The rail ────────────────────────────────────────────────────────────────

/** How much of the rail fits. Everything dropped at a narrower tier stays
 *  reachable in the More menu, which always holds the complete command set —
 *  controls are re-homed, never truncated (§20). */
type Tier = 'full' | 'medium' | 'compact' | 'tight';

function tierFor(width: number): Tier {
  if (width >= 900) return 'full';
  if (width >= 700) return 'medium';
  if (width >= 520) return 'compact';
  return 'tight';
}

function ToolbarRail({
  editor,
  ctx,
  tree,
  rect,
  range,
  tick,
  afterAction,
}: {
  editor: any;
  ctx: BlockTypeCtx;
  tree: { id: string; title: string; icon?: string | null }[];
  rect: { top: number; bottom: number; left: number; right: number };
  range: { current: PmRange | null };
  tick: number;
  afterAction: () => void;
}) {
  const railRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const [tier, setTier] = useState<Tier>(() => tierFor(window.innerWidth));

  useEffect(() => {
    const onResize = () => setTier(tierFor(window.innerWidth));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Above the selection by default; below it when the text sits at the top of
  // the viewport; always clamped inside the viewport with an 8px margin, so the
  // rail can never slide off screen or under the window edge (§19).
  const place = useCallback(() => {
    const el = railRef.current;
    const w = el?.offsetWidth ?? 0;
    const h = el?.offsetHeight ?? 0;
    const GAP = 10;
    const M = 8;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let top = rect.top - GAP - h;
    if (top < M) top = rect.bottom + GAP;
    top = Math.max(M, Math.min(top, vh - h - M));

    let left = rect.left;
    if (w) left = Math.max(M, Math.min(left, vw - w - M));
    setCoords({ top, left });
  }, [rect]);

  useLayoutEffect(place, [place, tier]);

  // The rail's own width changes as its block-type label changes ("Text" →
  // "Heading 1"), which moves where the right edge falls; re-clamp when it does.
  useEffect(() => {
    const el = railRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(place);
    ro.observe(el);
    return () => ro.disconnect();
  }, [place]);

  const api = useSelectionApi({ editor, ctx, tree, range, tick, afterAction });

  /**
   * Closing a panel hands the caret back to the text.
   *
   * Without this the panel simply disappears and focus is left on nothing:
   * ProseMirror keeps a selection in its *state* that the browser no longer
   * mirrors, so the next click and keystrokes fight a stale caret (measured:
   * after Duplicate, the editor's state selection stayed on the copy while the
   * DOM selection had moved). Returning focus re-synchronises the two, and it is
   * what you want anyway — you came back from a menu to keep writing.
   */
  const closeAndReturn = useCallback(
    (close: () => void) => () => {
      close();
      requestAnimationFrame(() => {
        try {
          editor.focus();
        } catch {
          /* editor unmounted while the panel was open */
        }
      });
    },
    [editor],
  );

  const activeDef = activeTurnIntoDef(api.blocks);
  const blockLabel =
    activeDef === null ? 'Mixed' : (activeDef?.title ?? blockFallbackLabel(api.blocks));
  const BlockIcon = activeDef?.Icon ?? Type;

  const showMarks = tier !== 'tight' ? INLINE_FORMATS : INLINE_FORMATS.slice(0, 2);
  const showLink = tier === 'full' || tier === 'medium' || tier === 'compact';
  const showColor = tier === 'full' || tier === 'medium' || tier === 'compact';
  const showFont = tier === 'full' || tier === 'medium';

  const controls = useCallback(
    () => Array.from(railRef.current?.querySelectorAll<HTMLElement>('button') ?? []),
    [],
  );

  /**
   * Reaching the rail from the keyboard, and moving around inside it.
   *
   * Tab cannot be the way in: inside the editor ProseMirror claims Tab for
   * indent/outdent, and the rail is portalled to the end of `<body>` anyway, so
   * it is never the next tab stop. **Alt+F10** is the long-standing convention
   * for "focus the editor toolbar" (Google Docs, TinyMCE), so that is the door.
   * Once inside, the rail behaves like a real `role="toolbar"`: one tab stop,
   * ←/→ (and Home/End) between controls, Enter/Space to activate, Escape back to
   * the text — the ARIA toolbar pattern, not a row of stray tab stops.
   */
  useEffect(() => {
    const els = controls();
    els.forEach((el, i) => {
      el.tabIndex = i === 0 ? 0 : -1;
    });
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'F10' || !e.altKey) return;
      const first = controls()[0];
      if (!first) return;
      e.preventDefault();
      first.focus();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [controls]);

  const onRailKeyDown = (e: React.KeyboardEvent) => {
    const els = controls();
    const at = els.indexOf(document.activeElement as HTMLElement);
    if (at < 0) return;
    let next = -1;
    if (e.key === 'ArrowRight') next = (at + 1) % els.length;
    else if (e.key === 'ArrowLeft') next = (at - 1 + els.length) % els.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = els.length - 1;
    else if (e.key === 'Escape') {
      e.preventDefault();
      try {
        editor.focus();
      } catch {
        /* editor gone */
      }
      return;
    } else return;
    e.preventDefault();
    els.forEach((el, i) => {
      el.tabIndex = i === next ? 0 : -1;
    });
    els[next]?.focus();
  };

  return (
    <Portal>
      <div
        ref={railRef}
        role="toolbar"
        aria-label="Text formatting"
        data-weft-selection-toolbar
        onKeyDown={onRailKeyDown}
        // `bn-formatting-toolbar` keeps BlockNote's own conventions (and anything
        // keyed off them) true for our replacement.
        className="bn-formatting-toolbar bn-ui-container wf-selection-rail z-selection-toolbar"
        style={{
          position: 'fixed',
          top: coords?.top ?? 0,
          left: coords?.left ?? 0,
          visibility: coords ? 'visible' : 'hidden',
        }}
      >
        {/* Block type — the only labelled control, because it is the only one
            whose current value you need to read rather than recognise. */}
        <Tooltip label="Turn into another block type" side="top">
          <Popover
            align="start"
            registerOverlay={false}
            className="bn-ui-container"
            trigger={
              <button
                type="button"
                data-weft-block-type
                aria-label={`Block type: ${blockLabel}`}
                onMouseDown={(e) => e.preventDefault()}
                className="wf-rail-select"
              >
                <BlockIcon size={15} className="shrink-0" />
                {tier !== 'tight' && <span className="truncate">{blockLabel}</span>}
                <ChevronDown size={12} className="shrink-0 opacity-60" />
              </button>
            }
          >
            {(close) => (
              <SelectionCommandMenu api={api} close={closeAndReturn(close)} initialView="turnInto" />
            )}
          </Popover>
        </Tooltip>

        <Divider />

        {showMarks.map((f) => {
          const state = api.stateOf(f.style);
          return (
            <RailToggle
              key={f.style}
              label={f.label}
              shortcut={shortcutLabel(f.shortcut)}
              state={state}
              testKey={f.style}
              onActivate={() => api.toggle(f.style)}
            >
              <f.Icon size={16} />
            </RailToggle>
          );
        })}

        {(showLink || showColor || showFont) && <Divider />}

        {showLink && (
          <RailPopover
            label={api.link ? 'Edit link' : 'Add link'}
            view="link"
            api={api}
            wrapClose={closeAndReturn}
            active={!!api.link}
            testKey="link"
          >
            <Link2 size={16} />
          </RailPopover>
        )}

        {showColor && (
          // The control reports its own value: the glyph takes the text colour,
          // the button takes the highlight. No separate swatch chip to read.
          <RailPopover
            label={colourLabel(api)}
            view="textColor"
            api={api}
            wrapClose={closeAndReturn}
            testKey="color"
            style={
              api.highlight.value
                ? {
                    background: `color-mix(in srgb, ${paletteColor(api.highlight.value).swatch} 26%, var(--surface))`,
                  }
                : undefined
            }
          >
            <Baseline
              size={16}
              style={
                api.textColor.value
                  ? { color: paletteColor(api.textColor.value).swatch }
                  : undefined
              }
            />
            {(api.textColor.mixed || api.highlight.mixed) && (
              <span
                aria-hidden
                className="wf-rail-state"
                style={{
                  backgroundImage:
                    'repeating-linear-gradient(90deg, var(--ink-faint) 0 3px, transparent 3px 6px)',
                }}
              />
            )}
          </RailPopover>
        )}

        {showFont && (
          <Tooltip label="Font for the selected text" side="top">
            <Popover
              align="start"
              registerOverlay={false}
              className="bn-ui-container"
              trigger={
                <button
                  type="button"
                  data-weft-inline-font
                  aria-label="Font"
                  onMouseDown={(e) => e.preventDefault()}
                  className="wf-rail-select"
                >
                  <Type size={15} className="shrink-0" />
                  {/* A face is named only when the selection actually has one.
                      "Default" as a permanent word says nothing and costs 60px. */}
                  {tier === 'full' && (api.font.mixed || api.font.value) && (
                    <span className="truncate">
                      {api.font.mixed ? 'Mixed' : pageFont(api.font.value!).label}
                    </span>
                  )}
                  <ChevronDown size={12} className="shrink-0 opacity-60" />
                </button>
              }
            >
              {(close) => <SelectionCommandMenu api={api} close={closeAndReturn(close)} initialView="font" />}
            </Popover>
          </Tooltip>
        )}

        <Divider />

        <Tooltip label="All formatting and block actions" side="top">
          <Popover
            align="end"
            registerOverlay={false}
            className="bn-ui-container"
            trigger={
              <button
                type="button"
                data-weft-selection-more
                aria-label="More formatting and block actions"
                onMouseDown={(e) => e.preventDefault()}
                className="wf-rail-button"
              >
                <MoreHorizontal size={16} />
              </button>
            }
          >
            {(close) => <SelectionCommandMenu api={api} close={closeAndReturn(close)} />}
          </Popover>
        </Tooltip>
      </div>
    </Portal>
  );
}

function blockFallbackLabel(blocks: any[]): string {
  if (!blocks.length) return 'Text';
  const type = blocks[0]?.type;
  return typeof type === 'string' ? type.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase()) : 'Text';
}

const Divider = () => <span aria-hidden className="wf-rail-divider" />;

/** Name the colour control's current value, so what the swatch shows visually is
 *  also said in words (§10 — colour is never the only signal). */
function colourLabel(api: SelectionApi): string {
  const part = (state: MarkState, name: string) =>
    state.mixed ? `${name}: mixed` : state.value ? `${name}: ${paletteColor(state.value).label}` : '';
  const bits = [part(api.textColor, 'Text color'), part(api.highlight, 'Highlight')].filter(Boolean);
  return bits.length ? bits.join(' · ') : 'Text color and highlight';
}

/** An on / off / **mixed** mark button. The state bar under the glyph is the
 *  signal, so state never rests on colour alone (§10): solid means every
 *  selected character carries the mark, dashed means only some do (§18). */
function RailToggle({
  label,
  shortcut,
  state,
  testKey,
  onActivate,
  children,
}: {
  label: string;
  shortcut?: string;
  state: MarkState;
  testKey: string;
  onActivate: () => void;
  children: ReactNode;
}) {
  return (
    <Tooltip label={shortcut ? `${label} · ${shortcut}` : label} side="top">
      <button
        type="button"
        data-weft-format={testKey}
        aria-label={label}
        aria-pressed={state.active ? 'true' : state.mixed ? 'mixed' : 'false'}
        data-state={state.active ? 'on' : state.mixed ? 'mixed' : 'off'}
        onMouseDown={(e) => {
          // Cancel the mousedown so the browser never moves the selection we
          // are about to format — the first and cheapest defence of §16.
          e.preventDefault();
          onActivate();
        }}
        // Keyboard activation only. A click already fired `onMouseDown` above;
        // `detail === 0` is how a synthesised (Enter/Space) click identifies
        // itself, so the mark is never toggled twice by one press.
        onClick={(e) => {
          if (e.detail === 0) onActivate();
        }}
        className="wf-rail-button"
      >
        {children}
        {(state.active || state.mixed) && (
          <span
            aria-hidden
            className="wf-rail-state"
            style={
              state.mixed
                ? {
                    backgroundImage:
                      'repeating-linear-gradient(90deg, currentColor 0 3px, transparent 3px 6px)',
                  }
                : { background: 'currentColor' }
            }
          />
        )}
      </button>
    </Tooltip>
  );
}

/** A rail button that opens the shared command panel at a given view. */
function RailPopover({
  label,
  shortcut,
  view,
  api,
  active,
  testKey,
  style,
  wrapClose,
  children,
}: {
  label: string;
  shortcut?: string;
  view: SelectionView;
  api: SelectionApi;
  active?: boolean;
  testKey: string;
  style?: React.CSSProperties;
  /** Wraps the panel's own close so the caret returns to the text. */
  wrapClose: (close: () => void) => () => void;
  children: ReactNode;
}) {
  return (
    <Tooltip label={shortcut ? `${label} · ${shortcut}` : label} side="top">
      <Popover
        align="start"
        registerOverlay={false}
        className="bn-ui-container"
        trigger={
          <button
            type="button"
            data-weft-format={testKey}
            aria-label={label}
            data-state={active ? 'on' : 'off'}
            onMouseDown={(e) => e.preventDefault()}
            className="wf-rail-button"
            style={style}
          >
            {children}
          </button>
        }
      >
        {(close) => (
          <SelectionCommandMenu api={api} close={wrapClose(close)} initialView={view} />
        )}
      </Popover>
    </Tooltip>
  );
}

// ── The verbs, assembled once ───────────────────────────────────────────────

function useSelectionApi({
  editor,
  ctx,
  tree,
  range,
  tick,
  afterAction,
}: {
  editor: any;
  ctx: BlockTypeCtx;
  tree: { id: string; title: string; icon?: string | null }[];
  range: { current: PmRange | null };
  tick: number;
  afterAction: () => void;
}): SelectionApi {
  // `tick` advances on every editor content/selection change, so the scan, the
  // touched blocks and the link under the cursor are always read from the live
  // document rather than from a stale render.
  const [bump, setBump] = useState(0);
  const refresh = useCallback(() => {
    setBump((b) => b + 1);
    afterAction();
  }, [afterAction]);

  const scan = useMemo(
    () => scanSelection(editor, range.current),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [editor, tick, bump],
  );
  const blocks = useMemo(
    () => selectedBlocks(editor, range.current),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [editor, tick, bump],
  );
  const link = useMemo(
    () => linkInSelection(editor, range.current),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [editor, tick, bump],
  );

  return useMemo<SelectionApi>(
    () => ({
      editor,
      ctx,
      tree,
      range: range.current,
      scan,
      blocks,
      link,
      stateOf: (style: string) => markState(scan, style),
      textColor: markState(scan, 'textColor'),
      highlight: markState(scan, 'backgroundColor'),
      font: markState(scan, 'font'),
      toggle: (style: string) => {
        toggleBooleanStyle(editor, range.current, style, markState(scan, style));
        refresh();
      },
      setColor: (kind, value) => {
        setStringStyle(editor, range.current, kind, value);
        refresh();
      },
      setFont: (key: string) => {
        setStringStyle(editor, range.current, 'font', key || null);
        refresh();
      },
      clearFormatting: () => {
        clearInlineFormatting(editor, range.current);
        refresh();
      },
      convert: (def) => {
        void convertSelection(def, editor, ctx, range.current).then(refresh);
      },
      setLink: (url, text) => {
        applyLink(editor, range.current, url, text);
        refresh();
      },
      clearLink: () => {
        removeLink(editor, range.current);
        refresh();
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [editor, ctx, tree, scan, blocks, link, refresh],
  );
}
