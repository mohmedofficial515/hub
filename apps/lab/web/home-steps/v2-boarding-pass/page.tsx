/**
 * v2-boarding-pass: "how booking works" drawn as one boarding pass. The three steps are its three parts, separated
 * by perforations with punched notches; the last part carries the barcode. When the pass scrolls into view a stamp
 * lands on each part in turn, as if the trip were checked in stop by stop.
 * Flat: 1 px lines only, no shadow, no gradient, no coloured stripe.
 */
import './tokens.css';
import { motion, MotionConfig } from 'framer-motion';
import { CreditCard, Plane, Search, TicketCheck, type LucideIcon } from 'lucide-react';
import { useT } from '@lab/i18n';
import { cn } from '@lab/utils';
import { messages } from './i18n';

const ICONS: LucideIcon[] = [Search, CreditCard, TicketCheck];

export default function Page() {
  return (
    <MotionConfig reducedMotion="user">
      <div className="gv-home min-h-dvh overflow-x-clip bg-(--surface-2)">
        <BoardingPassSteps />
      </div>
    </MotionConfig>
  );
}

function BoardingPassSteps() {
  const t = useT(messages);
  return (
    <section aria-labelledby="steps-title" className="mx-auto w-full max-w-[80rem] px-4 py-14 sm:px-6 md:py-20 lg:px-8">
      <div className="max-w-2xl">
        <p className="flex items-center gap-2 text-sm font-semibold text-(--brand-ink)">
          <Plane aria-hidden className="size-4 text-(--highlight) rtl:-scale-x-100" strokeWidth={2} />
          {t.eyebrow}
        </p>
        <h2 id="steps-title" className="mt-2 text-3xl leading-tight font-bold text-balance text-(--brand-ink) md:text-4xl">
          {t.title}
        </h2>
        <p className="mt-3 text-base leading-relaxed text-(--ink) md:text-lg">{t.lead}</p>
      </div>

      <div className="mt-10 rounded-[22px] border border-(--border-strong) bg-(--card) md:mt-12">
        {/* pass header: wordmark and label, like the top line of a real pass */}
        <div className="flex items-center justify-between gap-4 border-b border-(--line) px-5 py-3 sm:px-7">
          <span className="text-lg font-bold text-(--brand-ink)" translate="no" dir="ltr">
            go<span className="text-(--action-text)">t</span>eav
          </span>
          <span className="text-xs font-semibold tracking-wide text-(--ink-muted)">{t.passLabel}</span>
        </div>

        <ol className="grid md:grid-cols-3">
          {t.items.map((step, i) => {
            const Icon = ICONS[i];
            const last = i === t.items.length - 1;
            return (
              <li
                key={i}
                className={cn(
                  'relative flex flex-col px-5 pt-6 pb-6 sm:px-7 sm:pt-7',
                  i > 0 && 'border-t border-dashed border-(--border-strong) md:border-t-0 md:border-s',
                )}
              >
                {i > 0 && <Notches />}

                <div className="flex items-start justify-between gap-3">
                  <span className="flex size-11 items-center justify-center rounded-xl bg-(--brand-soft) text-(--brand-ink)">
                    <Icon aria-hidden className="size-5" strokeWidth={1.75} />
                  </span>
                  <Stamp index={i} label={t.stamp} />
                </div>

                <p className="mt-5 text-xs font-semibold text-(--ink-muted)">
                  {t.stepLabel} <span className="tnum">{String(i + 1).padStart(2, '0')}</span>
                </p>
                <h3 className="mt-1 text-xl leading-snug font-bold text-(--brand-ink)">
                  <span className="sr-only">{i + 1}. </span>
                  {step.title}
                </h3>
                <p className="mt-2 text-base leading-relaxed text-(--ink)">{step.body}</p>

                <dl className="mt-auto flex items-end justify-between gap-4 pt-6">
                  <div className="min-w-0 border-t border-(--line) pt-3">
                    <dt className="text-xs font-semibold text-(--ink-muted)">{t.needLabel}</dt>
                    <dd className="mt-0.5 text-sm font-semibold text-(--brand-ink)">{step.need}</dd>
                  </div>
                  {last && <Barcode label={t.barcodeAria} />}
                </dl>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}

/**
 * Punched notches where a perforation meets the outer edge. Each notch is a circle in the page colour with its own
 * 1 px border, clipped to the inside of the pass, so the pass outline bends around it.
 */
function Notches() {
  const circle = 'absolute size-[26px] rounded-full border border-(--border-strong) bg-(--surface-2)';
  return (
    <>
      {/* md+: vertical perforation, notches on the top and bottom edges */}
      <span aria-hidden className="absolute -start-[13px] -top-px hidden h-[14px] w-[26px] overflow-hidden md:block">
        <span className={cn(circle, '-top-[13px] start-0')} />
      </span>
      <span aria-hidden className="absolute -start-[13px] -bottom-px hidden h-[14px] w-[26px] overflow-hidden md:block">
        <span className={cn(circle, '-bottom-[13px] start-0')} />
      </span>
      {/* phones: horizontal perforation, notches on the side edges */}
      <span aria-hidden className="absolute -start-px -top-[13px] h-[26px] w-[14px] overflow-hidden md:hidden">
        <span className={cn(circle, '-start-[13px] top-0')} />
      </span>
      <span aria-hidden className="absolute -end-px -top-[13px] h-[26px] w-[14px] overflow-hidden md:hidden">
        <span className={cn(circle, '-end-[13px] top-0')} />
      </span>
    </>
  );
}

/** A round check-in stamp that lands once when the pass enters the viewport, one part after another. */
function Stamp({ index, label }: { index: number; label: string }) {
  return (
    <motion.span
      aria-hidden
      initial={{ opacity: 0, scale: 1.7, rotate: -28 }}
      whileInView={{ opacity: 1, scale: 1, rotate: -12 }}
      viewport={{ once: true, amount: 0.6 }}
      transition={{ delay: 0.25 + index * 0.45, type: 'spring', stiffness: 420, damping: 18 }}
      className="flex size-16 shrink-0 items-center justify-center rounded-full border-2 border-(--action-text) text-(--action-text)"
    >
      <span className="flex size-[52px] flex-col items-center justify-center rounded-full border border-dashed border-(--action-text) leading-none">
        <span className="text-sm font-bold">{label}</span>
        <span className="tnum mt-0.5 text-xs font-semibold">{String(index + 1).padStart(2, '0')}</span>
      </span>
    </motion.span>
  );
}

/** A decorative barcode: bar widths from a fixed pattern so it never changes between renders. */
function Barcode({ label }: { label: string }) {
  const pattern = [2, 1, 1, 3, 1, 2, 1, 1, 2, 3, 1, 1, 2, 1, 3, 1, 2, 2, 1, 1, 3, 1, 1, 2, 1, 2, 1, 3];
  let x = 0;
  const bars = pattern.map((w, i) => {
    const bar = i % 2 === 0 ? <rect key={i} x={x} y={0} width={w} height={40} /> : null;
    x += w + 1;
    return bar;
  });
  return (
    <svg role="img" aria-label={label} viewBox={`0 0 ${x} 40`} className="h-10 w-24 shrink-0 fill-(--brand-ink)" preserveAspectRatio="none">
      {bars}
    </svg>
  );
}
