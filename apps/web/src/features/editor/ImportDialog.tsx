import { useRef, useState } from 'react';
import { UploadCloud, FileUp, AlertTriangle, Loader2 } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import { toast } from '@/lib/toast';
import { IMPORT_ACCEPT, SUPPORTED_IMPORT_FORMATS } from '@/features/export/importContent';

/**
 * Import a file into the current page. A calm, single-purpose dialog: one
 * drop-or-choose target, the formats Weft can actually read, and honest
 * progress/error states. The parsing itself lives in the editor (importContent
 * needs a live editor for Markdown/HTML) — this dialog just collects the file and
 * reports what happened.
 *
 * Imported content is appended to the end of the page, so importing never
 * silently overwrites existing work.
 */
export function ImportDialog({
  open,
  onClose,
  onImport,
}: {
  open: boolean;
  onClose: () => void;
  /** Parse + append the file; resolves with the number of blocks added. */
  onImport: (file: File) => Promise<number>;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = async (file: File | null | undefined) => {
    if (!file || busy) return;
    setError(null);
    setBusy(true);
    try {
      const count = await onImport(file);
      toast.success(`Imported ${count} block${count === 1 ? '' : 's'} from ${file.name}`);
      close();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't import that file.");
    } finally {
      setBusy(false);
    }
  };

  const close = () => {
    setError(null);
    setDragging(false);
    setBusy(false);
    onClose();
  };

  return (
    <Modal open={open} onClose={close} title="Import" width="sm">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!busy) setDragging(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          setDragging(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          void handleFile(e.dataTransfer.files?.[0]);
        }}
        className={cn(
          'flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed px-6 py-9 text-center transition-colors',
          dragging
            ? 'border-thread bg-thread-soft'
            : 'border-line-strong bg-sunk/40 hover:border-ink-faint',
        )}
      >
        <span
          className={cn(
            'flex h-12 w-12 items-center justify-center rounded-full transition-colors',
            dragging ? 'bg-surface text-thread' : 'bg-surface text-ink-muted',
          )}
        >
          {busy ? (
            <Loader2 size={22} className="animate-spin" />
          ) : (
            <UploadCloud size={22} />
          )}
        </span>
        <div>
          <p className="text-sm font-medium text-ink">
            {busy ? 'Importing…' : 'Drag a file here, or choose one'}
          </p>
          <p className="mt-0.5 text-xs text-ink-faint">Added to the end of this page.</p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          <FileUp size={15} /> Choose file
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept={IMPORT_ACCEPT}
          className="hidden"
          onChange={(e) => {
            void handleFile(e.target.files?.[0]);
            e.target.value = ''; // allow re-picking the same file after an error
          }}
        />
      </div>

      {error && (
        <div className="mt-3 flex items-start gap-2 rounded-md border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="mt-4">
        <p className="text-2xs font-semibold uppercase tracking-wide text-ink-faint">
          Supported formats
        </p>
        <ul className="mt-1.5 flex flex-wrap gap-1.5">
          {SUPPORTED_IMPORT_FORMATS.map((f) => (
            <li
              key={f}
              className="rounded-sm border border-line bg-surface px-1.5 py-0.5 text-2xs text-ink-muted"
            >
              {f}
            </li>
          ))}
        </ul>
      </div>
    </Modal>
  );
}
