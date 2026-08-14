import { useState } from 'react';
import { createReactBlockSpec } from '@blocknote/react';

type Datum = { label: string; value: number };
const SAMPLE = '[{"label":"Mon","value":12},{"label":"Tue","value":19},{"label":"Wed","value":7},{"label":"Thu","value":15},{"label":"Fri","value":9}]';

function parseData(json: string): Datum[] {
  try {
    const d = JSON.parse(json);
    if (Array.isArray(d)) return d.filter((x) => x && typeof x.value === 'number');
  } catch { /* fall through */ }
  return [];
}

const PALETTE = ['#4f6ef7', '#f7864f', '#43b581', '#f7c94f', '#b04ff7', '#4fc7f7'];

function VerticalBar({ data }: { data: Datum[] }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const W = 320, H = 160, pad = 24, bw = (W - pad * 2) / data.length;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-md">
      {data.map((d, i) => {
        const h = ((H - pad * 2) * d.value) / max;
        return (
          <g key={i}>
            <rect x={pad + i * bw + bw * 0.15} y={H - pad - h} width={bw * 0.7} height={h} rx={2} fill={PALETTE[i % PALETTE.length]} />
            <text x={pad + i * bw + bw / 2} y={H - pad + 12} textAnchor="middle" className="fill-ink-faint" fontSize="9">{d.label}</text>
          </g>
        );
      })}
    </svg>
  );
}
function HorizontalBar({ data }: { data: Datum[] }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const W = 320, rowH = 22, pad = 8, labelW = 48;
  const H = data.length * rowH + pad * 2;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-md">
      {data.map((d, i) => {
        const w = ((W - labelW - pad * 2) * d.value) / max;
        return (
          <g key={i}>
            <text x={pad} y={pad + i * rowH + 14} className="fill-ink-faint" fontSize="9">{d.label}</text>
            <rect x={labelW} y={pad + i * rowH + 4} width={w} height={rowH - 8} rx={2} fill={PALETTE[i % PALETTE.length]} />
          </g>
        );
      })}
    </svg>
  );
}
function LineChart({ data }: { data: Datum[] }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const W = 320, H = 160, pad = 24;
  const pts = data.map((d, i) => {
    const x = pad + ((W - pad * 2) * i) / Math.max(1, data.length - 1);
    const y = H - pad - ((H - pad * 2) * d.value) / max;
    return [x, y];
  });
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-md">
      <polyline points={pts.map((p) => p.join(',')).join(' ')} fill="none" stroke={PALETTE[0]} strokeWidth={2} />
      {pts.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r={3} fill={PALETTE[0]} />)}
      {data.map((d, i) => <text key={i} x={pts[i]![0]} y={H - pad + 12} textAnchor="middle" className="fill-ink-faint" fontSize="9">{d.label}</text>)}
    </svg>
  );
}
function Donut({ data }: { data: Datum[] }) {
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  const R = 60, r = 36, C = 80;
  let acc = 0;
  const arcs = data.map((d, i) => {
    const frac = d.value / total;
    const a0 = acc * 2 * Math.PI - Math.PI / 2;
    acc += frac;
    const a1 = acc * 2 * Math.PI - Math.PI / 2;
    const large = frac > 0.5 ? 1 : 0;
    const x0 = C + R * Math.cos(a0), y0 = C + R * Math.sin(a0);
    const x1 = C + R * Math.cos(a1), y1 = C + R * Math.sin(a1);
    const xi1 = C + r * Math.cos(a1), yi1 = C + r * Math.sin(a1);
    const xi0 = C + r * Math.cos(a0), yi0 = C + r * Math.sin(a0);
    return <path key={i} d={`M${x0},${y0} A${R},${R} 0 ${large} 1 ${x1},${y1} L${xi1},${yi1} A${r},${r} 0 ${large} 0 ${xi0},${yi0} Z`} fill={PALETTE[i % PALETTE.length]} />;
  });
  return (
    <div className="flex items-center gap-3">
      <svg viewBox="0 0 160 160" className="h-32 w-32">{arcs}</svg>
      <div className="flex flex-col gap-0.5 text-xs">
        {data.map((d, i) => (
          <span key={i} className="flex items-center gap-1.5 text-ink-muted">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: PALETTE[i % PALETTE.length] }} />
            {d.label} · {Math.round((d.value / total) * 100)}%
          </span>
        ))}
      </div>
    </div>
  );
}
function NumberChart({ data }: { data: Datum[] }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <div className="flex flex-col">
      <span className="text-4xl font-semibold text-ink">{total.toLocaleString()}</span>
      <span className="text-xs text-ink-faint">Sum of {data.length} values</span>
    </div>
  );
}

export const Chart = createReactBlockSpec(
  {
    type: 'chart',
    propSchema: {
      variant: { default: 'verticalBar', values: ['verticalBar', 'horizontalBar', 'line', 'donut', 'number'] },
      data: { default: SAMPLE },
    },
    content: 'none',
  },
  {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    render: ({ block, editor }: any) => {
      // eslint-disable-next-line react-hooks/rules-of-hooks
      const [editing, setEditing] = useState(false);
      const variant = block.props.variant as string;
      const data = parseData(block.props.data as string);
      const V = { verticalBar: VerticalBar, horizontalBar: HorizontalBar, line: LineChart, donut: Donut, number: NumberChart }[variant] ?? VerticalBar;
      return (
        <div className="my-1 rounded-md border border-line bg-surface p-3" contentEditable={false}>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-2xs font-semibold uppercase tracking-wide text-ink-faint">{variant.replace(/([A-Z])/g, ' $1')} chart</span>
            {editor.isEditable && (
              <button className="text-2xs text-thread hover:underline" onClick={() => setEditing((e) => !e)}>
                {editing ? 'Done' : 'Edit data'}
              </button>
            )}
          </div>
          {editing ? (
            <textarea
              defaultValue={block.props.data}
              onBlur={(e) => editor.updateBlock(block, { props: { data: e.target.value } })}
              className="h-24 w-full resize-y rounded border border-line bg-sunk p-2 font-mono text-xs text-ink outline-none"
            />
          ) : data.length ? (
            <V data={data} />
          ) : (
            <p className="text-xs text-ink-faint">No data — click “Edit data” and provide JSON like {SAMPLE.slice(0, 40)}…</p>
          )}
        </div>
      );
    },
  },
);
