import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import ForceGraph2D from 'react-force-graph-2d';
import { ArrowLeft } from 'lucide-react';
import { useWorkspace } from '@/features/app/workspace';
import { useThemeStore } from '@/hooks/useTheme';
import { api } from '@/lib/api';
import { Spinner } from '@/components/ui/Spinner';
import { IconButton } from '@/components/ui/Button';

interface GraphNode {
  id: string;
  title: string;
  icon: string | null;
  val: number;
}
interface GraphLink {
  source: string;
  target: string;
  kind: 'child' | 'ref';
}
interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

interface GraphColors {
  thread: string;
  inkMuted: string;
  child: string;
  ref: string;
  paper: string;
}

function readColors(): GraphColors {
  const s = getComputedStyle(document.documentElement);
  const v = (name: string) => s.getPropertyValue(name).trim();
  return {
    thread: v('--thread') || '#2E4374',
    inkMuted: v('--ink-muted') || '#6B6660',
    child: v('--line-strong') || '#D8D4CC',
    ref: v('--line') || '#E7E4DE',
    paper: v('--paper') || '#FCFBF9',
  };
}

export default function GraphView() {
  const navigate = useNavigate();
  const { workspaceId } = useWorkspace();
  const { theme } = useThemeStore();

  const { data, isLoading } = useQuery({
    queryKey: ['graph', workspaceId],
    enabled: !!workspaceId,
    queryFn: () => api.get<GraphData>(`/workspaces/${workspaceId}/graph`),
  });

  // The force layout mutates node/link objects in place, so hand it fresh copies.
  const graphData = useMemo(
    () => ({
      nodes: (data?.nodes ?? []).map((n) => ({ ...n })),
      links: (data?.links ?? []).map((l) => ({ ...l })),
    }),
    [data],
  );

  // Colours come from CSS vars; recompute when the theme (or system scheme) flips.
  const [colors, setColors] = useState<GraphColors>(readColors);
  useEffect(() => {
    setColors(readColors());
  }, [theme]);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const on = () => setColors(readColors());
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);

  // Measure the canvas container so the graph fills the available space.
  const wrapRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      setSize({ w: Math.floor(width), h: Math.floor(height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const nodeCanvasObject = useCallback(
    // The lib's node type is loose (mutated with x/y at runtime), so use `any`.
    (node: any, ctx: CanvasRenderingContext2D, scale: number) => {
      const x: number = node.x ?? 0;
      const y: number = node.y ?? 0;
      const val: number = typeof node.val === 'number' ? node.val : 1;
      const r = Math.max(2.5, Math.sqrt(val) * 1.8);
      const label: string = (node.title as string) || 'Untitled';

      if (node.icon) {
        ctx.font = `${r * 2}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(node.icon as string, x, y);
      } else {
        ctx.beginPath();
        ctx.arc(x, y, r, 0, 2 * Math.PI);
        ctx.fillStyle = colors.thread;
        ctx.fill();
      }

      const fontSize = Math.max(2, 11 / scale);
      const truncated = label.length > 24 ? `${label.slice(0, 23)}…` : label;
      ctx.font = `${fontSize}px Inter, system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillStyle = colors.inkMuted;
      ctx.fillText(truncated, x, y + r + 2);
    },
    [colors],
  );

  const linkColor = useCallback(
    (link: any) => (link.kind === 'ref' ? colors.ref : colors.child),
    [colors],
  );
  const linkLineDash = useCallback(
    (link: any) => (link.kind === 'ref' ? [4, 4] : null),
    [],
  );

  const isEmpty = !isLoading && graphData.nodes.length === 0;

  return (
    <div className="flex h-full flex-col bg-paper">
      <header className="flex items-center gap-3 border-b border-line px-5 py-3">
        <IconButton label="Back" onClick={() => navigate('/')}>
          <ArrowLeft size={18} />
        </IconButton>
        <div className="min-w-0">
          <h1 className="font-display text-lg font-semibold leading-tight text-ink">Graph view</h1>
          <p className="text-xs text-ink-muted">How your pages connect</p>
        </div>
      </header>

      <div ref={wrapRef} className="relative flex-1 overflow-hidden">
        {isLoading ? (
          <div className="flex h-full items-center justify-center">
            <Spinner />
          </div>
        ) : isEmpty ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-ink-faint">No pages to graph yet.</p>
          </div>
        ) : (
          size.w > 0 &&
          size.h > 0 && (
            <ForceGraph2D
              width={size.w}
              height={size.h}
              graphData={graphData}
              backgroundColor={colors.paper}
              nodeVal="val"
              nodeLabel="title"
              nodeColor={() => colors.thread}
              nodeRelSize={4}
              nodeCanvasObject={nodeCanvasObject}
              linkColor={linkColor}
              linkLineDash={linkLineDash}
              linkWidth={1}
              onNodeClick={(node: any) => navigate(`/p/${node.id}`)}
            />
          )
        )}
      </div>
    </div>
  );
}
