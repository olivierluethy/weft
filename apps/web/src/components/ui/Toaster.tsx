import { CheckCircle2, Info, AlertCircle, X } from 'lucide-react';
import { useToasts, type ToastKind } from '@/lib/toast';

const icons: Record<ToastKind, typeof Info> = {
  info: Info,
  success: CheckCircle2,
  error: AlertCircle,
};
const barColor: Record<ToastKind, string> = {
  info: 'var(--thread)',
  success: 'var(--ok)',
  error: 'var(--danger)',
};

export function Toaster() {
  const { toasts, dismiss } = useToasts();
  return (
    <div className="fixed bottom-4 right-4 z-toast flex w-[340px] max-w-[calc(100vw-2rem)] flex-col gap-2">
      {toasts.map((t) => {
        const Icon = icons[t.kind];
        return (
          <div
            key={t.id}
            className="card flex items-start gap-2.5 overflow-hidden py-2.5 pl-3.5 pr-2.5 shadow-md animate-[slidein_.18s_ease]"
            style={{ borderLeft: `3px solid ${barColor[t.kind]}` }}
          >
            <Icon size={17} style={{ color: barColor[t.kind] }} className="mt-0.5 shrink-0" />
            <p className="flex-1 text-sm text-ink">{t.message}</p>
            <button onClick={() => dismiss(t.id)} className="text-ink-faint hover:text-ink">
              <X size={15} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
