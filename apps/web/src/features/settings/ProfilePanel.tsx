import { useRef, useState, type FormEvent } from 'react';
import { Upload } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { toast } from '@/lib/toast';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Avatar';

export function ProfilePanel() {
  const { user, refresh } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(user?.name ?? '');
  const [bio, setBio] = useState(user?.bio ?? '');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  if (!user) return null;

  const dirty = name.trim() !== user.name || (bio ?? '') !== (user.bio ?? '');

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      await api.patch('/account/profile', { name: name.trim(), bio: bio.trim() });
      await refresh();
      toast.success('Profile updated');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not update profile');
    } finally {
      setSaving(false);
    }
  };

  const onPickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true);
    try {
      const { upload } = await api.upload<{ upload: { url: string } }>('/uploads', file);
      await api.patch('/account/profile', { avatarUrl: upload.url });
      await refresh();
      toast.success('Avatar updated');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not upload avatar');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-display text-lg font-semibold text-ink">Profile</h2>
        <p className="mt-1 text-sm text-ink-muted">
          This is how you appear across your workspace.
        </p>
      </div>

      {/* Avatar */}
      <div className="flex items-center gap-4">
        <Avatar name={user.name} src={user.avatarUrl} size={64} />
        <div className="space-y-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={onPickFile}
          />
          <Button
            type="button"
            variant="secondary"
            size="sm"
            loading={uploading}
            onClick={() => fileRef.current?.click()}
          >
            <Upload size={15} />
            Change avatar
          </Button>
          <p className="text-xs text-ink-faint">PNG, JPG or GIF. Square images look best.</p>
        </div>
      </div>

      {/* Details */}
      <form onSubmit={save} className="space-y-4">
        <div>
          <label className="field-label" htmlFor="profile-name">
            Display name
          </label>
          <input
            id="profile-name"
            className="input"
            value={name}
            maxLength={80}
            required
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
          />
        </div>
        <div>
          <label className="field-label" htmlFor="profile-bio">
            Bio
          </label>
          <textarea
            id="profile-bio"
            className="input h-auto min-h-[84px] resize-y py-2 leading-relaxed"
            value={bio ?? ''}
            maxLength={280}
            onChange={(e) => setBio(e.target.value)}
            placeholder="A short line about yourself"
          />
          <p className="mt-1 text-xs text-ink-faint">{(bio ?? '').length}/280</p>
        </div>
        <div className="flex justify-end">
          <Button type="submit" variant="primary" loading={saving} disabled={!dirty}>
            Save changes
          </Button>
        </div>
      </form>
    </div>
  );
}
