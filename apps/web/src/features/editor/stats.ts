import { READING_WPM } from '@weft/shared';

export interface DocStats {
  words: number;
  characters: number;
  charactersNoSpaces: number;
  sentences: number;
  readingMinutes: number;
}

/** Pull plain text from a BlockNote document (array of blocks). */
export function docText(content: unknown): string {
  const out: string[] = [];
  const inline = (nodes: any): void => {
    if (!Array.isArray(nodes)) return;
    for (const n of nodes) {
      if (typeof n === 'string') out.push(n);
      else if (n?.type === 'text' && typeof n.text === 'string') out.push(n.text);
      else if (Array.isArray(n?.content)) inline(n.content);
      else if (n?.text) out.push(String(n.text));
    }
  };
  const block = (b: any): void => {
    if (!b) return;
    if (Array.isArray(b.content)) inline(b.content);
    else if (typeof b.content === 'string') out.push(b.content);
    if (Array.isArray(b.children)) b.children.forEach(block);
  };
  const blocks = Array.isArray(content) ? content : (content as any)?.content;
  if (Array.isArray(blocks)) blocks.forEach(block);
  return out.join(' ').replace(/\s+/g, ' ').trim();
}

export function computeStats(content: unknown): DocStats {
  const text = docText(content);
  const words = text ? text.split(/\s+/).filter(Boolean).length : 0;
  const sentences = text ? (text.match(/[.!?]+(\s|$)/g) || []).length : 0;
  return {
    words,
    characters: text.length,
    charactersNoSpaces: text.replace(/\s/g, '').length,
    sentences: Math.max(sentences, words > 0 ? 1 : 0),
    readingMinutes: words > 0 ? Math.max(1, Math.round(words / READING_WPM)) : 0,
  };
}
