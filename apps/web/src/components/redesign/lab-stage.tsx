'use client';

/**
 * @file lab-stage.tsx
 * @description One pane of the gallery: a version in its own iframe at a real device width, the running page, or a baseline's pictures. Each version
 * keeps its own frame because the projects' stylesheets collide, and a version that fails shows its error there and nowhere else (docs/16 §6).
 */
import { ImageOff, ServerOff } from 'lucide-react';
import { type ReactNode, useLayoutEffect, useRef, useState } from 'react';

import { Bidi, Button, fill, fmt, Ltr, num, StatusBadge, useLocale, useT } from '@/components/kit';
import type { RedesignCard } from '@/features/cards/types';
import {
  deviceBox,
  frameSrc,
  type GalleryApp,
  type GalleryPage,
  type GalleryState,
  type GalleryWidth,
  LIVE,
  paneBody,
  shotName,
} from '@/features/redesign/gallery';
import { useLabRunning, useShots } from '@/features/redesign/queries';
import type { RedesignMessages } from '@/lib/i18n/page-dicts';

/** Renders `src` at a real device width, so breakpoints fire, and scales it down to fit. */
function Device({ width, src, title }: { width: GalleryWidth; src: string; title: string }) {
  const locale = useLocale();
  const box = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  useLayoutEffect(() => {
    const element = box.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setSize({ w: entry.contentRect.width, h: entry.contentRect.height });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const { target, height, scale } = deviceBox(width, size);
  const framed = width !== 'fill';
  return (
    // The geometry is the same in both languages: the frame's own `dir` is set inside it, from the toolbar.
    <div ref={box} dir="ltr" className="absolute inset-0 flex justify-center overflow-hidden bg-muted">
      {size.w > 0 && (
        <div
          className={
            framed ? 'mt-6 shrink-0 overflow-hidden rounded-lg border border-border shadow-md' : 'w-full'
          }
          style={framed ? { width: target * scale, height: height * scale } : undefined}
        >
          <iframe
            title={title}
            src={src}
            data-lab-frame={title}
            className="bg-background"
            style={{
              width: target,
              height,
              transform: `scale(${scale})`,
              transformOrigin: '0 0',
              border: 0,
            }}
          />
        </div>
      )}
      {framed && size.w > 0 && (
        <p className="absolute end-3 bottom-2 rounded-sm bg-muted px-1 text-caption text-muted-foreground">
          {`${num(target, locale)}px · ${num(Math.round(scale * 100), locale)}%`}
        </p>
      )}
    </div>
  );
}

/** A baseline's pictures. A file named for the toolbar's mode is shown alone, otherwise all of them, and the page says so. */
function Screenshots({ card, state }: { card: RedesignCard | undefined; state: GalleryState }) {
  const t = useT<RedesignMessages>('redesign');
  const { shots } = useShots(card);
  const wanted = shotName(state);
  const match = shots.find((shot) => shot.name.startsWith(wanted));
  const list = match ? [match] : shots;
  return (
    <div className="absolute inset-0 flex flex-col gap-6 overflow-y-auto bg-muted p-4 md:p-6">
      {!match && (
        <p className="text-body-sm text-muted-foreground">
          {fill(t.gallery.noShotNamed, { name: <Ltr mono>{`${wanted}.png`}</Ltr> })}
        </p>
      )}
      {list.map((shot) => (
        <figure key={shot.name} className="mx-auto flex max-w-full flex-col gap-2">
          {/* The API serves it from the lab folder. Next's image optimiser would ask for the file a second time. */}
          <img
            src={shot.url}
            alt={fmt(t.shotAlt, { version: card?.redesign.version ?? '' })}
            loading="lazy"
            className="max-w-full rounded-lg border border-border"
          />
          <figcaption className="text-center text-caption text-muted-foreground">
            <Ltr mono>{shot.name}</Ltr>
          </figcaption>
        </figure>
      ))}
    </div>
  );
}

function Message({ children }: { children: ReactNode }) {
  return (
    <div className="absolute inset-0 grid place-items-center bg-muted p-6 text-center text-body-sm text-muted-foreground">
      <div className="flex max-w-md flex-col items-center gap-3">{children}</div>
    </div>
  );
}

/** The lab itself is down: that is its own honest state, and pictures and the review flow keep working. */
function LabDown({ onRetry }: { onRetry: () => void }) {
  const t = useT<RedesignMessages>('redesign');
  return (
    <Message>
      <ServerOff aria-hidden className="size-5" strokeWidth={1.75} />
      <p className="text-body font-medium text-foreground">{t.gallery.downTitle}</p>
      <p>{fill(t.gallery.downBody, { command: <Ltr mono>pnpm start:local</Ltr> })}</p>
      <Button onClick={onRetry}>{t.gallery.downRetry}</Button>
    </Message>
  );
}

export function LabPane({
  state,
  app,
  page,
  pageSlug,
  version,
  card,
  label,
}: {
  state: GalleryState;
  app: GalleryApp;
  page: GalleryPage | undefined;
  pageSlug: string;
  version: string;
  card: RedesignCard | undefined;
  /** A compare names each side. */
  label: boolean;
}) {
  const t = useT<RedesignMessages>('redesign');
  const running = useLabRunning();
  const { shots } = useShots(card);
  const body = paneBody(page, pageSlug, version, shots.length || (card?.attachments.length ?? 0));

  let content: ReactNode;
  if (body === 'frame') {
    content =
      running.data === false ? (
        <LabDown onRetry={() => void running.refetch()} />
      ) : (
        <Device
          width={state.width}
          src={frameSrc(app, pageSlug, version, state)}
          title={`${app}/${pageSlug}/${version}`}
        />
      );
  } else if (body === 'live' && page?.liveUrl) {
    content = <Device width={state.width} src={page.liveUrl} title={`${app}/${pageSlug}/${LIVE}`} />;
  } else if (body === 'shots') {
    content = <Screenshots card={card} state={state} />;
  } else {
    content = (
      <Message>
        <ImageOff aria-hidden className="size-5" strokeWidth={1.75} />
        <p>{fill(t.gallery.nothing, { version: <Ltr mono>{version}</Ltr> })}</p>
      </Message>
    );
  }

  return (
    <section aria-label={version} className="flex min-h-[70dvh] min-w-0 flex-1 flex-col md:min-h-0">
      {label && (
        <div className="flex flex-wrap items-center gap-2 border-b border-border bg-card px-3 py-1.5">
          <Ltr mono className="text-body-sm font-medium text-foreground">
            {version === LIVE ? t.gallery.live : version}
          </Ltr>
          {card && <StatusBadge status={card.status} />}
          {card && (
            <span className="min-w-0 truncate text-body-sm text-muted-foreground">
              <Bidi>{card.redesign.concept}</Bidi>
            </span>
          )}
        </div>
      )}
      <div className="relative min-h-0 flex-1">{content}</div>
    </section>
  );
}
