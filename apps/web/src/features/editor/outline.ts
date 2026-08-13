/** Flatten a BlockNote document into an ordered list of its headings, used to
 * drive the right-side outline / table of contents. Works from the live
 * `editor.document` (array of blocks with nested `children`). */

export interface OutlineHeading {
  id: string;
  level: number;
  text: string;
}

type AnyBlock = {
  id?: string;
  type?: string;
  props?: { level?: number };
  content?: unknown;
  children?: AnyBlock[];
};

function inlineText(content: unknown): string {
  if (!Array.isArray(content)) return '';
  return content
    .map((n: any) => (n?.type === 'link' ? inlineText(n.content) : (n?.text ?? '')))
    .join('')
    .trim();
}

export function extractHeadings(blocks: unknown): OutlineHeading[] {
  const out: OutlineHeading[] = [];
  const walk = (list: AnyBlock[]) => {
    for (const b of list) {
      if (b.type === 'heading' && b.id) {
        out.push({ id: b.id, level: b.props?.level ?? 1, text: inlineText(b.content) || 'Untitled heading' });
      }
      if (Array.isArray(b.children) && b.children.length) walk(b.children);
    }
  };
  if (Array.isArray(blocks)) walk(blocks as AnyBlock[]);
  return out;
}
