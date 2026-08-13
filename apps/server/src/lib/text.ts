import { READING_WPM } from '@weft/shared';

/** Recursively pull plain text out of a BlockNote document (array of blocks). */
export function extractText(content: unknown): string {
  const out: string[] = [];
  const walkInline = (nodes: any): void => {
    if (!Array.isArray(nodes)) return;
    for (const n of nodes) {
      if (typeof n === 'string') out.push(n);
      else if (n?.type === 'text' && typeof n.text === 'string') out.push(n.text);
      else if (n?.type === 'link' && Array.isArray(n.content)) walkInline(n.content);
      else if (n?.text) out.push(String(n.text));
    }
  };
  const walkBlock = (block: any): void => {
    if (!block) return;
    if (Array.isArray(block.content)) walkInline(block.content);
    else if (typeof block.content === 'string') out.push(block.content);
    if (Array.isArray(block.children)) block.children.forEach(walkBlock);
  };
  const blocks = Array.isArray(content) ? content : (content as any)?.content;
  if (Array.isArray(blocks)) blocks.forEach(walkBlock);
  return out.join(' ').replace(/\s+/g, ' ').trim();
}

export interface DocStats {
  words: number;
  characters: number;
  charactersNoSpaces: number;
  sentences: number;
  readingMinutes: number;
}

export function computeStats(content: unknown): DocStats {
  const text = extractText(content);
  const words = text ? text.split(/\s+/).filter(Boolean).length : 0;
  const sentences = text ? (text.match(/[.!?]+(\s|$)/g) || []).length : 0;
  return {
    words,
    characters: text.length,
    charactersNoSpaces: text.replace(/\s/g, '').length,
    sentences: Math.max(sentences, words > 0 ? 1 : 0),
    readingMinutes: Math.max(words > 0 ? Math.round(words / READING_WPM) : 0, words > 0 ? 1 : 0),
  };
}

export const wordCount = (content: unknown): number => computeStats(content).words;

/** Extract referenced page ids from `mention` inline nodes (for backlinks). */
export function extractMentions(content: unknown): string[] {
  const ids = new Set<string>();
  const walk = (node: any): void => {
    if (!node || typeof node !== 'object') return;
    if (
      (node.type === 'mention' || node.type === 'pageMention') &&
      (node.props?.pageId || node.pageId)
    ) {
      ids.add(node.props?.pageId ?? node.pageId);
    }
    if (Array.isArray(node.content)) node.content.forEach(walk);
    if (Array.isArray(node.children)) node.children.forEach(walk);
  };
  const blocks = Array.isArray(content) ? content : (content as any)?.content;
  if (Array.isArray(blocks)) blocks.forEach(walk);
  return [...ids];
}
