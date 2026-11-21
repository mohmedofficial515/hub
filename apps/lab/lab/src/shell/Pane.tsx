import { useLayoutEffect, useRef, useState } from 'react';
import { findVersion, registry, type App } from '../core/registry';
import { dirOf, frameHash } from '../core/view';
import type { Route, Width } from './route';
import { StatusBadge } from './status';

interface PaneProps {
  route: Route;
  app: App;
  page: string;
  version: string;
  label?: boolean;
}

export function Pane({ route, app, page, version, label }: PaneProps) {
  const entry = registry.find((p) => p.app === app && p.slug === page);
  const v = page === '_tokens' ? null : findVersion(app, page, version);

  let body: React.ReactNode;
  if (page === '_tokens' || v?.load) {
    body = <Device width={route.width} src={`${import.meta.env.BASE_URL}frame-${app}.html${frameHash(page, version, route)}`} />;
  } else if (version === 'live' && entry?.liveUrl) {
    body = <Device width={route.width} src={entry.liveUrl} />;
  } else if (v?.screenshots.length) {
    body = <Screenshots shots={v.screenshots} route={route} />;
  } else {
    body = <p className="p-8 text-sm text-zinc-500">Nothing to render yet for {version}.</p>;
  }

  return (
    <section className="flex min-w-0 flex-1 flex-col">
      {label && (
        <div className="flex items-center gap-2 border-b border-white/5 px-3 py-1.5 text-xs text-zinc-400">
          <span className="font-medium text-zinc-200">{version}</span>
          {v && <StatusBadge status={v.status} />}
        </div>
      )}
      <div className="min-h-0 flex-1">{body}</div>
    </section>
  );
}

/** Renders `src` at a real device width (so breakpoints fire) and scales it down to fit. */
function Device({ width, src }: { width: Width; src: string }) {
  const box = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  useLayoutEffect(() => {
    const el = box.current!;
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const pad = 24;
  const target = width === 'fill' ? Math.max(size.w, 1) : width;
  const scale = width === 'fill' ? 1 : Math.min(1, (size.w - pad * 2) / target);
  const height = width === 'fill' ? size.h : (size.h - pad * 2) / scale;

  return (
    <div ref={box} className="relative h-full overflow-hidden bg-[radial-gradient(circle_at_1px_1px,rgb(255_255_255/0.06)_1px,transparent_0)] [background-size:16px_16px]">
      {size.w > 0 && (
        <div
          className={width === 'fill' ? 'absolute inset-0' : 'absolute top-6 left-1/2 overflow-hidden rounded-xl shadow-2xl ring-1 ring-white/10'}
          style={width === 'fill' ? undefined : { width: target * scale, height: height * scale, transform: 'translateX(-50%)' }}
        >
          <iframe
            title={src}
            src={src}
            style={{ width: target, height, transform: `scale(${scale})`, transformOrigin: '0 0', border: 0, background: 'white' }}
          />
        </div>
      )}
      {width !== 'fill' && size.w > 0 && (
        <p className="absolute right-3 bottom-2 text-[10px] text-zinc-500">
          {target}px · {Math.round(scale * 100)}%
        </p>
      )}
    </div>
  );
}

/** Baseline screenshots; files named `<width>-<rtl|ltr>-<light|dark>.png` match the toolbar mode. */
function Screenshots({ shots, route }: { shots: { name: string; url: string }[]; route: Route }) {
  const wanted = `${route.width === 'fill' ? 1440 : route.width}-${dirOf(route.lang)}-${route.theme}`;
  const match = shots.find((s) => s.name.startsWith(wanted));
  const list = match ? [match] : shots;
  return (
    <div className="h-full space-y-6 overflow-y-auto p-6">
      {!match && <p className="text-xs text-zinc-500">No screenshot named {wanted}.png — showing all.</p>}
      {list.map((s) => (
        <figure key={s.name} className="mx-auto w-fit">
          <img src={s.url} alt={s.name} className="max-w-full rounded-lg shadow-2xl ring-1 ring-white/10" />
          <figcaption className="mt-2 text-center text-xs text-zinc-500">{s.name}</figcaption>
        </figure>
      ))}
    </div>
  );
}
