/**
 * Before / after strip for three real surfaces. "Before" is a faithful replica of what the dashboard prints today
 * (`formatAmount` / `formatMoneyValue`: `USD 12,345,678.50`, code first, same weight everywhere), built with the measured classes of
 * `spark-stat-card.tsx`, `booking-columns.tsx` and `booking-overview.tsx`. The real components use next/* so they cannot be imported.
 */
import type { ReactNode } from 'react';
import { Percent, ShoppingBag } from 'lucide-react';
import { Badge } from '@dash/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@dash/components/ui/table';
import { AmountView } from './amount';
import { Tile, oldText } from './kpi';
import { useLab } from './env';

function Pair({ id, title, before, after }: { id: string; title: string; before: ReactNode; after: ReactNode }) {
  const { t } = useLab();
  return (
    <section aria-label={title} className="grid gap-3">
      <h3 className="text-14 font-extrabold">{title}</h3>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="grid min-w-0 content-start gap-2">
          <p className="text-12 font-bold text-muted-foreground">{t.surfaces.before}</p>
          <div id={`surface-before-${id}`} className="min-w-0 rounded-2xl">
            {before}
          </div>
        </div>
        <div className="grid min-w-0 content-start gap-2">
          <p className="text-12 font-bold text-primary">{t.surfaces.after}</p>
          <div id={`surface-after-${id}`} className="min-w-0 rounded-2xl">
            {after}
          </div>
        </div>
      </div>
    </section>
  );
}

function FinanceKpis() {
  const { t } = useLab();
  return (
    <>
      <Pair
        id="finance"
        title={t.surfaces.finance}
        before={
          <div className="grid gap-3">
            <Tile title={t.kpi.gross} icon={ShoppingBag} value={oldText('12345678.50', 'USD')} subtitle={t.surfaces.financeSub} />
            <Tile title={t.kpi.refundRateTitle} icon={Percent} value="4.12" unit="%" subtitle={t.kpi.refundRateNote} />
          </div>
        }
        after={
          <div className="grid gap-3">
            <Tile title={t.kpi.gross} icon={ShoppingBag} value={<AmountView value="12345678.50" currency="USD" context="kpi" />} subtitle={t.surfaces.financeSub} />
            <Tile title={t.kpi.refundRateTitle} icon={Percent} value="4.12" unit="%" subtitle={t.kpi.refundRateNote} />
          </div>
        }
      />
    </>
  );
}

const ROWS = [
  { ref: 'GT-48166', total: '1250.00', cur: 'SAR', paid: '1000.00', refunded: '250.00' },
  { ref: 'GT-48109', total: '12450.75', cur: 'USD', paid: '12450.75', refunded: '0.00' },
  { ref: 'GT-48190', total: '18750000', cur: 'JPY', paid: '18750000', refunded: '0.00' },
];

function BookingsRow({ after }: { after: boolean }) {
  const { t } = useLab();
  return (
    <div className="overflow-x-auto rounded-2xl border bg-card [&_th:first-child]:ps-4 [&_td:first-child]:ps-4 [&_th:last-child]:pe-4 [&_td:last-child]:pe-4">
      <Table className="min-w-[520px]">
        <TableHeader>
          <TableRow>
            <TableHead className="text-start">{t.table.ref}</TableHead>
            <TableHead className={after ? 'text-end' : 'text-start'}>{t.table.total}</TableHead>
            <TableHead className={after ? 'text-end' : 'text-start'}>{t.facts.paid}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {ROWS.map((r) => (
            <TableRow key={r.ref}>
              <TableCell className="text-start text-13 font-bold" dir="ltr">
                {r.ref}
              </TableCell>
              {after ? (
                <>
                  <TableCell className="text-end text-13 font-semibold">
                    <AmountView value={r.total} currency={r.cur} context="table" />
                  </TableCell>
                  <TableCell className="text-end text-13">
                    <AmountView value={r.paid} currency={r.cur} context="table" />
                    {r.refunded !== '0.00' && (
                      <span className="mt-0.5 block text-11 text-destructive-soft-foreground">
                        {t.facts.refunded} <AmountView value={r.refunded} currency={r.cur} context="table" softCents={false} />
                      </span>
                    )}
                  </TableCell>
                </>
              ) : (
                <>
                  <TableCell className="text-start text-13" dir="ltr">
                    {oldText(r.total, r.cur)}
                  </TableCell>
                  <TableCell className="text-start text-13" dir="ltr">
                    {oldText(r.paid, r.cur)}
                    {r.refunded !== '0.00' && <span className="block text-11 text-destructive-soft-foreground">{`${t.facts.refunded} ${oldText(r.refunded, r.cur)}`}</span>}
                  </TableCell>
                </>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function FactRows({ after }: { after: boolean }) {
  const { t } = useLab();
  const rows: [string, string, string, boolean][] = [
    [t.facts.total, '1250.00', 'SAR', false],
    [t.facts.paid, '1000.00', 'SAR', false],
    [t.facts.supplier, '920.4000', 'USD', true],
    [t.facts.margin, '57.6000', 'USD', true],
  ];
  return (
    <dl className="overflow-hidden rounded-2xl border bg-card">
      {rows.map(([label, v, cur, usd]) => (
        <div key={label} className="flex items-baseline justify-between gap-4 border-t border-border/60 px-5 py-3 first:border-t-0">
          <dt className="text-13 font-semibold text-muted-foreground">{label}</dt>
          <dd className="text-14 font-bold">
            {after ? (
              <>
                <AmountView value={v} currency={cur} context="detail" mark={usd ? 'none' : 'auto'} />
                {usd && <span className="ms-1.5 inline-block rounded border border-border px-1 align-middle text-[11px] font-semibold leading-4 text-muted-foreground">USD</span>}
              </>
            ) : (
              <bdi dir="ltr">{oldText(v, cur)}</bdi>
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function Surfaces() {
  const { t } = useLab();
  return (
    <div className="grid gap-8">
      <FinanceKpis />
      <Pair id="bookings" title={t.surfaces.bookings} before={<BookingsRow after={false} />} after={<BookingsRow after />} />
      <Pair id="facts" title={t.surfaces.facts} before={<FactRows after={false} />} after={<FactRows after />} />
      <Badge variant="outline" className="h-auto w-fit whitespace-normal py-1 text-11 font-medium text-muted-foreground">
        {t.surfaces.replicaNote}
      </Badge>
    </div>
  );
}

