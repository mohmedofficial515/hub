/**
 * v4-departures-board: "how booking works" read off an airport departures board. Each step is a row: a flight code
 * whose split-flap letters spin and settle, the step name, what you need, and a status ("Start here", "Next",
 * "Boarding"). Arabic words flip as whole cells because Arabic letters join and cannot be split into tiles.
 * The board is dark in both themes; the page around it keeps the site colours. No shadow, no gradient.
 */
import './tokens.css';
import { useEffect, useRef, useState } from 'react';
import { motion, MotionConfig, useInView, useReducedMotion } from 'framer-motion';
import { useLocale, useT } from '@lab/i18n';
import { cn } from '@lab/utils';
import { messages } from './i18n';

export default function Page() {
  return (
    <MotionConfig reducedMotion="user">
      <div className="gv-home min-h-dvh overflow-x-clip">
        <DeparturesBoardSteps />
      </div>
    </MotionConfig>
  );
}

const STATUS_TONE = ['text-(--board-gold)', 'text-(--board-ink)', 'text-(--board-teal)'];

function DeparturesBoardSteps() {
  const t = useT(messages);
  const boardRef = useRef<HTMLDivElement>(null);
  const shown = useInView(boardRef, { once: true, amount: 0.35 });

  return (
    <section aria-labelledby="steps-title" className="mx-auto w-full max-w-[80rem] px-4 py-14 sm:px-6 md:py-20 lg:px-8">
      <div className="max-w-2xl">
        <p className="text-sm font-semibold text-(--action-text)">{t.eyebrow}</p>
        <h2 id="steps-title" className="mt-2 text-3xl leading-tight font-bold text-balance text-(--brand-ink) md:text-4xl">
          {t.title}
        </h2>
        <p className="mt-3 text-base leading-relaxed text-(--ink) md:text-lg">{t.lead}</p>
      </div>

      <div
        ref={boardRef}
        className="mt-10 overflow-hidden rounded-[22px] border border-(--board-line) bg-(--board) text-(--board-ink) md:mt-12"
      >
        {/* board header */}
        <div className="flex items-center justify-between gap-4 px-5 py-4 sm:px-6">
          <p className="flex items-baseline gap-3">
            <span className="text-xl font-bold">{t.board}</span>
            <span aria-hidden className="font-mono text-xs tracking-[0.3em] text-(--board-muted)" translate="no">
              {t.boardLatin}
            </span>
          </p>
          <Clock label={t.localTime} />
        </div>

        {/* column heads (md+) */}
        <div
          aria-hidden
          className="hidden border-t border-(--board-line) px-6 py-2.5 text-xs font-semibold text-(--board-muted) md:grid md:grid-cols-[9rem_minmax(0,1fr)_13rem_9rem] md:gap-6"
        >
          <span>{t.cols.code}</span>
          <span>{t.cols.step}</span>
          <span>{t.cols.need}</span>
          <span>{t.cols.status}</span>
        </div>

        <ol>
          {t.items.map((step, i) => (
            <li
              key={i}
              className="grid gap-3 border-t border-(--board-line) px-5 py-5 sm:px-6 md:grid-cols-[9rem_minmax(0,1fr)_13rem_9rem] md:items-center md:gap-6"
            >
              <div className="flex items-center justify-between gap-3 md:block">
                <FlapCode text={step.code} start={shown} delay={i * 260} />
                <Status className="flex md:hidden" tone={STATUS_TONE[i]} live={i === 0} start={shown} delay={i * 260 + 500}>
                  {step.status}
                </Status>
              </div>

              <FlipCell start={shown} delay={i * 260 + 150}>
                <h3 className="text-lg leading-snug font-bold md:text-xl">
                  <span className="sr-only">{i + 1}. </span>
                  {step.title}
                </h3>
                <p className="mt-1 text-base leading-relaxed text-(--board-muted)">{step.body}</p>
              </FlipCell>

              <FlipCell start={shown} delay={i * 260 + 300}>
                <p className="text-sm text-(--board-muted) md:sr-only">{t.cols.need}</p>
                <p className="text-base font-semibold">{step.need}</p>
              </FlipCell>

              <Status className="hidden md:flex" tone={STATUS_TONE[i]} live={i === 0} start={shown} delay={i * 260 + 450}>
                {step.status}
              </Status>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

const FLAP_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

/** Latin flight code on split-flap tiles: each tile spins through letters and settles, start side first. */
function FlapCode({ text, start, delay }: { text: string; start: boolean; delay: number }) {
  const reduce = useReducedMotion();
  const [shown, setShown] = useState(() => (reduce ? text : text.replace(/\S/g, ' ')));

  useEffect(() => {
    if (!start) return;
    if (reduce) {
      setShown(text);
      return;
    }
    let frame = 0;
    let timer: ReturnType<typeof setInterval> | undefined;
    const wait = setTimeout(() => {
      timer = setInterval(() => {
        frame++;
        setShown(
          text
            .split('')
            .map((c, i) =>
              c === ' ' || frame > 5 + i * 2 ? c : FLAP_CHARS[Math.floor(Math.random() * FLAP_CHARS.length)],
            )
            .join(''),
        );
        if (frame > 5 + text.length * 2) clearInterval(timer);
      }, 55);
    }, delay);
    return () => {
      clearTimeout(wait);
      if (timer) clearInterval(timer);
    };
  }, [start, reduce, text, delay]);

  return (
    <span className="inline-flex gap-1" dir="ltr" translate="no">
      <span className="sr-only">{text}</span>
      {shown.split('').map((c, i) =>
        c === ' ' && text[i] === ' ' ? (
          <span key={i} aria-hidden className="w-1.5" />
        ) : (
          <span
            key={i}
            aria-hidden
            className="relative flex h-10 w-7 items-center justify-center rounded-[5px] bg-(--board-cell) font-mono text-lg font-bold"
          >
            {c}
            {/* the split of the flap */}
            <span className="absolute inset-x-0 top-1/2 h-px bg-(--board)" />
          </span>
        ),
      )}
    </span>
  );
}

/** A whole cell that flips down into place, like a word panel on the board. */
function FlipCell({ children, start, delay }: { children: React.ReactNode; start: boolean; delay: number }) {
  return (
    <motion.div
      initial={{ rotateX: -90, opacity: 0 }}
      animate={start ? { rotateX: 0, opacity: 1 } : undefined}
      transition={{ delay: delay / 1000, duration: 0.45, ease: [0.2, 0.9, 0.3, 1.2] }}
      style={{ transformPerspective: 700, transformOrigin: 'top center' }}
      className="min-w-0"
    >
      {children}
    </motion.div>
  );
}

function Status({
  children,
  tone,
  live,
  start,
  delay,
  className,
}: {
  children: React.ReactNode;
  tone: string;
  live: boolean;
  start: boolean;
  delay: number;
  className?: string;
}) {
  return (
    <motion.p
      initial={{ opacity: 0 }}
      animate={start ? { opacity: 1 } : undefined}
      transition={{ delay: delay / 1000, duration: 0.2 }}
      className={cn('items-center gap-2 text-base font-bold', tone, className)}
    >
      <span className="relative flex size-2.5">
        {live && (
          <motion.span
            aria-hidden
            className="absolute inset-0 rounded-full bg-current"
            animate={{ opacity: [1, 0.2, 1] }}
            transition={{ duration: 1.6, repeat: Infinity }}
          />
        )}
        <span aria-hidden className={cn('relative size-2.5 rounded-full bg-current', live && 'opacity-0')} />
      </span>
      {children}
    </motion.p>
  );
}

/** The board's clock: the visitor's local time, Latin digits, colon blinking once a second. */
function Clock({ label }: { label: string }) {
  const locale = useLocale();
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  return (
    <p className="flex items-center gap-2 text-(--board-muted)">
      <span className="hidden text-xs whitespace-nowrap sm:inline">{label}</span>
      <span className="tnum font-mono text-xl font-bold text-(--board-gold)" dir="ltr" translate="no" lang={locale === 'ar' ? 'en' : undefined}>
        {hh}
        <span className={cn(now.getSeconds() % 2 ? 'opacity-30' : 'opacity-100')}>:</span>
        {mm}
      </span>
    </p>
  );
}
