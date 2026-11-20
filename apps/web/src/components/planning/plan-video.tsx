'use client';

/**
 * @file plan-video.tsx
 * @description The plan explained on video (v5-live-plan, batch 4), made by Hams on request. Asking records the request on the plan (for its
 * current revision) and adds an `explainer` run to the member's agent queue, on the device and in the folder where Hams lives; Claude makes the film
 * there with Hams' plan-film engine and attaches it. While it works, the five film stages come from the run's `report_stage`. The player has a
 * chapter per phase: the playing chapter is marked and lights its phase on the map (`onSpot`), with the captions and the poster. A film made for an
 * older revision says so and offers to make it again. "Open in Hams" shows only when the run named Hams' project.
 */
import type { ExplainerRequest, PlanExplainer } from '@hub/contracts';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, Clapperboard, ExternalLink, Loader2, RefreshCw, TriangleAlert, Video } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import {
  Button,
  cn,
  fmt,
  focusRing,
  kitMessages,
  Ltr,
  num,
  showToast,
  useLocale,
  useRoute,
  useT,
} from '@/components/kit';
import { useRunPlace } from '@/components/queue/run-bits';
import { revealChat, useMaybeWb } from '@/components/workbench/store';
import type { PlanCard } from '@/features/cards/types';
import { useChat } from '@/features/chat/queries';
import { evidenceUrl } from '@/features/planning/evidence';
import {
  chapterAt,
  chapterPhase,
  clockOf,
  EXPLAINER_DEFAULT,
  explainerRuns,
  explainerView,
  FILM_STAGE_LIST,
  hamsFolderOf,
  requestExplainer,
} from '@/features/planning/explainer';
import { toneOf } from '@/features/planning/journey';
import { useAddRun, useQueue } from '@/features/queue/queries';
import { isHubError } from '@/lib/api/errors';

import { ExplainerRequestPanel } from './explainer-request';
import type { PlanningMessages } from './messages';

type Words = PlanningMessages['detail']['video'];

const voiceLabel = (v: Words, request: ExplainerRequest) =>
  request.voice === 'google'
    ? fmt(v.voiceGoogle, { name: request.googleVoice })
    : request.voice === 'hams'
      ? v.voiceHams
      : v.voiceNone;

/** The film and its chapters, playing; a chapter lights its phase on the map. */
function Player({
  card,
  film,
  onSpot,
}: {
  card: PlanCard;
  film: Pick<PlanExplainer, 'attachmentId' | 'posterId' | 'captionsId' | 'chapters'>;
  onSpot: (phase: number | null) => void;
}) {
  const v = useT<PlanningMessages>('planning').detail.video;
  const locale = useLocale();
  const { ws } = useRoute();
  const video = useRef<HTMLVideoElement>(null);
  const [current, setCurrent] = useState(-1);
  const phases = card.plan.phases;
  const chapters = (film.chapters ?? []).map((chapter, index, all) => {
    const phase = chapterPhase(chapter.phaseId, phases);
    const title =
      phase !== null
        ? (phases[phase]?.title ?? chapter.title ?? '')
        : index === 0
          ? v.intro_
          : index === all.length - 1
            ? v.outro
            : (chapter.title ?? v.intro_);
    return { phase, title, start: chapter.start };
  });
  const url = (id: string | undefined) => (id ? evidenceUrl(ws, card.key, id) : undefined);

  const onTime = () => {
    const el = video.current;
    if (!el || chapters.length === 0) return;
    const at = chapterAt(chapters, el.currentTime);
    if (at !== current) setCurrent(at);
    onSpot(el.paused ? null : (chapters[at]?.phase ?? null));
  };
  const seek = (index: number) => {
    const el = video.current;
    if (!el) return;
    el.currentTime = (chapters[index]?.start ?? 0) + 0.05;
    void el.play().catch(() => undefined);
  };
  useEffect(() => () => onSpot(null), [onSpot]);

  return (
    <div className="grid min-w-0 items-start gap-4 @page-lg:grid-cols-[minmax(0,1fr)_17rem]">
      <video
        ref={video}
        data-pj-explainer-video
        className="pj-video aspect-video"
        src={url(film.attachmentId)}
        poster={url(film.posterId)}
        controls
        preload="metadata"
        playsInline
        onTimeUpdate={onTime}
        onPlay={onTime}
        onPause={() => onSpot(null)}
        onEnded={() => onSpot(null)}
      >
        {film.captionsId && (
          <track kind="captions" srcLang="ar" label={v.captionsLabel} src={url(film.captionsId)} default />
        )}
      </video>
      {chapters.length > 0 && (
        <nav aria-label={v.chapters} className="flex min-w-0 flex-col gap-1">
          <h3 className="px-2 text-caption font-semibold text-muted-foreground">{v.chapters}</h3>
          <ol className="flex max-h-90 flex-col gap-0.5 overflow-y-auto">
            {chapters.map((chapter, index) => (
              <li key={`${index}-${chapter.start}`}>
                <button
                  type="button"
                  data-pj-tone={chapter.phase === null ? undefined : toneOf(chapter.phase)}
                  aria-current={current === index}
                  onClick={() => seek(index)}
                  className={cn(
                    'flex w-full min-w-0 items-center gap-2.5 rounded-lg px-2 py-1.5 text-start hover:bg-accent',
                    current === index && 'bg-accent',
                    focusRing,
                  )}
                >
                  <span
                    aria-hidden
                    className={cn(
                      'grid size-6 shrink-0 place-items-center rounded-md text-caption font-bold',
                      chapter.phase === null ? 'bg-muted text-foreground' : 'pj-tone-bg',
                    )}
                  >
                    {chapter.phase === null ? (
                      <Video className="size-3.5" strokeWidth={2} />
                    ) : (
                      <Ltr>{num(chapter.phase, locale)}</Ltr>
                    )}
                  </span>
                  <span dir="auto" className="min-w-0 flex-1 truncate text-body-sm text-foreground">
                    {chapter.title}
                  </span>
                  <Ltr className="shrink-0 text-caption text-muted-foreground tabular-nums">
                    {clockOf(chapter.start)}
                  </Ltr>
                </button>
              </li>
            ))}
          </ol>
        </nav>
      )}
    </div>
  );
}

export function PlanVideo({ card, onSpot }: { card: PlanCard; onSpot: (phase: number | null) => void }) {
  const v = useT<PlanningMessages>('planning').detail.video;
  const kit = useT(kitMessages);
  const locale = useLocale();
  const wb = useMaybeWb();
  const place = useRunPlace();
  const queue = useQueue({ enabled: !!wb });
  const runs = explainerRuns(queue.data?.runs ?? [], card.key);
  const explainer = card.plan.explainer ?? null;
  const revision = Number((card.plan as { revision?: number }).revision ?? 1);
  const active = runs.find((run) => run.state === 'running' || run.state === 'waiting') ?? null;
  const chat = useChat(active?.chatId ?? null);
  const turn = chat.data?.messages.find((m) => m.id === active?.messageId) ?? chat.data?.messages.at(-1);
  const view = explainerView({ explainer, planRevision: revision, runs, stages: turn?.stages });
  const canAsk = !card.archivedAt && card.allowedActions.includes('plan.request_explainer');
  const [asking, setAsking] = useState(false);
  const [request, setRequest] = useState<ExplainerRequest>(explainer?.request ?? EXPLAINER_DEFAULT);
  const [folder, setFolder] = useState<string | null>(() => hamsFolderOf(place.folders));
  const [busy, setBusy] = useState(false);
  const add = useAddRun();

  useEffect(() => {
    if (!folder) setFolder(hamsFolderOf(place.folders));
  }, [folder, place.folders]);

  const start = async () => {
    if (!place.device || !folder) return;
    setBusy(true);
    try {
      await requestExplainer(card.key, request);
      await add.mutateAsync({
        source: 'explainer',
        cardKey: card.key,
        device: place.device,
        folder,
        when: { kind: 'now' },
      });
      setAsking(false);
    } catch (error: unknown) {
      showToast({ tone: 'error', message: isHubError(error) ? error.message : kit.actionFailed });
    } finally {
      setBusy(false);
    }
  };

  // The film still to play: the one made, or the one kept while a new one is made.
  const film =
    view.state === 'ready' ? view.explainer : explainer?.previous ? { ...explainer.previous } : null;
  const made = view.state === 'ready' ? view.explainer : explainer?.previous;

  return (
    <section
      aria-labelledby={`video-${card.key}`}
      data-pj-explainer={view.state}
      className="flex min-w-0 flex-col gap-4 rounded-2xl border border-border bg-card p-4 shadow-xs md:p-6"
    >
      <header className="flex min-w-0 flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h2
            id={`video-${card.key}`}
            className="flex items-center gap-2 text-title-sm font-semibold text-foreground"
          >
            <Clapperboard aria-hidden className="size-4 text-muted-foreground" strokeWidth={1.75} />
            {v.title}
          </h2>
          <p className="text-body-sm text-muted-foreground">
            {asking ? v.askTitle : film ? v.hint : view.state === 'none' ? v.none : v.previous}
          </p>
        </div>
        {canAsk && !asking && (view.state === 'ready' || view.state === 'failed') && (
          <Button size="sm" variant="ghost" onClick={() => setAsking(true)}>
            <RefreshCw aria-hidden className="size-4" strokeWidth={1.75} />
            {v.again}
          </Button>
        )}
      </header>

      {view.state === 'ready' && view.outdated && (
        <p
          data-pj-explainer-outdated
          className="flex items-start gap-2 rounded-lg bg-warning-soft px-3 py-2 text-body-sm text-warning-soft-foreground"
        >
          <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} />
          {fmt(v.outdated, { n: num(view.explainer.revision, locale) })}
        </p>
      )}

      <AnimatePresence mode="wait" initial={false}>
        {asking ? (
          <motion.div
            key="asking"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3, ease: [0.2, 0.7, 0.2, 1] }}
            className="overflow-hidden"
          >
            <ExplainerRequestPanel
              value={request}
              onChange={setRequest}
              device={place.device ? place.deviceName || '—' : null}
              folders={place.folders}
              folder={folder}
              onFolder={setFolder}
              busy={busy}
              onStart={() => void start()}
              onCancel={() => setAsking(false)}
            />
          </motion.div>
        ) : view.state === 'none' ? (
          <motion.div
            key="none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-start gap-3 rounded-xl border border-dashed border-border p-5"
          >
            {canAsk && (
              <Button variant="primary" onClick={() => setAsking(true)}>
                <Video aria-hidden className="size-4" strokeWidth={2} />
                {v.request}
              </Button>
            )}
          </motion.div>
        ) : view.state === 'making' ? (
          <motion.div
            key="making"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            role="status"
            data-pj-explainer-making
            className="flex flex-col gap-3 rounded-xl border border-border p-5"
          >
            <p className="flex items-center gap-2 text-body font-semibold text-foreground">
              <Loader2
                aria-hidden
                className="size-4 animate-spin text-primary motion-reduce:animate-none"
                strokeWidth={2}
              />
              {v.making}
            </p>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
              <motion.span
                className="block h-full rounded-full bg-primary"
                initial={false}
                animate={{ width: `${Math.max(4, (view.done / FILM_STAGE_LIST.length) * 100)}%` }}
                transition={{ duration: 0.6 }}
              />
            </div>
            <ol aria-label={v.stagesLabel} className="flex flex-col gap-1.5">
              {FILM_STAGE_LIST.map((stage, index) => {
                const done = index < view.done;
                const now = view.current === stage;
                return (
                  <li
                    key={stage}
                    data-state={done ? 'done' : now ? 'started' : 'todo'}
                    className={cn(
                      'flex items-center gap-2 text-body-sm',
                      done || now ? 'text-foreground' : 'text-muted-foreground',
                    )}
                  >
                    <span
                      aria-hidden
                      className={cn(
                        'grid size-5 place-items-center rounded-full border-2',
                        done
                          ? 'border-primary bg-primary text-primary-foreground'
                          : now
                            ? 'border-primary'
                            : 'border-border',
                      )}
                    >
                      {done && <Check className="size-3" strokeWidth={3} />}
                    </span>
                    {fmt(v.stages[stage], { voice: voiceLabel(v, view.explainer.request) })}
                  </li>
                );
              })}
            </ol>
            {view.run.chatId && (
              <Button
                size="sm"
                variant="ghost"
                className="self-start"
                onClick={() => revealChat(view.run.chatId!)}
              >
                {v.openChat}
              </Button>
            )}
          </motion.div>
        ) : view.state === 'queued' || view.state === 'failed' ? (
          <motion.div
            key={view.state}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            role="status"
            data-pj-explainer-waiting={view.state}
            className={cn(
              'flex flex-col items-start gap-2 rounded-xl border p-4 text-body-sm',
              view.state === 'failed'
                ? 'border-destructive/40 text-destructive-soft-foreground'
                : 'border-border text-muted-foreground',
            )}
          >
            {view.state === 'failed' ? v.failed : fmt(v.asked, { device: place.deviceName || '—' })}
            {view.state === 'failed' && view.run.chatId && (
              <Button size="sm" variant="ghost" onClick={() => revealChat(view.run.chatId!)}>
                {v.openChat}
              </Button>
            )}
          </motion.div>
        ) : null}
      </AnimatePresence>

      {film && !asking && (
        <div className="flex min-w-0 flex-col gap-2">
          <Player card={card} film={film} onSpot={onSpot} />
          {made && (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-caption text-muted-foreground">
                {fmt(v.made, {
                  style: v.styles[made.request.style][0] ?? made.request.style,
                  voice: voiceLabel(v, made.request),
                  aspect: v.aspects[made.request.aspect],
                  n: num(made.revision, locale),
                })}
              </p>
              {view.state === 'ready' && view.explainer.hamsProject && (
                <a
                  href={view.explainer.hamsProject.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-body-sm text-foreground hover:bg-accent',
                    focusRing,
                  )}
                >
                  <ExternalLink aria-hidden className="size-3.5" strokeWidth={1.75} />
                  {v.openInHams}
                </a>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
