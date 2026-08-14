import { create } from 'zustand';

/**
 * App-level editor preferences, persisted to localStorage — the same lightweight
 * store shape as `useTheme` (hooks/useTheme.tsx), so there's one preference
 * pattern, not two. Currently just the spellcheck toggle surfaced in the page
 * "…" menu; the applied effect lives in the editor (features/editor/Editor.tsx),
 * which sets the `spellcheck` attribute on the editable so every text field in a
 * note (paragraphs, headings, lists, table cells, code — all inherit from the
 * ProseMirror root) honours the choice.
 */
interface EditorPrefsState {
  /** Whether the browser's native spellcheck runs inside note content. Default on. */
  spellcheck: boolean;
  setSpellcheck: (v: boolean) => void;
  toggleSpellcheck: () => void;
}

const KEY = 'weft-spellcheck';

function loadSpellcheck(): boolean {
  // Default ON, matching the browser default, until the user opts out.
  return localStorage.getItem(KEY) !== 'false';
}

export const useEditorPrefs = create<EditorPrefsState>((set, get) => ({
  spellcheck: loadSpellcheck(),
  setSpellcheck: (spellcheck) => {
    localStorage.setItem(KEY, String(spellcheck));
    set({ spellcheck });
  },
  toggleSpellcheck: () => get().setSpellcheck(!get().spellcheck),
}));
