'use client';

/**
 * @file lab-stage.tsx
 * @description One pane of the lab: a version in its own iframe at a real device width, the running page, or a baseline's pictures. Each version
 * keeps its own frame because the projects' stylesheets collide, and a version that fails shows its error there and nowhere else (docs/16 §6).
 */
import { ImageOff, ServerOff } from 'lucide-react';
import { type ReactNode, useLayoutEffect, useRef, useState } from 'react';

import { AppLink, Bidi, cn, focusRing, Ltr } from '@/components/kit';
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
import { LAB_WORDS } from '@/features/redesign/lab-words';
import { useLabRunning, useShots } from '@/features/redesign/queries';

/** A status reads the same here as on its card: it is the card's own, and the live stream changes it. */
export function LabStatus({ status }: { status: string }) {
  return (
    <span
      data-status={status}
      className="lab-status shrink-0 rounded-full px-2 py-0.5 text-lab-micro font-medium tracking-wide uppercase"
    >
      {status.replaceAll('_', ' ')}
    </span>
  );
}

/** Renders `src` at a real device width, so breakpoints fire, and scales it down to fit. */
function Device({ width, src, title }: { width: GalleryWidth; src: string; title: string }) {
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
    <div ref={box} className="lab-stage absolute inset-0 overflow-hidden">
      {size.w > 0 && (
        <div className={framed ? 'absolute inset-x-0 top-6 flex justify-center' : 'absolute inset-0'}>
          <div
            className={framed ? 'overflow-hidden rounded-xl shadow-2xl ring-1 ring-white/10' : undefined}
            style={framed ? { width: target * scale, height: height * scale } : undefined}
          >
            <iframe
              title={title}
              src={src}
              data-lab-frame={title}
              style={{
                width: target,
                height,
                transform: `scale(${scale})`,
                transformOrigin: '0 0',
                border: 0,
                background: 'white',
              }}
            />
          </div>
        </div>
      )}
      {framed && size.w > 0 && (
        <p className="absolute end-3 bottom-2 text-lab-micro text-lab-faint">
          {`${target}px · ${Math.round(scale * 100)}%`}
        </p>
      )}
    </div>
  );
}

/** A baseline's pictures. A file named for the toolbar's mode is shown alone, otherwise all of them, and the page says so. */
function Screenshots({ card, state }: { card: RedesignCard | undefined; state: GalleryState }) {
  const { shots } = useShots(card);
  const wanted = shotName(state);
  const match = shots.find((shot) => shot.name.startsWith(wanted));
  const list = match ? [match] : shots;
  return (
    <div className="absolute inset-0 flex flex-col gap-6 overflow-y-auto p-6">
      {!match && <p className="text-xs text-lab-faint">{LAB_WORDS.noShotNamed(wanted)}</p>}
      {list.map((shot) => (
        <figure key={shot.name} className="mx-auto flex max-w-full flex-col gap-2">
          {/* The API serves it from the lab folder. Next's image optimiser would ask for the file a second time. */}
          <img
            src={shot.url}
            alt={`${card?.redesign.version ?? ''}: ${shot.name}`}
            loading="lazy"
            className="max-w-full rounded-lg shadow-2xl ring-1 ring-white/10"
          />
          <figcaption className="text-center text-xs text-lab-faint">{shot.name}</figcaption>
        </figure>
      ))}
    </div>
  );
}

function Message({ children }: { children: ReactNode }) {
  return (
    <div className="absolute inset-0 grid place-items-center p-6 text-center text-sm text-lab-dim">
      <div className="flex max-w-md flex-col items-center gap-3">{children}</div>
    </div>
  );
}

/** The lab itself is down: that is its own honest state, and pictures and the review flow keep working. */
function LabDown({ onRetry }: { onRetry: () => void }) {
  return (
    <Message>
      <ServerOff aria-hidden className="size-5" strokeWidth={1.75} />
      <p className="font-medium text-lab-text">{LAB_WORDS.downTitle}</p>
      <p>
        {LAB_WORDS.downBody} <code className="text-lab-soft">pnpm start:local</code>
      </p>
      <button
        type="button"
        onClick={onRetry}
        className={cn(
          'min-h-11 rounded-md bg-white/10 px-3 text-lab-text transition-colors hover:bg-white/15 md:min-h-8',
          focusRing,
        )}
      >
        {LAB_WORDS.downRetry}
      </button>
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
        <p>{LAB_WORDS.nothing(version)}</p>
      </Message>
    );
  }

  return (
    <section aria-label={version} className="flex min-h-[70dvh] min-w-0 flex-1 flex-col md:min-h-0">
      {label && (
        <div className="flex flex-wrap items-center gap-2 border-b border-white/5 px-3 py-1.5 text-xs text-lab-dim">
          <span className="font-medium text-lab-soft">{version}</span>
          {card && <LabStatus status={card.status} />}
          {card && (
            <AppLink
              card={card.key}
              aria-label={LAB_WORDS.openCard(card.key)}
              title={LAB_WORDS.openCard(card.key)}
              className={cn('rounded-sm hover:text-lab-text', focusRing)}
            >
              <Ltr mono>{card.key}</Ltr>
            </AppLink>
          )}
          {card && (
            <span className="min-w-0 truncate">
              <Bidi>{card.redesign.concept}</Bidi>
            </span>
          )}
        </div>
      )}
      <div className="relative min-h-0 flex-1">{content}</div>
    </section>
  );
}
