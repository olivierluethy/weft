import { useRef, useState } from 'react';
import EmojiPicker from '@emoji-mart/react';
import emojiData from '@emoji-mart/data';
import { Smile, Upload, ImageIcon, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';
import { useThemeStore } from '@/hooks/useTheme';
import { ImageSearch } from './ImageSearch';

type Tab = 'emoji' | 'upload' | 'search';

/** Detect whether a stored icon value is an image URL vs an emoji glyph. */
export const isImageIcon = (icon: string | null | undefined) =>
  !!icon && (icon.startsWith('http') || icon.startsWith('/uploads'));

export function PageIcon({ icon, size = 20 }: { icon: string | null; size?: number }) {
  if (!icon) return null;
  if (isImageIcon(icon)) {
    return (
      <img
        src={icon}
        alt=""
        className="rounded object-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  return <span style={{ fontSize: size * 0.9, lineHeight: 1 }}>{icon}</span>;
}

export function IconPicker({
  onPick,
  onRemove,
  workspaceId,
}: {
  onPick: (value: string) => void;
  onRemove: () => void;
  workspaceId: string;
}) {
  const [tab, setTab] = useState<Tab>('emoji');
  const { theme } = useThemeStore();
  const fileRef = useRef<HTMLInputElement>(null);

  const upload = async (file: File) => {
    const { upload } = await api.upload<{ upload: { url: string } }>('/uploads', file, {
      workspaceId,
    });
    onPick(location.origin + upload.url);
  };

  return (
    <div className="w-[340px] rounded-md border border-line bg-surface shadow-md">
      <div className="flex items-center justify-between border-b border-line px-1.5 py-1">
        <div className="flex">
          <TabBtn icon={<Smile size={14} />} label="Emoji" active={tab === 'emoji'} onClick={() => setTab('emoji')} />
          <TabBtn icon={<Upload size={14} />} label="Upload" active={tab === 'upload'} onClick={() => setTab('upload')} />
          <TabBtn icon={<ImageIcon size={14} />} label="Search" active={tab === 'search'} onClick={() => setTab('search')} />
        </div>
        <button
          onClick={onRemove}
          className="flex items-center gap-1 rounded px-2 py-1 text-xs text-ink-faint transition hover:bg-sunk hover:text-danger"
        >
          <Trash2 size={13} /> Remove
        </button>
      </div>

      <div className="p-2">
        {tab === 'emoji' && (
          <EmojiPicker
            data={emojiData}
            theme={theme === 'system' ? 'auto' : theme}
            previewPosition="none"
            skinTonePosition="none"
            onEmojiSelect={(e: { native: string }) => onPick(e.native)}
          />
        )}
        {tab === 'upload' && (
          <div className="py-6 text-center">
            <button className="btn btn-secondary" onClick={() => fileRef.current?.click()}>
              <Upload size={15} /> Choose an image
            </button>
            <p className="mt-2 text-xs text-ink-faint">PNG, JPG, SVG or GIF.</p>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
            />
          </div>
        )}
        {tab === 'search' && <ImageSearch onPick={onPick} />}
      </div>
    </div>
  );
}

function TabBtn({
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
