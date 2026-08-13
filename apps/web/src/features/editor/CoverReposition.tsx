import { useRef, useState } from 'react';
import { Move, ZoomIn, ZoomOut } from 'lucide-react';
import { COVER_HEIGHT } from '@weft/shared';
import { Button } from '@/components/ui/Button';
import { coverImageStyle } from './cover';

const clamp = (n: number, min = 0, max = 100) => Math.min(max, Math.max(min, n));

/** Drag-to-focus + zoom editor for a cover. Live preview, then Save/Cancel. */
export function CoverReposition({
  url,
  offsetX,
  offsetY,
  scale,
  onSave,
  onCancel,
}: {
  url: string;
  offsetX: number;
  offsetY: number;
  scale: number;
  onSave: (v: { coverOffsetX: number; coverOffsetY: number; coverScale: number }) => void;
  onCancel: () => void;
}) {
  const [x, setX] = useState(offsetX ?? 50);
  const [y, setY] = useState(offsetY ?? 50);
  const [z, setZ] = useState(scale ?? 1);
  const boxRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null);

  const onDown = (e: React.MouseEvent) => {
    e.preventDefault();
    drag.current = { sx: e.clientX, sy: e.clientY, ox: x, oy: y };
    const move = (ev: MouseEvent) => {
      if (!drag.current || !boxRef.current) return;
      const w = boxRef.current.clientWidth;
      const h = boxRef.current.clientHeight;
      // Dragging right reveals the left of the image → focal x decreases.
      const dx = ((ev.clientX - drag.current.sx) / w) * 100;
      const dy = ((ev.clientY - drag.current.sy) / h) * 100;
      setX(clamp(drag.current.ox - dx / z));
      setY(clamp(drag.current.oy - dy / z));
    };
    const up = () => {
      drag.current = null;
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  };

  const onWheel = (e: React.WheelEvent) => {
    setZ((prev) => Math.min(4, Math.max(1, +(prev - e.deltaY * 0.0015).toFixed(3))));
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(33,31,28,.5)] p-4 backdrop-blur-[2px]"
      onMouseDown={(e) => e.target === e.currentTarget && onCancel()}
    >
      <div className="card w-full max-w-[720px] overflow-hidden shadow-lg">
        <div className="flex items-center justify-between border-b border-line px-5 py-3">
          <h2 className="flex items-center gap-2 font-display text-base font-semibold text-ink">
            <Move size={16} /> Reposition cover
          </h2>
          <span className="text-xs text-ink-faint">Drag to set the focus · scroll to zoom</span>
        </div>

        <div
          ref={boxRef}
          onMouseDown={onDown}
          onWheel={onWheel}
          className="relative cursor-grab overflow-hidden bg-sunk active:cursor-grabbing"
          style={{ height: COVER_HEIGHT }}
        >
          <img src={url} alt="" draggable={false} style={coverImageStyle(x, y, z)} />
          {/* framing guides */}
          <div className="pointer-events-none absolute inset-0 border border-white/20" />
        </div>

        <div className="flex items-center gap-3 border-t border-line px-5 py-3">
          <ZoomOut size={16} className="text-ink-faint" />
          <input
            type="range"
            min={1}
            max={4}
            step={0.02}
            value={z}
            onChange={(e) => setZ(+e.target.value)}
            className="flex-1 accent-[var(--thread)]"
          />
          <ZoomIn size={16} className="text-ink-faint" />
          <span className="w-10 text-right font-mono text-xs text-ink-muted">{z.toFixed(2)}×</span>
        </div>

        <div className="flex justify-between gap-2 border-t border-line px-5 py-3">
          <Button
            variant="ghost"
            onClick={() => {
              setX(50);
              setY(50);
              setZ(1);
            }}
          >
            Reset
          </Button>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={() =>
                onSave({ coverOffsetX: Math.round(x), coverOffsetY: Math.round(y), coverScale: +z.toFixed(3) })
              }
            >
              Save position
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
