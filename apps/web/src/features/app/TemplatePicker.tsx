import { useQuery } from '@tanstack/react-query';
import { FileText, FilePlus } from 'lucide-react';
import { api } from '@/lib/api';
import { PageIcon } from '@/features/editor/pickers/IconPicker';

interface Template {
  id: string;
  title: string;
  icon: string | null;
}

/** Popover content listing a workspace's templates (and optionally a blank
 * option). `onPick(undefined)` = blank page; `onPick(id)` = create from template. */
export function TemplatePicker({
  workspaceId,
  onPick,
  includeBlank = false,
}: {
  workspaceId: string;
  onPick: (templateId?: string) => void;
  includeBlank?: boolean;
}) {
  const { data } = useQuery({
    queryKey: ['templates', workspaceId],
    enabled: !!workspaceId,
    queryFn: () => api.get<{ templates: Template[] }>(`/workspaces/${workspaceId}/templates`),
  });
  const templates = data?.templates ?? [];

  return (
    <div className="w-[248px] rounded-md border border-line bg-surface p-1 shadow-md">
      <p className="px-2 pb-1 pt-1.5 text-2xs font-semibold uppercase tracking-wide text-ink-faint">
        {includeBlank ? 'New page' : 'From a template'}
      </p>
      {includeBlank && (
        <button
          onClick={() => onPick(undefined)}
          className="flex w-full items-center gap-2.5 rounded px-2 py-1.5 text-left text-sm text-ink transition hover:bg-sunk"
        >
          <FilePlus size={16} className="text-ink-faint" /> Blank page
        </button>
      )}
      {includeBlank && templates.length > 0 && <div className="my-1 h-px bg-line" />}
      {templates.map((t) => (
        <button
          key={t.id}
          onClick={() => onPick(t.id)}
          className="flex w-full items-center gap-2.5 rounded px-2 py-1.5 text-left text-sm text-ink transition hover:bg-sunk"
        >
          <span className="flex h-4 w-4 items-center justify-center">
            {t.icon ? <PageIcon icon={t.icon} size={16} /> : <FileText size={15} className="text-ink-faint" />}
          </span>
          <span className="truncate">{t.title || 'Untitled'}</span>
        </button>
      ))}
      {templates.length === 0 && (
        <p className="px-2 py-3 text-xs leading-relaxed text-ink-faint">
          No templates yet. Open a page's <span className="font-medium">⋯</span> menu →{' '}
          <span className="font-medium">Save as template</span>.
        </p>
      )}
    </div>
  );
}
