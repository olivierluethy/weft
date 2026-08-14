/**
 * File-format icons (docs/STYLEGUIDE.md §9).
 *
 * lucide has no Markdown / PDF / Word marks, and pairing a real PDF logo with a
 * generic `FileText` would put six icon languages in one list. So this is one
 * drawn primitive used six ways: a document sheet with a folded corner (same
 * 1.5px stroke and 24-unit grid as the lucide icons around it), crossed by a
 * filled band carrying the format's wordmark in a per-format accent.
 *
 * The result is identifiable at a glance — the band colour alone separates PDF
 * from Word before you read anything — while the six obviously belong together.
 * Colour is never the only signal: the wordmark says the same thing (§10).
 */

export type FileFormat = 'md' | 'txt' | 'json' | 'docx' | 'pdf' | 'html';

interface FormatSpec {
  /** Wordmark inside the band. Max 4 characters — it has to stay legible. */
  mark: string;
  /** Band fill. Mirrors the block colour swatches, so it reads as Weft's palette. */
  accent: string;
}

const FORMATS: Record<FileFormat, FormatSpec> = {
  md: { mark: 'MD', accent: 'var(--ink-muted)' },
  txt: { mark: 'TXT', accent: 'var(--ink-faint)' },
  json: { mark: 'JSON', accent: '#c9a227' },
  docx: { mark: 'DOC', accent: '#3f76c4' },
  pdf: { mark: 'PDF', accent: '#c4554d' },
  html: { mark: 'HTML', accent: '#cc772f' },
};

export function FileFormatIcon({
  format,
  size = 20,
  className,
}: {
  format: FileFormat;
  /** Rendered px. 20 is the smallest size at which the wordmark stays readable. */
  size?: number;
  className?: string;
}) {
  const { mark, accent } = FORMATS[format];
  // Four-character marks (JSON, HTML) get a tighter setting so every wordmark
  // fills the same band width instead of overflowing it.
  const fontSize = mark.length >= 4 ? 5.2 : 6.2;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden
      focusable="false"
    >
      {/* Sheet + folded corner, in currentColor so it tracks the row's ink. */}
      <path
        d="M14 2.75H7A2.25 2.25 0 0 0 4.75 5v14A2.25 2.25 0 0 0 7 21.25h10A2.25 2.25 0 0 0 19.25 19V8z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M13.75 2.75V8.25h5.5" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      {/* Format band — deliberately wider than the sheet, the way file-type
          badges have looked since desktop file managers invented them. */}
      <rect x="1.75" y="12.5" width="20.5" height="7.25" rx="1.75" fill={accent} />
      <text
        x="12"
        y="17.35"
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={fontSize}
        fontWeight={700}
        letterSpacing={mark.length >= 4 ? '-0.1' : '0.1'}
        fill="var(--surface)"
        fontFamily="Inter, system-ui, sans-serif"
      >
        {mark}
      </text>
    </svg>
  );
}
