import { useState } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { css as cssLang } from '@codemirror/lang-css';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
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
  const { theme } = useThemeStore();
  const dark =
    theme === 'dark' ||
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  return (
    <Modal
      open
      onClose={onClose}
      title="Custom CSS"
      width="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              onSave(value);
              onClose();
            }}
          >
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
  );
}
