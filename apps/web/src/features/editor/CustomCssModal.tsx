import { useState } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { css as cssLang } from '@codemirror/lang-css';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { UnsavedChangesDialog } from '@/components/ui/ConfirmDialog';
import { useThemeStore } from '@/hooks/useTheme';

const SAMPLE = `/* Scoped to this page's content.
   Try: */
h1 { color: var(--thread); }
p { font-size: 18px; }`;

export function CustomCssModal({
  initial,
  onSave,
  onClose,
}: {
  initial: string | null;
  onSave: (css: string) => void;
  onClose: () => void;
}) {
  const [value, setValue] = useState(initial ?? '');
  const [confirmClose, setConfirmClose] = useState(false);
  const { theme } = useThemeStore();
  const dark =
    theme === 'dark' ||
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  const dirty = value !== (initial ?? '');
  const save = () => {
    onSave(value);
    onClose();
  };
  // Closing with edits routes through the unsaved-changes prompt; a clean close
  // (Escape / backdrop / Cancel) goes straight through (§37).
  const requestClose = () => (dirty ? setConfirmClose(true) : onClose());

  return (
    <>
      <Modal
        open
        onClose={requestClose}
        title="Custom CSS"
        width="lg"
        footer={
          <>
            <Button variant="ghost" onClick={requestClose}>
              Cancel
            </Button>
            <Button variant="primary" disabled={!dirty} onClick={save}>
              Apply CSS
            </Button>
          </>
        }
      >
        <p className="mb-3 text-sm text-ink-muted">
          Styles are scoped to this page's content area and applied live. Use design tokens like{' '}
          <code className="font-mono text-thread">var(--thread)</code>.
        </p>
        <div className="overflow-hidden rounded-md border border-line-strong">
          <CodeMirror
            value={value}
            height="300px"
            theme={dark ? 'dark' : 'light'}
            extensions={[cssLang()]}
            placeholder={SAMPLE}
            onChange={setValue}
          />
        </div>
      </Modal>

      <UnsavedChangesDialog
        open={confirmClose}
        onKeepEditing={() => setConfirmClose(false)}
        onDiscard={() => {
          setConfirmClose(false);
          onClose();
        }}
        onSave={() => {
          setConfirmClose(false);
          save();
        }}
      />
    </>
  );
}
