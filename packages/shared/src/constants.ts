/** Editor content column width bounds (px). Persisted per page. */
export const PAGE_WIDTH = {
  min: 640,
  max: 1100,
  default: 720,
} as const;

/** Version-history snapshot debounce (ms). */
export const SNAPSHOT_DEBOUNCE_MS = 2500;

/** Words-per-minute used for reading-time estimates. */
export const READING_WPM = 220;

/** Cover image aspect (height in px at full width). */
export const COVER_HEIGHT = 240;

export const APP_NAME = 'Weft';
export const APP_TAGLINE = 'A woven web of connected notes.';
