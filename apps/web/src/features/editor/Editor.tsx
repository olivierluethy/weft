import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import * as Y from 'yjs';
import { HocuspocusProvider } from '@hocuspocus/provider';
import {
  useCreateBlockNote,
  SuggestionMenuController,
  FormattingToolbarController,
  SideMenuController,
  getDefaultReactSlashMenuItems,
  type DefaultReactSuggestionItem,
} from '@blocknote/react';
import { filterSuggestionItems, insertOrUpdateBlock } from '@blocknote/core';
import { BlockNoteView } from '@blocknote/mantine';
import '@blocknote/mantine/style.css';
import {
  FileText,
  Heading1,
  Heading2,
  Heading3,
  Heading4,
  Heading5,
  Heading6,
} from 'lucide-react';
import './editor.css';
// Side-effect: publishes the H1–H6 type scale as CSS custom properties.
import { HEADING_LABELS, HEADING_LEVELS, type HeadingLevel } from './headingScale';

const HEADING_ICONS: Record<HeadingLevel, typeof Heading1> = {
  1: Heading1,
  2: Heading2,
  3: Heading3,
  4: Heading4,
  5: Heading5,
  6: Heading6,
};
import { api } from '@/lib/api';
import { hashHue } from '@/lib/utils';
import { computeStats, docText, type DocStats } from './stats';
import { WeftSideMenu, PageConvertDialog, convertSpec, type ConvertTarget } from './WeftSideMenu';
import { useThemeStore } from '@/hooks/useTheme';
import { useTree, useInvalidate } from '@/lib/queries';
import { weftSchema } from './mention';
import { SlashMenu } from './SlashMenu';
import { WeftFormattingToolbar } from './FormattingToolbar';
import { extractHeadings, type OutlineHeading } from './outline';

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
}) {
  const { theme } = useThemeStore();

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

  // Slash menu items = BlockNote defaults + a `/page` command that spawns a real
  // child page (nested in the sidebar tree) and drops a link block to it here.
  const getSlashItems = async (query: string): Promise<DefaultReactSuggestionItem[]> => {
    const defaults = getDefaultReactSlashMenuItems(editor);

    // Provide all six heading levels ourselves. BlockNote only ships Heading 1–3
    // and gates even those behind `checkDefaultBlockTypeInSchema("heading")`, a
    // *reference-equality* check against its built-in heading block. Because
    // Weft swaps in a six-level heading block (weftSchema), that check fails and
    // BlockNote drops ALL its default heading items — which is why only 4–6 (the
    // ones we used to add manually) showed up. So we own the full set here,
    // grouped and ordered H1→H6, and drop any stray built-in heading items.
    const headingGroup = editor.dictionary.slash_menu.heading.group;
    const headingItems: DefaultReactSuggestionItem[] = HEADING_LEVELS.map((level) => {
      const Icon = HEADING_ICONS[level];
      return {
        title: HEADING_LABELS[level],
        subtext: `Level ${level} heading`,
        group: headingGroup,
        aliases: [`h${level}`, `heading${level}`, `heading ${level}`],
        icon: <Icon size={18} />,
        onItemClick: () => insertOrUpdateBlock(editor, { type: 'heading', props: { level: level as never } }),
      };
    });
    const nonHeadingDefaults = defaults.filter((d) => !d.title?.startsWith('Heading'));
    const withHeadings = [...headingItems, ...nonHeadingDefaults];

    const pageItem: DefaultReactSuggestionItem = {
      title: 'Page',
      subtext: 'Create a sub-page nested in this one',
      group: 'Basic blocks',
      icon: <FileText size={18} />,
      onItemClick: async () => {
        try {
          const res = await api.post<{ page: { id: string } }>('/pages', {
            workspaceId,
            parentId: pageId,
          });
          insertOrUpdateBlock(editor, {
            type: 'pageLink',
            props: { pageId: res.page.id, workspaceId, title: '', icon: '' },
          });
          await invalidate.tree(workspaceId);
        } catch {
          /* page creation failed — leave the editor untouched */
        }
      },
    };
    // Keep the "Basic blocks" group contiguous by slotting Page after its last member.
    const lastBasic = withHeadings.map((d) => d.group).lastIndexOf('Basic blocks');
    const merged =
      lastBasic === -1
        ? [...withHeadings, pageItem]
        : [...withHeadings.slice(0, lastBasic + 1), pageItem, ...withHeadings.slice(lastBasic + 1)];
    return filterSuggestionItems(merged, query);
  };

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
    { block: any; target: ConvertTarget; childId: string; title: string } | null
  >(null);

  // Replace a Page block with a paragraph/heading carrying the page's title, and
  // move the now-unlinked child page to Trash (recoverable).
  const performPageConvert = useCallback(
    async (block: any, target: ConvertTarget, childId: string, title: string) => {
      editor.updateBlock(block, {
        ...convertSpec(target),
        content: [{ type: 'text', text: title, styles: {} }],
      } as never);
      if (childId) {
        await api.del(`/pages/${childId}`).catch(() => undefined);
        await invalidate.tree(workspaceId);
      }
    },
    [editor, invalidate, workspaceId],
  );

  const handleBlockConvert = useCallback(
    async (block: any, target: ConvertTarget) => {
      // Regular blocks convert in place, preserving their text.
      if (block.type !== 'pageLink') {
        editor.updateBlock(block, convertSpec(target) as never);
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
      if (hasContent) setConvertReq({ block, target, childId, title });
      else void performPageConvert(block, target, childId, title);
    },
    [editor, tree, performPageConvert],
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const renderSideMenu = useCallback(
    (menuProps: any) => <WeftSideMenu {...menuProps} onConvert={handleBlockConvert} />,
    [handleBlockConvert],
  );

  return (
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
            void performPageConvert(req.block, req.target, req.childId, req.title);
          }}
        />
      )}
    </BlockNoteView>
  );
}
