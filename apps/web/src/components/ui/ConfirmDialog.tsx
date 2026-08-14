import { type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Modal } from './Modal';
import { Button } from './Button';

/**
 * A single confirm/cancel decision, styled once so every "are you sure?" in the
 * app looks and behaves the same (§11, §38). Destructive actions read as
 * destructive: a warning glyph and a danger-filled confirm button. Built on
 * `Modal`, so it inherits focus management, Escape and backdrop dismissal — Escape
 * / backdrop / Cancel all resolve to `onCancel`, never a silent confirm.
 */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      width="sm"
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button
            variant={danger ? 'danger' : 'primary'}
            size="sm"
            data-autofocus
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="flex gap-3">
        {danger && (
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-danger-soft text-danger">
            <AlertTriangle size={18} />
          </span>
        )}
        <div className="min-w-0 text-sm leading-relaxed text-ink-muted">{message}</div>
      </div>
    </Modal>
  );
}

/**
 * The three-way close decision for a dialog that holds unsaved edits (§37): keep
 * editing, discard, or save. Keep editing is the safe default (autofocused);
 * discard is destructive.
 */
export function UnsavedChangesDialog({
  open,
  onKeepEditing,
  onDiscard,
  onSave,
}: {
  open: boolean;
  onKeepEditing: () => void;
  onDiscard: () => void;
  onSave: () => void;
}) {
  return (
    <Modal
      open={open}
      onClose={onKeepEditing}
      title="Unsaved changes"
      width="sm"
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onDiscard} className="text-danger hover:bg-danger-soft">
            Discard changes
          </Button>
          <Button variant="secondary" size="sm" data-autofocus onClick={onKeepEditing}>
            Keep editing
          </Button>
          <Button variant="primary" size="sm" onClick={onSave}>
            Save changes
          </Button>
        </>
      }
    >
      <p className="text-sm leading-relaxed text-ink-muted">
        You have unsaved changes. Save them before closing, or discard them.
      </p>
    </Modal>
  );
}
