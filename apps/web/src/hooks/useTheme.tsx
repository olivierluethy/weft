import { create } from 'zustand';
import { useEffect } from 'react';

type Theme = 'light' | 'dark' | 'system';

interface ThemeState {
  theme: Theme;
  setTheme: (t: Theme) => void;
  cycle: () => void;
}

const KEY = 'weft-theme';

function apply(theme: Theme) {
  const root = document.documentElement;
  if (theme === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', theme);
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: (localStorage.getItem(KEY) as Theme) || 'system',
  setTheme: (theme) => {
    localStorage.setItem(KEY, theme);
    apply(theme);
    set({ theme });
  },
  cycle: () => {
    const order: Theme[] = ['light', 'dark', 'system'];
    const next = order[(order.indexOf(get().theme) + 1) % order.length]!;
    get().setTheme(next);
  },
}));

/** Applies the persisted theme on mount. Mount once near the app root. */
export function useThemeEffect() {
  const theme = useThemeStore((s) => s.theme);
  useEffect(() => apply(theme), [theme]);
}
