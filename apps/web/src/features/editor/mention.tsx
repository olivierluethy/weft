import {
  BlockNoteSchema,
  defaultBlockSpecs,
  defaultInlineContentSpecs,
  defaultStyleSpecs,
} from '@blocknote/core';
import { createReactInlineContentSpec } from '@blocknote/react';
import { useNavigate } from 'react-router-dom';
import { PageIcon } from './pickers/IconPicker';
import { FontStyle } from './fontStyle';
import { Heading6 } from './heading';
import { PageLink } from './pageLink';
import { weftCustomBlockSpecs, weftCustomInlineSpecs } from './blocks';

/** Inline chip for an @page reference. Serialises as
 * `{ type: 'mention', props: { pageId, title } }` — the shape the server's
 * backlink extractor looks for. Clicking navigates to the referenced page. */
function MentionChip({ pageId, title, icon }: { pageId: string; title: string; icon: string }) {
  const navigate = useNavigate();
  return (
    <span
      role="link"
      tabIndex={0}
      onClick={() => pageId && navigate(`/p/${pageId}`)}
      onKeyDown={(e) => e.key === 'Enter' && pageId && navigate(`/p/${pageId}`)}
      className="inline-flex cursor-pointer items-center gap-0.5 rounded-sm bg-thread-soft px-1 py-px align-baseline font-sans text-[0.92em] font-medium text-thread transition hover:brightness-95"
      contentEditable={false}
    >
      {icon ? <PageIcon icon={icon} size={13} /> : <span aria-hidden>@</span>}
      {title || 'Untitled'}
    </span>
  );
}

export const Mention = createReactInlineContentSpec(
  {
    type: 'mention',
    propSchema: {
      pageId: { default: '' },
      title: { default: '' },
      icon: { default: '' },
    },
    content: 'none',
  },
  {
    render: (props) => (
      <MentionChip
        pageId={props.inlineContent.props.pageId}
        title={props.inlineContent.props.title}
        icon={props.inlineContent.props.icon}
      />
    ),
  },
);

/** Editor schema = defaults + Weft's custom specs:
 *  - `heading` block widened to six levels (docs/STYLEGUIDE.md §3.2) — overrides
 *    BlockNote's default, which caps `level` at 1–3,
 *  - `pageLink` block (sub-page reference, docs/STYLEGUIDE.md §6),
 *  - inline `mention` chip (@page reference → backlink),
 *  - inline `font` style (per-selection font family, docs/STYLEGUIDE.md §3.4). */
export const weftSchema = BlockNoteSchema.create({
  blockSpecs: {
    ...defaultBlockSpecs,
    heading: Heading6,
    pageLink: PageLink,
    ...weftCustomBlockSpecs,
  },
  inlineContentSpecs: {
    ...defaultInlineContentSpecs,
    mention: Mention,
    ...weftCustomInlineSpecs,
  },
  styleSpecs: {
    ...defaultStyleSpecs,
    font: FontStyle,
  },
});
