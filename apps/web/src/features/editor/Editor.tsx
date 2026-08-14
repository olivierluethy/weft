import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import * as Y from 'yjs';
import { HocuspocusProvider } from '@hocuspocus/provider';
import {
  useCreateBlockNote,
  SuggestionMenuController,
  FormattingToolbarController,
  SideMenuController,
  type DefaultReactSuggestionItem,
} from '@blocknote/react';
import { filterSuggestionItems, locales as coreLocales } from '@blocknote/core';
import { multiColumnDropCursor, locales as multiColumnLocales } from '@blocknote/xl-multi-column';
import { createMultilineBlocksPlugin, multilineBlocksPluginKey } from './multilineBlocks';
import { createEmptyBlockDeletePlugin, emptyBlockDeletePluginKey } from './emptyBlockDelete';
import { createQuoteShortcutPlugin, quoteShortcutPluginKey } from './quoteShortcut';
import { createToggleBehaviorPlugin, toggleBehaviorPluginKey } from './toggleBehavior';
import { installEmptyDocRedoFallback } from './emptyDocRedo';
import { BlockNoteView } from '@blocknote/mantine';
import '@blocknote/mantine/style.css';
import './editor.css';
// Side-effect (via blockTypes): publishes the H1–H6 type scale as CSS custom properties.
import { useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';
import { toast } from '@/lib/toast';
import { hashHue } from '@/lib/utils';
import { computeStats, docText, type DocStats } from './stats';
import { WeftSideMenu, PageConvertDialog } from './WeftSideMenu';
import {
  getSlashBlockItems,
  convertBlockType,
  addBlockAfter,
  blockPlainText,
  type BlockTypeDef,
  type BlockTypeCtx,
} from './blockTypes';
import { useThemeStore } from '@/hooks/useTheme';
import { useEditorPrefs } from '@/hooks/useEditorPrefs';
import { useTree, useInvalidate } from '@/lib/queries';
import { weftSchema } from './mention';
import { SlashMenu } from './SlashMenu';
import { MarqueeSelect } from './MarqueeSelect';
import { CodeLanguagePicker } from './CodeLanguagePicker';
import { CodeCopyButton } from './CodeCopyButton';
import { WeftFormattingToolbar } from './FormattingToolbar';
import { EmptyState, isBlocksEmpty } from './EmptyState';
import { extractHeadings, type OutlineHeading } from './outline';
import { parseFileToBlocks } from '@/features/export/importContent';

const colorFor = (id: string) => `hsl(${hashHue(id)} 55% 45%)`;

/** Clear the collaborative (Yjs) undo stack. Undo/redo under collaboration is the
 * y-prosemirror UndoManager living in a ProseMirror plugin; we locate it by
 * duck-typing the plugin states and call `.clear()`. Used after the initial
 * content hydration so it isn't undoable. Best-effort — never throws. */
function clearCollabUndoHistory(editor: unknown): void {
  try {
    const view = (editor as { prosemirrorView?: { state?: unknown }; _tiptapEditor?: { view?: { state?: unknown } } })
      .prosemirrorView ?? (editor as { _tiptapEditor?: { view?: { state?: unknown } } })._tiptapEditor?.view;
    const state = (view as { state?: { plugins?: Array<{ getState?: (s: unknown) => unknown }> } })?.state;
    for (const plugin of state?.plugins ?? []) {
      const pstate = plugin.getState?.(state) as { undoManager?: { clear?: () => void } } | undefined;
      if (pstate?.undoManager?.clear) {
        pstate.undoManager.clear();
        return;
      }
    }
  } catch {
    /* undo manager not present / shape drift — ignore */
  }
}

function effectiveTheme(pref: string): 'light' | 'dark' {
  if (pref === 'dark') return 'dark';
  if (pref === 'light') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/** Reorder a whole heading section from the outline: move the heading `draggedId`
 * plus every following top-level block up to (but not including) the next heading
 * of equal-or-higher level, placing it right before `beforeId` (or at the end
 * when `beforeId` is null). Exposed to the Outline via `reorderRef`. */
export type ReorderSection = (draggedId: string, beforeId: string | null) => void;

export function Editor({
  pageId,
  workspaceId,
  initialContent,
  editable,
  user,
  onSave,
  onStats,
  onHeadings,
  reorderRef,
  focusEditorRef,
  importRef,
  pageUpdatedAt,
}: {
  pageId: string;
  workspaceId: string;
  initialContent: unknown;
  editable: boolean;
  user: { id: string; name: string };
  onSave: (doc: unknown) => void;
  onStats?: (stats: DocStats) => void;
  onHeadings?: (headings: OutlineHeading[]) => void;
  reorderRef?: MutableRefObject<ReorderSection | null>;
  /** Set by the editor to focus the body's first block (used by the title's
   * Enter key so it jumps straight into the content). */
  focusEditorRef?: MutableRefObject<(() => void) | null>;
  /** Set by the editor to a function that parses an uploaded file and appends the
   * resulting blocks to the doc, so the page-menu Import dialog can push content
   * into the editor. Resolves with how many blocks were added; rejects (with a
   * user-facing message) when the file can't be read. */
  importRef?: MutableRefObject<((file: File) => Promise<number>) | null>;
  /** Page's last-edited timestamp, surfaced in the block-action menu footer. */
  pageUpdatedAt?: string;
}) {
  const { theme } = useThemeStore();
  const spellcheck = useEditorPrefs((s) => s.spellcheck);
  const navigate = useNavigate();

  // One Yjs doc + Hocuspocus provider per mounted page (component is keyed by pageId).
  const { doc, provider } = useMemo(() => {
    const d = new Y.Doc();
    const wsProto = location.protocol === 'https:' ? 'wss' : 'ws';
    const p = new HocuspocusProvider({
      url: `${wsProto}://${location.host}/collab`,
      name: pageId,
      document: d,
    });
    return { doc: d, provider: p };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageId]);

  const { data: tree } = useTree(workspaceId);
  const invalidate = useInvalidate();

  const editor = useCreateBlockNote({
    schema: weftSchema,
    // Multi-column drop cursor: shows a vertical insert bar so blocks can be dropped
    // into / between columns. Paired with `withMultiColumn(weftSchema)` (mention.tsx).
    dropCursor: multiColumnDropCursor,
    dictionary: {
      ...coreLocales.en,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      multi_column: multiColumnLocales.en as any,
    },
    collaboration: {
      provider,
      fragment: doc.getXmlFragment('document'),
      user: { name: user.name, color: colorFor(user.id) },
    },
    uploadFile: async (file: File) => {
      const { upload } = await api.upload<{ upload: { url: string } }>('/uploads', file, {
        workspaceId,
      });
      return location.origin + upload.url;
    },
  });

  // DEV-only: expose the live editor for headless introspection / interaction tests.
  // Never runs in production builds (`import.meta.env.DEV` is statically false there).
  if (import.meta.env.DEV) {
    (window as unknown as Record<string, unknown>).__weftEditor = editor;
  }

  // Notion-style multi-line Enter handling for Highlight/Quote. Registered before
  // BlockNote's own Enter keymap so it can claim the key inside those blocks; a
  // no-op everywhere else. See multilineBlocks.ts for the mechanism.
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tt = (editor as any)._tiptapEditor;
    if (!tt) return;
    const prepend = (newPlugin: unknown, plugins: unknown[]) => [newPlugin, ...plugins];
    tt.registerPlugin(createMultilineBlocksPlugin(editor), prepend);
    tt.registerPlugin(createEmptyBlockDeletePlugin(editor), prepend);
    tt.registerPlugin(createQuoteShortcutPlugin(editor), prepend);
    tt.registerPlugin(createToggleBehaviorPlugin(editor), prepend);
    return () => {
      try {
        tt.unregisterPlugin(multilineBlocksPluginKey);
        tt.unregisterPlugin(emptyBlockDeletePluginKey);
        tt.unregisterPlugin(quoteShortcutPluginKey);
        tt.unregisterPlugin(toggleBehaviorPluginKey);
      } catch {
        /* editor already torn down */
      }
    };
  }, [editor]);

  // Restore content when redo follows an undo that emptied the whole document —
  // a y-prosemirror collab-undo limitation the native redo can't recover. See
  // emptyDocRedo.ts. Editable panes only.
  useEffect(() => {
    if (!editable) return;
    return installEmptyDocRedoFallback(editor);
  }, [editor, editable]);

  // Spellcheck toggle (app preference, persisted — see hooks/useEditorPrefs.ts).
  // The `spellcheck` attribute governs the browser's native spellcheck, and it
  // cascades: descendant editables that don't set their own value inherit it. We
  // set it in two places so every note text field is covered without ever mutating
  // ProseMirror's own managed nodes (doing so fights PM's mutation handling):
  //   • the ProseMirror root — every block editable inside a note (paragraphs,
  //     headings, lists, quotes, table cells, code, columns) inherits from it;
  //   • the content wrapper — catches editable regions rendered *beside* the editor
  //     (the empty-page quick-start band), which aren't under the PM root.
  // The values persist across React re-renders (set imperatively, React doesn't
  // manage them) and are re-applied on the next page (Editor is keyed by pageId).
  // Page titles keep their own `spellCheck={false}` (PageHeader).
  const contentWrapRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const value = String(spellcheck);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const root: HTMLElement | undefined = (editor as any)._tiptapEditor?.view?.dom;
    root?.setAttribute('spellcheck', value);
    contentWrapRef.current?.setAttribute('spellcheck', value);
  }, [editor, spellcheck]);

  // Reliable hover-state hide for the block side menu (＋ / ⠿). BlockNote's plugin
  // keeps the floating handles pinned to the last block after the pointer moves
  // away: it emits `show:false` when no block is hovered, but its React controller
  // does not reliably unmount them in our config (default side menu disabled +
  // custom SideMenuController). So we drive visibility geometrically — the handles
  // are shown only while the pointer is within the editor's content region (the
  // text column plus the left gutter that holds the handles). Moving the pointer
  // to the header, the sidebar, or the empty space above/below the document hides
  // them, matching Notion. Native HTML5 drag doesn't fire `pointermove`, so a
  // block drag is naturally unaffected; BlockNote still positions the handles on
  // the hovered block within the region.
  useEffect(() => {
    if (!editable) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tt = (editor as any)._tiptapEditor;
    const root: HTMLElement | undefined = tt?.view?.dom;
    if (!root) return;
    let raf = 0;
    const onMove = (e: MouseEvent) => {
      if (raf) return;
      const { clientX: x, clientY: y } = e;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const b = root.getBoundingClientRect();
        // Gutter (~44px) holds the ＋/⠿; a little right slack keeps the handle
        // reachable when the pointer drifts just past the text column.
        const inside = x >= b.left - 60 && x <= b.right + 8 && y >= b.top && y <= b.bottom;
        document.body.classList.toggle('wf-sidemenu-hidden', !inside);
      });
    };
    document.addEventListener('pointermove', onMove as EventListener, true);
    return () => {
      document.removeEventListener('pointermove', onMove as EventListener, true);
      if (raf) cancelAnimationFrame(raf);
      document.body.classList.remove('wf-sidemenu-hidden');
    };
  }, [editor, editable]);

  // Column drop-zone affordances. While a block is dragged, light up every column
  // as a drop zone (`.wf-dnd-active` on the PM root) and mark the column under the
  // pointer as the active target — or invalid, when a whole `columnList` is being
  // dragged (it can't nest inside a column). Pure editor UI: only CSS-hook classes
  // are toggled, nothing is written to the document. See editor.css.
  useEffect(() => {
    if (!editable) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tt = (editor as any)._tiptapEditor;
    const root: HTMLElement | undefined = tt?.view?.dom;
    if (!root) return;

    let sourceChecked = false;
    let invalidSource = false;

    // The dragged block is reflected in the PM selection (BlockNote sets it on
    // dragstart). A whole columnList can't be nested inside a column.
    const isColumnListDrag = (): boolean => {
      try {
        const sel = tt.view.state.selection;
        const node = sel.node ?? sel.$from?.nodeAfter ?? null;
        return node?.type?.name === 'columnList';
      } catch {
        return false;
      }
    };

    const clearTargets = () => {
      root
        .querySelectorAll('.wf-drop-target, .wf-drop-invalid')
        .forEach((el) => el.classList.remove('wf-drop-target', 'wf-drop-invalid'));
    };

    const onDragOver = (e: DragEvent) => {
      root.classList.add('wf-dnd-active');
      if (!sourceChecked) {
        invalidSource = isColumnListDrag();
        sourceChecked = true;
      }
      const col = (e.target as HTMLElement | null)?.closest?.('.bn-block-column') as
        | HTMLElement
        | null;
      const cls = invalidSource ? 'wf-drop-invalid' : 'wf-drop-target';
      if (col?.classList.contains(cls)) return; // already marked (re-added if reconciled)
      clearTargets();
      if (col) col.classList.add(cls);
    };

    const onDragCleanup = () => {
      root.classList.remove('wf-dnd-active');
      clearTargets();
      sourceChecked = false;
      invalidSource = false;
    };

    // dragover fires over the editor content; end/drop go on document so a drag
    // that ends outside the editor (or is cancelled) still clears the state.
    root.addEventListener('dragover', onDragOver);
    document.addEventListener('dragend', onDragCleanup);
    document.addEventListener('drop', onDragCleanup);
    return () => {
      root.removeEventListener('dragover', onDragOver);
      document.removeEventListener('dragend', onDragCleanup);
      document.removeEventListener('drop', onDragCleanup);
      onDragCleanup();
    };
  }, [editor, editable]);

  // `@` menu: insert a page-mention inline chip that the server turns into a backlink.
  const getMentionItems = (query: string): DefaultReactSuggestionItem[] =>
    (tree ?? [])
      .filter(
        (p) => p.id !== pageId && (p.title || 'Untitled').toLowerCase().includes(query.toLowerCase()),
      )
      .slice(0, 10)
      .map((p) => ({
        title: p.title || 'Untitled',
        icon: <span className="text-sm">{p.icon || '📄'}</span>,
        onItemClick: () =>
          editor.insertInlineContent([
            { type: 'mention', props: { pageId: p.id, title: p.title || 'Untitled', icon: p.icon ?? '' } },
            ' ',
          ]),
      }));

  // Shared block-type context: both the "/" slash menu and the "+" convert menu
  // are built from the single `BLOCK_TYPE_DEFS` registry (blockTypes.tsx) via
  // this context, so the two menus can never drift apart.
  const blockCtx: BlockTypeCtx = useMemo(
    () => ({
      editor,
      workspaceId,
      pageId,
      invalidateTree: () => invalidate.tree(workspaceId),
      toast: (msg: string) => toast.success(msg),
      navigate,
      currentUserName: user.name,
    }),
    [editor, workspaceId, pageId, invalidate, navigate, user.name],
  );

  // Slash menu items come straight from the shared registry (insert verb).
  const getSlashItems = async (query: string): Promise<DefaultReactSuggestionItem[]> =>
    filterSuggestionItems(getSlashBlockItems(blockCtx), query);

  const saveTimer = useRef<ReturnType<typeof setTimeout>>();
  const latest = useRef<unknown>(initialContent);
  // Serialized snapshot of the note's state when it was OPENED (captured after the
  // collab seed settles, so it reflects the normalized document, not the raw seed).
  // A version snapshot is written on leave only when the current state differs from
  // this baseline — i.e. only when the user actually edited. Merely viewing a page
  // and switching away writes nothing. See the unmount effect below.
  const openedBaseline = useRef<string | null>(null);

  // Seed the shared doc from the canonical JSON the first time it opens empty.
  // We seed on Yjs sync, but also on a short fallback timer so content always
  // renders even if the collaboration socket is slow or unavailable.
  useEffect(() => {
    let done = false;
    const seed = () => {
      if (done) return;
      const fragment = doc.getXmlFragment('document');
      const meta = doc.getMap('meta');
      if (
        fragment.length === 0 &&
        !meta.get('seeded') &&
        Array.isArray(initialContent) &&
        initialContent.length > 0
      ) {
        meta.set('seeded', true);
        try {
          editor.replaceBlocks(editor.document, initialContent as never);
          // The initial hydration is not a user edit — drop it from the collab
          // undo stack so opening a page and pressing Ctrl+Z can't wipe it.
          clearCollabUndoHistory(editor);
        } catch {
          /* content shape drift — ignore */
        }
      }
      done = true;
      // Capture the opened state as the snapshot baseline. handleChange may have
      // already run (the seed's replaceBlocks fires onChange), so we (re)sync
      // `latest` here too — this is the reference point "no edits since open".
      latest.current = editor.document;
      openedBaseline.current = JSON.stringify(editor.document);
      setDocEmpty(isBlocksEmpty(editor.document));
      onStats?.(computeStats(editor.document));
      onHeadings?.(extractHeadings(editor.document));
    };
    if (provider.isSynced) seed();
    else provider.on('synced', seed);
    const fallback = setTimeout(seed, 1500);
    return () => {
      clearTimeout(fallback);
      provider.off('synced', seed);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor]);

  // Leaving the note (this component is keyed by pageId, so switching pages/views
  // unmounts it) is the ONLY trigger that writes a version-history snapshot — the
  // Notion "save last state on switch" behaviour. We snapshot exactly once, and
  // only when the current state differs from the state the note was opened with,
  // so viewing a page without editing (or switching away twice with no change in
  // between) creates no entry. Content itself still persists via onSave.
  useEffect(() => {
    return () => {
      clearTimeout(saveTimer.current);
      onSave(latest.current);
      const baseline = openedBaseline.current;
      const edited = baseline !== null && JSON.stringify(latest.current) !== baseline;
      if (edited) {
        void api.post('/versions', { pageId, content: latest.current, kind: 'blur' }).catch(() => undefined);
      }
      provider.destroy();
      doc.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleChange = () => {
    const docJson = editor.document;
    latest.current = docJson;
    setDocEmpty(isBlocksEmpty(docJson));
    onStats?.(computeStats(docJson));
    onHeadings?.(extractHeadings(docJson));

    // Persist the live content (not a history snapshot) shortly after edits stop.
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => onSave(docJson), 800);
  };

  // Section reorder driven by the outline's drag-and-drop. Works on the top-level
  // block list; a "section" is a heading plus the following blocks up to the next
  // heading of equal-or-higher level (so sub-headings and body move with it). We
  // apply the change as ONE `replaceBlocks` over just the affected contiguous
  // window, so it flows through the normal editor history (undoable) and the
  // collab doc (persists) without touching either mechanism.
  useEffect(() => {
    if (!reorderRef) return;
    reorderRef.current = (draggedId, beforeId) => {
      type TopBlock = { id: string; type: string; props?: { level?: number } };
      const top = editor.document as unknown as TopBlock[];
      const dStart = top.findIndex((b) => b.id === draggedId);
      if (dStart < 0) return; // heading isn't a top-level block (e.g. indented) — skip
      const dLevel = top[dStart]!.props?.level ?? 1;
      let dEnd = dStart + 1;
      while (dEnd < top.length && !(top[dEnd]!.type === 'heading' && (top[dEnd]!.props?.level ?? 1) <= dLevel)) {
        dEnd++;
      }
      const sectionIds = new Set(top.slice(dStart, dEnd).map((b) => b.id));
      if (beforeId && sectionIds.has(beforeId)) return; // dropping inside its own section

      const full = editor.document; // full block objects (with children/content)
      const section = full.slice(dStart, dEnd);
      const rest = full.filter((b) => !sectionIds.has(b.id));
      let insertAt = beforeId ? rest.findIndex((b) => b.id === beforeId) : rest.length;
      if (insertAt < 0) insertAt = rest.length;
      const next = [...rest.slice(0, insertAt), ...section, ...rest.slice(insertAt)];

      // Replace only the contiguous window that actually moved.
      let lo = 0;
      while (lo < full.length && full[lo]!.id === next[lo]!.id) lo++;
      if (lo === full.length) return; // no-op
      let hi = full.length - 1;
      while (hi >= 0 && full[hi]!.id === next[hi]!.id) hi--;
      editor.replaceBlocks(
        full.slice(lo, hi + 1).map((b) => b.id),
        next.slice(lo, hi + 1) as never,
      );
    };
    return () => {
      reorderRef.current = null;
    };
  });

  // ── Block-type conversion via the side-menu "+" ────────────────────────────
  // A pending conversion of a Page (sub-page reference) that still has content —
  // held here so the confirm dialog renders at the editor level, independent of
  // the ephemeral hover side-menu that triggered it.
  const [convertReq, setConvertReq] = useState<
    { block: any; def: BlockTypeDef; childId: string; title: string } | null
  >(null);

  // Empty-page quick-start affordance. `docEmpty` tracks whether the document is
  // blank; `dismissedEmpty` lets the user wave it away ("Text" / start typing).
  // Both are pure UI — nothing here is written to the document.
  const [docEmpty, setDocEmpty] = useState(() => isBlocksEmpty(initialContent));
  const [dismissedEmpty, setDismissedEmpty] = useState(false);
  const showEmptyState = editable && docEmpty && !dismissedEmpty;

  // Replace a Page block (`pageLink`) with the chosen block type, carrying the
  // page's title as the new block's text, and move the now-unlinked child page
  // to Trash (recoverable).
  const performPageConvert = useCallback(
    async (block: any, def: BlockTypeDef, childId: string, title: string) => {
      await convertBlockType(def, block, blockCtx, title);
      if (childId) {
        await api.del(`/pages/${childId}`).catch(() => undefined);
        await invalidate.tree(workspaceId);
      }
    },
    [blockCtx, invalidate, workspaceId],
  );

  const handleBlockConvert = useCallback(
    async (block: any, def: BlockTypeDef) => {
      // Regular blocks convert in place, preserving their text. This also covers
      // converting a normal block INTO a Page (def.spec.kind === 'page').
      if (block.type !== 'pageLink') {
        await convertBlockType(def, block, blockCtx, blockPlainText(block));
        // The "+" popover stole focus from the editor; hand it back and drop the
        // caret at the end of the converted block so the user can keep typing
        // without re-clicking (the block keeps its id through updateBlock). Only
        // for `simple` block types — `file`/`page`/`action` don't leave an
        // editable text block under the cursor.
        if (def.spec.kind === 'simple') {
          try {
            editor.focus();
            editor.setTextCursorPosition(block.id, 'end');
          } catch {
            /* converted target isn't a text block — nothing to focus */
          }
        }
        return;
      }
      const childId = (block.props?.pageId as string) || '';
      const node = tree?.find((n) => n.id === childId);
      const title = node?.title || (block.props?.title as string) || 'Untitled';
      // Does the linked page hold anything worth warning about?
      let hasContent = !!node?.hasChildren;
      if (!hasContent && childId) {
        try {
          const res = await api.get<{ page: { content: unknown } }>(`/pages/${childId}`);
          hasContent = docText(res.page?.content).trim().length > 0;
        } catch {
          /* if we can't read it, fall through to the confirm dialog to be safe */
          hasContent = true;
        }
      }
      if (hasContent) setConvertReq({ block, def, childId, title });
      else void performPageConvert(block, def, childId, title);
    },
    [editor, blockCtx, tree, performPageConvert],
  );

  // Expose "focus the first content block" so the page title's Enter key can jump
  // straight into the body (Notion-style). Places the caret at the start of the
  // first block; if the first block isn't a text block, just focuses the editor.
  useEffect(() => {
    if (!focusEditorRef) return;
    focusEditorRef.current = () => {
      try {
        editor.focus();
        const first = editor.document?.[0] as { id?: string } | undefined;
        if (first?.id) editor.setTextCursorPosition(first.id, 'start');
      } catch {
        /* first block isn't a text block — focus alone is enough */
      }
    };
    return () => {
      if (focusEditorRef) focusEditorRef.current = null;
    };
  }, [editor, focusEditorRef]);

  // Expose "parse a file and append its blocks" so the page-menu Import dialog can
  // push content into the live document. Parsing (importContent.ts) needs the live
  // editor for Markdown/HTML, so it lives here. Appends after the last block, or
  // replaces the doc when it's just one empty paragraph, then focuses the first
  // imported block. Rejects with a user-facing message the dialog shows.
  useEffect(() => {
    if (!importRef) return;
    importRef.current = async (file: File) => {
      const { blocks } = await parseFileToBlocks(file, editor);
      if (!blocks.length) return 0;
      const doc = editor.document as any[];
      const last = doc[doc.length - 1];
      const inserted = isBlocksEmpty(doc)
        ? editor.replaceBlocks(doc.map((b) => b.id), blocks as never).insertedBlocks
        : editor.insertBlocks(blocks as never, last, 'after');
      const first = inserted?.[0];
      if (first?.id) {
        try {
          editor.setTextCursorPosition(first.id, 'start');
        } catch {
          /* first imported block isn't a text block — no caret to place */
        }
      }
      return blocks.length;
    };
    return () => {
      if (importRef) importRef.current = null;
    };
  }, [editor, importRef]);

  // The "+" add-block verb: insert a brand-new block after the clicked one
  // (never converts it). Distinct from `handleBlockConvert` above (§17–19).
  const handleAddBlock = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (block: any, def: BlockTypeDef) => {
      void addBlockAfter(def, block, blockCtx);
    },
    [blockCtx],
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const renderSideMenu = useCallback(
    (menuProps: any) => (
      <WeftSideMenu
        {...menuProps}
        onConvert={handleBlockConvert}
        onAddBlock={handleAddBlock}
        ctx={blockCtx}
        tree={tree ?? []}
        pageUpdatedAt={pageUpdatedAt}
      />
    ),
    [handleBlockConvert, handleAddBlock, blockCtx, tree, pageUpdatedAt],
  );

  return (
    <>
    {editable && <MarqueeSelect editor={editor} />}
    {editable && <CodeLanguagePicker editor={editor} />}
    {editable && <CodeCopyButton editor={editor} />}
    <div className="relative" ref={contentWrapRef}>
    <BlockNoteView
      editor={editor}
      editable={editable}
      onChange={handleChange}
      theme={effectiveTheme(theme)}
      className="weft-page-content"
      // BlockNoteView always renders BlockNoteDefaultUI *alongside* these children,
      // so leaving the defaults on would mount a second menu on top of ours.
      // Disable the three we replace below; the default emoji picker (":") stays.
      slashMenu={false}
      formattingToolbar={false}
      sideMenu={false}
    >
      {/* Formatting toolbar: BlockNote defaults + the per-selection font-family
       * picker (docs/STYLEGUIDE.md §3.4). */}
      <FormattingToolbarController formattingToolbar={WeftFormattingToolbar} />

      {/* Side menu: the "+" converts the current block's type (no blank-line
       * insertion) and the handles are vertically centered (placement "left"). */}
      <SideMenuController sideMenu={renderSideMenu} floatingOptions={{ placement: 'left' }} />

      {/* Slash menu: viewport-aware (BlockNote flips it up near the bottom) and
       * internally scrollable so every block category stays reachable. */}
      <SuggestionMenuController
        triggerCharacter="/"
        getItems={getSlashItems}
        suggestionMenuComponent={SlashMenu}
      />
      <SuggestionMenuController triggerCharacter="@" getItems={async (q) => getMentionItems(q)} />

      {convertReq && (
        <PageConvertDialog
          pageTitle={convertReq.title}
          onCancel={() => setConvertReq(null)}
          onConfirm={() => {
            const req = convertReq;
            setConvertReq(null);
            void performPageConvert(req.block, req.def, req.childId, req.title);
          }}
        />
      )}
    </BlockNoteView>
    {/* Quick-start band at the bottom of the editor area (empty pages only). */}
    {showEmptyState && (
      <EmptyState editor={editor} ctx={blockCtx} onDismiss={() => setDismissedEmpty(true)} />
    )}
    </div>
    </>
  );
}
