import { useRef, useState, type KeyboardEvent } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowLeftRight, Armchair, Ban, BriefcaseBusiness, Check, CircleCheck, CircleHelp, CircleX, Loader2, Luggage, RotateCcw, type LucideIcon } from 'lucide-react';
import { useLocale, useT } from '@lab/i18n';
import { cn } from '@lab/utils';
import { messages } from '../i18n';
import type { Condition, FareOption, Itinerary } from '../mock';
import { Amount, compareDecimal, formatMoney, SignedMoney, subtractDecimal } from './money';
import { shownTotal } from './model';

type Tone = 'good' | 'neutral' | 'bad' | 'unknown';
const TONE: Record<Tone, string> = {
  good: 'text-success-ink',
  neutral: 'text-ink-muted',
  bad: 'text-danger-ink',
  unknown: 'text-ink-muted',
};

/**
 * The fare shelf: the fare families of one itinerary side by side, in plain words, opened in place under the card.
 * Picking a column re-prices the card above it; the shelf's "Continue" is the screen's one primary (teal) button,
 * and only one shelf is open at a time, so the rule holds on a list of cards.
 */
export function FareShelf({
  id,
  itinerary,
  selected,
  onSelect,
  withBag,
}: {
  id: string;
  itinerary: Itinerary;
  selected: FareOption;
  onSelect: (fare: FareOption) => void;
  withBag: boolean;
}) {
  const t = useT(messages);
  const locale = useLocale();
  const reduce = useReducedMotion();
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const [opening, setOpening] = useState(false);
  const fares = itinerary.fares;
  const cheapest = [...fares].sort((a, b) => compareDecimal(shownTotal(a, withBag), shownTotal(b, withBag)))[0];
  const currency = selected.price.currency;
  const money = (v: string) => formatMoney(v, currency, locale);
  const airline = itinerary.owner.name[locale];

  /** Radio-group keys: arrows move and select, in the page's direction. */
  const onKey = (e: KeyboardEvent, index: number) => {
    const forward = locale === 'ar' ? ['ArrowLeft', 'ArrowDown'] : ['ArrowRight', 'ArrowDown'];
    const back = locale === 'ar' ? ['ArrowRight', 'ArrowUp'] : ['ArrowLeft', 'ArrowUp'];
    let next = index;
    if (forward.includes(e.key)) next = (index + 1) % fares.length;
    else if (back.includes(e.key)) next = (index - 1 + fares.length) % fares.length;
    else return;
    e.preventDefault();
    onSelect(fares[next]);
    refs.current[next]?.focus();
  };

  const condition = (c: Condition, kind: 'change' | 'refund'): [LucideIcon, Tone, string] => {
    if (c.allowed === null) return [CircleHelp, 'unknown', t.shelf.values.unknown];
    if (!c.allowed) return [CircleX, 'bad', t.shelf.values.notAllowed];
    if (!c.penaltyAmount || c.penaltyAmount === '0.00')
      return [CircleCheck, 'good', kind === 'refund' ? t.shelf.values.fullRefund : t.shelf.values.free];
    return [kind === 'refund' ? RotateCcw : ArrowLeftRight, 'neutral', t.shelf.values.fee(money(c.penaltyAmount))];
  };

  const rows = (fare: FareOption): { key: string; label: string; icon: LucideIcon; tone: Tone; value: string }[] => {
    const { checkedPieces, checkedKg, carryOnKg } = fare.baggage;
    const [changeIcon, changeTone, changeValue] = condition(fare.conditions.change, 'change');
    const [refundIcon, refundTone, refundValue] = condition(fare.conditions.refund, 'refund');
    return [
      { key: 'cabin', label: t.shelf.rows.cabinBag, icon: BriefcaseBusiness, tone: 'neutral', value: t.shelf.values.cabinKg(carryOnKg) },
      checkedPieces
        ? { key: 'checked', label: t.shelf.rows.checked, icon: Luggage, tone: 'good', value: t.shelf.values.kg(checkedPieces, checkedKg) }
        : { key: 'checked', label: t.shelf.rows.checked, icon: Ban, tone: 'bad', value: t.shelf.values.none },
      { key: 'change', label: t.shelf.rows.change, icon: changeIcon, tone: changeTone, value: changeValue },
      { key: 'refund', label: t.shelf.rows.refund, icon: refundIcon, tone: refundTone, value: refundValue },
      fare.seatChoice === 'unknown'
        ? { key: 'seat', label: t.shelf.rows.seat, icon: CircleHelp, tone: 'unknown', value: t.shelf.values.unknown }
        : { key: 'seat', label: t.shelf.rows.seat, icon: Armchair, tone: fare.seatChoice === 'free' ? 'good' : 'neutral', value: fare.seatChoice === 'free' ? t.shelf.values.seatFree : t.shelf.values.seatPaid },
    ];
  };

  const name = `fare-${id}`;

  return (
    <motion.section
      id={id}
      aria-labelledby={`${id}-title`}
      initial={reduce ? false : { height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      exit={reduce ? { opacity: 0, transition: { duration: 0 } } : { height: 0, opacity: 0 }}
      transition={{ duration: reduce ? 0 : 0.3, ease: [0.23, 1, 0.32, 1] }}
      className="overflow-hidden border-t border-border bg-surface-2"
    >
      <div className="px-4 py-5 md:px-6">
        <h4 id={`${id}-title`} className="text-base font-semibold text-brand-ink">
          {t.shelf.title(airline)}
        </h4>
        {/* The count is visible, so a third column off-screen on a phone is never a surprise. */}
        <p className="mt-0.5 text-sm text-ink-muted">
          {t.shelf.lead} <span className="font-semibold text-ink tnum">{t.shelf.count(fares.length)}.</span>
        </p>

        {/*
          A radiogroup of native radios. Each radio's name is short (fare, price, difference); the column's rules are
          read through aria-describedby and sit outside the control, so no table lives inside a button.
        */}
        <div
          role="radiogroup"
          aria-labelledby={`${id}-title`}
          className={cn(
            // Phones: a row that scrolls sideways; each column is narrower than half, so the next one peeks in.
            '-mx-4 mt-4 flex snap-x snap-mandatory scroll-px-4 gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:gap-3 sm:overflow-visible sm:px-0 sm:pb-0',
            fares.length === 2 ? 'sm:grid-cols-2' : fares.length >= 3 ? 'sm:grid-cols-3' : 'sm:max-w-xs sm:grid-cols-1',
          )}
        >
          {fares.map((fare, index) => {
            const isOn = fare.offerId === selected.offerId;
            const total = shownTotal(fare, withBag);
            const delta = subtractDecimal(total, shownTotal(cheapest, withBag));
            const isCheapest = fare.offerId === cheapest.offerId;
            const label = `${fare.fareBrandName}, ${money(total)}, ${isCheapest ? t.shelf.cheapest : `+${money(delta)}`}`;
            const rulesId = `${id}-rules-${index}`;
            return (
              <div
                key={fare.offerId}
                onClick={() => onSelect(fare)}
                className={cn(
                  'relative flex w-[calc((100%-1rem)/2.4)] min-w-0 shrink-0 cursor-pointer snap-start flex-col rounded-xl bg-card p-3 transition-[border-color] duration-200 has-[input:focus-visible]:ring-2 has-[input:focus-visible]:ring-ring has-[input:focus-visible]:ring-offset-2 has-[input:focus-visible]:ring-offset-surface-2 sm:w-auto sm:p-4',
                  isOn ? 'border-2 border-brand' : 'border border-border hover:border-border-strong',
                )}
              >
                <label className="flex cursor-pointer flex-col">
                  <input
                    ref={(el) => {
                      refs.current[index] = el;
                    }}
                    type="radio"
                    name={name}
                    value={fare.offerId}
                    checked={isOn}
                    onChange={() => onSelect(fare)}
                    onKeyDown={(e) => onKey(e, index)}
                    aria-label={label}
                    aria-describedby={rulesId}
                    className="sr-only"
                  />
                  {/* The selected column carries a small check disc at its top end; colour is never the only signal. */}
                  <span
                    aria-hidden
                    className={cn(
                      'absolute end-2 top-2 flex size-5 items-center justify-center rounded-full transition-opacity duration-150',
                      isOn ? 'bg-brand text-brand-foreground opacity-100' : 'opacity-0',
                    )}
                  >
                    <Check className="size-3.5" strokeWidth={3} />
                  </span>
                  <span aria-hidden className="pe-6 text-sm leading-snug font-semibold break-words text-brand-ink">
                    {fare.fareBrandName}
                  </span>
                  <span aria-hidden>
                    <Amount amount={total} currency={currency} locale={locale} className="mt-2 text-base font-bold text-brand-ink sm:text-lg" />
                  </span>
                  <span aria-hidden className="mt-0.5 text-xs text-ink-muted tnum">
                    {isCheapest ? t.shelf.cheapest : <SignedMoney amount={delta} currency={currency} locale={locale} />}
                  </span>
                </label>

                <dl id={rulesId} className="mt-3 space-y-2.5 border-t border-border pt-3">
                  {rows(fare).map((row) => (
                    <div key={row.key}>
                      <dt className="text-xs text-ink-muted">{row.label}</dt>
                      <dd className="mt-0.5 flex items-start gap-1.5 text-xs leading-snug font-medium text-ink sm:text-sm">
                        <row.icon className={cn('mt-px size-4 shrink-0', TONE[row.tone])} aria-hidden />
                        <span className="min-w-0 break-words">{row.value}</span>
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            );
          })}
        </div>

        <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <p className="text-xs text-ink-muted md:max-w-md">{t.shelf.footnote}</p>
          {/* A link, so it opens in a new tab and middle-clicks like one (L-44). The lab stops the navigation. */}
          <a
            href={`/${locale}/flights/reservation/${encodeURIComponent(selected.offerId)}?search=${encodeURIComponent(itinerary.searchId)}`}
            onClick={(e) => {
              e.preventDefault();
              setOpening(true);
              window.setTimeout(() => setOpening(false), 1600);
            }}
            aria-busy={opening}
            className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-md bg-action px-6 text-base font-bold text-action-foreground transition-colors duration-150 outline-none hover:bg-action-hover focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface-2"
          >
            {opening && <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden />}
            {opening ? (
              t.shelf.opening
            ) : (
              <>
                {t.shelf.continue(selected.fareBrandName)}
                <span aria-hidden className="opacity-60">|</span>
                <Amount amount={shownTotal(selected, withBag)} currency={currency} locale={locale} currencyClassName="text-xs text-action-foreground" />
              </>
            )}
          </a>
        </div>
      </div>
    </motion.section>
  );
}
