import { type ReactElement } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Star, Copy, Link2, Trash2, FileStack, Lock, Unlock } from 'lucide-react';
import { Menu } from '@/components/ui/Menu';
import { api } from '@/lib/api';
import { useInvalidate } from '@/lib/queries';
import { useWorkspace } from './workspace';
import { toast } from '@/lib/toast';

/** Per-page context menu used in the sidebar and the page header. */
export function PageRowMenu({
  pageId,
  title,
  isFavorite,
  isLocked,
  children,
}: {
  pageId: string;
  title: string;
  isFavorite?: boolean;
  isLocked?: boolean;
  children: ReactElement;
}) {
  const { workspaceId } = useWorkspace();
  const invalidate = useInvalidate();
  const navigate = useNavigate();
  const { pageId: activeId } = useParams();

  const refresh = async () => {
    await invalidate.tree(workspaceId);
    invalidate.page(pageId);
  };

  return (
    <Menu
      align="end"
      trigger={children}
      items={[
        {
          label: isFavorite ? 'Remove from favorites' : 'Add to favorites',
          icon: <Star size={15} className={isFavorite ? 'fill-madder text-madder' : ''} />,
          onClick: async () => {
            await api.patch(`/pages/${pageId}`, { isFavorite: !isFavorite });
            void refresh();
          },
        },
        {
          label: isLocked ? 'Unlock page' : 'Lock page',
          icon: isLocked ? <Unlock size={15} /> : <Lock size={15} />,
          onClick: async () => {
            await api.patch(`/pages/${pageId}`, { isLocked: !isLocked });
            void refresh();
          },
        },
        {
          label: 'Duplicate',
          icon: <Copy size={15} />,
          onClick: async () => {
            await api.post(`/pages/${pageId}/duplicate`);
            await invalidate.tree(workspaceId);
            toast.success('Page duplicated');
          },
        },
        {
          label: 'Save as template',
          icon: <FileStack size={15} />,
          onClick: async () => {
            await api.post(`/pages/${pageId}/save-as-template`);
            toast.success('Saved as a template');
          },
        },
        {
          label: 'Copy link',
          icon: <Link2 size={15} />,
          onClick: () => {
            void navigator.clipboard.writeText(`${location.origin}/p/${pageId}`);
            toast.success('Link copied');
          },
        },
        { divider: true, label: '' },
        {
          label: 'Move to trash',
          icon: <Trash2 size={15} />,
          danger: true,
          onClick: async () => {
            await api.del(`/pages/${pageId}`);
            await invalidate.tree(workspaceId);
            toast.success(`"${title || 'Untitled'}" moved to trash`);
            if (activeId === pageId) navigate('/');
          },
        },
      ]}
    />
  );
}
