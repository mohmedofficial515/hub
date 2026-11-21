import { useState, type MouseEvent, type ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Check } from 'lucide-react';
import { useLocale, useT } from '@lab/i18n';
import { cn } from '@lab/ui/hub-cn';
import { messages } from '../i18n';
import { fmt, Ltr, TypeIcon } from './atoms';
import { num, plural } from './format';
import { composition, type NeedCard, type Segment } from './model';
import { focusRing, typeClass } from './type-meta';

// ── Geometry ───────────────────────────────────────────────────────────────────────────────────
const VIEW = 240;
const C = VIEW / 2;
const R = 94; // centre line of the reef
const SW = 22; // thickness of a polyp
const LAGOON_R = 76;
const NOTCH_R = 114; // the overdue/soon marks sit just outside the reef
const UNIT_GAP = 3.2; // degrees between neighbouring polyps
const GROUP_GAP = 14; // degrees between Needs / Ready / Sessions

const rad = (deg: number) => (deg * Math.PI) / 180;
const at = (deg: number, r: number) => ({ x: C + r * Math.cos(rad(deg)), y: C + r * Math.sin(rad(deg)) });

function arc(from: number, to: number) {
  const a = at(from, R);
  const b = at(to, R);
  return `M ${a.x.toFixed(2)} ${a.y.toFixed(2)} A ${R} ${R} 0 ${to - from > 180 ? 1 : 0} 1 ${b.x.toFixed(2)} ${b.y.toFixed(2)}`;
}

/** One equal arc per item: a count you can see, not a share to estimate. Rounded ends are budgeted in. */
function layout(segments: Segment[]) {
  const n = segments.length;
  if (n === 0) return [];
  const groups = new Set(segments.map((s) => s.group)).size;
  const budget = 360 - groups * GROUP_GAP - (n - groups) * UNIT_GAP;
  const visual = budget / n;
  const cap = ((SW / 2 / R) * 180) / Math.PI;
  const span = Math.max(visual - 2 * cap, 0.5);
  let cursor = -90 + GROUP_GAP / 2;
  return segments.map((seg, i) => {
    const from = cursor + cap;
    const to = from + span;
    cursor += visual + (segments[i + 1] && segments[i + 1].group === seg.group ? UNIT_GAP : GROUP_GAP);
    return { seg, d: arc(from, to), mid: (from + to) / 2 };
  });
}

// ── The ring ───────────────────────────────────────────────────────────────────────────────────

function Reef({
  segments,
  done,
  label,
  onHover,
  onPick,
}: {
  segments: Segment[];
  done: ReadonlySet<string>;
  label: string;
  onHover: (seg: Segment | null) => void;
  onPick: (seg: Segment) => void;
}) {
  const reduce = useReducedMotion();
  const placed = layout(segments);
  return (
    <svg
      viewBox={`0 0 ${VIEW} ${VIEW}`}
      role="img"
      aria-label={label}
      // Clockwise in LTR, counter-clockwise in RTL: the ring reads in the page's direction (research §5).
      className="absolute inset-0 size-full rtl:-scale-x-100"
    >
      <circle cx={C} cy={C} r={LAGOON_R} className="fill-(--reef-lagoon)" />
      {segments.length === 0 && <circle cx={C} cy={C} r={R} fill="none" strokeWidth={6} className="stroke-border" />}
      {placed.map(({ seg, d, mid }, i) => {
        const isDone = done.has(seg.id);
        const notch = seg.flag && !isDone ? at(mid, NOTCH_R) : null;
        return (
          <g
            key={seg.id}
            className="cursor-pointer"
            onMouseEnter={() => onHover(seg)}
            onMouseLeave={() => onHover(null)}
            onClick={() => onPick(seg)}
          >
            {/* The one orchestrated moment on load: the reef grows around the lagoon. */}
            <motion.path
              d={d}
              fill="none"
              strokeWidth={SW}
              strokeLinecap="round"
              className={typeClass[seg.type].seg}
              initial={reduce ? false : { pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ duration: 0.42, delay: i * 0.035, ease: [0.2, 0.8, 0.2, 1] }}
            />
            {/* Cleared: the polyp goes hollow. The count drops, and the shape of the day stays honest. */}
            <path
              d={d}
              fill="none"
              strokeWidth={SW - 5.5}
              strokeLinecap="round"
              className={cn('stroke-background transition-opacity duration-300 motion-reduce:transition-none', isDone ? 'opacity-100' : 'opacity-0')}
            />
            {notch && (
              <circle cx={notch.x} cy={notch.y} r={6} strokeWidth={2.5} className={cn('stroke-background', seg.flag === 'overdue' ? 'fill-destructive' : 'fill-warning')} />
            )}
          </g>
        );
      })}
    </svg>
  );
}

// ── The hero ───────────────────────────────────────────────────────────────────────────────────

/** A number that goes to its section. In-page scroll by script: the lab's router owns `location.hash`. */
function Jump({ to, onJump, className, children }: { to: string; onJump: (id: string) => void; className?: string; children: ReactNode }) {
  return (
    <a
      href={`#${to}`}
      onClick={(e: MouseEvent) => {
        e.preventDefault();
        onJump(to);
      }}
      className={cn('group rounded-lg', focusRing, className)}
    >
      {children}
    </a>
  );
}

export function Atoll({
  segments,
  needs,
  needsTotal,
  done,
  readyCount,
  sessionCount,
  changedCount,
  showReady,
  onJump,
  onPick,
}: {
  segments: Segment[];
  needs: NeedCard[];
  needsTotal: number;
  done: ReadonlySet<string>;
  readyCount: number;
  sessionCount: number;
  changedCount: number;
  showReady: boolean;
  onJump: (id: string) => void;
  onPick: (seg: Segment) => void;
}) {
  const t = useT(messages);
  const locale = useLocale();
  const [hover, setHover] = useState<Segment | null>(null);
  const comp = composition(needs);
  const left = needs.length;
  const cleared = needsTotal - left;
  const flags = segments.filter((s) => s.flag && !done.has(s.id));
  const hasOverdue = flags.some((s) => s.flag === 'overdue');
  const hasSoon = flags.some((s) => s.flag === 'soon');

  const parts = [
    left > 0 ? fmt(t.hero.ariaNeeds, { n: left, types: comp.map((c) => plural(c.n, locale, t.hero.typeCount[c.type])).join('، ') }) : t.hero.allClear,
    cleared > 0 ? fmt(t.hero.ariaCleared, { n: cleared }) : '',
  ].filter(Boolean);

  const numbers = [
    showReady && readyCount > 0 ? { to: 'ready-title', n: readyCount, label: plural(readyCount, locale, t.hero.ready), tone: 'text-type-task-fg' } : null,
    sessionCount > 0 ? { to: 'sessions-title', n: sessionCount, label: plural(sessionCount, locale, t.hero.sessions), tone: 'text-type-change-fg' } : null,
    changedCount > 0 ? { to: 'since-title', n: changedCount, label: plural(changedCount, locale, t.hero.changed), tone: 'text-foreground' } : null,
  ].filter((x): x is NonNullable<typeof x> => x !== null);

  return (
    <section aria-labelledby="hero-title" className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-4 gap-y-5 md:gap-x-10">
      <h2 id="hero-title" className="sr-only">
        {t.hero.title}
      </h2>

      <div className="relative size-36 md:row-span-2 md:size-56 xl:size-60">
        <Reef segments={segments} done={done} label={fmt(t.hero.aria, { parts: parts.join('. ') })} onHover={setHover} onPick={onPick} />
        {/* The lagoon: what is left to clear. On hover it names the polyp, so nothing floats over the page. */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <Jump to="needs-title" onJump={onJump} className="pointer-events-auto flex max-w-[58%] flex-col items-center text-center">
            {hover ? (
              <span className="flex flex-col items-center gap-0.5">
                <span className="text-body-sm font-semibold text-foreground">{t.types[hover.type]}</span>
                {hover.key && (
                  <Ltr mono className="text-caption text-muted-foreground">
                    {hover.key}
                  </Ltr>
                )}
              </span>
            ) : left === 0 ? (
              <span className="flex flex-col items-center gap-1">
                <Check aria-hidden className="size-7 text-success-soft-foreground md:size-9" strokeWidth={2.25} />
                <span className="text-body-sm font-medium text-foreground">{t.hero.allClear}</span>
              </span>
            ) : (
              <>
                <span className="reef-lagoon-num text-foreground">
                  <Ltr>{num(left, locale)}</Ltr>
                </span>
                <span className="mt-0.5 text-body-sm font-medium text-foreground group-hover:underline md:mt-1">
                  {cleared > 0 ? fmt(t.hero.leftOf, { total: num(needsTotal, locale) }) : t.hero.left}
                </span>
              </>
            )}
          </Jump>
        </div>
      </div>

      {/* The key: every colour in the ring, named and counted. */}
      <div className="min-w-0 self-center md:self-end">
        {comp.length > 0 && (
          <ul className="flex flex-wrap gap-x-4 gap-y-1.5 md:gap-x-5 md:gap-y-2">
            {comp.map((c) => (
              <li key={c.type} className="flex items-center gap-1.5 text-body-sm font-medium text-foreground md:gap-2 md:text-body">
                <TypeIcon type={c.type} size="sm" />
                <span>{plural(c.n, locale, t.hero.typeCount[c.type])}</span>
              </li>
            ))}
          </ul>
        )}
        {(hasOverdue || hasSoon) && (
          <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-body-sm text-muted-foreground md:mt-3">
            {hasOverdue && (
              <span className="flex items-center gap-1.5">
                <span aria-hidden className="size-2.5 rounded-full bg-destructive" />
                {t.hero.overdueKey}
              </span>
            )}
            {hasSoon && (
              <span className="flex items-center gap-1.5">
                <span aria-hidden className="size-2.5 rounded-full bg-warning" />
                {t.hero.soonKey}
              </span>
            )}
          </p>
        )}
      </div>

      {numbers.length > 0 ? (
        <ul className="col-span-2 grid auto-cols-fr grid-flow-col gap-x-3 self-start md:col-span-1 md:col-start-2 md:gap-x-6">
          {numbers.map((item) => (
            <li key={item.to} className="min-w-0">
              <Jump to={item.to} onJump={onJump} className="flex min-h-11 flex-col gap-0.5">
                <span className={cn('reef-num', item.tone)}>
                  <Ltr>{num(item.n, locale)}</Ltr>
                </span>
                <span className="text-body-sm text-muted-foreground group-hover:text-foreground group-hover:underline">{item.label}</span>
              </Jump>
            </li>
          ))}
        </ul>
      ) : (
        <p className="col-span-2 self-start text-body text-muted-foreground md:col-span-1 md:col-start-2">{t.hero.quiet}</p>
      )}
    </section>
  );
}
