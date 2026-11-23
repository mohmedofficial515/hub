import { useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { Minus, Plus } from 'lucide-react';
import { cn } from '@lab/utils';

import { useAccount } from '../model';
import { clampCrop, COVER_GUIDES, coverScale, MAX_ZOOM, MIN_ZOOM, type Crop, type EditorKind, type Source } from './crop';

const STEP = 0.02; // arrow key: 2 % of the frame
const ZOOM_STEP = 0.1;

/** How a crop change came about: only key, wheel and button changes are announced (the slider speaks for itself). */
export type CropOrigin = 'pointer' | 'key' | 'slider';

/**
 * A fixed-ratio crop frame (lab stand-in for react-easy-crop): drag to pan, two fingers to pinch-zoom and pan, the
 * wheel or +/− to zoom, arrows to pan, R to rotate. The image can never leave an empty edge. Cover frames show the
 * desktop and phone guides measured on the page; the avatar frame shows the round mask.
 */
export function Cropper({
  kind,
  source,
  crop,
  aspect,
  onChange,
}: {
  kind: EditorKind;
  source: Source;
  crop: Crop;
  aspect: number;
  onChange: (crop: Crop, origin: CropOrigin) => void;
}) {
  const m = useAccount();
  const e = m.t.editor;
  const frame = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  // Active pointers and the gesture's start: one pointer pans, two pinch (zoom by distance, pan by midpoint).
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ crop: Crop; mid: { x: number; y: number }; dist: number } | null>(null);
  const helpId = useId();

  useEffect(() => {
    const el = frame.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setSize({ w: entry.contentRect.width, h: entry.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const set = (next: Partial<Crop>, origin: CropOrigin) => onChange(clampCrop({ ...crop, ...next }, source, aspect), origin);

  const snapshot = () => {
    const pts = [...pointers.current.values()];
    const mid = pts.reduce((a, p) => ({ x: a.x + p.x / pts.length, y: a.y + p.y / pts.length }), { x: 0, y: 0 });
    const dist = pts.length > 1 ? Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) : 0;
    return { mid, dist };
  };

  const onPointerDown = (ev: PointerEvent<HTMLDivElement>) => {
    if (ev.pointerType === 'mouse' && ev.button !== 0) return;
    ev.currentTarget.setPointerCapture(ev.pointerId);
    pointers.current.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    gesture.current = { crop, ...snapshot() };
  };
  const onPointerMove = (ev: PointerEvent<HTMLDivElement>) => {
    if (!pointers.current.has(ev.pointerId) || !gesture.current || size.w === 0) return;
    pointers.current.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    const g = gesture.current;
    const now = snapshot();
    const zoom = g.dist > 0 && now.dist > 0 ? g.crop.zoom * (now.dist / g.dist) : g.crop.zoom;
    onChange(
      clampCrop(
        { ...g.crop, zoom, x: g.crop.x + (now.mid.x - g.mid.x) / size.w, y: g.crop.y + (now.mid.y - g.mid.y) / size.h },
        source,
        aspect,
      ),
      'pointer',
    );
  };
  const onPointerUp = (ev: PointerEvent<HTMLDivElement>) => {
    pointers.current.delete(ev.pointerId);
    // Re-anchor the gesture so lifting one finger of a pinch does not jump.
    gesture.current = pointers.current.size > 0 ? { crop, ...snapshot() } : null;
  };

  const onKeyDown = (ev: KeyboardEvent<HTMLDivElement>) => {
    const k = ev.key;
    // Panning moves the image under a fixed frame, so the arrows are physical in both directions.
    if (k === 'ArrowLeft') set({ x: crop.x - STEP }, 'pointer');
    else if (k === 'ArrowRight') set({ x: crop.x + STEP }, 'pointer');
    else if (k === 'ArrowUp') set({ y: crop.y - STEP }, 'pointer');
    else if (k === 'ArrowDown') set({ y: crop.y + STEP }, 'pointer');
    else if (k === '+' || k === '=') set({ zoom: crop.zoom + ZOOM_STEP }, 'key');
    else if (k === '-' || k === '_') set({ zoom: crop.zoom - ZOOM_STEP }, 'key');
    else if (k === 'r' || k === 'R') set({ rotation: crop.rotation + 90 }, 'key');
    else return;
    ev.preventDefault();
  };

  // Same transform as renderCrop(): centre, offset, rotate, scale.
  const { scale } = coverScale(source, crop.rotation, size.w || 1, size.h || 1);
  const s = scale * crop.zoom;
  const transform = `translate(-50%, -50%) translate(${crop.x * size.w}px, ${crop.y * size.h}px) rotate(${crop.rotation}deg) scale(${s})`;

  return (
    <div className="space-y-2">
      <div
        ref={frame}
        role="group"
        tabIndex={0}
        aria-label={e.cropLabel}
        aria-describedby={helpId}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onWheel={(ev) => set({ zoom: crop.zoom + (ev.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP) }, 'key')}
        onKeyDown={onKeyDown}
        className={cn(
          'relative w-full cursor-grab touch-none overflow-hidden rounded-xl bg-(--navy-950) select-none active:cursor-grabbing',
          'outline-none focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:ring-offset-2 focus-visible:ring-offset-(--popover)',
          kind === 'avatar' && 'mx-auto max-w-[320px]',
        )}
        style={{ aspectRatio: String(aspect) }}
      >
        {size.w > 0 && (
          <img
            src={source.url}
            alt=""
            draggable={false}
            /* Physical centring (left 50 % + translate −50 %), not a direction: the same in RTL and LTR. */
            className="pointer-events-none absolute top-1/2 left-1/2 max-w-none"
            style={{ width: source.width, height: source.height, transform, transformOrigin: 'center' }}
          />
        )}

        {kind === 'avatar' ? (
          // Round mask: everything outside the circle is dimmed, the circle gets a 1 px white line.
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 m-auto aspect-square h-full rounded-full ring-1 ring-white/70"
            style={{ boxShadow: '0 0 0 9999px rgb(9 20 47 / 0.62)' }}
          />
        ) : (
          <CoverGuides desktop={e.guideDesktop} phone={e.guidePhone} />
        )}
      </div>
      <p id={helpId} className="text-sm text-(--ink-muted)">
        {e.cropHelp}
      </p>
    </div>
  );
}

/** Dashed frames for what a 1440 desktop (full width, middle band) and a 390 phone (middle column) show of the cover. */
function CoverGuides({ desktop, phone }: { desktop: string; phone: string }) {
  const d = COVER_GUIDES.desktop;
  const p = COVER_GUIDES.phone;
  const label = 'absolute rounded bg-(--navy-950)/85 px-1.5 text-sm leading-6 font-semibold text-white';
  return (
    <span aria-hidden className="pointer-events-none absolute inset-0">
      <span
        className="absolute inset-x-0 border-y-2 border-dashed border-white/90"
        style={{ top: `${d.y0 * 100}%`, bottom: `${(1 - d.y1) * 100}%` }}
      >
        <span className={cn(label, 'start-2 top-1')}>{desktop}</span>
      </span>
      <span
        className="absolute inset-y-0 border-x-2 border-dashed border-(--teal-400)"
        style={{ insetInlineStart: `${p.x0 * 100}%`, insetInlineEnd: `${(1 - p.x1) * 100}%` }}
      >
        <span className={cn(label, 'end-1 bottom-1')}>{phone}</span>
      </span>
    </span>
  );
}

/** Zoom: −, a slider with a minimum width, +. Its own row below md so it never collapses. */
export function ZoomControl({ crop, onChange }: { crop: Crop; onChange: (zoom: number, origin: CropOrigin) => void }) {
  const m = useAccount();
  const e = m.t.editor;
  const id = useId();
  const btn =
    'flex size-11 shrink-0 items-center justify-center rounded-md border border-(--border) text-(--ink) hover:bg-(--surface-2) disabled:opacity-40 outline-none focus-visible:ring-2 focus-visible:ring-(--ring)';
  return (
    <div className="flex w-full min-w-0 items-center gap-2 md:w-auto md:flex-1">
      <label htmlFor={id} className="shrink-0 text-sm font-semibold text-(--ink)">
        {e.zoom}
      </label>
      <button
        type="button"
        aria-label={e.zoomOut}
        disabled={crop.zoom <= MIN_ZOOM}
        onClick={() => onChange(crop.zoom - 0.1, 'key')}
        className={btn}
      >
        <Minus aria-hidden className="size-4" />
      </button>
      <input
        id={id}
        type="range"
        min={MIN_ZOOM}
        max={MAX_ZOOM}
        step={0.01}
        value={crop.zoom}
        aria-valuetext={e.zoomNow(Math.round(crop.zoom * 100))}
        onChange={(ev) => onChange(Number(ev.target.value), 'slider')}
        className="h-11 min-w-[120px] flex-1 cursor-pointer accent-(--action)"
      />
      <button
        type="button"
        aria-label={e.zoomIn}
        disabled={crop.zoom >= MAX_ZOOM}
        onClick={() => onChange(crop.zoom + 0.1, 'key')}
        className={btn}
      >
        <Plus aria-hidden className="size-4" />
      </button>
      <span aria-hidden className="w-12 shrink-0 text-end text-sm text-(--ink-muted) tabular-nums">
        {Math.round(crop.zoom * 100)}%
      </span>
    </div>
  );
}
