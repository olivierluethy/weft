import { createReactBlockSpec } from '@blocknote/react';
import { useNavigate } from 'react-router-dom';
import { FileText } from 'lucide-react';
import { useTree } from '@/lib/queries';
import { PageIcon } from './pickers/IconPicker';

/** Rendered body of a sub-page reference block. Shows the child page's icon +
 * title (kept live from the sidebar tree so renames reflect here) and navigates
 * to it on click. A void block — same interaction language as the @-mention chip,
 * promoted to block level (docs/STYLEGUIDE.md §6 "Sub-page block"). */
function PageLinkView({
  pageId,
  workspaceId,
  title,
  icon,
}: {
  pageId: string;
  workspaceId: string;
  title: string;
  icon: string;
}) {
  const navigate = useNavigate();
  const { data: tree } = useTree(workspaceId || null);
  const live = tree?.find((n) => n.id === pageId);
  const displayTitle = live?.title || title || 'Untitled';
  const displayIcon = live?.icon ?? (icon || null);

  return (
    <div
      role="link"
      tabIndex={0}
      contentEditable={false}
      onClick={() => pageId && navigate(`/p/${pageId}`)}
      onKeyDown={(e) => e.key === 'Enter' && pageId && navigate(`/p/${pageId}`)}
      className="group my-0.5 inline-flex max-w-full cursor-pointer select-none items-center gap-2 rounded px-1.5 py-1 align-baseline text-ink transition hover:bg-sunk"
    >
      <span className="flex h-5 w-5 shrink-0 items-center justify-center text-[15px]">
        {displayIcon ? <PageIcon icon={displayIcon} size={18} /> : <FileText size={17} className="text-ink-muted" />}
      </span>
      <span className="truncate underline decoration-line-strong underline-offset-2 group-hover:decoration-ink-muted">
        {displayTitle}
      </span>
    </div>
  );
}

/** `pageLink` block — a child-page reference inserted via the `/page` slash
 * command. Stores the child `pageId` (+ a title/icon fallback for offline
 * render); the child also lives in the sidebar tree via its `parentId`. */
export const PageLink = createReactBlockSpec(
  {
    type: 'pageLink',
    propSchema: {
      pageId: { default: '' },
      workspaceId: { default: '' },
      title: { default: '' },
      icon: { default: '' },
    },
    content: 'none',
  },
  {
    render: (props) => (
      <PageLinkView
        pageId={props.block.props.pageId}
        workspaceId={props.block.props.workspaceId}
        title={props.block.props.title}
        icon={props.block.props.icon}
      />
    ),
  },
);
