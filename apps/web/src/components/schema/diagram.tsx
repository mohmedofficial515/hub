'use client';

/**
 * @file diagram.tsx
 * @description The design as a map (docs/17 §4): domains as tinted zones, tables inside them, relations between them. Hover or select a table and its relations light up while the rest fades.
 * Focus shows one table with its neighbours, laid out again tightly. A table dragged keeps its place in this browser; Arrange again forgets them. In Arabic the map reads from the right.
 * By keyboard (review B2): the toolbar comes before the tables in Tab order, Enter or Space on a table opens it in the inspector, and a table reached by Tab far
 * out is brought close. Fitting and centring keep clear of the toolbar on top and the draft dock below (review M8).
 */
import '@xyflow/react/dist/style.css';

import type { SchemaRelation } from '@hub/contracts';
import {
  Background,
  BackgroundVariant,
  type Edge,
  MarkerType,
  MiniMap,
  type Node,
  type NodeChange,
  ReactFlow,
  ReactFlowProvider,
  useNodesState,
  useReactFlow,
} from '@xyflow/react';
import { Focus, LayoutGrid, Maximize, Minus, Plus, Sparkles, X } from 'lucide-react';
import { type RefObject, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Button, cn, IconButton, matchKey, Segmented, Tooltip, useLocale, useRoute } from '@/components/kit';

import {
  type Box,
  coverageOf,
  groupAround,
  layoutSchema,
  neighbourhood,
  NODE_WIDTH,
  nodeHeight,
  visibleFields,
} from './model';
import { useSchemaWords, useStudio } from './studio';
import { DomainNode, type DomainNodeData, HotContext, TableNode, type TableNodeData } from './table-node';

const NODE_TYPES = { table: TableNode, domain: DomainNode };
const GHOST_DOMAIN = '__proposed';

type Point = { x: number; y: number };

function readPinned(ws: string): Record<string, Point> {
  try {
    return JSON.parse(window.localStorage.getItem(`hub:schema:pos:${ws}`) ?? '{}') as Record<string, Point>;
  } catch {
    return {};
  }
}

function writePinned(ws: string, pinned: Record<string, Point>) {
  try {
    window.localStorage.setItem(`hub:schema:pos:${ws}`, JSON.stringify(pinned));
  } catch {
    /* Not remembered in this browser; the layout still works. */
  }
}

/** What covers the canvas: the toolbar on top and the draft dock below, in pixels from each edge. */
function coveredEdges(canvas: HTMLElement | null): { top: number; bottom: number; height: number } {
  if (!canvas) return { top: 0, bottom: 0, height: 0 };
  const box = canvas.getBoundingClientRect();
  const toolbar = canvas.querySelector<HTMLElement>('.schema-toolbar')?.getBoundingClientRect();
  const dock = canvas
    .closest('.schema-main')
    ?.querySelector<HTMLElement>('.schema-dock')
    ?.getBoundingClientRect();
  return {
    top: toolbar ? Math.max(0, toolbar.bottom - box.top) : 0,
    bottom: dock ? Math.max(0, box.bottom - dock.top) : 0,
    height: box.height,
  };
}

/** Fit padding that keeps the top row of domains out from under the toolbar and the last one above the dock. */
function fitPadding(canvas: HTMLElement | null) {
  const covered = coveredEdges(canvas);
  if (!covered.height) return INITIAL_FIT_PADDING;
  return {
    top: `${Math.round(covered.top + 16)}px`,
    bottom: `${Math.round(covered.bottom + 16)}px`,
    x: '4%',
  } as const;
}

const INITIAL_FIT_PADDING = { top: '84px', bottom: '72px', x: '4%' } as const;

function sides(from: Box, to: Box): { sourceHandle: string; targetHandle: string } {
  const fromCentre = from.x + from.width / 2;
  const toCentre = to.x + to.width / 2;
  if (Math.abs(fromCentre - toCentre) < from.width * 0.6) return { sourceHandle: 'r', targetHandle: 'tr' };
  return fromCentre < toCentre
    ? { sourceHandle: 'r', targetHandle: 'tl' }
    : { sourceHandle: 'l', targetHandle: 'tr' };
}

function Canvas({ canvas }: { canvas: RefObject<HTMLDivElement | null> }) {
  const studio = useStudio();
  const t = useSchemaWords();
  const locale = useLocale();
  const { ws } = useRoute();
  const flow = useReactFlow();
  const rtl = locale === 'ar';
  const { doc, prefs, focus, marks } = studio;

  const [pinned, setPinned] = useState<Record<string, Point>>(() => readPinned(ws));
  const [hovered, setHovered] = useState<string | null>(null);

  const shown = useMemo(() => {
    if (focus) return neighbourhood(doc, focus, 1, prefs.implied);
    const hidden = new Set(prefs.hidden);
    return new Set(doc.models.filter((model) => !hidden.has(model.domain)).map((model) => model.name));
  }, [doc, focus, prefs.hidden, prefs.implied]);

  const heightOf = useCallback(
    (name: string) => {
      const model = doc.models.find((entry) => entry.name === name);
      if (!model) return nodeHeight(0, 0) + 8;
      const touched = (field: string) => marks.proposedFields.has(`${name}.${field}`);
      const fields = visibleFields(model, prefs.detail, touched);
      const extra = marks.newFields.get(name)?.length ?? 0;
      return nodeHeight(fields.length + extra, model.fields.length - fields.length);
    },
    [doc, prefs.detail, marks],
  );

  const ghosts = useMemo(() => (focus ? [] : marks.newModels), [focus, marks.newModels]);

  const layout = useMemo(() => {
    const layoutDoc = ghosts.length
      ? {
          ...doc,
          domains: [
            ...doc.domains,
            {
              name: GHOST_DOMAIN,
              file: '',
              header: null,
              models: ghosts.map((ghost) => ghost.name),
              enums: [],
            },
          ],
        }
      : doc;
    const visible = new Set([...shown, ...ghosts.map((ghost) => ghost.name)]);
    const result = layoutSchema(layoutDoc, visible, heightOf);
    // In Arabic the first domain sits on the right.
    if (!rtl) return result;
    const mirror = (box: Box): Box => ({ ...box, x: -box.x - box.width });
    return {
      nodes: new Map([...result.nodes].map(([name, box]) => [name, mirror(box)])),
      groups: new Map([...result.groups].map(([name, box]) => [name, mirror(box)])),
    };
  }, [doc, shown, ghosts, heightOf, rtl]);

  const boxOf = useCallback(
    (name: string): Box | undefined => {
      const base = layout.nodes.get(name);
      if (!base) return undefined;
      const pin = focus ? undefined : pinned[name];
      return pin ? { ...base, x: pin.x, y: pin.y } : base;
    },
    [layout, pinned, focus],
  );

  const buildNodes = useCallback((): Node[] => {
    const tables: Node[] = [];
    const domainBoxes = new Map<string, Box[]>();
    for (const [name] of layout.nodes) {
      const box = boxOf(name)!;
      const ghost = ghosts.find((entry) => entry.name === name);
      const domain = ghost ? GHOST_DOMAIN : (doc.models.find((model) => model.name === name)?.domain ?? '');
      domainBoxes.set(domain, [...(domainBoxes.get(domain) ?? []), box]);
      tables.push({
        id: name,
        type: 'table',
        position: { x: box.x, y: box.y },
        data: ghost ? { model: name, ghost: { summary: ghost.change.summary } } : { model: name },
        width: NODE_WIDTH,
        style: { width: NODE_WIDTH },
        draggable: !ghost,
      } satisfies Node<TableNodeData>);
    }
    const groups: Node[] = [];
    for (const [domain, boxes] of domainBoxes) {
      const box = groupAround(boxes);
      if (!box || domain === GHOST_DOMAIN) continue;
      const models = doc.models.filter((model) => model.domain === domain);
      groups.push({
        id: `domain:${domain}`,
        type: 'domain',
        position: { x: box.x, y: box.y },
        data: {
          domain,
          coverage: coverageOf(models, studio.annotations),
          count: boxes.length,
          width: box.width,
        },
        style: { width: box.width, height: box.height },
        draggable: false,
        selectable: false,
        focusable: false,
        zIndex: -1,
      } satisfies Node<DomainNodeData>);
    }
    return [...groups, ...tables];
  }, [layout, boxOf, ghosts, doc, studio.annotations]);

  const [nodes, setNodes, onNodesChangeBase] = useNodesState<Node>([]);
  useEffect(() => setNodes(buildNodes()), [buildNodes, setNodes]);

  // Keep the domain zones around their tables while a table is dragged.
  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      onNodesChangeBase(changes);
      const moved = changes.filter((change) => change.type === 'position' && change.position);
      if (moved.length === 0) return;
      const ended = moved.some((change) => change.type === 'position' && change.dragging === false);
      setNodes((current) => {
        const byDomain = new Map<string, Box[]>();
        for (const node of current) {
          if (node.type !== 'table') continue;
          const domain = doc.models.find((model) => model.name === node.id)?.domain;
          if (!domain) continue;
          byDomain.set(domain, [
            ...(byDomain.get(domain) ?? []),
            {
              x: node.position.x,
              y: node.position.y,
              width: NODE_WIDTH,
              height: node.measured?.height ?? heightOf(node.id),
            },
          ]);
        }
        return current.map((node) => {
          if (node.type !== 'domain') return node;
          const box = groupAround(byDomain.get((node.data as DomainNodeData).domain) ?? []);
          return box
            ? { ...node, position: { x: box.x, y: box.y }, style: { width: box.width, height: box.height } }
            : node;
        });
      });
      if (ended && !focus) {
        setPinned((before) => {
          const next = { ...before };
          for (const change of moved)
            if (change.type === 'position' && change.position) next[change.id] = change.position;
          writePinned(ws, next);
          return next;
        });
      }
    },
    [onNodesChangeBase, setNodes, doc, heightOf, focus, ws],
  );

  const active = hovered ?? studio.selection?.name ?? null;
  const hot = useMemo(
    () => (active && shown.has(active) ? neighbourhood(doc, active, 1, prefs.implied) : null),
    [active, shown, doc, prefs.implied],
  );

  const edges = useMemo((): Edge[] => {
    const positions = new Map(
      nodes
        .filter((node) => node.type === 'table')
        .map((node) => [
          node.id,
          {
            x: node.position.x,
            y: node.position.y,
            width: NODE_WIDTH,
            height: node.measured?.height ?? heightOf(node.id),
          },
        ]),
    );
    return doc.relations
      .filter(
        (relation: SchemaRelation) =>
          (prefs.implied || !relation.implied) && positions.has(relation.from) && positions.has(relation.to),
      )
      .map((relation) => {
        const lit = active !== null && (relation.from === active || relation.to === active);
        const faded = active !== null && !lit;
        return {
          id: relation.id,
          source: relation.from,
          target: relation.to,
          type: 'smoothstep',
          ...sides(positions.get(relation.from)!, positions.get(relation.to)!),
          animated: lit,
          className: cn(
            'schema-edge',
            relation.implied && 'schema-edge-implied',
            lit && 'schema-edge-lit',
            faded && 'schema-edge-faded',
          ),
          markerEnd: {
            type: relation.cardinality === 'one_to_one' ? MarkerType.Arrow : MarkerType.ArrowClosed,
            width: 14,
            height: 14,
          },
          zIndex: lit ? 1 : 0,
          focusable: false,
        } satisfies Edge;
      });
  }, [nodes, doc.relations, prefs.implied, active, heightOf]);

  // Centre a table in the part of the canvas nothing covers: below the toolbar, above the dock. A table taller than that starts just under the toolbar.
  const centreOn = useCallback(
    (node: Node, zoom: number, duration: number) => {
      const covered = coveredEdges(canvas.current);
      const height = node.measured?.height ?? 200;
      const clear = covered.height - covered.top - covered.bottom;
      const x = node.position.x + NODE_WIDTH / 2;
      const y =
        height * zoom + 24 <= clear
          ? node.position.y + height / 2 + (covered.bottom - covered.top) / 2 / zoom
          : node.position.y + (covered.height / 2 - covered.top - 12) / zoom;
      void flow.setCenter(x, y, { zoom, duration });
    },
    [canvas, flow],
  );

  // Centre on a table asked for by search, the inspector or the dictionary.
  const lastReveal = useRef(0);
  useEffect(() => {
    const reveal = studio.reveal;
    if (!reveal || reveal.tick === lastReveal.current) return;
    lastReveal.current = reveal.tick;
    const node = nodes.find((entry) => entry.id === reveal.model);
    if (!node) return;
    centreOn(node, 1, 600);
  }, [studio.reveal, nodes, centreOn]);

  // A new focus or filter fits the view to what is shown.
  const fitKey = `${focus ?? ''}|${prefs.hidden.join(',')}`;
  useEffect(() => {
    const id = window.setTimeout(
      () => void flow.fitView({ padding: fitPadding(canvas.current), duration: 500 }),
      60,
    );
    return () => window.clearTimeout(id);
  }, [fitKey, flow, canvas]);

  // A table reached by Tab while the map is far out comes close enough to read (review B2).
  useEffect(() => {
    const box = canvas.current;
    if (!box) return;
    const onFocus = (event: FocusEvent) => {
      const target = event.target as HTMLElement;
      if (!target.classList.contains('react-flow__node-table') || !target.matches(':focus-visible')) return;
      const node = flow.getNode(target.dataset.id ?? '');
      if (node && flow.getZoom() < 0.6) centreOn(node, 0.85, 250);
    };
    box.addEventListener('focusin', onFocus);
    return () => box.removeEventListener('focusin', onFocus);
  }, [canvas, flow, centreOn]);

  const hotValue = useMemo(() => ({ hot, active, hover: setHovered }), [hot, active]);

  return (
    <HotContext.Provider value={hotValue}>
      <Toolbar
        onFit={() => void flow.fitView({ padding: fitPadding(canvas.current), duration: 400 })}
        onRelayout={() => {
          setPinned({});
          writePinned(ws, {});
          window.setTimeout(
            () => void flow.fitView({ padding: fitPadding(canvas.current), duration: 400 }),
            60,
          );
        }}
      />
      {focus && (
        <div className="schema-focus-pill">
          <Focus aria-hidden className="size-4" strokeWidth={1.75} />
          <span className="font-mono text-body-sm" dir="ltr">
            {focus}
          </span>
          <Button size="sm" variant="ghost" onClick={() => studio.setFocus(null)}>
            <X aria-hidden className="size-4" strokeWidth={1.75} />
            {t.actions.focusOff}
          </Button>
        </div>
      )}
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={NODE_TYPES}
        onNodesChange={onNodesChange}
        onNodeClick={(_event, node) => {
          if (node.type === 'table' && !(node.data as TableNodeData).ghost)
            studio.select({ kind: 'model', name: node.id });
        }}
        onNodeDoubleClick={(_event, node) => {
          if (node.type === 'table' && !(node.data as TableNodeData).ghost) studio.setFocus(node.id);
        }}
        onPaneClick={() => studio.select(null)}
        nodesConnectable={false}
        elementsSelectable
        onlyRenderVisibleElements
        minZoom={0.08}
        maxZoom={2}
        fitView
        fitViewOptions={{ padding: INITIAL_FIT_PADDING }}
        proOptions={{ hideAttribution: true }}
        className="schema-flow"
      >
        <Background variant={BackgroundVariant.Dots} gap={22} size={1.2} className="schema-bg" />
        <MiniMap
          pannable
          zoomable
          className="schema-minimap"
          nodeColor={(node) =>
            node.type === 'domain'
              ? 'transparent'
              : `var(--type-${studio.tones.get(doc.models.find((model) => model.name === node.id)?.domain ?? '') ?? 'doc'})`
          }
          nodeStrokeWidth={0}
          maskColor="var(--schema-mask)"
        />
      </ReactFlow>
      <Legend />
    </HotContext.Provider>
  );
}

function Toolbar({ onRelayout, onFit }: { onRelayout: () => void; onFit: () => void }) {
  const studio = useStudio();
  const t = useSchemaWords();
  const locale = useLocale();
  const flow = useReactFlow();
  const { prefs } = studio;
  return (
    <div
      className="schema-toolbar"
      role="toolbar"
      aria-label={t.views.diagram}
      dir={locale === 'ar' ? 'rtl' : 'ltr'}
    >
      <Segmented
        label={t.actions.detail}
        value={prefs.detail}
        onChange={(detail) => studio.setPrefs({ detail })}
        options={[
          { value: 'keys', label: t.actions.detailKeys },
          { value: 'all', label: t.actions.detailAll },
        ]}
      />
      <Segmented
        label={t.actions.labels}
        value={prefs.labels}
        onChange={(labels) => studio.setPrefs({ labels })}
        options={[
          { value: 'ar', label: t.actions.labelsAr },
          { value: 'code', label: t.actions.labelsEn },
        ]}
      />
      <label className="schema-toggle">
        <input
          type="checkbox"
          checked={prefs.implied}
          onChange={(event) => studio.setPrefs({ implied: event.target.checked })}
        />
        <span>{t.actions.implied}</span>
      </label>
      <span className="schema-toolbar-gap" />
      <IconButton label={t.actions.zoomOut} onClick={() => void flow.zoomOut({ duration: 200 })}>
        <Minus aria-hidden className="size-4" strokeWidth={1.75} />
      </IconButton>
      <IconButton label={t.actions.zoomIn} onClick={() => void flow.zoomIn({ duration: 200 })}>
        <Plus aria-hidden className="size-4" strokeWidth={1.75} />
      </IconButton>
      <IconButton label={t.actions.fit} onClick={onFit}>
        <Maximize aria-hidden className="size-4" strokeWidth={1.75} />
      </IconButton>
      <Tooltip content={t.actions.relayoutTip}>
        <IconButton label={t.actions.relayout} onClick={onRelayout}>
          <LayoutGrid aria-hidden className="size-4" strokeWidth={1.75} />
        </IconButton>
      </Tooltip>
    </div>
  );
}

function Legend() {
  const t = useSchemaWords();
  return (
    <div className="schema-legend" aria-label={t.legend.title}>
      <span className="schema-legend-item">
        <span className="schema-legend-line" aria-hidden />
        {t.legend.declared}
      </span>
      <span className="schema-legend-item">
        <span className="schema-legend-line schema-legend-dashed" aria-hidden />
        {t.legend.implied}
      </span>
      <span className="schema-legend-item">
        <Sparkles aria-hidden className="size-3.5 text-info-soft-foreground" strokeWidth={2} />
        {t.legend.changed}
      </span>
      <span className="schema-legend-item">
        <Plus aria-hidden className="size-3.5 text-success-soft-foreground" strokeWidth={2} />
        {t.legend.proposed}
      </span>
    </div>
  );
}

export function Diagram() {
  const studio = useStudio();
  const canvas = useRef<HTMLDivElement>(null);
  return (
    <div
      ref={canvas}
      className="schema-canvas"
      dir="ltr"
      // Enter or Space on a table opens it in the inspector, as a click does, and moves focus there (review B2).
      onKeyDown={(event) => {
        if (!matchKey(event, 'Enter') && !matchKey(event, ' ')) return;
        const target = event.target as HTMLElement;
        if (!target.classList.contains('react-flow__node-table')) return;
        const name = target.dataset.id ?? '';
        if (!studio.doc.models.some((model) => model.name === name)) return;
        event.preventDefault();
        studio.select({ kind: 'model', name }, { focus: true });
      }}
    >
      <ReactFlowProvider>
        <Canvas canvas={canvas} />
      </ReactFlowProvider>
    </div>
  );
}
