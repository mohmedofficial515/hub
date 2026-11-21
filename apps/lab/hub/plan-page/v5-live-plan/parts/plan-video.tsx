import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, Clapperboard, ExternalLink, Loader2, RefreshCw, Video } from 'lucide-react';
import { useLocale, useT } from '@lab/i18n';
import { cn } from '@lab/ui/hub-cn';
import { Button, fmt, focusRing, Ltr, num, showToast } from '../../../today/v5-peacock-app/kit';
import { HAMS_DEFAULT, HamsRequestPanel, type HamsRequest } from './hams-request';
import { messages } from '../i18n';
import { mediaUrl } from './media';
import type { PhaseGroup } from './model';
import { toneOf } from './tone';
import filmChapters from '../media/video/plan-explainer.chapters.json';

/** Where each chapter starts in the explainer Hams made (`chapters.json` of the film): the intro, a chapter per phase, the close. */
const MADE = filmChapters as { phase: number | null; title: string; start: number }[];

type VideoState = 'none' | 'asking' | 'making' | 'ready';

const clockOf = (at: number) => {
  const seconds = Math.floor(at);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
};

/**
 * The plan explained on video, made by Hams (F:/tools/hams) on request. NEW in Hub: `plan.explainer { attachmentId, captionsId,
 * chapters[{ phaseId|null, start }], revision, request }`. Hub sends the request (style, voice: Google by default, dialect, aspect,
 * length, captions) and the plan to Hams, Hams makes the video, Hub stores and plays it.
 * The player has chapters (an intro and one per phase). The playing chapter is marked in the list and lights its phase on the map
 * (`onSpot`), so the video and the map tell the same story. Native controls and Arabic captions.
 */
export function PlanVideo({ groups, revision, initial, onSpot }: { groups: PhaseGroup[]; revision: number; initial: VideoState; onSpot: (phase: number | null) => void }) {
  const t = useT(messages);
  const locale = useLocale();
  const [state, setState] = useState<VideoState>(initial);
  const [request, setRequest] = useState<HamsRequest>(HAMS_DEFAULT);
  const [made, setMade] = useState<HamsRequest>(HAMS_DEFAULT);
  const [hasVideo, setHasVideo] = useState(initial === 'ready');
  const [making, setMaking] = useState(0);
  const h = t.hams;
  const voiceLabel = (r: HamsRequest) => (r.voice === 'google' ? fmt(h.voiceGoogle, { name: r.googleVoice }) : r.voice === 'hams' ? h.voiceHams : h.voiceNone);
  const steps = h.steps.map((label) => fmt(label, { voice: voiceLabel(request) }));
  const [current, setCurrent] = useState(-1);
  const video = useRef<HTMLVideoElement>(null);
  // the phase titles come from the plan (the page's language); the intro and the close from the page's words
  const chapters = MADE.map((c, i) => ({
    title: c.phase === null ? (i === 0 ? t.videoIntro : t.videoOutro) : (groups.find((g) => g.index === c.phase)?.phase?.title ?? c.title),
    phase: c.phase,
    start: c.start,
  }));

  // Lab: Hams' making is simulated, five stages in about seven seconds.
  useEffect(() => {
    if (state !== 'making') return;
    setMaking(0);
    const ids = [1, 2, 3, 4, 5].map((n) => window.setTimeout(() => setMaking(n), n * 1300));
    const done = window.setTimeout(() => {
      setMade(request);
      setHasVideo(true);
      setState('ready');
    }, 5 * 1300 + 500);
    return () => [...ids, done].forEach((id) => window.clearTimeout(id));
  }, [state, request]);

  const seek = (i: number) => {
    const v = video.current;
    if (!v) return;
    v.currentTime = (chapters[i]?.start ?? 0) + 0.05;
    void v.play();
  };

  const onTime = () => {
    const v = video.current;
    if (!v) return;
    const i = Math.max(0, chapters.findLastIndex((c) => c.start <= v.currentTime + 0.01));
    if (i !== current) {
      setCurrent(i);
      onSpot(v.paused ? null : (chapters[i]?.phase ?? null));
    }
  };

  return (
    <section aria-labelledby="ps-video-title" className="flex min-w-0 flex-col gap-4 rounded-2xl border border-border bg-card p-4 md:p-6">
      <header className="flex min-w-0 flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h2 id="ps-video-title" className="flex items-center gap-2 text-title-sm font-semibold text-foreground">
            <Clapperboard aria-hidden className="size-4 text-muted-foreground" strokeWidth={1.75} />
            {t.videoTitle}
          </h2>
          <p className="text-body-sm text-muted-foreground">{state === 'ready' ? t.videoHint : state === 'asking' ? h.title : t.videoNone}</p>
        </div>
        {state === 'ready' && (
          <Button size="sm" variant="ghost" onClick={() => setState('asking')}>
            <RefreshCw aria-hidden className="size-4" strokeWidth={1.75} />
            {t.videoRegen}
          </Button>
        )}
      </header>

      <AnimatePresence mode="wait" initial={false}>
        {state === 'none' && (
          <motion.div key="none" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-start gap-3 rounded-xl border border-dashed border-border p-5">
            <Button variant="primary" onClick={() => setState('asking')}>
              <Video aria-hidden className="size-4" strokeWidth={2} />
              {t.videoRequest}
            </Button>
            <p className="text-caption text-muted-foreground">{t.videoLab}</p>
          </motion.div>
        )}

        {state === 'asking' && (
          <HamsRequestPanel key="asking" value={request} onChange={setRequest} onStart={() => setState('making')} onCancel={() => setState(hasVideo ? 'ready' : 'none')} />
        )}

        {state === 'making' && (
          <motion.div key="making" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="flex flex-col gap-3 rounded-xl border border-border p-5" role="status">
            <p className="flex items-center gap-2 text-body font-semibold text-foreground">
              <Loader2 aria-hidden className="size-4 animate-spin text-primary motion-reduce:animate-none" strokeWidth={2} />
              {t.videoMaking}
            </p>
            <div className="ps-progress" aria-hidden>
              <motion.span initial={{ width: '4%' }} animate={{ width: `${Math.max(4, (making / steps.length) * 100)}%` }} transition={{ duration: 0.6 }} />
            </div>
            <ol className="flex flex-col gap-1.5">
              {steps.map((label, i) => (
                <li key={label} className={cn('flex items-center gap-2 text-body-sm', i < making ? 'text-foreground' : 'text-muted-foreground')}>
                  <span aria-hidden className={cn('grid size-5 place-items-center rounded-full border-2', i < making ? 'border-primary bg-primary text-primary-foreground' : i === making ? 'border-primary' : 'border-border')}>
                    {i < making && <Check className="size-3" strokeWidth={3} />}
                  </span>
                  {label}
                </li>
              ))}
            </ol>
          </motion.div>
        )}

        {state === 'ready' && (
          <motion.div key="ready" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.35 }} className="ps-video-grid min-w-0">
            <div className="flex min-w-0 flex-col gap-1.5">
              <video
                ref={video}
                className="ps-video"
                src={mediaUrl('video/plan-explainer.mp4')}
                poster={mediaUrl('video/plan-explainer-poster.jpg')}
                controls
                preload="metadata"
                playsInline
                onTimeUpdate={onTime}
                onPause={() => onSpot(null)}
                onPlay={onTime}
                onEnded={() => onSpot(null)}
              >
                <track kind="captions" srcLang="ar" label="العربية" src={mediaUrl('video/plan-explainer.ar.vtt')} default />
              </video>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-caption text-muted-foreground">
                  {fmt(h.made, { style: h.styles[made.style][0], voice: voiceLabel(made), aspect: h.aspects[made.aspect] })} · {fmt(t.videoMade, { n: num(revision, locale) })}
                </p>
                <Button size="sm" variant="ghost" onClick={() => showToast({ message: h.labOpen })}>
                  <ExternalLink aria-hidden className="size-3.5" strokeWidth={1.75} />
                  {h.openInHams}
                </Button>
              </div>
            </div>
            <nav aria-label={t.videoChapters} className="flex min-w-0 flex-col gap-1">
              <h3 className="px-2 text-caption font-semibold text-muted-foreground">{t.videoChapters}</h3>
              <ol className="flex max-h-90 flex-col gap-0.5 overflow-y-auto">
                {chapters.map((c, i) => (
                  <li key={i}>
                    <button
                      type="button"
                      data-tone={c.phase === null ? undefined : toneOf(c.phase)}
                      aria-current={current === i}
                      onClick={() => seek(i)}
                      className={cn('ps-chapter-btn flex w-full min-w-0 items-center gap-2.5 rounded-lg px-2 py-1.5 text-start hover:bg-accent', focusRing)}
                    >
                      <span aria-hidden className={cn('grid size-6 shrink-0 place-items-center rounded-md text-caption font-bold', c.phase === null ? 'bg-muted text-foreground' : 'ps-tone-bg')}>
                        {c.phase === null ? <Video className="size-3.5" strokeWidth={2} /> : <Ltr>{num(c.phase, locale)}</Ltr>}
                      </span>
                      <span dir="auto" className="min-w-0 flex-1 truncate text-body-sm text-foreground">
                        {c.title}
                      </span>
                      <Ltr className="shrink-0 text-caption text-muted-foreground tabular-nums">{clockOf(c.start)}</Ltr>
                    </button>
                  </li>
                ))}
              </ol>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
