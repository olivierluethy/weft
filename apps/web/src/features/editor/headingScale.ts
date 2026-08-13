/* Single source of truth for the heading type scale (docs/STYLEGUIDE.md §3.2).
 *
 * Both render layers read from THIS object so heading sizes can never drift
 * between "editing" and "viewing":
 *   1. The live editor + in-app read-only view — same `.weft-page-content` DOM,
 *      styled from the CSS custom properties injected by `injectHeadingScale()`.
 *   2. Every export (HTML / print-PDF / DOCX) — `exporters.ts` imports the same
 *      numbers instead of hard-coding them.
 *
 * Sizes are in rem against the 16px document root, so 2.25rem === 36px etc.
 */

export type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;

export interface TypeStep {
  /** font-size in rem (root = 16px) */
  size: number;
  /** unitless line-height */
  lineHeight: number;
  /** font-weight */
  weight: number;
  /** margin above the block, in rem */
  spaceAbove: number;
}

export const HEADING_LEVELS: readonly HeadingLevel[] = [1, 2, 3, 4, 5, 6];

/** The exact stepped scale. Each level is unmistakably larger than the next. */
export const HEADING_SCALE: Record<HeadingLevel, TypeStep> = {
  1: { size: 2.25, lineHeight: 1.2, weight: 700, spaceAbove: 2 },
  2: { size: 1.75, lineHeight: 1.25, weight: 700, spaceAbove: 1.6 },
  3: { size: 1.375, lineHeight: 1.3, weight: 600, spaceAbove: 1.3 },
  4: { size: 1.125, lineHeight: 1.4, weight: 600, spaceAbove: 1.1 },
  5: { size: 1, lineHeight: 1.4, weight: 600, spaceAbove: 1 },
  6: { size: 0.875, lineHeight: 1.4, weight: 600, spaceAbove: 1 },
};

/** Base body / normal text. */
export const BODY_STEP: TypeStep = { size: 1, lineHeight: 1.6, weight: 400, spaceAbove: 0.5 };

/** Rounded, human labels for the level pickers (slash menu, toolbar). */
export const HEADING_LABELS: Record<HeadingLevel, string> = {
  1: 'Heading 1',
  2: 'Heading 2',
  3: 'Heading 3',
  4: 'Heading 4',
  5: 'Heading 5',
  6: 'Heading 6',
};

/** `:root { --h1-size: … }` declarations derived from the scale above. */
export function headingScaleVars(): string {
  const decls: string[] = [];
  for (const lvl of HEADING_LEVELS) {
    const s = HEADING_SCALE[lvl];
    decls.push(
      `--h${lvl}-size:${s.size}rem`,
      `--h${lvl}-lh:${s.lineHeight}`,
      `--h${lvl}-weight:${s.weight}`,
      `--h${lvl}-space:${s.spaceAbove}rem`,
    );
  }
  decls.push(
    `--body-size:${BODY_STEP.size}rem`,
    `--body-lh:${BODY_STEP.lineHeight}`,
    `--body-space:${BODY_STEP.spaceAbove}rem`,
  );
  return `:root{${decls.join(';')}}`;
}

/** Plain `h1..h6` CSS block for standalone export documents. */
export function headingScaleExportCss(): string {
  const rules = HEADING_LEVELS.map((lvl) => {
    const s = HEADING_SCALE[lvl];
    return `h${lvl}{font-size:${s.size}rem;line-height:${s.lineHeight};font-weight:${s.weight};margin:${s.spaceAbove}rem 0 .3rem}`;
  });
  return rules.join('');
}

/** Idempotently publish the scale as CSS custom properties on `document.head`,
 * so the static editor CSS (`var(--h1-size)` …) resolves from this one source.
 * Runs once at module load; the `<style>` owns the tokens (index.css no longer
 * defines them), guaranteeing editor and exports can never diverge. */
export function injectHeadingScale(): void {
  if (typeof document === 'undefined') return;
  const id = 'weft-heading-scale';
  if (document.getElementById(id)) return;
  const style = document.createElement('style');
  style.id = id;
  style.textContent = headingScaleVars();
  document.head.appendChild(style);
}

injectHeadingScale();
