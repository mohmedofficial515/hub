import type { ReactNode } from 'react';
import { ArrowLeftRight, Ban, BriefcaseBusiness, CircleCheck, CircleHelp, CircleX, Luggage, type LucideIcon } from 'lucide-react';
import { useLocale, useT } from '@lab/i18n';
import { cn } from '@lab/utils';
import { messages } from '../i18n';
import type { FareOption } from '../mock';
import { formatMoney } from './money';
import { refundStatusOf, type RefundStatus } from './model';

const REFUND: Record<RefundStatus, { icon: LucideIcon; tone: string }> = {
  refundable: { icon: CircleCheck, tone: 'text-success-ink' },
  nonRefundable: { icon: CircleX, tone: 'text-danger-ink' },
  unknown: { icon: CircleHelp, tone: 'text-ink-muted' },
};

/**
 * The refund badge: three states, icon + word, on a neutral pill (no tinted card, no stripe). "Unknown" is neutral,
 * never red: the airline did not say, so the card does not say "no" either (L-13).
 */
export function RefundBadge({ fare, className }: { fare: FareOption; className?: string }) {
  const t = useT(messages);
  const locale = useLocale();
  const status = refundStatusOf(fare);
  const { icon: Icon, tone } = REFUND[status];
  const fee = fare.conditions.refund.penaltyAmount;
  const label =
    status === 'refundable'
      ? fee && fee !== '0.00'
        ? t.refund.refundableFee(formatMoney(fee, fare.price.currency, locale))
        : t.refund.refundable
      : status === 'nonRefundable'
        ? t.refund.nonRefundable
        : t.refund.unknown;

  return (
    <span
      data-refund={status}
      className={cn(
        'inline-flex min-h-8 w-fit items-center gap-1.5 rounded-full border border-border bg-card px-3 text-xs font-semibold text-ink',
        className,
      )}
    >
      <Icon className={cn('size-4 shrink-0', tone)} aria-hidden />
      {label}
    </span>
  );
}

/** One plain-language line of what the chosen fare includes: icon + words, tone on the icon only. */
function Fact({ icon: Icon, tone, children }: { icon: LucideIcon; tone: string; children: ReactNode }) {
  return (
    <li className="inline-flex items-center gap-1.5 text-sm text-ink">
      <Icon className={cn('size-4 shrink-0', tone)} aria-hidden />
      {children}
    </li>
  );
}

/** Bag and change rule of the chosen fare. A missing checked bag is said out loud (L-61). */
export function FareFacts({ fare }: { fare: FareOption }) {
  const t = useT(messages);
  const locale = useLocale();
  const { checkedPieces, checkedKg, carryOnKg } = fare.baggage;
  const change = fare.conditions.change;
  const money = (v: string) => formatMoney(v, fare.price.currency, locale);

  return (
    <ul className="flex flex-wrap items-center gap-x-5 gap-y-2">
      <Fact icon={checkedPieces ? Luggage : Ban} tone={checkedPieces ? 'text-success-ink' : 'text-ink-muted'}>
        {t.facts.checked(checkedPieces, checkedKg)}
      </Fact>
      <Fact icon={BriefcaseBusiness} tone="text-ink-muted">
        {t.facts.cabinBag(carryOnKg)}
      </Fact>
      <Fact
        icon={change.allowed === null ? CircleHelp : ArrowLeftRight}
        tone={change.allowed === false ? 'text-danger-ink' : change.allowed && change.penaltyAmount === '0.00' ? 'text-success-ink' : 'text-ink-muted'}
      >
        {change.allowed === null
          ? t.facts.changeUnknown
          : change.allowed === false
            ? t.facts.changeNo
            : change.penaltyAmount && change.penaltyAmount !== '0.00'
              ? t.facts.changeFee(money(change.penaltyAmount))
              : t.facts.changeFree}
      </Fact>
    </ul>
  );
}
