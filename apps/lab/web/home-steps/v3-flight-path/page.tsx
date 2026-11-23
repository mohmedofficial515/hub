/**
 * v3-flight-path: "how booking works" as one flight route across a flat navy block. The route is drawn as the page
 * scrolls and a small plane flies along it; each step is a stop on the route and lights up gold when the plane
 * passes it. Phones get the same idea vertically: a rail at the inline start with the plane moving down.
 * The lab page adds a plain spacer above and below the section so there is something to scroll.
 */
import './tokens.css';
import { useLayoutEffect, useRef, useState } from 'react';
import {
  motion,
  MotionConfig,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
  type MotionValue,
} from 'framer-motion';
import { Plane } from 'lucide-react';
import { useT } from '@lab/i18n';
import { cn } from '@lab/utils';
import { messages } from './i18n';

/** Route through three stops in a 1200 x 240 box; stop centres match the three equal text columns. */
const ROUTE = 'M 20 170 C 110 170, 120 70, 200 70 S 500 170, 600 170 S 900 70, 1000 70 S 1130 170, 1180 170';
const STOPS = [
  { x: 200, y: 70 },
  { x: 600, y: 170 },
  { x: 1000, y: 70 },
];

export default function Page() {
  return (
    <MotionConfig reducedMotion="user">
      <div className="gv-home min-h-dvh overflow-x-clip">
        <Spacer />
        <FlightPathSteps />
        <Spacer />
      </div>
    </MotionConfig>
  );
}

/** Lab only: stands for the sections around this one so the scroll-linked route can be tried. */
function Spacer() {
  return (
    <div aria-hidden className="mx-auto flex h-[60vh] max-w-[80rem] items-center justify-center px-4">
      <div className="h-full w-full rounded-[22px] border border-dashed border-(--line)" />
    </div>
  );
}

function FlightPathSteps() {
  const t = useT(messages);
  const reduce = useReducedMotion();
  const sectionRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ['start 0.85', 'end 0.85'] });
  const smooth = useSpring(scrollYProgress, { stiffness: 140, damping: 26, mass: 0.4 });
  const progress = useTransform(smooth, (v) => (reduce ? 1 : Math.min(1, Math.max(0, v))));

  return (
    <section
      ref={sectionRef}
      aria-labelledby="steps-title"
      className="bg-(--surface-brand) text-(--on-brand)"
    >
      <div className="mx-auto w-full max-w-[80rem] px-4 py-14 sm:px-6 md:py-20 lg:px-8">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div className="max-w-xl">
            <p className="text-sm font-semibold text-(--highlight)">{t.eyebrow}</p>
            <h2 id="steps-title" className="mt-2 text-3xl leading-tight font-bold text-balance md:text-4xl">
              {t.title}
            </h2>
            <p className="mt-3 text-base leading-relaxed text-(--on-brand-muted) md:text-lg">{t.lead}</p>
          </div>
          {/* departure / arrival read-out, like the two ends of a ticket */}
          <dl className="hidden shrink-0 items-center gap-4 md:flex">
            <div>
              <dt className="text-xs text-(--on-brand-muted)">{t.from}</dt>
              <dd className="text-lg font-bold">{t.fromValue}</dd>
            </div>
            <span aria-hidden className="h-px w-16 border-t border-dashed border-(--line-on-brand)" />
            <Plane aria-hidden className="size-5 rotate-45 text-(--highlight) rtl:-rotate-[135deg]" strokeWidth={1.75} />
            <span aria-hidden className="h-px w-16 border-t border-dashed border-(--line-on-brand)" />
            <div>
              <dt className="text-xs text-(--on-brand-muted)">{t.to}</dt>
              <dd className="text-lg font-bold">{t.toValue}</dd>
            </div>
          </dl>
        </div>

        <DesktopRoute progress={progress} label={t.pathAria} items={t.items} />
        <PhoneRoute progress={progress} items={t.items} />
      </div>
    </section>
  );
}

type Item = { title: string; body: string };

function DesktopRoute({ progress, label, items }: { progress: MotionValue<number>; label: string; items: Item[] }) {
  const pathRef = useRef<SVGPathElement>(null);
  const planeRef = useRef<SVGGElement>(null);
  const [stopAt, setStopAt] = useState<number[]>([0.2, 0.5, 0.8]);
  const [reached, setReached] = useState(0);

  // where each stop sits along the route, as a fraction of its length
  useLayoutEffect(() => {
    const path = pathRef.current;
    if (!path) return;
    const total = path.getTotalLength();
    const found = STOPS.map((s) => {
      let best = 0;
      let dist = Infinity;
      for (let i = 0; i <= 400; i++) {
        const p = path.getPointAtLength((total * i) / 400);
        const d = Math.hypot(p.x - s.x, p.y - s.y);
        if (d < dist) {
          dist = d;
          best = i / 400;
        }
      }
      return best;
    });
    setStopAt(found);
  }, []);

  const place = (v: number) => {
    const path = pathRef.current;
    const plane = planeRef.current;
    if (!path || !plane) return;
    const total = path.getTotalLength();
    const at = Math.max(0.001, Math.min(0.999, v)) * total;
    const p = path.getPointAtLength(at);
    const q = path.getPointAtLength(Math.min(total, at + 1));
    const angle = (Math.atan2(q.y - p.y, q.x - p.x) * 180) / Math.PI;
    plane.setAttribute('transform', `translate(${p.x} ${p.y}) rotate(${angle})`);
    setReached(stopAt.filter((s) => v >= s - 0.005).length);
  };
  useMotionValueEvent(progress, 'change', place);
  useLayoutEffect(() => place(progress.get()), [stopAt]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="mt-12 hidden md:block">
      {/* the drawing mirrors in RTL so the plane flies from the inline start to the inline end */}
      <svg viewBox="0 0 1200 240" role="img" aria-label={label} className="block h-auto w-full rtl:-scale-x-100">
        <path d={ROUTE} fill="none" className="stroke-(--line-on-brand)" strokeWidth={2} strokeDasharray="2 8" strokeLinecap="round" />
        <motion.path
          ref={pathRef}
          d={ROUTE}
          fill="none"
          className="stroke-(--highlight)"
          strokeWidth={2}
          strokeLinecap="round"
          style={{ pathLength: progress }}
        />
        {STOPS.map((s, i) => (
          <g key={i} transform={`translate(${s.x} ${s.y})`}>
            <circle r={22} className={cn('transition-colors duration-300', i < reached ? 'fill-(--highlight)' : 'fill-(--surface-brand)')} />
            <circle r={22} fill="none" className="stroke-(--highlight)" strokeWidth={1.5} />
            <text
              textAnchor="middle"
              dominantBaseline="central"
              className={cn(
                'rtl:-scale-x-100 text-[18px] font-bold transition-colors duration-300',
                i < reached ? 'fill-(--highlight-foreground)' : 'fill-(--on-brand)',
              )}
              style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
            >
              {i + 1}
            </text>
          </g>
        ))}
        <g ref={planeRef}>
          <circle r={18} className="fill-(--surface-brand)" />
          <path
            className="fill-(--on-brand)"
            d="M14 0 C14 -1.6 12 -2 10 -2 L4 -2 L-4 -11 L-7 -11 L-2 -2 L-9 -2 L-12 -6 L-14 -6 L-12.5 0 L-14 6 L-12 6 L-9 2 L-2 2 L-7 11 L-4 11 L4 2 L10 2 C12 2 14 1.6 14 0 Z"
          />
        </g>
      </svg>

      <ol className="mt-4 grid grid-cols-3 gap-8">
        {items.map((step, i) => (
          <li key={i} className="text-center">
            <h3 className={cn('text-xl font-bold transition-colors duration-300', i < reached ? 'text-(--on-brand)' : 'text-(--on-brand-muted)')}>
              <span className="sr-only">{i + 1}. </span>
              {step.title}
            </h3>
            <p className="mx-auto mt-2 max-w-xs text-base leading-relaxed text-(--on-brand-muted)">{step.body}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}

function PhoneRoute({ progress, items }: { progress: MotionValue<number>; items: Item[] }) {
  const [reached, setReached] = useState(0);
  useMotionValueEvent(progress, 'change', (v) => setReached([0.08, 0.45, 0.85].filter((s) => v >= s).length));
  const top = useTransform(progress, (v) => `${v * 100}%`);

  return (
    <div className="relative mt-10 md:hidden">
      {/* rail: dashed track and the gold flown part, with the plane on its tip */}
      <span aria-hidden className="absolute start-[21px] top-0 bottom-0 border-s-2 border-dashed border-(--line-on-brand)" />
      <motion.span
        aria-hidden
        className="absolute start-[21px] top-0 bottom-0 w-0.5 origin-top bg-(--highlight)"
        style={{ scaleY: progress }}
      />
      <motion.span
        aria-hidden
        className="absolute start-[6px] z-[2] -mt-4 flex size-8 items-center justify-center rounded-full bg-(--surface-brand)"
        style={{ top }}
      >
        <Plane className="size-5 rotate-[135deg] text-(--on-brand)" strokeWidth={1.75} />
      </motion.span>

      <ol className="space-y-10">
        {items.map((step, i) => (
          <li key={i} className="relative flex gap-5">
            <span
              aria-hidden
              className={cn(
                'tnum relative z-[1] flex size-11 shrink-0 items-center justify-center rounded-full border-[1.5px] border-(--highlight) text-lg font-bold transition-colors duration-300',
                i < reached ? 'bg-(--highlight) text-(--highlight-foreground)' : 'bg-(--surface-brand) text-(--on-brand)',
              )}
            >
              {i + 1}
            </span>
            <div className="min-w-0 pt-1.5">
              <h3 className="text-lg font-bold">
                <span className="sr-only">{i + 1}. </span>
                {step.title}
              </h3>
              <p className="mt-1 text-base leading-relaxed text-(--on-brand-muted)">{step.body}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
