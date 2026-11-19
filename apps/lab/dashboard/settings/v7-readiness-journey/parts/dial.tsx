// The readiness dial: one tick per check, laid out by section around the circle (8 sectors with gaps). Shape AND
// colour carry the state: a long bar = done, a short heavy bar = to do, a hollow ring = waits for the backend.
import { useEffect, useRef, useState } from 'react';
import { animate, motion, useReducedMotion } from 'framer-motion';
import type { SectionId } from '@lab/mocks/settings';
import { cn } from '@lab/utils';
import { L, sectionOf, formatNumber } from './data';
import { isOwnerCheck, type Check, type Tally } from './readiness';
import { ServerCog } from 'lucide-react';
import { useSettings } from './store';
import { Icon } from './ui';

const SIZE = 240;
const C = SIZE / 2;
const GAP_DEG = 7;

function polar(r: number, deg: number) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: C + r * Math.cos(rad), y: C + r * Math.sin(rad) };
}

// The intro (ticks drawing in, number counting up) plays once per page load; later visits animate only the change.
let introPlayed = false;
let lastPct: number | null = null;

function useCountUp(target: number, reduce: boolean) {
  const start = reduce ? target : (lastPct ?? 0);
  const [value, setValue] = useState(start);
  const from = useRef(start);
  useEffect(() => {
    lastPct = target;
    if (reduce) {
      setValue(target);
      from.current = target;
      return;
    }
    const controls = animate(from.current, target, {
      duration: 0.9,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => setValue(Math.round(v)),
    });
    from.current = target;
    return () => controls.stop();
  }, [target, reduce]);
  return value;
}

export function ReadinessDial({ checks, tally, sections, className }: { checks: Check[]; tally: Tally; sections: SectionId[]; className?: string }) {
  const { t, lang } = useSettings();
  const reduce = !!useReducedMotion();
  const [intro] = useState(() => !introPlayed && !reduce);
  useEffect(() => {
    introPlayed = true;
  }, []);
  const pct = useCountUp(tally.pct, reduce);
  const own = checks.filter(isOwnerCheck);
  const n = own.length;
  const slot = (360 - sections.length * GAP_DEG) / Math.max(n, 1);

  let angle = GAP_DEG / 2;
  let index = 0;
  const ticks: { check: Check; deg: number; i: number }[] = [];
  for (const id of sections) {
    const list = own.filter((c) => c.section === id);
    for (const check of list) {
      const mid = angle + slot / 2;
      // Sections run in reading direction: clockwise in English, counter-clockwise in Arabic.
      ticks.push({ check, deg: lang === 'ar' ? 360 - mid : mid, i: index++ });
      angle += slot;
    }
    angle += GAP_DEG;
  }

  return (
    <div className={cn('relative aspect-square w-full', className)}>
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="size-full overflow-visible"
        role="img"
        aria-label={t.readiness.dialLabel(tally.pct, tally.done, tally.own)}
      >
        <circle cx={C} cy={C} r={76} className="fill-none stroke-border" strokeWidth={1} />
        {ticks.map(({ check, deg, i }) => {
          const title = `${t.checks[check.id]?.title ?? check.id}: ${t.readiness[check.status]}`;
          const delay = intro ? 0.15 + i * 0.018 : 0;
          if (check.status === 'blocked') {
            const p = polar(103, deg);
            return (
              <motion.circle
                key={check.id}
                cx={p.x}
                cy={p.y}
                r={4.2}
                strokeWidth={2.4}
                className="fill-card stroke-accent-violet"
                initial={intro ? { opacity: 0, scale: 0.4 } : false}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay, duration: 0.35 }}
                style={{ transformOrigin: `${p.x}px ${p.y}px` }}
              >
                <title>{title}</title>
              </motion.circle>
            );
          }
          const todo = check.status === 'todo';
          const a = polar(todo ? 96 : 88, deg);
          const b = polar(114, deg);
          return (
            <motion.line
              key={check.id}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              strokeLinecap="round"
              strokeWidth={todo ? 7 : 5}
              strokeDasharray={todo ? '4 3' : undefined}
              className={todo ? 'stroke-warning-strong' : 'stroke-success'}
              initial={intro ? { pathLength: 0, opacity: 0 } : false}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ delay, duration: 0.4, ease: 'easeOut' }}
            >
              <title>{title}</title>
            </motion.line>
          );
        })}
      </svg>
      <div className="pointer-events-none absolute inset-0 grid place-items-center">
        <div className="text-center" aria-hidden>
          <div className="flex items-baseline justify-center gap-0.5 font-extrabold leading-none tracking-tight text-foreground tabular-nums" dir="ltr">
            <span className="text-[clamp(2.5rem,7vw,3.5rem)]">{formatNumber(pct, lang, 0)}</span>
            <span className="text-22 text-muted-foreground">%</span>
          </div>
          <div className="mt-1.5 text-13 font-semibold text-muted-foreground">{t.readiness.ready}</div>
          <div className="mt-0.5 text-12 text-muted-foreground tabular-nums">
            {tally.done}/{tally.own}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Legend with the same shapes as the dial. */
export function DialLegend({ tally }: { tally: Tally }) {
  const { t } = useSettings();
  return (
    <div className="space-y-2">
      <ul className="flex flex-wrap gap-x-5 gap-y-2" aria-label={t.readiness.legend}>
        <li className="flex items-center gap-2 text-13 text-muted-foreground">
          <span className="h-2.5 w-5 rounded-full bg-success" aria-hidden />
          <span className="font-semibold text-foreground tabular-nums">{tally.done}</span>
          <span>{t.readiness.done}</span>
        </li>
        <li className="flex items-center gap-2 text-13 text-muted-foreground">
          <span className="h-2.5 w-5 rounded-full" style={TODO_FILL} aria-hidden />
          <span className="font-semibold text-foreground tabular-nums">{tally.todo}</span>
          <span>{t.readiness.todo}</span>
        </li>
      </ul>
      {tally.blocked ? (
        <p className="flex items-start gap-2 text-12 text-muted-foreground">
          <ServerCog className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          <span>
            <span className="font-semibold text-foreground">{t.readiness.backendLine(tally.blocked)}</span>. {t.readiness.backendHint}
          </span>
        </p>
      ) : null}
    </div>
  );
}

/** "To do" is drawn striped (shape cue) in the strong amber (>= 3:1 on card in both themes). */
export const TODO_FILL = {
  backgroundImage: 'repeating-linear-gradient(135deg, var(--warning-strong) 0 3px, transparent 3px 5px)',
  boxShadow: 'inset 0 0 0 1.5px var(--warning-strong)',
} as const;

/** One line per section: icon, name, segmented bar (done / to do / backend), count. */
export function SectionBars({
  rows,
  onPick,
}: {
  rows: { id: SectionId; tally: Tally }[];
  onPick: (id: SectionId) => void;
}) {
  const { t, lang } = useSettings();
  const reduce = !!useReducedMotion();
  const [intro] = useState(() => !introPlayed && !reduce);
  return (
    <ul className="grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-2" aria-label={t.readiness.sectionsTitle}>
      {rows.map(({ id, tally }, i) => {
        const section = sectionOf(id);
        const name = L(section.title, lang);
        const seg = (n: number) => `${(n / Math.max(tally.own, 1)) * 100}%`;
        return (
          <li key={id}>
            <button
              type="button"
              onClick={() => onPick(id)}
              aria-label={t.readiness.sectionAria(name, tally.done, tally.todo, tally.blocked)}
              className="group grid min-h-11 w-full grid-cols-[1.25rem_minmax(0,1fr)_minmax(3.5rem,26%)_3.5rem] sm:grid-cols-[1.25rem_minmax(0,1fr)_minmax(4.5rem,34%)_3.5rem] items-center gap-3 rounded-lg px-2 text-start transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              <span className="text-muted-foreground group-hover:text-foreground [&_svg]:size-4">
                <Icon name={section.icon} />
              </span>
              <span className="truncate text-13 font-semibold">{name}</span>
              <span className="flex h-2.5 w-full gap-0.5 overflow-hidden rounded-full bg-muted" aria-hidden>
                {(['done', 'todo'] as const).map((k) =>
                  tally[k] ? (
                    <motion.span
                      key={k}
                      className={cn(
                        'h-full rounded-full',
                        k === 'done' && 'bg-success',
                      )}
                      style={k === 'todo' ? TODO_FILL : undefined}
                      initial={intro ? { width: 0 } : false}
                      animate={{ width: seg(tally[k]) }}
                      transition={{ delay: intro ? 0.35 + i * 0.05 : 0, duration: reduce ? 0 : 0.5, ease: 'easeOut' }}
                    />
                  ) : null,
                )}
              </span>
              <span className="flex items-center justify-end gap-1 text-12 font-semibold text-muted-foreground tabular-nums">
                <span dir="ltr">{t.readiness.sectionLine(tally.done, tally.own)}</span>
                {tally.blocked ? (
                  <span className="inline-flex items-center gap-0.5 font-medium" title={t.readiness.backendLine(tally.blocked)}>
                    <ServerCog className="size-3" aria-hidden />
                    {tally.blocked}
                  </span>
                ) : null}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/** Mini ring used as the stop marker on the journey route: your part only; to-do arc dashed (shape cue). */
export function MiniRing({ tally, label }: { tally: Tally; label: string }) {
  const r = 17;
  const len = 2 * Math.PI * r;
  const done = tally.own ? tally.done / tally.own : 1;
  const todo = tally.own ? tally.todo / tally.own : 0;
  return (
    <span className="relative grid size-11 shrink-0 place-items-center rounded-full bg-background">
      <svg viewBox="0 0 44 44" className="absolute inset-0 size-11 -rotate-90" aria-hidden>
        <circle cx="22" cy="22" r={r} className="fill-none stroke-border" strokeWidth="4" />
        {todo ? (
          <circle
            cx="22"
            cy="22"
            r={r}
            className="fill-none stroke-warning-strong"
            strokeWidth="4"
            style={{ strokeDasharray: `${todo * len} ${len}`, strokeDashoffset: -done * len, strokeLinecap: 'butt' }}
          />
        ) : null}
        <circle cx="22" cy="22" r={r} className="fill-none stroke-success" strokeWidth="4" strokeDasharray={`${done * len} ${len}`} />
      </svg>
      <span className="relative text-13 font-bold tabular-nums">{label}</span>
      {todo ? <span className="absolute -end-0.5 -top-0.5 size-3 rounded-full border-2 border-background" style={{ background: 'var(--warning-strong)' }} aria-hidden /> : null}
    </span>
  );
}
