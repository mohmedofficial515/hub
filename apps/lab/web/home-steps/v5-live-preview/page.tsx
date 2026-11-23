/**
 * v5-live-preview: "how booking works" as step tabs beside a small live screen. The screen plays a short
 * illustration of the real product for the chosen step (search results, traveller name and wallet payment, the
 * e-ticket arriving), drawn with the site's own tokens instead of stock photos. The steps advance on their own
 * every few seconds, with a ring around the number showing the time left; hover, focus or the pause button stop it,
 * and with reduced motion it never advances by itself.
 */
import './tokens.css';
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { AnimatePresence, motion, MotionConfig, useReducedMotion } from 'framer-motion';
import { Pause, Play } from 'lucide-react';
import { useT } from '@lab/i18n';
import { cn } from '@lab/utils';
import { messages } from './i18n';
import { PayScreen, SearchScreen, TicketScreen } from './parts/screens';

const STEP_MS = 6500;

export default function Page() {
  return (
    <MotionConfig reducedMotion="user">
      <div className="gv-home min-h-dvh overflow-x-clip">
        <LivePreviewSteps />
      </div>
    </MotionConfig>
  );
}

function LivePreviewSteps() {
  const t = useT(messages);
  const reduce = useReducedMotion();
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [hold, setHold] = useState(false); // hover or focus inside the section
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const running = !reduce && !paused && !hold;

  useEffect(() => {
    if (!running) return;
    const id = setTimeout(() => setActive((a) => (a + 1) % t.items.length), STEP_MS);
    return () => clearTimeout(id);
  }, [running, active, t.items.length]);

  const onKey = (e: KeyboardEvent) => {
    const n = t.items.length;
    const next =
      e.key === 'ArrowDown' || e.key === 'ArrowRight'
        ? (active + 1) % n
        : e.key === 'ArrowUp' || e.key === 'ArrowLeft'
          ? (active - 1 + n) % n
          : e.key === 'Home'
            ? 0
            : e.key === 'End'
              ? n - 1
              : null;
    if (next === null) return;
    e.preventDefault();
    setActive(next);
    tabs.current[next]?.focus();
  };

  const Screen = [SearchScreen, PayScreen, TicketScreen][active];

  return (
    <section
      aria-labelledby="steps-title"
      className="bg-(--surface-2)"
      onPointerEnter={() => setHold(true)}
      onPointerLeave={() => setHold(false)}
      onFocus={() => setHold(true)}
      onBlur={(e) => !e.currentTarget.contains(e.relatedTarget as Node) && setHold(false)}
    >
      <div className="mx-auto grid w-full max-w-[80rem] items-center gap-10 px-4 py-14 sm:px-6 md:py-20 lg:grid-cols-[minmax(0,6fr)_minmax(0,5fr)] lg:gap-16 lg:px-8">
        <div>
          <p className="text-sm font-semibold text-(--action-text)">{t.eyebrow}</p>
          <h2 id="steps-title" className="mt-2 text-3xl leading-tight font-bold text-balance text-(--brand-ink) md:text-4xl">
            {t.title}
          </h2>
          <p className="mt-3 max-w-xl text-base leading-relaxed text-(--ink) md:text-lg">{t.lead}</p>

          <div role="tablist" aria-label={t.tabsAria} aria-orientation="vertical" className="mt-8 space-y-2" onKeyDown={onKey}>
            {t.items.map((step, i) => {
              const on = i === active;
              return (
                <button
                  key={i}
                  ref={(el) => {
                    tabs.current[i] = el;
                  }}
                  role="tab"
                  id={`step-tab-${i}`}
                  aria-selected={on}
                  aria-controls="step-screen"
                  tabIndex={on ? 0 : -1}
                  onClick={() => setActive(i)}
                  className={cn(
                    'flex w-full items-start gap-4 rounded-[18px] border p-4 text-start transition-colors duration-200',
                    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--ring)',
                    on ? 'border-(--border-strong) bg-(--card)' : 'border-transparent hover:bg-(--surface-3)',
                  )}
                >
                  <NumberRing n={i + 1} on={on} running={running && on} />
                  <span className="min-w-0 pt-1.5">
                    <span className={cn('block text-lg font-bold', on ? 'text-(--brand-ink)' : 'text-(--ink)')}>{step.title}</span>
                    {/* the body opens only on the chosen step; grid-rows keeps the height change smooth */}
                    <span
                      className={cn(
                        'grid transition-[grid-template-rows] duration-300',
                        on ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
                      )}
                    >
                      <span className="overflow-hidden">
                        <span className="block pt-1 text-base leading-relaxed text-(--ink)">{step.body}</span>
                      </span>
                    </span>
                  </span>
                </button>
              );
            })}
          </div>

          {!reduce && (
            <button
              type="button"
              onClick={() => setPaused((p) => !p)}
              className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-(--brand-ink) hover:bg-(--surface-3) focus-visible:outline-2 focus-visible:outline-(--ring)"
            >
              {paused ? <Play aria-hidden className="size-4" /> : <Pause aria-hidden className="size-4" />}
              {paused ? t.play : t.pause}
            </button>
          )}
        </div>

        {/* the small screen */}
        <div className="mx-auto w-full max-w-[26rem]">
          <div
            id="step-screen"
            role="tabpanel"
            aria-labelledby={`step-tab-${active}`}
            className="rounded-[32px] border border-(--border-strong) bg-(--card) p-2.5"
          >
            <div className="rounded-[24px] bg-(--surface-2) px-4 pt-10 pb-5">
              {/* status bar of the illustration */}
              <div aria-hidden className="mx-auto -mt-6 mb-6 h-1.5 w-16 rounded-full bg-(--border-strong)" />
              <div className="min-h-[21rem]">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={active}
                    initial={{ opacity: 0, x: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    aria-hidden
                  >
                    <Screen s={t.screen} />
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
          </div>
          <p className="mt-3 text-center text-xs text-(--ink-muted)">{t.example}</p>
        </div>
      </div>
    </section>
  );
}

/** Step number in a ring; on the running step the ring fills over STEP_MS to show when the next step comes. */
function NumberRing({ n, on, running }: { n: number; on: boolean; running: boolean }) {
  const r = 20;
  const c = 2 * Math.PI * r;
  return (
    <span className="relative flex size-11 shrink-0 items-center justify-center">
      <svg aria-hidden viewBox="0 0 44 44" className="absolute inset-0 -rotate-90">
        <circle cx={22} cy={22} r={r} fill="none" strokeWidth={1.5} className="stroke-(--border-strong)" />
        {on && (
          <motion.circle
            key={running ? 'run' : 'still'}
            cx={22}
            cy={22}
            r={r}
            fill="none"
            strokeWidth={2}
            strokeLinecap="round"
            className="stroke-(--brand)"
            strokeDasharray={c}
            initial={{ strokeDashoffset: running ? c : 0 }}
            animate={{ strokeDashoffset: 0 }}
            transition={{ duration: running ? STEP_MS / 1000 : 0, ease: 'linear' }}
          />
        )}
      </svg>
      <span className={cn('tnum text-base font-bold', on ? 'text-(--brand-ink)' : 'text-(--ink-muted)')}>{n}</span>
    </span>
  );
}
