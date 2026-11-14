import { Fragment } from 'react';
import { useT } from '@lab/i18n';
import { Badge } from '@dash/components/ui/badge';
import { fill, messages } from '../i18n';
import { Amount } from './amount';
import { DAYS } from './data';
import { aggregate } from './engine';
import { nameOf, useEnv } from './env';
import { decToFixed, decToString, groupInt, type Dec } from './money-core';
import { Overlay } from './overlay';

/** Geometry only: money never goes through Number for display, but a sparkline needs coordinates. */
export const toNum = (d: Dec): number => Number(decToString(d));

export function Sparkline({ values, flags, className }: { values: number[]; flags?: boolean[]; className?: string }) {
  const W = 320;
  const H = 56;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const x = (i: number) => (i / (values.length - 1)) * W;
  const y = (v: number) => H - 6 - ((v - min) / span) * (H - 12);
  const d = values.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={className} role="img" aria-hidden preserveAspectRatio="none" style={{ direction: 'ltr' }}>
      <path d={d} fill="none" stroke="var(--primary)" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
      {flags?.map(
        (f, i) =>
          f && <circle key={i} cx={x(i)} cy={y(values[i])} r="3.5" fill="var(--card)" stroke="var(--warning)" strokeWidth="2" vectorEffect="non-scaling-stroke" />,
      )}
    </svg>
  );
}

const fmtDay = (iso: string, lang: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString(lang === 'ar' ? 'ar-u-nu-latn' : 'en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });

/** The conversion receipt: everything the server used to turn USD aggregates into the display currency. */
export function Receipt({ open, onClose, currency }: { open: boolean; onClose: () => void; currency: string }) {
  const env = useEnv();
  const t = useT(messages);
  const a = aggregate(currency);
  const usd = currency === 'USD';
  const rateOf = (d: Dec) => decToFixed(d, currency === 'JPY' ? 2 : 4);
  const rows: Array<[string, React.ReactNode]> = [
    [t.rcSource, <span key="s">USD · {nameOf(env, 'USD')}</span>],
    [t.rcDisplay, <span key="d">{currency} · {nameOf(env, currency)}</span>],
    [t.rcPeriod, <span key="p" dir="ltr">{fmtDay(DAYS[0], env.lang)} - {fmtDay(DAYS[DAYS.length - 1], env.lang)}</span>],
    [t.rcRecords, <span key="r" dir="ltr">{groupInt(String(a.records))}</span>],
    [
      t.rcOwn,
      <span key="o" dir="ltr">
        {usd ? '0' : groupInt(String(a.ownRecords))}
      </span>,
    ],
    [
      t.rcEstimated,
      <span key="e">
        {a.estimatedDays.length === 0 ? t.none : (
          <span className="inline-flex flex-wrap items-center justify-end gap-1">
            <span dir="ltr">{a.estimatedDays.length}</span>
            <Badge variant="warning" className="px-1.5 py-0 text-10">
              {t.estimatedShort}
            </Badge>
          </span>
        )}
      </span>,
    ],
  ];
  return (
    <Overlay open={open} onClose={onClose} title={t.rcTitle} description={fill(t.rcLead, { cur: currency })}>
      <div className="space-y-4 p-4">
        <div className="rounded-xl bg-muted/50 p-3">
          <p className="text-11 font-medium text-muted-foreground">{t.rcResult}</p>
          <Amount value={decToString(a.gross)} currency={currency} context="detail" className="mt-1 text-3xl font-black" noTrigger />
          <p className="mt-1.5 text-12 text-muted-foreground">{usd ? t.rcNoConversion : fill(t.rcFormula, { cur: currency })}</p>
        </div>

        <dl className="divide-y rounded-xl border text-13">
          {rows.map(([k, v]) => (
            <div key={k} className="flex items-center justify-between gap-4 px-3 py-2.5">
              <dt className="text-12 font-medium text-muted-foreground">{k}</dt>
              <dd className="text-end font-semibold tabular-nums">{v}</dd>
            </div>
          ))}
        </dl>

        {!usd && (
          <div className="rounded-xl border p-3">
            <p className="text-12 font-bold">
              {t.rcRateTitle} <bdi dir="ltr" className="font-medium text-muted-foreground">(1 USD = {currency})</bdi>
            </p>
            <div className="mt-2 grid grid-cols-3 gap-2 text-center" dir="ltr">
              {([
                [t.rcMin, a.rate.min],
                [t.rcAvg, a.rate.avg],
                [t.rcMax, a.rate.max],
              ] as Array<[string, Dec]>).map(([k, v]) => (
                <Fragment key={k}>
                  <div className="rounded-lg bg-muted/50 px-2 py-2">
                    <p className="text-10 font-medium text-muted-foreground">{k}</p>
                    <p className="text-14 font-black tabular-nums">{rateOf(v)}</p>
                  </div>
                </Fragment>
              ))}
            </div>
            <Sparkline className="mt-3 h-14 w-full" values={a.rateSeries.map((r) => toNum(r.rate))} flags={a.rateSeries.map((r) => r.estimated)} />
            <div className="mt-1 flex justify-between text-10 text-muted-foreground" dir="ltr">
              <span>{fmtDay(DAYS[0], env.lang)}</span>
              <span>{fmtDay(DAYS[DAYS.length - 1], env.lang)}</span>
            </div>
            {a.estimatedDays.length > 0 && <p className="mt-2 text-11 text-muted-foreground">{fill(t.rcEstimatedNote, { n: String(a.estimatedDays.length) })}</p>}
          </div>
        )}
        <p className="rounded-lg bg-muted/40 p-3 text-12 leading-5 text-muted-foreground">{t.rcRawNote}</p>
      </div>
    </Overlay>
  );
}
