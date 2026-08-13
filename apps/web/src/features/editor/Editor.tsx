import { useEffect, useMemo, useRef } from 'react';
import * as Y from 'yjs';
import { HocuspocusProvider } from '@hocuspocus/provider';
import { useCreateBlockNote } from '@blocknote/react';
import { BlockNoteView } from '@blocknote/mantine';
import '@blocknote/mantine/style.css';
import './editor.css';
import { api } from '@/lib/api';
import { hashHue } from '@/lib/utils';
import { computeStats, type DocStats } from './stats';
import { useThemeStore } from '@/hooks/useTheme';
import { SNAPSHOT_DEBOUNCE_MS } from '@weft/shared';

const colorFor = (id: string) => `hsl(${hashHue(id)} 55% 45%)`;

function effectiveTheme(pref: string): 'light' | 'dark' {
  if (pref === 'dark') return 'dark';
  if (pref === 'light') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function Editor({
  pageId,
  workspaceId,
  initialContent,
  editable,
  user,
  onSave,
  onStats,
}: {
  pageId: string;
  workspaceId: string;
  initialContent: unknown;
  editable: boolean;
  user: { id: string; name: string };
  onSave: (doc: unknown) => void;
  onStats?: (stats: DocStats) => void;
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

  const editor = useCreateBlockNote({
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

  const saveTimer = useRef<ReturnType<typeof setTimeout>>();
  const snapTimer = useRef<ReturnType<typeof setTimeout>>();
  const latest = useRef<unknown>(initialContent);

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
        } catch {
          /* content shape drift — ignore */
        }
      }
      done = true;
      onStats?.(computeStats(editor.document));
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

  // Persist on unmount (page-leave / blur equivalent).
  useEffect(() => {
    return () => {
      clearTimeout(saveTimer.current);
      clearTimeout(snapTimer.current);
      onSave(latest.current);
      void api.post('/versions', { pageId, content: latest.current, kind: 'blur' }).catch(() => undefined);
      provider.destroy();
      doc.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleChange = () => {
    const docJson = editor.document;
    latest.current = docJson;
    onStats?.(computeStats(docJson));

    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => onSave(docJson), 800);

    clearTimeout(snapTimer.current);
    snapTimer.current = setTimeout(() => {
      void api.post('/versions', { pageId, content: docJson, kind: 'auto' }).catch(() => undefined);
    }, SNAPSHOT_DEBOUNCE_MS);
  };

  return (
    <BlockNoteView
      editor={editor}
      editable={editable}
      onChange={handleChange}
      theme={effectiveTheme(theme)}
      className="weft-page-content"
    />
  );
}
