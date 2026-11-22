/**
 * The sections that stay under the search (brief GTV-553): what you can book, how booking works, support contact.
 * Flat surfaces and hairlines; meaning is an icon plus a word; no photographs (the real grid hot-links stock images,
 * audit L-48) and no invented figures.
 */
import {
  Car,
  Check,
  Clock3,
  Hotel,
  Luggage,
  Mail,
  MapPinned,
  Phone,
  Plane,
  Smartphone,
  TicketCheck,
  TrainFront,
  UserRound,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@lab/utils';
import type { Messages } from '../i18n';
import { focusRing } from './field';
import { SEARCH_ID } from './search-card';

const container = 'mx-auto w-full max-w-[80rem] px-4 sm:px-6 lg:px-8';

function SectionHead({ id, title, lead }: { id: string; title: string; lead: string }) {
  return (
    <div className="max-w-2xl">
      <h2 id={id} className="text-2xl leading-snug font-bold text-(--brand-ink) md:text-3xl">
        {title}
      </h2>
      <p className="mt-2 text-base leading-relaxed text-(--ink-muted)">{lead}</p>
    </div>
  );
}

/* ---------------- services ---------------- */

const SOON: Array<[keyof Messages['services']['items'], LucideIcon]> = [
  ['hotels', Hotel],
  ['packages', MapPinned],
  ['cars', Car],
  ['driver', UserRound],
  ['pickup', Luggage],
  ['trains', TrainFront],
  ['esim', Smartphone],
];

export function Services({ t }: { t: Messages['services'] }) {
  return (
    <section aria-labelledby="services-title" className={cn(container, 'py-12 md:py-16')}>
      <SectionHead id="services-title" title={t.title} lead={t.lead} />
      <div className="mt-8 grid gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-6">
        {/* the one open product */}
        <article className="flex flex-col rounded-2xl border border-(--line) bg-(--card) p-6">
          <div className="flex items-center justify-between gap-3">
            <span className="flex size-12 items-center justify-center rounded-lg bg-(--brand-soft) text-(--brand-ink)">
              <Plane className="size-6" aria-hidden strokeWidth={1.75} />
            </span>
            <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-(--success-ink)">
              <Check className="size-4" aria-hidden />
              {t.available}
            </span>
          </div>
          <h3 className="mt-5 text-xl font-bold text-(--brand-ink)">{t.items.flights.title}</h3>
          <p className="mt-1 text-base leading-relaxed text-(--ink)">{t.items.flights.description}</p>
          <a
            href={`#${SEARCH_ID}`}
            onClick={(e) => {
              e.preventDefault();
              const target = document.getElementById(SEARCH_ID);
              target?.scrollIntoView({ block: 'center', behavior: 'smooth' });
              target?.querySelector<HTMLButtonElement>('button[id^="from-"]')?.focus({ preventScroll: true });
            }}
            className={cn(
              'mt-6 inline-flex min-h-11 items-center gap-2 self-start rounded-md border border-(--border-strong) px-4 text-sm font-bold text-(--brand-ink) hover:bg-(--surface-2) lg:mt-auto',
              focusRing,
            )}
          >
            {t.startSearch}
          </a>
        </article>

        {/* the products that are not on sale yet */}
        <ul className="grid gap-px overflow-hidden rounded-2xl border border-(--line) bg-(--line) sm:grid-cols-2">
          {SOON.map(([key, Icon], i) => (
            <li
              key={key}
              className={cn(
                'flex items-start gap-3 bg-(--card) p-4',
                i === SOON.length - 1 && 'sm:col-span-2',
              )}
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-(--surface-2) text-(--ink-muted)">
                <Icon className="size-5" aria-hidden strokeWidth={1.75} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <h3 className="text-base font-semibold text-(--brand-ink)">{t.items[key].title}</h3>
                  <span className="inline-flex items-center gap-1 rounded-full bg-(--surface-3) px-2 py-0.5 text-xs font-semibold text-(--ink)">
                    <Clock3 className="size-3.5" aria-hidden />
                    {t.soon}
                  </span>
                </div>
                <p className="mt-0.5 text-sm leading-relaxed text-(--ink-muted)">{t.items[key].description}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* ---------------- how booking works: the same departure line, drawn flat ---------------- */

export function Steps({ t }: { t: Messages['steps'] }) {
  return (
    <section aria-labelledby="steps-title" className="border-y border-(--line) bg-(--surface-2)">
      <div className={cn(container, 'py-12 md:py-16')}>
        <SectionHead id="steps-title" title={t.title} lead={t.lead} />
        <ol className="relative mt-10 grid gap-8 md:grid-cols-3 md:gap-6">
          {/* the line: vertical at the inline start on phones, horizontal through the stops from md */}
          <span
            aria-hidden
            className="absolute start-[19px] top-5 bottom-5 w-px bg-(--border-strong) md:start-5 md:end-5 md:top-[19px] md:bottom-auto md:h-px md:w-auto"
          />
          {t.items.map((step, i) => (
            <li key={i} className="relative flex gap-4 md:flex-col md:gap-5">
              <span
                aria-hidden
                className="tnum relative z-[1] flex size-10 shrink-0 items-center justify-center rounded-full border border-(--brand) bg-(--background) text-base font-bold text-(--brand-ink)"
              >
                {i === 2 ? <TicketCheck className="size-5" strokeWidth={1.75} /> : i + 1}
              </span>
              <div className="min-w-0 pt-1.5 md:pt-0">
                <h3 className="text-lg font-bold text-(--brand-ink)">
                  <span className="sr-only">{i + 1}. </span>
                  {step.title}
                </h3>
                <p className="mt-1 max-w-sm text-base leading-relaxed text-(--ink)">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/* ---------------- support: flat navy (D7) ---------------- */

export function Support({
  t,
  phone,
  email,
}: {
  t: Messages['support'];
  phone: string | null;
  email: string | null;
}) {
  const onBrandLink = cn(
    'inline-flex min-h-11 items-center gap-2 rounded-md text-(--on-brand) underline-offset-4 hover:underline',
    focusRing,
    'focus-visible:outline-(--on-brand)',
  );
  return (
    <section id="help" aria-labelledby="support-title" className={cn(container, 'py-12 md:py-16')}>
      <div className="grid overflow-hidden rounded-3xl bg-(--surface-brand) text-(--on-brand) lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <div className="p-6 sm:p-8 lg:p-10">
          <h2 id="support-title" className="text-2xl leading-snug font-bold md:text-3xl">
            {t.title}
          </h2>
          <p className="mt-2 max-w-lg text-base leading-relaxed text-(--on-brand-muted)">{t.body}</p>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-x-8">
            {phone && (
              <a href={`tel:${phone.replace(/\s/g, '')}`} className={onBrandLink}>
                <Phone className="size-5 text-(--on-brand-muted)" aria-hidden />
                <span className="sr-only">{t.call}: </span>
                <span dir="ltr" className="tnum text-xl font-bold">
                  {phone}
                </span>
              </a>
            )}
            {email && (
              <a href={`mailto:${email}`} className={onBrandLink}>
                <Mail className="size-5 text-(--on-brand-muted)" aria-hidden />
                <span className="sr-only">{t.email}: </span>
                <span dir="ltr" className="text-base font-semibold">
                  {email}
                </span>
              </a>
            )}
          </div>
        </div>
        <div id="manage-booking" className="border-t border-(--line-on-brand) p-6 sm:p-8 lg:border-s lg:border-t-0 lg:p-10">
          <h3 className="text-lg font-bold">{t.manage}</h3>
          <p className="mt-1 text-base leading-relaxed text-(--on-brand-muted)">{t.manageBody}</p>
          <a
            href="#manage"
            className={cn(
              'mt-5 inline-flex min-h-11 items-center rounded-md border border-(--on-brand) px-5 text-sm font-bold text-(--on-brand) hover:bg-(--line-on-brand)',
              focusRing,
              'focus-visible:outline-(--on-brand)',
            )}
          >
            {t.manage}
          </a>
        </div>
      </div>
    </section>
  );
}
