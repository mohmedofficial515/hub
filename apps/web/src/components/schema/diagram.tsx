'use client';

/**
 * @file diagram.tsx
 * @description The design as a full-window map (docs/17 §4), in the manner of a design tool's canvas: domains as quiet zones, tables inside them, relations between them, and a
 * floating toolbar at the bottom with the zoom and the view's switches. Nothing sits on the map that it does not need.
 * Smooth by construction: hover and the selection's neighbourhood are painted by one generated stylesheet, and the semantic zoom is a data attribute and a CSS variable on the canvas,
 * so neither redraws a table. The 3D view tilts the map in perspective with the tables floating over their domains; dragging is off while tilted, because the pointer no longer maps
 * flat onto the map.
 * By keyboard (review B2): the toolbar comes before the tables in Tab order, Enter or Space on a table opens it in the panel, and a table reached by Tab far out is brought close.
 * Fitting and centring keep clear of whatever floats over the canvas: the top bars, the toolbar, the layers and the side panel (review M8).
 * Keys on the map: Shift+1 or F fits, 0 is 100%, + and − zoom, T tilts, M shows the minimap.
 */
import '@xyflow/react/dist/style.css';

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
  useStore,
} from '@xyflow/react';
import {
  Box as BoxIcon,
  Focus,
  Languages,
  LayoutGrid,
  MapIcon,
  Maximize,
  Minus,
  Plus,
  Rows3,
  Spline,
  X,
} from 'lucide-react';
import { type RefObject, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

import {
  Button,
  fmt,
  IconButton,
  matchKey,
  num,
  shortcutsEnabled,
  Tooltip,
  useLocale,
  useRoute,
} from '@/components/kit';

import { DraftPill } from './draft-dock';
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
import { useChrome, useSchemaWords, useStudio } from './studio';
import { DomainNode, type DomainNodeData, HoverContext, TableNode, type TableNodeData } from './table-node';

const NODE_TYPES = { table: TableNode, domain: DomainNode };
const GHOST_DOMAIN = '__proposed';
/** Below `MAP` the map shows blocks and domain names, below `FAR` a table is its name, below `MID` its columns thin out. */
const MAP = 0.22;
const FAR = 0.36;
const MID = 0.7;

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

interface Covered {
  top: number;
  bottom: number;
  left: number;
  right: number;
  width: number;
  height: number;
}

/** How far in from each edge the floating parts cover the canvas: the top bars, the toolbar, the layers and the side panel. */
function coveredEdges(canvas: HTMLElement | null): Covered {
  const none = { top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0 };
  if (!canvas) return none;
  const box = canvas.getBoundingClientRect();
  const covered = { ...none, width: box.width, height: box.height };
  const studio = canvas.closest('.schema-studio');
  const rect = (selector: string) =>
    [...(studio?.querySelectorAll<HTMLElement>(selector) ?? [])].map((element) =>
      element.getBoundingClientRect(),
    );
  for (const bar of rect('.schema-topbar')) covered.top = Math.max(covered.top, bar.bottom - box.top);
  for (const bar of rect('.schema-toolbar')) covered.bottom = Math.max(covered.bottom, box.bottom - bar.top);
  for (const side of rect('.schema-layers, .schema-panel')) {
    if (side.width === 0) continue;
    if (side.left + side.width / 2 < box.left + box.width / 2) {
      covered.left = Math.max(covered.left, side.right - box.left);
    } else {
      covered.right = Math.max(covered.right, box.right - side.left);
    }
  }
  return covered;
}

/** Fit padding that keeps every domain out from under what floats over the canvas. */
function fitPadding(canvas: HTMLElement | null) {
  const covered = coveredEdges(canvas);
  if (!covered.height) return INITIAL_FIT_PADDING;
  const px = (value: number) => `${Math.round(value + 20)}px` as const;
  return {
    // Far out, a domain's name stands above its zone, so the top keeps room for the first row's names.
    top: px(covered.top + 28),
    bottom: px(covered.bottom),
    left: px(covered.left),
    right: px(covered.right),
  };
}

const INITIAL_FIT_PADDING = { top: '80px', bottom: '84px', left: '40px', right: '40px' } as const;

function sides(from: Box, to: Box): { sourceHandle: string; targetHandle: string } {
  const fromCentre = from.x + from.width / 2;
  const toCentre = to.x + to.width / 2;
  if (Math.abs(fromCentre - toCentre) < from.width * 0.6) return { sourceHandle: 'r', targetHandle: 'tr' };
  return fromCentre < toCentre
    ? { sourceHandle: 'r', targetHandle: 'tl' }
    : { sourceHandle: 'l', targetHandle: 'tr' };
}

/** Writes the zoom onto the canvas, for the stylesheet: `data-zoom` and `--schema-zinv`. One tiny component re-renders per frame; no table does. */
function ZoomMarks({ canvas }: { canvas: RefObject<HTMLDivElement | null> }) {
  const zoom = useStore((state) => state.transform[2]);
  useLayoutEffect(() => {
    const element = canvas.current;
    if (!element) return;
    element.style.setProperty('--schema-zinv', (1 / zoom).toFixed(4));
    const tier = zoom < MAP ? 'map' : zoom < FAR ? 'far' : zoom < MID ? 'mid' : 'near';
    if (element.dataset.zoom !== tier) element.dataset.zoom = tier;
  }, [zoom, canvas]);
  return null;
}

const quoted = (value: string) => `"${value.replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`;

function Canvas({ canvas }: { canvas: RefObject<HTMLDivElement | null> }) {
  const studio = useStudio();
  const chrome = useChrome();
  const t = useSchemaWords();
  const locale = useLocale();
  const { ws } = useRoute();
  const flow = useReactFlow();
  const rtl = locale === 'ar';
  const { doc, prefs, focus, marks } = studio;

  const [pinned, setPinned] = useState<Record<string, Point>>(() => readPinned(ws));

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
        data: ghost
          ? { model: name, height: box.height, ghost: { summary: ghost.change.summary } }
          : { model: name, height: box.height },
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
        (relation) =>
          (prefs.implied || !relation.implied) && positions.has(relation.from) && positions.has(relation.to),
      )
      .map(
        (relation) =>
          ({
            id: relation.id,
            source: relation.from,
            target: relation.to,
            type: 'smoothstep',
            pathOptions: { borderRadius: 18 },
            ...sides(positions.get(relation.from)!, positions.get(relation.to)!),
            className: relation.implied ? 'schema-edge schema-edge-implied' : 'schema-edge',
            markerEnd: {
              type: relation.cardinality === 'one_to_one' ? MarkerType.Arrow : MarkerType.ArrowClosed,
              width: 14,
              height: 14,
            },
            focusable: false,
          }) as Edge,
      );
  }, [nodes, doc.relations, prefs.implied, heightOf]);

  // ── Hover and the selection's neighbourhood, painted by one stylesheet ────────────────────────

  const paintSheet = useRef<HTMLStyleElement>(null);
  const hovered = useRef<string | null>(null);
  const selectedName = studio.selection?.name ?? null;
  const paint = useCallback(
    (active: string | null) => {
      const sheet = paintSheet.current;
      const box = canvas.current;
      if (!sheet || !box) return;
      if (!active || !shown.has(active)) {
        sheet.textContent = '';
        delete box.dataset.hot;
        return;
      }
      const hot = neighbourhood(doc, active, 1, prefs.implied);
      const lit = doc.relations
        .filter(
          (relation) =>
            (prefs.implied || !relation.implied) && (relation.from === active || relation.to === active),
        )
        .map((relation) => relation.id);
      const tables = [...hot].map((name) => `[data-id=${quoted(name)}]`).join(',');
      const lines = [
        `.schema-canvas[data-hot] .react-flow__node-table:not(${tables}) .schema-node{opacity:.2}`,
        `.schema-canvas[data-hot] .react-flow__edge${lit.length ? `:not(${lit.map((id) => `[data-id=${quoted(id)}]`).join(',')})` : ''}{opacity:.07}`,
      ];
      if (lit.length) {
        lines.push(
          `.schema-canvas[data-hot] :is(${lit.map((id) => `.react-flow__edge[data-id=${quoted(id)}]`).join(',')}) .react-flow__edge-path{stroke:var(--primary);stroke-width:2.2;stroke-dasharray:8 6;animation:schema-flow .8s linear infinite}`,
        );
      }
      sheet.textContent = lines.join('\n');
      box.dataset.hot = '';
    },
    [canvas, shown, doc, prefs.implied],
  );
  const paintRef = useRef(paint);
  const selectedRef = useRef(selectedName);
  useLayoutEffect(() => {
    paintRef.current = paint;
    selectedRef.current = selectedName;
    paint(hovered.current ?? selectedName);
  }, [paint, selectedName]);
  const hover = useCallback((model: string | null) => {
    hovered.current = model;
    paintRef.current(model ?? selectedRef.current);
  }, []);

  // ── Moving the view ───────────────────────────────────────────────────────────────────────────

  const fit = useCallback(
    (duration = 450) => void flow.fitView({ padding: fitPadding(canvas.current), duration }),
    [flow, canvas],
  );

  // Centre a table in the part of the canvas nothing covers. A table taller than that starts just under the top bars.
  const centreOn = useCallback(
    (node: Node, zoom: number, duration: number) => {
      const covered = coveredEdges(canvas.current);
      const height = node.measured?.height ?? 200;
      const clear = covered.height - covered.top - covered.bottom;
      const x = node.position.x + NODE_WIDTH / 2 - (covered.left - covered.right) / 2 / zoom;
      const y =
        height * zoom + 24 <= clear
          ? node.position.y + height / 2 + (covered.bottom - covered.top) / 2 / zoom
          : node.position.y + (covered.height / 2 - covered.top - 12) / zoom;
      void flow.setCenter(x, y, { zoom, duration });
    },
    [canvas, flow],
  );

  // Centre on a table asked for by search, the panel, the layers or the dictionary.
  const lastReveal = useRef(0);
  useEffect(() => {
    const reveal = studio.reveal;
    if (!reveal || reveal.tick === lastReveal.current) return;
    lastReveal.current = reveal.tick;
    const node = nodes.find((entry) => entry.id === reveal.model);
    if (!node) return;
    centreOn(node, Math.max(flow.getZoom(), 0.9), 650);
  }, [studio.reveal, nodes, centreOn, flow]);

  // A new focus or filter fits the view to what is shown.
  const fitKey = `${focus ?? ''}|${prefs.hidden.join(',')}`;
  useEffect(() => {
    const id = window.setTimeout(() => fit(550), 60);
    return () => window.clearTimeout(id);
  }, [fitKey, fit]);

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

  // The map's own keys, when nothing is being typed and no dialog is open.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey || !shortcutsEnabled()) return;
      const target = event.target as HTMLElement | null;
      if (
        target?.closest('input, textarea, select, [contenteditable="true"], [role="dialog"], [role="menu"]')
      )
        return;
      const run = (action: () => void) => {
        event.preventDefault();
        action();
      };
      if ((event.code === 'Digit1' && event.shiftKey) || matchKey(event, 'f')) run(() => fit());
      else if (event.code === 'Digit0' || event.key === '0')
        run(() => void flow.zoomTo(1, { duration: 300 }));
      else if (event.key === '+' || event.key === '=' || event.code === 'NumpadAdd')
        run(() => void flow.zoomIn({ duration: 220 }));
      else if (event.key === '-' || event.code === 'NumpadSubtract')
        run(() => void flow.zoomOut({ duration: 220 }));
      else if (matchKey(event, 't')) run(() => chrome.setTilt(!chrome.tilt));
      else if (matchKey(event, 'm')) run(() => chrome.setMinimap(!chrome.minimap));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [fit, flow, chrome]);

  return (
    <HoverContext.Provider value={hover}>
      <style ref={paintSheet} />
      <Toolbar
        onFit={() => fit(400)}
        onRelayout={() => {
          setPinned({});
          writePinned(ws, {});
          window.setTimeout(() => fit(450), 60);
        }}
      />
      {focus && (
        <div className="schema-focus-pill" dir={rtl ? 'rtl' : 'ltr'}>
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
        nodesDraggable={!chrome.tilt}
        elementsSelectable
        zoomOnDoubleClick={false}
        minZoom={0.06}
        maxZoom={2.5}
        fitView
        fitViewOptions={{ padding: INITIAL_FIT_PADDING }}
        proOptions={{ hideAttribution: true }}
        className="schema-flow"
      >
        <ZoomMarks canvas={canvas} />
        <Background variant={BackgroundVariant.Dots} gap={24} size={1.3} className="schema-bg" />
        {chrome.minimap && !chrome.panel && (
          <MiniMap
            pannable
            zoomable
            position={rtl ? 'bottom-left' : 'bottom-right'}
            className="schema-minimap"
            ariaLabel={t.chrome.minimap}
            nodeColor={(node) =>
              node.type === 'domain'
                ? 'transparent'
                : `var(--type-${studio.tones.get(doc.models.find((model) => model.name === node.id)?.domain ?? '') ?? 'doc'})`
            }
            nodeBorderRadius={6}
            nodeStrokeWidth={0}
            maskColor="var(--schema-mask)"
          />
        )}
      </ReactFlow>
    </HoverContext.Provider>
  );
}

/** The zoom as a percentage; a press fits the map. */
function ZoomLevel({ onFit }: { onFit: () => void }) {
  const t = useSchemaWords();
  const locale = useLocale();
  const pct = useStore((state) => Math.round(state.transform[2] * 100));
  return (
    <Tooltip content={t.chrome.zoomTip}>
      <button
        type="button"
        className="schema-zoom-level"
        onClick={onFit}
        aria-label={fmt(t.chrome.zoomLevel, { pct: num(pct, locale) })}
      >
        {fmt(t.stats.pct, { pct: num(pct, locale) })}
      </button>
    </Tooltip>
  );
}

function Toggle({
  pressed,
  label,
  tip,
  onPress,
  children,
}: {
  pressed: boolean;
  label: string;
  tip: string;
  onPress: () => void;
  children: React.ReactNode;
}) {
  return (
    <Tooltip content={tip}>
      <IconButton
        label={label}
        aria-pressed={pressed}
        data-pressed={pressed || undefined}
        className="schema-tool"
        onClick={onPress}
      >
        {children}
      </IconButton>
    </Tooltip>
  );
}

function Toolbar({ onRelayout, onFit }: { onRelayout: () => void; onFit: () => void }) {
  const studio = useStudio();
  const chrome = useChrome();
  const t = useSchemaWords();
  const locale = useLocale();
  const flow = useReactFlow();
  const { prefs } = studio;
  const icon = 'size-4';
  return (
    <div
      className="schema-toolbar"
      role="toolbar"
      aria-label={t.views.diagram}
      dir={locale === 'ar' ? 'rtl' : 'ltr'}
    >
      <div className="schema-toolbar-group">
        <Tooltip content={t.chrome.keys.zoomOut}>
          <IconButton
            label={t.actions.zoomOut}
            className="schema-tool"
            onClick={() => void flow.zoomOut({ duration: 220 })}
          >
            <Minus aria-hidden className={icon} strokeWidth={1.75} />
          </IconButton>
        </Tooltip>
        <ZoomLevel onFit={onFit} />
        <Tooltip content={t.chrome.keys.zoomIn}>
          <IconButton
            label={t.actions.zoomIn}
            className="schema-tool"
            onClick={() => void flow.zoomIn({ duration: 220 })}
          >
            <Plus aria-hidden className={icon} strokeWidth={1.75} />
          </IconButton>
        </Tooltip>
        <Tooltip content={t.chrome.keys.fit}>
          <IconButton label={t.actions.fit} className="schema-tool" onClick={onFit}>
            <Maximize aria-hidden className={icon} strokeWidth={1.75} />
          </IconButton>
        </Tooltip>
      </div>
      <span className="schema-toolbar-gap" aria-hidden />
      <div className="schema-toolbar-group">
        <Toggle
          pressed={prefs.detail === 'all'}
          label={t.actions.detailAll}
          tip={prefs.detail === 'all' ? t.actions.detailKeys : t.actions.detailAll}
          onPress={() => studio.setPrefs({ detail: prefs.detail === 'all' ? 'keys' : 'all' })}
        >
          <Rows3 aria-hidden className={icon} strokeWidth={1.75} />
        </Toggle>
        <Toggle
          pressed={prefs.labels === 'ar'}
          label={t.chrome.arabicNames}
          tip={prefs.labels === 'ar' ? t.chrome.showCode : t.chrome.showArabic}
          onPress={() => studio.setPrefs({ labels: prefs.labels === 'ar' ? 'code' : 'ar' })}
        >
          <Languages aria-hidden className={icon} strokeWidth={1.75} />
        </Toggle>
        <Toggle
          pressed={prefs.implied}
          label={t.actions.implied}
          tip={t.actions.implied}
          onPress={() => studio.setPrefs({ implied: !prefs.implied })}
        >
          <Spline aria-hidden className={icon} strokeWidth={1.75} />
        </Toggle>
        <Toggle
          pressed={chrome.tilt}
          label={t.chrome.tilt}
          tip={t.chrome.tiltTip}
          onPress={() => chrome.setTilt(!chrome.tilt)}
        >
          <BoxIcon aria-hidden className={icon} strokeWidth={1.75} />
        </Toggle>
        <Toggle
          pressed={chrome.minimap}
          label={t.chrome.minimap}
          tip={t.chrome.keys.minimap}
          onPress={() => chrome.setMinimap(!chrome.minimap)}
        >
          <MapIcon aria-hidden className={icon} strokeWidth={1.75} />
        </Toggle>
        <Tooltip content={t.actions.relayoutTip}>
          <IconButton label={t.actions.relayout} className="schema-tool" onClick={onRelayout}>
            <LayoutGrid aria-hidden className={icon} strokeWidth={1.75} />
          </IconButton>
        </Tooltip>
      </div>
      <span className="schema-toolbar-gap" aria-hidden />
      <DraftPill />
    </div>
  );
}

export function Diagram() {
  const studio = useStudio();
  const chrome = useChrome();
  const canvas = useRef<HTMLDivElement>(null);
  return (
    <div
      ref={canvas}
      className="schema-canvas"
      dir="ltr"
      data-tilt={chrome.tilt || undefined}
      // Enter or Space on a table opens it in the panel, as a click does, and moves focus there (review B2).
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
