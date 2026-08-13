import { useRef, useState } from 'react';
import { Upload, Link2, ImageIcon, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { ImageSearch } from './ImageSearch';

type Tab = 'search' | 'upload' | 'url';

export function CoverPicker({
  onPick,
  onRemove,
  workspaceId,
}: {
  onPick: (url: string) => void;
  onRemove: () => void;
  workspaceId: string;
}) {
  const [tab, setTab] = useState<Tab>('search');
  const [url, setUrl] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const upload = async (file: File) => {
    const { upload } = await api.upload<{ upload: { url: string } }>('/uploads', file, {
      workspaceId,
    });
    onPick(location.origin + upload.url);
  };

  return (
    <div className="w-[380px] rounded-md border border-line bg-surface shadow-md">
      <div className="flex items-center justify-between border-b border-line px-1.5 py-1">
        <div className="flex">
          <Tab_ icon={<ImageIcon size={14} />} label="Gallery" active={tab === 'search'} onClick={() => setTab('search')} />
          <Tab_ icon={<Upload size={14} />} label="Upload" active={tab === 'upload'} onClick={() => setTab('upload')} />
          <Tab_ icon={<Link2 size={14} />} label="Link" active={tab === 'url'} onClick={() => setTab('url')} />
        </div>
        <button
          onClick={onRemove}
          className="flex items-center gap-1 rounded px-2 py-1 text-xs text-ink-faint transition hover:bg-sunk hover:text-danger"
        >
          <Trash2 size={13} /> Remove
        </button>
      </div>
      <div className="p-3">
        {tab === 'search' && <ImageSearch onPick={onPick} />}
        {tab === 'upload' && (
          <div className="py-6 text-center">
            <Button variant="secondary" onClick={() => fileRef.current?.click()}>
              <Upload size={15} /> Choose an image
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
            />
          </div>
        )}
        {tab === 'url' && (
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (url.trim()) onPick(url.trim());
            }}
          >
            <input
              className="input"
              placeholder="https://…/image.jpg"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
            <Button type="submit" variant="primary">
              Add
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}

function Tab_({
  icon,
  label,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition',
        active ? 'bg-thread-soft text-thread' : 'text-ink-muted hover:bg-sunk',
      )}
    >
      {icon} {label}
    </button>
  );
}
