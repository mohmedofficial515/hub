/**
 * A change read as a sentence: "Refund destination: Customer's choice → Wallet", "Lockout turned off",
 * "Added: 60 minutes". Shared by the review sheet and the history drawer; JSON never shows.
 */
import type { ReactNode } from 'react';
import { ArrowRight, Coins, ShieldCheck, TriangleAlert, Users } from 'lucide-react';
import { cn } from '@lab/utils';
import type { FieldValue } from '@lab/mocks/settings';
import { fill, valueText } from './format';
import { fieldLabel, type Change } from './model';
import { useStore } from './store';
import { Pill } from './ui';

function listDelta(from: FieldValue, to: FieldValue) {
  const a = Array.isArray(from) ? (from as Array<string | number>).map(String) : [];
  const b = Array.isArray(to) ? (to as Array<string | number>).map(String) : [];
  return { added: b.filter((x) => !a.includes(x)), removed: a.filter((x) => !b.includes(x)) };
}

/** One tag per change, the one that explains the confirmation it needs. */
function tag(field: NonNullable<Change['ref']>['field'], t: ReturnType<typeof useStore>['t']): ReactNode {
  const cls = 'h-5 gap-1 px-1.5 text-11 [&_svg]:size-3';
  if (field.proposed) return <Pill tone="info" className={cls}>{field.proposalId}</Pill>;
  if (field.risk === 'high') return <Pill tone="warning" className={cls}><TriangleAlert aria-hidden />{t.field.highRisk}</Pill>;
  if (field.twoPerson) return <Pill tone="outline" className={cls}><Users aria-hidden />{t.field.twoPerson}</Pill>;
  if (field.control === 'security') return <Pill tone="outline" className={cls}><ShieldCheck aria-hidden />{t.field.security}</Pill>;
  if (field.control === 'money') return <Pill tone="outline" className={cls}><Coins aria-hidden />{t.field.money}</Pill>;
  return null;
}

export function ChangeLine({ change, compact, showTags = true }: { change: Change; compact?: boolean; showTags?: boolean }) {
  const { t, locale } = useStore();
  const field = change.ref?.field;
  const label = field ? fieldLabel(field, locale, t) : change.key;
  const text = (v: FieldValue) => valueText(locale, t, field, v, 6);
  const isList = Array.isArray(change.from) || Array.isArray(change.to);

  let body: ReactNode;
  if (field?.type === 'boolean' || typeof change.to === 'boolean') {
    body = (
      <span className={cn('font-bold', change.to ? 'text-success-soft-foreground' : 'text-foreground')}>{change.to ? t.review.turnedOn : t.review.turnedOff}</span>
    );
  } else if (isList && field?.type !== 'secret') {
    const { added, removed } = listDelta(change.from, change.to);
    const pretty = (xs: string[]) => valueText(locale, t, field, xs as never, 6);
    body = (
      <span className="grid gap-0.5">
        {added.length ? <span className="font-semibold text-success-soft-foreground">{fill(t.review.added, { v: pretty(added) })}</span> : null}
        {removed.length ? <span className="font-semibold text-destructive-soft-foreground">{fill(t.review.removed, { v: pretty(removed) })}</span> : null}
        {!added.length && !removed.length ? <span className="font-semibold">{t.review.reordered}</span> : null}
      </span>
    );
  } else {
    body = (
      <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="sr-only">{t.review.from}</span>
        <bdi className="text-muted-foreground line-through decoration-muted-foreground/50">{text(change.from)}</bdi>
        <ArrowRight className="size-3.5 shrink-0 text-muted-foreground rtl:rotate-180" aria-hidden />
        <span className="sr-only">{t.review.to}</span>
        <bdi className="font-bold text-foreground">{text(change.to)}</bdi>
      </span>
    );
  }

  return (
    <div className={cn('grid gap-1', compact ? 'py-1.5' : 'py-3')}>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className={cn('font-semibold', compact ? 'text-13' : 'text-14')}>{label}</span>
        {showTags && field ? tag(field, t) : null}
      </div>
      <div className={cn(compact ? 'text-13' : 'text-14')}>{body}</div>
      {!compact && field?.proposed ? <p className="text-12 text-info-soft-foreground">{t.review.proposedNote}</p> : null}
    </div>
  );
}
