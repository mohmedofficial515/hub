import { useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { cn } from '@lab/utils';

import { useAccount } from '../model';
import { clampCrop, COVER_GUIDES, coverScale, MAX_ZOOM, MIN_ZOOM, type Crop, type EditorKind, type Source } from './crop';

const STEP = 0.02; // arrow key: 2 % of the frame
const ZOOM_STEP = 0.1;

/**
 * A fixed-ratio crop frame (lab stand-in for react-easy-crop): drag or arrow keys to pan, +/− (or the wheel) to zoom,
 * R to rotate. The image can never leave an empty edge. Cover frames show the desktop and phone guides; the avatar
 * frame shows the round mask.
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
  onChange: (crop: Crop) => void;
}) {
  const m = useAccount();
  const e = m.t.editor;
  const frame = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const drag = useRef<{ id: number; x: number; y: number; start: Crop } | null>(null);
  const helpId = useId();

  useEffect(() => {
    const el = frame.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setSize({ w: entry.contentRect.width, h: entry.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const set = (next: Partial<Crop>) => onChange(clampCrop({ ...crop, ...next }, source, aspect));

  const onPointerDown = (ev: PointerEvent<HTMLDivElement>) => {
    if (ev.button !== 0) return;
    ev.currentTarget.setPointerCapture(ev.pointerId);
    drag.current = { id: ev.pointerId, x: ev.clientX, y: ev.clientY, start: crop };
  };
  const onPointerMove = (ev: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.id !== ev.pointerId || size.w === 0) return;
    onChange(
      clampCrop(
        { ...d.start, x: d.start.x + (ev.clientX - d.x) / size.w, y: d.start.y + (ev.clientY - d.y) / size.h },
        source,
        aspect,
      ),
    );
  };
  const onPointerUp = (ev: PointerEvent<HTMLDivElement>) => {
    if (drag.current?.id === ev.pointerId) drag.current = null;
  };

  const onKeyDown = (ev: KeyboardEvent<HTMLDivElement>) => {
    const k = ev.key;
    // Panning moves the image under a fixed frame, so the arrows are physical in both directions.
    if (k === 'ArrowLeft') set({ x: crop.x - STEP });
    else if (k === 'ArrowRight') set({ x: crop.x + STEP });
    else if (k === 'ArrowUp') set({ y: crop.y - STEP });
    else if (k === 'ArrowDown') set({ y: crop.y + STEP });
    else if (k === '+' || k === '=') set({ zoom: crop.zoom + ZOOM_STEP });
    else if (k === '-' || k === '_') set({ zoom: crop.zoom - ZOOM_STEP });
    else if (k === 'r' || k === 'R') set({ rotation: crop.rotation + 90 });
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
        onWheel={(ev) => set({ zoom: crop.zoom + (ev.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP) })}
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
            // Physical centring (left 50 % + translate -50 %), not a direction: the same in RTL and LTR.
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

/** Dashed frames for what desktop (full width, middle band) and a phone (middle column) will show of the cover. */
function CoverGuides({ desktop, phone }: { desktop: string; phone: string }) {
  const d = COVER_GUIDES.desktop;
  const p = COVER_GUIDES.phone;
  const label = 'absolute rounded bg-(--navy-950)/80 px-1.5 text-xs leading-5 font-semibold text-white';
  return (
    <span aria-hidden className="pointer-events-none absolute inset-0">
      <span
        className="absolute inset-x-0 border-y border-dashed border-white/85"
        style={{ top: `${((1 - d.height) / 2) * 100}%`, bottom: `${((1 - d.height) / 2) * 100}%` }}
      >
        <span className={cn(label, 'start-2 top-1')}>{desktop}</span>
      </span>
      <span
        className="absolute inset-y-0 border-x border-dashed border-(--teal-400)"
        style={{ insetInlineStart: `${((1 - p.width) / 2) * 100}%`, insetInlineEnd: `${((1 - p.width) / 2) * 100}%` }}
      >
        <span className={cn(label, 'end-1 bottom-1')}>{phone}</span>
      </span>
    </span>
  );
}

export function ZoomControl({ crop, onChange }: { crop: Crop; onChange: (zoom: number) => void }) {
  const m = useAccount();
  const id = useId();
  return (
    <div className="flex min-w-0 flex-1 items-center gap-3">
      <label htmlFor={id} className="shrink-0 text-sm font-semibold text-(--ink)">
        {m.t.editor.zoom}
      </label>
      <input
        id={id}
        type="range"
        min={MIN_ZOOM}
        max={MAX_ZOOM}
        step={0.01}
        value={crop.zoom}
        aria-valuetext={m.t.editor.zoomNow(Math.round(crop.zoom * 100))}
        onChange={(ev) => onChange(Number(ev.target.value))}
        className="h-11 min-w-0 flex-1 cursor-pointer accent-(--action)"
      />
      <span className="w-12 shrink-0 text-end text-sm text-(--ink-muted) tabular-nums">
        {Math.round(crop.zoom * 100)}%
      </span>
    </div>
  );
}
