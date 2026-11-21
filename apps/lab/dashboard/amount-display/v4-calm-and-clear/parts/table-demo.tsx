/**
 * Section 5: a bookings-style table (real Table primitives), the booking-detail "facts" block and the bidi sentence demo.
 * Transactions keep their OWN currency (D2); the display-currency equivalent is in the tooltip (tables) or a muted second line (details).
 */
import { useState, type ReactNode } from 'react';
import { cn } from '@lab/utils';
import { Badge } from '@dash/components/ui/badge';
import { Card } from '@dash/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@dash/components/ui/table';
import { AmountView, Amount, Equivalent, Reveal, amountLabel } from './amount';
import { equivalent } from './convert';
import { TRANSACTIONS, dayLabel, type Transaction, type TxStatus } from './data';
import { fill, useLab } from './env';
import { amountParts, amountText, columnScale, type Unit } from './money-core';
import { Segmented } from './segmented';

const STATUS_VARIANT: Record<TxStatus, 'success' | 'info' | 'danger' | 'warning'> = { paid: 'success', partial: 'info', refunded: 'danger', pending: 'warning' };

/**
 * Total cell: the amount in the column's own scale + the SAME Reveal as the KPI tiles (span role=button, hover / focus / touch tap).
 * It carries the exact value (when the column is compacted) and the display-currency equivalent with the rate and day.
 */
function TotalCell({ tx, columnUnit }: { tx: Transaction; columnUnit: Unit | null }) {
  const lab = useLab();
  const { t, display, locale } = lab;
  const eq = equivalent(tx, display);
  const parts = amountParts(tx.amount, tx.currency, { context: 'detail' });
  return (
    <Reveal
      label={parts ? `${amountLabel(parts, lab)}. ${t.n.table.revealHint}` : t.states.noValue}
      content={
        <div className="grid gap-1.5 py-0.5">
          {columnUnit && (
            <div className="flex items-baseline justify-between gap-4">
              <span className="text-11 text-muted-foreground">{t.reveal.exact}</span>
              <AmountView value={tx.amount} currency={tx.currency} context="detail" className="text-13 font-bold" softCents={false} />
            </div>
          )}
          {eq ? (
            <>
              <div className="flex items-baseline justify-between gap-4">
                <span className="text-11 text-muted-foreground">{fill(t.table.equivalent, { cur: display })}</span>
                <Equivalent value={eq.value} currency={eq.currency} className="text-13 font-bold" />
              </div>
              <span className="text-11 text-muted-foreground" dir="ltr">
                1 USD = {eq.rate} {display} · {dayLabel(eq.day, locale)}
              </span>
            </>
          ) : (
            <span className="text-11 text-muted-foreground">{t.table.sameCurrency}</span>
          )}
        </div>
      }
    >
      <AmountView value={tx.amount} currency={tx.currency} context="table" columnUnit={columnUnit} />
    </Reveal>
  );
}

export function BookingsTable() {
  const lab = useLab();
  const { t, locale } = lab;
  const [page, setPage] = useState<1 | 2 | 3>(1);
  const rows = TRANSACTIONS.filter((r) => r.page === page);
  const unit = columnScale(rows.map((r) => r.amount));
  const marginUnit = columnScale(rows.map((r) => r.marginUsd));
  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented
          label={t.table.page}
          value={page}
          onChange={setPage}
          className="inline-flex rounded-lg border bg-muted/60 p-1"
          itemClassName={(on) => cn('min-h-11 rounded-md px-3.5 text-13 font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-8', on ? 'bg-background text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground')}
          options={([1, 2, 3] as const).map((p) => ({ value: p, content: fill(t.table.pageN, { n: p }) }))}
        />
        <Badge variant={unit ? 'info' : 'outline'} className="h-6 px-2.5 text-11">
          {unit ? fill(t.table.colCompact, { unit }) : t.table.colExact}
        </Badge>
      </div>
      <div tabIndex={0} role="region" aria-label={t.table.page} className="overflow-x-auto rounded-2xl border bg-card shadow-sm focus-visible:ring-2 focus-visible:ring-ring [&_th:first-child]:ps-4 [&_td:first-child]:ps-4 [&_th:last-child]:pe-4 [&_td:last-child]:pe-4">
        <Table className="min-w-[700px]">
          <TableHeader>
            <TableRow>
              <TableHead className="text-start">{t.table.ref}</TableHead>
              <TableHead className="text-start">{t.table.route}</TableHead>
              <TableHead className="text-start">{t.table.status}</TableHead>
              <TableHead className="text-end">{t.table.total}</TableHead>
              <TableHead className="text-end">{t.table.marginUsd}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="text-start">
                  <span className="block text-13 font-bold" dir="ltr">
                    {r.ref}
                  </span>
                  <span className="block text-11 text-muted-foreground">{locale === 'ar' ? r.customerAr : r.customerEn}</span>
                </TableCell>
                <TableCell className="text-start text-13">{locale === 'ar' ? r.routeAr : r.routeEn}</TableCell>
                <TableCell className="text-start">
                  <Badge variant={STATUS_VARIANT[r.status]} className="text-11">
                    {t.table.statuses[r.status]}
                  </Badge>
                </TableCell>
                <TableCell className="text-end text-13 font-semibold">
                  <TotalCell tx={r} columnUnit={unit} />
                </TableCell>
                {/* single-currency column: the unit is in the header, so no sign and no code in the cells */}
                <TableCell className="text-end text-13 text-muted-foreground">
                  <Amount value={r.marginUsd} currency="USD" context="table" columnUnit={marginUnit} mark="none" softCents={false} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <p className="text-12 text-muted-foreground">{t.table.note}</p>
    </div>
  );
}

function Fact({ label, children, second, tag }: { label: string; children: ReactNode; second?: ReactNode; tag?: boolean }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-4 gap-y-0.5 border-t border-border/60 px-5 py-3 first:border-t-0">
      <dt className="text-13 font-semibold text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-end">
        <div className="text-14 font-bold">
          {children}
          {tag && <span className="ms-1.5 inline-block rounded border border-border px-1 align-middle text-[11px] font-semibold leading-4 text-muted-foreground">USD</span>}
        </div>
        {second && <div className="text-12 font-medium">{second}</div>}
      </dd>
    </div>
  );
}

/** Booking-detail facts block: exact native amounts, muted equivalent as a second line, USD-denominated lines tagged. */
export function FactsBlock() {
  const lab = useLab();
  const { t, display, locale } = lab;
  const [id, setId] = useState('tx-4');
  const tx = TRANSACTIONS.find((r) => r.id === id) ?? TRANSACTIONS[0];
  const picks = ['tx-4', 'tx-1', 'tx-8', 'tx-3'].map((x) => TRANSACTIONS.find((r) => r.id === x)!);
  const eq = equivalent(tx, display);
  const due = tx.status === 'pending' ? tx.amount : '0.00';
  return (
    <div className="grid gap-3">
      <Segmented
        label={t.facts.pick}
        value={id}
        onChange={setId}
        className="flex flex-wrap gap-2"
        itemClassName={(on) => cn('min-h-11 rounded-full border px-3.5 text-13 font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-9', on ? 'border-primary bg-primary text-primary-foreground' : 'bg-card hover:bg-muted')}
        options={picks.map((p) => ({
          value: p.id,
          content: (
            <>
              <bdi dir="ltr">{p.ref}</bdi> · {p.currency}
            </>
          ),
        }))}
      />
      <Card className="gap-0 overflow-hidden rounded-2xl border bg-card py-0 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/40 px-5 py-3">
          <h3 className="text-14 font-extrabold">{t.facts.title}</h3>
          <span className="text-12 text-muted-foreground">
            <bdi dir="ltr">{tx.ref}</bdi> · {locale === 'ar' ? tx.routeAr : tx.routeEn}
          </span>
        </div>
        <dl>
          <Fact label={t.facts.total} second={eq && <Equivalent value={eq.value} currency={eq.currency} />}>
            <span className="text-18">
              <AmountView value={tx.amount} currency={tx.currency} context="detail" />
            </span>
          </Fact>
          <Fact label={t.facts.paid}>
            <AmountView value={tx.amountPaid} currency={tx.currency} context="detail" />
          </Fact>
          <Fact label={t.facts.refunded}>
            <AmountView value={tx.amountRefunded} currency={tx.currency} context="detail" tone={tx.amountRefunded === '0.00' ? 'muted' : 'negative'} softCents={false} />
          </Fact>
          <Fact label={t.facts.due}>
            <AmountView value={due} currency={tx.currency} context="detail" tone={due === '0.00' ? 'muted' : 'neutral'} />
          </Fact>
          <Fact label={t.facts.supplier} tag>
            <AmountView value={tx.supplierCostUsd} currency="USD" context="detail" mark="none" />
          </Fact>
          <Fact label={t.facts.margin} tag>
            <AmountView value={tx.marginUsd} currency="USD" context="detail" mark="none" />
          </Fact>
          <Fact label={t.facts.wallet} tag>
            <AmountView value={tx.walletAppliedUsd} currency="USD" context="detail" mark="none" tone={tx.walletAppliedUsd === '0.0000' ? 'muted' : 'neutral'} />
          </Fact>
          <Fact label={t.facts.rate}>
            <span className="text-13 font-semibold" dir="ltr">
              1 USD = {equivalent({ ...tx, currency: 'USD' }, tx.currency)?.rate ?? '1'} {tx.currency}
            </span>
          </Fact>
        </dl>
      </Card>
      <p className="text-12 text-muted-foreground">{t.facts.note}</p>
    </div>
  );
}

/** Sentence with an amount inside Arabic (RTL) or English text: plain text breaks, the isolate does not. */
export function BidiDemo() {
  const lab = useLab();
  const { t } = lab;
  const [before, after] = t.bidi.sentence.split('{amount}');
  const plain = amountText('1250.00', 'SAR', { mark: 'glyph' });
  const plainNeg = amountText('-1250.00', 'USD', { mark: 'code' });
  const isolated = amountText('1250.00', 'SAR', { mark: 'glyph', isolate: 'lri' });
  return (
    <div className="grid gap-3 md:grid-cols-3">
      <div className="grid gap-2 rounded-2xl border bg-card p-4">
        <Badge variant="danger" className="w-fit text-11">
          {t.bidi.wrong}
        </Badge>
        <p className="text-15 leading-relaxed">
          {before}
          {plain}
          {after}
        </p>
        <p className="text-15 leading-relaxed">
          {t.bidi.balance} {plainNeg}
        </p>
        <p className="text-12 text-muted-foreground">{t.bidi.wrongNote}</p>
      </div>
      <div className="grid gap-2 rounded-2xl border bg-card p-4">
        <Badge variant="warning" className="w-fit text-11">
          {t.bidi.textIso}
        </Badge>
        <p className="text-15 leading-relaxed">
          {before}
          {isolated}
          {after}
        </p>
        <p className="text-15 leading-relaxed">
          {t.bidi.balance} {amountText('-1250.00', 'USD', { isolate: 'lri' })}
        </p>
        <p className="text-12 text-muted-foreground">{t.bidi.textIsoNote}</p>
      </div>
      <div className="grid gap-2 rounded-2xl border border-primary/40 bg-card p-4">
        <Badge variant="success" className="w-fit text-11">
          {t.bidi.right}
        </Badge>
        <p className="text-15 leading-relaxed">
          {before}
          <AmountView value="1250.00" currency="SAR" context="inline" className="font-bold" />
          {after}
        </p>
        <p className="text-15 leading-relaxed">
          {t.bidi.balance} <AmountView value="-1250.00" currency="USD" context="inline" className="font-bold" />
        </p>
        <p className="text-12 text-muted-foreground">{t.bidi.rightNote}</p>
      </div>
    </div>
  );
}
