import type { Config } from 'tailwindcss';

/** Tailwind consumes the design tokens defined in index.css as CSS variables,
 * so components reference semantic names (bg-surface, text-ink) — never raw hex.
 * The single source of truth for the values is docs/STYLEGUIDE.md. */
const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        thread: {
          DEFAULT: 'var(--thread)',
          hover: 'var(--thread-hover)',
          soft: 'var(--thread-soft)',
        },
        madder: { DEFAULT: 'var(--madder)', soft: 'var(--madder-soft)' },
        paper: 'var(--paper)',
        surface: 'var(--surface)',
        sunk: 'var(--sunk)',
        line: { DEFAULT: 'var(--line)', strong: 'var(--line-strong)' },
        ink: {
          DEFAULT: 'var(--ink)',
          muted: 'var(--ink-muted)',
          faint: 'var(--ink-faint)',
        },
        ok: { DEFAULT: 'var(--ok)', soft: 'var(--ok-soft)' },
        warn: { DEFAULT: 'var(--warn)', soft: 'var(--warn-soft)' },
        danger: { DEFAULT: 'var(--danger)', soft: 'var(--danger-soft)' },
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
        serif: ['Newsreader', 'Georgia', 'serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        '2xs': ['11px', { lineHeight: '16px', fontWeight: '500' }],
        xs: ['12px', { lineHeight: '18px' }],
        sm: ['13px', { lineHeight: '20px' }],
        base: ['15px', { lineHeight: '24px' }],
        lg: ['17px', { lineHeight: '26px' }],
      },
      borderRadius: {
        sm: '4px',
        DEFAULT: '6px',
        md: '8px',
        lg: '12px',
        xl: '16px',
      },
      boxShadow: {
        sm: '0 1px 2px rgba(33,31,28,.05)',
        DEFAULT: '0 2px 8px rgba(33,31,28,.08)',
        md: '0 6px 20px rgba(33,31,28,.10)',
        lg: '0 16px 40px rgba(33,31,28,.16)',
      },
      transitionTimingFunction: {
        standard: 'cubic-bezier(.2,.6,.2,1)',
        enter: 'cubic-bezier(.4,0,.2,1)',
      },
      // Single, documented stacking scale (docs/STYLEGUIDE.md §6.1). Every
      // overlay uses one of these named layers instead of an ad-hoc `z-[n]`,
      // so layering is decided once and stays consistent. Floating layers
      // (menus/popovers/tooltips/toasts) live far above document chrome and,
      // crucially, are all rendered through a portal to <body> so no
      // stacking context (a `sticky`/`backdrop-blur` bar, a `transform`
      // ancestor) can ever trap them below sibling chrome.
      //
      // RESERVED BAND 2000–4000 — BlockNote's in-editor floating UI. The editor
      // library portals its OWN affordances to <body> at hard-coded z-index
      // (side menu / suggestion menu 2000, formatting toolbar 3000, one element
      // 4000). Those are content-level affordances, so every APP overlay below
      // (scrim upward) must sit ABOVE this band — otherwise the editor's hover
      // handles (the "+"/⠿ side menu) bleed over app popovers like the page
      // emoji picker. Do NOT place app overlays inside 2000–4000.
      zIndex: {
        header: '20', // in-flow sticky page/section headers
        'scrim-low': '30', // mobile sidebar backdrop, floating reopen button
        sidebar: '40', // mobile sidebar drawer
        peek: '60', // docked side-peek panel + its scrim
        // — reserved 2000–4000: BlockNote editor floating UI (see note above) —
        scrim: '5000', // modals, dialogs, full-screen panels (portalled)
        overlay: '6000', // menus, popovers, dropdowns, context menus (portalled)
        tooltip: '6100', // tooltips (portalled)
        toast: '6200', // toasts (portalled) — always on top
      },
    },
  },
  plugins: [],
};

export default config;
