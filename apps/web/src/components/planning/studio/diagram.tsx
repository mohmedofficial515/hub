'use client';

/**
 * @file diagram.tsx
 * @description The report's flow, drawn here from Claude's nodes and edges rather than by a library: columns follow the longest path from each start, so a
 * flow reads in the page's direction (right to left in Arabic), and every colour is a theme token, so dark mode needs nothing of its own. The same nodes are
 * listed under the drawing in words, for a screen reader and for a phone where the drawing scrolls.
 */
import type { ProposedIdea } from '@hub/contracts';
import { useEffect, useId, useMemo, useRef, useState } from 'react';

import { Bidi, cn, num, useLocale } from '@/components/kit';

type Diagram = NonNullable<ProposedIdea['diagram']>;
type Shape = NonNullable<Diagram['nodes'][number]['shape']>;

const W_MAX = 176;
const W_MIN = 120;
const H = 60;
const GAP_X = 72;
const GAP_Y = 28;
const PAD = 12;
const MAX_ACROSS = 4;
const GAP_SIDE = 24;
const GAP_DOWN = 52;
/** The lane a loop back takes, outside the nodes, so it never crosses one. */
const LANE = 44;

interface Layout {
  at: Map<string, { x: number; y: number }>;
  width: number;
  height: number;
  vertical: boolean;
  w: number;
  /** The edges that go back to an earlier column. */
  back: Set<number>;
  /** The width (down) or height (across) of the loops' lane. */
  lane: number;
}

/** An edge label's pill width. */
const labelWidth = (label?: string) => (label ? Math.min(label.length * 6.8 + 16, 140) : 0);

/** Longest-path columns from the starts. A cycle is cut where it closes, so a loop back is drawn in its own lane. */
function columnsOf(diagram: Diagram) {
  const ids = diagram.nodes.map((n) => n.id);
  const incoming = new Map(ids.map((id) => [id, 0]));
  for (const e of diagram.edges) incoming.set(e.to, (incoming.get(e.to) ?? 0) + 1);
  const column = new Map<string, number>();
  const starts = ids.filter((id) => (incoming.get(id) ?? 0) === 0);
  const visit = (id: string, depth: number, path: Set<string>) => {
    if (path.has(id)) return;
    if ((column.get(id) ?? -1) >= depth) return;
    column.set(id, depth);
    path.add(id);
    for (const e of diagram.edges) if (e.from === id) visit(e.to, depth + 1, path);
    path.delete(id);
  };
  for (const id of starts.length ? starts : ids.slice(0, 1)) visit(id, 0, new Set());
  for (const id of ids) if (!column.has(id)) column.set(id, 0);
  const columns: string[][] = [];
  for (const id of ids) (columns[column.get(id)!] ??= []).push(id);
  const back = new Set<number>();
  diagram.edges.forEach((e, i) => {
    if ((column.get(e.to) ?? 0) <= (column.get(e.from) ?? 0)) back.add(i);
  });
  return { columns: columns.map((c) => c ?? []), back };
}

/**
 * The drawing's layout for the room it has. A flow that fits reads across in the page's direction; a longer one, or one in a narrow column, reads top to
 * bottom. Nodes narrow before the drawing scrolls, and never shrink their words.
 */
export function layout(diagram: Diagram, room: number): Layout {
  const { columns, back } = columnsOf(diagram);
  // The lane is wide enough for the longest label on a loop back, so the label sits inside it, never past the drawing's edge.
  const longest = Math.max(0, ...[...back].map((i) => labelWidth(diagram.edges[i]?.label)));
  const widestRow = Math.max(...columns.map((c) => c.length));
  // Down the page the lane takes only the room the nodes leave; its label is cut to fit, never the drawing.
  const spare = room - PAD * 2 - widestRow * W_MIN - (widestRow - 1) * GAP_SIDE;
  const lane = back.size > 0 ? Math.max(LANE, Math.min(longest + 12, Math.max(LANE, spare))) : 0;
  const tallest = Math.max(...columns.map((c) => c.length));
  const acrossWidth = (w: number) => columns.length * w + (columns.length - 1) * GAP_X + PAD * 2;
  const across = columns.length <= MAX_ACROSS && acrossWidth(W_MIN) <= room;
  const at = new Map<string, { x: number; y: number }>();

  if (across) {
    const w = Math.max(
      W_MIN,
      Math.min(W_MAX, Math.floor((room - PAD * 2 - (columns.length - 1) * GAP_X) / columns.length)),
    );
    const height = tallest * H + (tallest - 1) * GAP_Y + PAD * 2 + lane;
    const width = acrossWidth(w);
    columns.forEach((col, ci) => {
      const colHeight = col.length * H + (col.length - 1) * GAP_Y;
      const top = (height - lane - colHeight) / 2;
      col.forEach((id, ri) => at.set(id, { x: PAD + ci * (w + GAP_X), y: top + ri * (H + GAP_Y) }));
    });
    return { at, width, height, vertical: false, w, back, lane };
  }

  const widest = Math.max(...columns.map((c) => c.length));
  const w = Math.max(
    W_MIN,
    Math.min(W_MAX, Math.floor((room - PAD * 2 - lane - (widest - 1) * GAP_SIDE) / widest)),
  );
  const inner = widest * w + (widest - 1) * GAP_SIDE;
  const width = inner + PAD * 2 + lane;
  const height = columns.length * H + (columns.length - 1) * GAP_DOWN + PAD * 2;
  columns.forEach((row, ri) => {
    const rowWidth = row.length * w + (row.length - 1) * GAP_SIDE;
    const left = PAD + (inner - rowWidth) / 2;
    row.forEach((id, ci) => at.set(id, { x: left + ci * (w + GAP_SIDE), y: PAD + ri * (H + GAP_DOWN) }));
  });
  return { at, width, height, vertical: true, w, back, lane };
}

/** A label in at most two lines that fit the node's width, cut with an ellipsis. */
function lines(label: string, w: number): string[] {
  const max = Math.max(12, Math.floor((w - 16) / 7));
  const words = label.split(/\s+/);
  const out: string[] = [];
  let line = '';
  for (const word of words) {
    if ((line + ' ' + word).trim().length > max && line) {
      out.push(line);
      line = word;
    } else line = `${line} ${word}`.trim();
  }
  if (line) out.push(line);
  if (out.length > 2) return [out[0]!, `${out[1]!.slice(0, max - 3)}…`];
  return out.map((l) => (l.length > max + 2 ? `${l.slice(0, max + 1)}…` : l));
}

/** The width the drawing has, read from its box and kept up to date. */
function useRoom() {
  const ref = useRef<HTMLDivElement>(null);
  const [room, setRoom] = useState(640);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const read = () => setRoom(Math.max(280, Math.floor(el.clientWidth)));
    read();
    const observer = new ResizeObserver(read);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, room] as const;
}

const SHAPE_CLASS: Record<Shape, string> = {
  actor: 'fill-info-soft stroke-info',
  step: 'fill-card stroke-border',
  data: 'fill-type-plan-soft stroke-type-plan',
  decision: 'fill-warning-soft stroke-warning',
};
const TEXT_CLASS: Record<Shape, string> = {
  actor: 'fill-info-soft-foreground',
  step: 'fill-foreground',
  data: 'fill-type-plan-fg',
  decision: 'fill-warning-soft-foreground',
};

export function FlowDiagram({
  diagram,
  words,
}: {
  diagram: Diagram;
  words: { shapes: Record<Shape, string>; listLabel: string; to: string; sep?: string | undefined };
}) {
  const locale = useLocale();
  const rtl = locale === 'ar';
  const uid = useId().replace(/:/g, '');
  const [box, room] = useRoom();
  const {
    at,
    width,
    height,
    vertical,
    w: W,
    back,
    lane,
  } = useMemo(() => layout(diagram, room), [diagram, room]);
  const x = (left: number) => (rtl ? width - left - W : left);
  const label = new Map(diagram.nodes.map((n) => [n.id, n.label]));
  const used = new Set(diagram.nodes.map((n) => n.shape ?? 'step'));

  return (
    <figure className="flex min-w-0 flex-col gap-3">
      <div ref={box} className="-mx-1 overflow-x-auto px-1 pb-1">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          width={width}
          height={height}
          role="img"
          aria-labelledby={`${uid}-list`}
          className="mx-auto block max-w-none"
        >
          <defs>
            <marker
              id={`${uid}-arrow`}
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="7"
              markerHeight="7"
              orient="auto-start-reverse"
            >
              <path d="M0,0 L10,5 L0,10 z" className="fill-muted-foreground" />
            </marker>
          </defs>
          {diagram.edges.map((e, i) => {
            const a = at.get(e.from);
            const b = at.get(e.to);
            if (!a || !b) return null;
            let d: string;
            let mx: number;
            let my: number;
            if (back.has(i)) {
              // A loop back runs in its own lane outside the nodes: down the side when the flow reads down, under the nodes when it reads across.
              const r = 10;
              if (vertical) {
                const side = rtl ? -1 : 1;
                const laneX = side > 0 ? width - PAD - lane / 2 : PAD + lane / 2;
                const ax = x(a.x) + (side > 0 ? W : 0);
                const bx = x(b.x) + (side > 0 ? W : 0);
                const ay = a.y + H / 2;
                const by = b.y + H / 2;
                const up = by < ay ? -1 : 1;
                d = `M${ax},${ay} H${laneX - side * r} Q${laneX},${ay} ${laneX},${ay + up * r} V${by - up * r} Q${laneX},${by} ${laneX - side * r},${by} H${bx}`;
                mx = laneX;
                my = (ay + by) / 2;
              } else {
                const laneY = height - PAD - lane / 2;
                const ax = x(a.x) + W / 2;
                const bx = x(b.x) + W / 2;
                const ay = a.y + H;
                const by = b.y + H;
                const dir = bx < ax ? -1 : 1;
                d = `M${ax},${ay} V${laneY - r} Q${ax},${laneY} ${ax + dir * r},${laneY} H${bx - dir * r} Q${bx},${laneY} ${bx},${laneY - r} V${by}`;
                mx = (ax + bx) / 2;
                my = laneY;
              }
            } else if (vertical) {
              const ax = x(a.x) + W / 2;
              const bx = x(b.x) + W / 2;
              const ay = a.y + H;
              const by = b.y;
              const bend = (by - ay) / 2;
              d = `M${ax},${ay} C${ax},${ay + bend} ${bx},${by - bend} ${bx},${by}`;
              mx = (ax + bx) / 2;
              my = (ay + by) / 2;
            } else {
              const ax = x(a.x) + (rtl ? 0 : W);
              const bx = x(b.x) + (rtl ? W : 0);
              const ay = a.y + H / 2;
              const by = b.y + H / 2;
              const bend = (bx - ax) / 2;
              d = `M${ax},${ay} C${ax + bend},${ay} ${bx - bend},${by} ${bx},${by}`;
              mx = (ax + bx) / 2;
              my = (ay + by) / 2;
            }
            return (
              <g key={`${e.from}-${e.to}-${i}`}>
                <path
                  d={d}
                  fill="none"
                  strokeWidth={1.5}
                  strokeDasharray={back.has(i) ? '4 3' : undefined}
                  className={back.has(i) ? 'stroke-muted-foreground/45' : 'stroke-muted-foreground/60'}
                  markerEnd={`url(#${uid}-arrow)`}
                />
                {e.label &&
                  (() => {
                    // A label on a loop back fits its lane; any other fits 140px. Cut text keeps its whole words in the tooltip.
                    const pill = Math.min(labelWidth(e.label), back.has(i) && vertical ? lane - 8 : 140);
                    const chars = Math.max(3, Math.floor((pill - 16) / 6.8));
                    const shown = e.label.length > chars ? `${e.label.slice(0, chars - 1)}…` : e.label;
                    return (
                      <g>
                        <title>{e.label}</title>
                        <rect
                          x={mx - pill / 2}
                          y={my - 9}
                          width={pill}
                          height={18}
                          rx={9}
                          className="fill-background stroke-border"
                        />
                        <text
                          x={mx}
                          y={my + 3.5}
                          textAnchor="middle"
                          className="fill-muted-foreground text-caption"
                          direction={rtl ? 'rtl' : 'ltr'}
                        >
                          {shown}
                        </text>
                      </g>
                    );
                  })()}
              </g>
            );
          })}
          {diagram.nodes.map((n) => {
            const p = at.get(n.id);
            if (!p) return null;
            const shape = n.shape ?? 'step';
            const text = lines(n.label, W);
            const left = x(p.x);
            return (
              <g key={n.id}>
                <title>{n.note ? `${n.label}: ${n.note}` : n.label}</title>
                <rect
                  x={left}
                  y={p.y}
                  width={W}
                  height={H}
                  rx={shape === 'actor' ? H / 2 : shape === 'decision' ? 6 : 12}
                  strokeWidth={shape === 'decision' ? 1.5 : 1}
                  strokeDasharray={shape === 'decision' ? '5 3' : undefined}
                  className={cn(SHAPE_CLASS[shape])}
                />
                {shape === 'data' && (
                  <line
                    x1={left + 10}
                    x2={left + W - 10}
                    y1={p.y + 9}
                    y2={p.y + 9}
                    className="stroke-type-plan/50"
                  />
                )}
                <text
                  x={left + W / 2}
                  y={p.y + H / 2 + (text.length === 1 ? 4.5 : -3)}
                  textAnchor="middle"
                  direction={rtl ? 'rtl' : 'ltr'}
                  className={cn('text-body-sm font-medium', TEXT_CLASS[shape])}
                >
                  {text.map((l, i) => (
                    <tspan key={i} x={left + W / 2} dy={i === 0 ? 0 : 16}>
                      {l}
                    </tspan>
                  ))}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5" aria-hidden>
        {(['actor', 'step', 'data', 'decision'] as const)
          .filter((s) => used.has(s))
          .map((s) => (
            <span key={s} className="inline-flex items-center gap-1.5 text-caption text-muted-foreground">
              <span
                className={cn(
                  'inline-block size-3 border',
                  s === 'actor' && 'rounded-full border-info bg-info-soft',
                  s === 'step' && 'rounded-xs border-border bg-card',
                  s === 'data' && 'rounded-xs border-type-plan bg-type-plan-soft',
                  s === 'decision' && 'rounded-xs border-dashed border-warning bg-warning-soft',
                )}
              />
              {words.shapes[s]}
            </span>
          ))}
      </div>
      <figcaption className="sr-only" id={`${uid}-list`}>
        {words.listLabel}:{' '}
        {diagram.edges
          .map((e) => `${label.get(e.from)} ${words.to} ${label.get(e.to)}`)
          .join(words.sep ?? ', ')}
      </figcaption>
      {diagram.nodes.some((n) => n.note) && (
        <ol className="grid gap-2 @page-lg:grid-cols-2">
          {diagram.nodes
            .filter((n) => n.note)
            .map((n, i) => (
              <li key={n.id} className="flex min-w-0 gap-2 text-caption">
                <span className="mt-px flex size-5 shrink-0 items-center justify-center rounded-full bg-muted font-semibold text-muted-foreground tabular-nums">
                  {num(i + 1, locale)}
                </span>
                <span className="min-w-0 text-muted-foreground">
                  <span className="font-medium text-foreground">
                    <Bidi>{n.label}</Bidi>
                  </span>
                  {' · '}
                  <Bidi>{n.note!}</Bidi>
                </span>
              </li>
            ))}
        </ol>
      )}
    </figure>
  );
}
