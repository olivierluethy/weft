/**
 * The editor's colour vocabulary — one list, used at both scales.
 *
 * BlockNote ships the same ten named colours twice: as **block props**
 * (`textColor` / `backgroundColor` on a block) and as **inline styles** (marks on
 * a run of text). Both render from the same `[data-text-color]` /
 * `[data-background-color]` CSS, so "red" must mean the same red whether the user
 * reached it from the six-dots block menu or from a text selection. Keeping the
 * names and swatches here means there is exactly one place that decides what the
 * palette is (docs/STYLEGUIDE.md §6.8).
 */

export interface PaletteColor {
  /** BlockNote's colour name — the value written to the prop / style. */
  name: string;
  /** Human label used in menus and tooltips. */
  label: string;
  /** Representative swatch, for the picker only (the editor paints from CSS). */
  swatch: string;
}

export const PALETTE: PaletteColor[] = [
  { name: 'default', label: 'Default', swatch: 'transparent' },
  { name: 'gray', label: 'Gray', swatch: '#9b9691' },
  { name: 'brown', label: 'Brown', swatch: '#a3835f' },
  { name: 'red', label: 'Red', swatch: '#c4554d' },
  { name: 'orange', label: 'Orange', swatch: '#cc772f' },
  { name: 'yellow', label: 'Yellow', swatch: '#c9a227' },
  { name: 'green', label: 'Green', swatch: '#4f9d69' },
  { name: 'blue', label: 'Blue', swatch: '#3f76c4' },
  { name: 'purple', label: 'Purple', swatch: '#8a5cc4' },
  { name: 'pink', label: 'Pink', swatch: '#c45c93' },
];

/** Look a colour up by BlockNote name; falls back to the default entry. */
export function paletteColor(name: string | null | undefined): PaletteColor {
  return PALETTE.find((c) => c.name === name) ?? PALETTE[0]!;
}
