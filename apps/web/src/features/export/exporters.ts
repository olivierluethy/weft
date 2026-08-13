/** Convert a stored BlockNote document (array of blocks) into export formats.
 * Kept dependency-light and self-contained so it works from persisted JSON
 * without a live editor instance. */

type Inline = any;
type Block = any;
export type PageFont = 'serif' | 'sans' | 'mono';

// Font stacks mirror the in-app page fonts (docs/STYLEGUIDE.md §3.3).
// Headings share the page face and are distinguished by size/weight, matching
// how the live editor renders them.
const BODY_FONT: Record<PageFont, string> = {
  serif: "Georgia, 'Newsreader', serif",
  sans: "Inter, system-ui, sans-serif",
  mono: "'JetBrains Mono', ui-monospace, monospace",
};
const DOCX_FONT: Record<PageFont, string> = {
  serif: 'Georgia',
  sans: 'Calibri',
  mono: 'JetBrains Mono',
};

// ── Inline rendering ─────────────────────────────────────────────────────
function inlineMd(nodes: Inline[]): string {
  if (!Array.isArray(nodes)) return '';
  return nodes
    .map((n) => {
      if (n.type === 'link') return `[${inlineMd(n.content)}](${n.href})`;
      let text = n.text ?? '';
      const s = n.styles ?? {};
      if (s.code) text = `\`${text}\``;
      if (s.bold) text = `**${text}**`;
      if (s.italic) text = `*${text}*`;
      if (s.strike) text = `~~${text}~~`;
      return text;
    })
    .join('');
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
}

function inlineHtml(nodes: Inline[]): string {
  if (!Array.isArray(nodes)) return '';
  return nodes
    .map((n) => {
      if (n.type === 'link') return `<a href="${escapeHtml(n.href)}">${inlineHtml(n.content)}</a>`;
      let text = escapeHtml(n.text ?? '');
      const s = n.styles ?? {};
      if (s.code) text = `<code>${text}</code>`;
      if (s.bold) text = `<strong>${text}</strong>`;
      if (s.italic) text = `<em>${text}</em>`;
      if (s.underline) text = `<u>${text}</u>`;
      if (s.strike) text = `<s>${text}</s>`;
      return text;
    })
    .join('');
}

const inlineText = (nodes: Inline[]): string =>
  Array.isArray(nodes) ? nodes.map((n) => (n.type === 'link' ? inlineText(n.content) : n.text ?? '')).join('') : '';

// ── Markdown ─────────────────────────────────────────────────────────────
export function toMarkdown(blocks: Block[], depth = 0): string {
  if (!Array.isArray(blocks)) return '';
  const pad = '  '.repeat(depth);
  const lines: string[] = [];
  for (const b of blocks) {
    const c = b.content;
    switch (b.type) {
      case 'heading':
        lines.push(`${pad}${'#'.repeat(b.props?.level ?? 1)} ${inlineMd(c)}`);
        break;
      case 'bulletListItem':
        lines.push(`${pad}- ${inlineMd(c)}`);
        break;
      case 'numberedListItem':
        lines.push(`${pad}1. ${inlineMd(c)}`);
        break;
      case 'checkListItem':
        lines.push(`${pad}- [${b.props?.checked ? 'x' : ' '}] ${inlineMd(c)}`);
        break;
      case 'quote':
        lines.push(`${pad}> ${inlineMd(c)}`);
        break;
      case 'codeBlock':
        lines.push(`${pad}\`\`\`${b.props?.language ?? ''}\n${inlineText(c)}\n\`\`\``);
        break;
      case 'image':
        lines.push(`${pad}![${b.props?.caption ?? ''}](${b.props?.url ?? ''})`);
        break;
      case 'divider':
        lines.push(`${pad}---`);
        break;
      case 'table':
        lines.push(tableToMarkdown(b));
        break;
      default:
        lines.push(`${pad}${inlineMd(c)}`);
    }
    if (Array.isArray(b.children) && b.children.length) lines.push(toMarkdown(b.children, depth + 1));
  }
  return lines.join('\n');
}

function tableToMarkdown(block: Block): string {
  const rows: any[] = block.content?.rows ?? [];
  if (!rows.length) return '';
  const render = (cells: any[]) => `| ${cells.map((cell) => inlineMd(cell.content ?? cell)).join(' | ')} |`;
  const head = render(rows[0].cells);
  const sep = `| ${rows[0].cells.map(() => '---').join(' | ')} |`;
  const body = rows.slice(1).map((r: any) => render(r.cells));
  return [head, sep, ...body].join('\n');
}

// ── HTML ─────────────────────────────────────────────────────────────────
export function toHtml(blocks: Block[]): string {
  if (!Array.isArray(blocks)) return '';
  const out: string[] = [];
  let i = 0;
  while (i < blocks.length) {
    const b = blocks[i]!;
    if (b.type === 'bulletListItem' || b.type === 'numberedListItem' || b.type === 'checkListItem') {
      const tag = b.type === 'numberedListItem' ? 'ol' : 'ul';
      const group: Block[] = [];
      while (i < blocks.length && blocks[i]!.type === b.type) group.push(blocks[i++]!);
      out.push(
        `<${tag}>${group
          .map(
            (g) =>
              `<li>${g.type === 'checkListItem' ? `<input type="checkbox" ${g.props?.checked ? 'checked' : ''} disabled/> ` : ''}${inlineHtml(g.content)}${g.children?.length ? toHtml(g.children) : ''}</li>`,
          )
          .join('')}</${tag}>`,
      );
      continue;
    }
    out.push(renderHtmlBlock(b));
    i++;
  }
  return out.join('\n');
}

function renderHtmlBlock(b: Block): string {
  const c = b.content;
  switch (b.type) {
    case 'heading':
      return `<h${b.props?.level ?? 1}>${inlineHtml(c)}</h${b.props?.level ?? 1}>`;
    case 'quote':
      return `<blockquote>${inlineHtml(c)}</blockquote>`;
    case 'codeBlock':
      return `<pre><code>${escapeHtml(inlineText(c))}</code></pre>`;
    case 'image':
      return `<figure><img src="${b.props?.url ?? ''}" alt="${escapeHtml(b.props?.caption ?? '')}"/>${b.props?.caption ? `<figcaption>${escapeHtml(b.props.caption)}</figcaption>` : ''}</figure>`;
    case 'divider':
      return '<hr/>';
    case 'table':
      return tableToHtml(b);
    default:
      return `<p>${inlineHtml(c)}</p>`;
  }
}

function tableToHtml(block: Block): string {
  const rows: any[] = block.content?.rows ?? [];
  return `<table>${rows
    .map(
      (r: any, ri: number) =>
        `<tr>${r.cells
          .map((cell: any) => {
            const inner = inlineHtml(cell.content ?? cell);
            return ri === 0 ? `<th>${inner}</th>` : `<td>${inner}</td>`;
          })
          .join('')}</tr>`,
    )
    .join('')}</table>`;
}

// ── Download helpers ───────────────────────────────────────────────────────
export function download(filename: string, content: string | Blob, mime = 'text/plain') {
  const blob = content instanceof Blob ? content : new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const slug = (title: string) => (title || 'untitled').replace(/[^\w-]+/g, '-').toLowerCase().slice(0, 60);

export function exportMarkdown(title: string, blocks: Block[]) {
  download(`${slug(title)}.md`, `# ${title || 'Untitled'}\n\n${toMarkdown(blocks)}\n`, 'text/markdown');
}

export function exportJson(title: string, page: unknown) {
  download(`${slug(title)}.json`, JSON.stringify(page, null, 2), 'application/json');
}

export function exportHtmlFile(title: string, blocks: Block[], font: PageFont = 'serif') {
  download(`${slug(title)}.html`, htmlDocument(title, blocks, font), 'text/html');
}

export function htmlDocument(title: string, blocks: Block[], font: PageFont = 'serif'): string {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
<style>
  body{font-family:${BODY_FONT[font]};max-width:720px;margin:40px auto;padding:0 20px;color:#211f1c;line-height:1.6}
  h1,h2,h3{font-weight:600;line-height:1.25}
  h1{font-size:30px;letter-spacing:-.02em;margin:1.2em 0 .4em}
  h2{font-size:24px;letter-spacing:-.01em;margin:1.1em 0 .35em}
  h3{font-size:19px;letter-spacing:-.01em;margin:1em 0 .3em}
  code{font-family:'JetBrains Mono',monospace;background:#f4f2ee;padding:2px 5px;border-radius:4px;font-size:.9em}
  pre{background:#f4f2ee;padding:14px;border-radius:8px;overflow:auto}
  blockquote{border-left:3px solid #2e4374;margin:0;padding-left:16px;color:#6b6660}
  img{max-width:100%;border-radius:8px}
  table{border-collapse:collapse;width:100%}th,td{border:1px solid #d8d4cc;padding:6px 10px;text-align:left}
  a{color:#2e4374}hr{border:none;border-top:1px solid #e7e4de;margin:24px 0}
</style></head><body><h1>${escapeHtml(title || 'Untitled')}</h1>${toHtml(blocks)}</body></html>`;
}

/** Print-view based PDF export: opens a print-ready window and triggers print. */
export function exportPdf(title: string, blocks: Block[], font: PageFont = 'serif') {
  const win = window.open('', '_blank');
  if (!win) return;
  win.document.write(htmlDocument(title, blocks, font));
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 350);
}

/** DOCX export via the `docx` library (dynamic import to keep it out of the main bundle). */
export async function exportDocx(title: string, blocks: Block[], font: PageFont = 'serif') {
  const { Document, Packer, Paragraph, HeadingLevel, TextRun } = await import('docx');
  const headingFor = (lvl: number) =>
    lvl === 1 ? HeadingLevel.HEADING_1 : lvl === 2 ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_3;

  const paras: any[] = [new Paragraph({ text: title || 'Untitled', heading: HeadingLevel.TITLE })];
  const walk = (list: Block[], level = 0) => {
    for (const b of list) {
      const text = inlineText(b.content);
      if (b.type === 'heading') paras.push(new Paragraph({ text, heading: headingFor(b.props?.level ?? 1) }));
      else if (b.type === 'bulletListItem')
        paras.push(new Paragraph({ text, bullet: { level } }));
      else if (b.type === 'numberedListItem')
        paras.push(new Paragraph({ text, numbering: { reference: 'nums', level } }));
      else if (b.type === 'checkListItem')
        paras.push(new Paragraph({ children: [new TextRun(`${b.props?.checked ? '☑' : '☐'} ${text}`)] }));
      else if (b.type === 'quote') paras.push(new Paragraph({ text, style: 'IntenseQuote' }));
      else if (b.type === 'codeBlock')
        paras.push(new Paragraph({ children: [new TextRun({ text, font: 'JetBrains Mono' })] }));
      else if (b.type === 'divider') paras.push(new Paragraph({ text: '―――――' }));
      else paras.push(new Paragraph({ text }));
      if (Array.isArray(b.children) && b.children.length) walk(b.children, level + 1);
    }
  };
  walk(blocks);

  const doc = new Document({
    styles: { default: { document: { run: { font: DOCX_FONT[font] } } } },
    sections: [{ children: paras }],
  });
  const blob = await Packer.toBlob(doc);
  download(`${slug(title)}.docx`, blob, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
}
