import { parseCsv } from '../editor/blockTypes';

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Turn an uploaded file into BlockNote blocks, ready to append to a page. The
 * reciprocal of the exporters (features/export/exporters.ts): every format here
 * is one Weft can actually read, so the Import dialog never promises a format it
 * can't parse (§10 of the brief).
 *
 *   • Markdown / text (.md, .markdown, .txt) → BlockNote's Markdown parser
 *   • HTML (.html, .htm)                     → BlockNote's HTML parser
 *   • Weft JSON (.json)                      → a page export's `content`, verbatim
 *   • CSV (.csv)                             → a single table block
 *
 * Parsing lives here (not in the dialog) because two formats need a live editor
 * instance to parse; the dialog just hands over the File.
 */

/** `accept` attribute for the file input — the formats parseFile can handle. */
export const IMPORT_ACCEPT =
  '.md,.markdown,.txt,.html,.htm,.json,.csv,text/markdown,text/plain,text/html,application/json,text/csv';

/** Human-readable list shown in the dialog. Kept in sync with the branches below. */
export const SUPPORTED_IMPORT_FORMATS = [
  'Markdown (.md, .markdown)',
  'Plain text (.txt)',
  'HTML (.html)',
  'Weft export (.json)',
  'CSV (.csv)',
];

function extension(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot >= 0 ? name.slice(dot + 1).toLowerCase() : '';
}

export interface ParsedImport {
  blocks: any[];
}

/** Parse `file` into blocks using `editor` for Markdown/HTML. Throws an Error
 * with a user-facing message when the file can't be read as a supported format. */
export async function parseFileToBlocks(file: File, editor: any): Promise<ParsedImport> {
  const ext = extension(file.name);
  const text = await file.text();

  if (ext === 'json') {
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error("That file isn't valid JSON.");
    }
    const content = Array.isArray(data)
      ? data
      : data && typeof data === 'object' && Array.isArray((data as any).content)
        ? (data as any).content
        : null;
    if (!content) throw new Error("That JSON isn't a Weft page export.");
    return { blocks: content };
  }

  if (ext === 'csv') {
    const rows = parseCsv(text);
    if (!rows.length) throw new Error('The CSV file is empty.');
    const width = Math.max(...rows.map((r) => r.length));
    return {
      blocks: [
        {
          type: 'table',
          content: {
            type: 'tableContent',
            rows: rows.map((r) => ({
              cells: Array.from({ length: width }, (_, i) => r[i] ?? ''),
            })),
          },
        },
      ],
    };
  }

  if (ext === 'html' || ext === 'htm') {
    const blocks = await editor.tryParseHTMLToBlocks(text);
    if (!blocks?.length) throw new Error("Couldn't read any content from that HTML file.");
    return { blocks };
  }

  // Markdown / plain text (and anything else we optimistically try as Markdown).
  const blocks = await editor.tryParseMarkdownToBlocks(text);
  if (!blocks?.length) throw new Error('There was nothing to import in that file.');
  return { blocks };
}
