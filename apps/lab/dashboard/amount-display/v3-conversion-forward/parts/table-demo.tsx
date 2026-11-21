import { useMemo, useState } from 'react';
import { Banknote, Columns3, Equal } from 'lucide-react';
import { useLocale, useT } from '@lab/i18n';
import { cn } from '@lab/utils';
import { Badge } from '@dash/components/ui/badge';
import { Button } from '@dash/components/ui/button';
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@dash/components/ui/dropdown-menu';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@dash/components/ui/table';
import { fill, messages } from '../i18n';
import { Amount, Equivalent } from './amount';
import { TXS, txUsd, type Tx, type TxStatus } from './data';
import { txEquivalent } from './engine';
import { useEnv } from './env';
import { BasisChip } from './kpi';
import { TABLE_COLUMN_THRESHOLD, addDec, cmpDec, decToFixed, decToString, mulDec, parseDec } from './money-core';

const fmtDay = (iso: string, lang: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString(lang === 'ar' ? 'ar-u-nu-latn' : 'en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });

const due = (x: Tx) => decToFixed(addDec(parseDec(x.total), { n: -parseDec(x.paid).n, s: parseDec(x.paid).s }), 3);
const colCompact = (vals: string[]) => vals.some((v) => cmpDec({ n: parseDec(v).n < BigInt(0) ? -parseDec(v).n : parseDec(v).n, s: parseDec(v).s }, parseDec(String(TABLE_COLUMN_THRESHOLD))) >= 0);

const STATUS_VARIANT: Record<TxStatus, 'success' | 'warning' | 'secondary' | 'destructive'> = {
  confirmed: 'success',
  partial: 'warning',
  pending: 'secondary',
  refunded: 'destructive',
};

/** Real Table primitives, the DataGrid look: end-aligned figures, one currency per row, optional equivalent column. */
export function BookingsTable({ onSelect, selected }: { onSelect: (id: string) => void; selected: string }) {
  const t = useT(messages);
  const env = useEnv();
  const lang = useLocale();
  const [cols, setCols] = useState({ paid: true, due: true, equivalent: false });
  const totalCompact = useMemo(() => colCompact(TXS.map((x) => x.total)), []);
  const paidCompact = useMemo(() => colCompact(TXS.map((x) => x.paid)), []);
  const dueCompact = useMemo(() => colCompact(TXS.map((x) => due(x))), []);
  const statusLabel = t.status as Record<TxStatus, string>;

  return (
    <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 bg-muted/50 px-5 py-4">
        <div className="min-w-0">
          <h3 className="text-15 font-bold text-primary">{t.tblTitle}</h3>
          <p className="text-12 text-muted-foreground">{fill(t.tblDesc, { cur: env.display })}</p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="min-h-11 gap-2 sm:size-auto sm:min-h-9 sm:h-9" aria-label={t.tblColumns}>
              <Columns3 className="size-4" />
              <span className="text-13">{t.tblColumns}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60">
            <DropdownMenuLabel className="text-12">{t.tblColumns}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {(
              [
                ['paid', t.colPaid],
                ['due', t.colDue],
                ['equivalent', t.colEquivalent],
              ] as const
            ).map(([k, label]) => (
              <DropdownMenuCheckboxItem key={k} checked={cols[k]} onCheckedChange={(v) => setCols((c) => ({ ...c, [k]: !!v }))} onSelect={(e) => e.preventDefault()} className="min-h-11 sm:min-h-8">
                {label}
                {k === 'equivalent' && <span className="ms-auto ps-2 text-10 text-muted-foreground">{t.tblOffDefault}</span>}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <Table className="min-w-[46rem]">
        <TableHeader>
          <TableRow className="bg-muted hover:bg-muted">
            <TableHead className="h-11 text-start text-12">{t.colRef}</TableHead>
            <TableHead className="h-11 text-start text-12">{t.colCustomer}</TableHead>
            <TableHead className="h-11 text-start text-12">{t.colStatus}</TableHead>
            <TableHead className="h-11 text-end text-12">{t.colTotal}</TableHead>
            {cols.paid && <TableHead className="h-11 text-end text-12">{t.colPaid}</TableHead>}
            {cols.due && <TableHead className="h-11 text-end text-12">{t.colDue}</TableHead>}
            {cols.equivalent && <TableHead className="h-11 text-end text-12">{fill(t.colEquivalentIn, { cur: env.display })}</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {TXS.map((x) => {
            const eq = txEquivalent(x, env.display);
            const dueValue = due(x);
            const hint = (
              <div className="space-y-1">
                <Amount value={x.total} currency={x.currency} context="detail" plain noTrigger multi />
                {eq ? (
                  <div className="opacity-80">
                    {env.dec.approx && '≈ '}
                    <Amount value={decToString(eq.value)} currency={env.display} context="detail" plain noTrigger multi />
                    <span className="block text-11 opacity-80">{fill(t.rateOfDay, { rate: decToFixed(eq.rate, 4), day: fmtDay(x.date, lang) })}</span>
                  </div>
                ) : (
                  <div className="text-11 opacity-80">{t.sameCurrency}</div>
                )}
              </div>
            );
            return (
              <TableRow key={x.id} data-state={x.id === selected ? 'selected' : undefined}>
                <TableCell className="py-2">
                  <button
                    type="button"
                    onClick={() => onSelect(x.id)}
                    aria-pressed={x.id === selected}
                    className="-mx-2 min-h-11 rounded-md px-2 text-13 font-bold text-primary outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/60 sm:min-h-8"
                  >
                    <span dir="ltr">{x.ref}</span>
                  </button>
                </TableCell>
                <TableCell className="text-13">{x.customer[lang]}</TableCell>
                <TableCell>
                  <Badge variant={STATUS_VARIANT[x.status]} className="text-11">
                    {statusLabel[x.status]}
                  </Badge>
                </TableCell>
                <TableCell className="text-end text-13 font-semibold">
                  <Amount value={x.total} currency={x.currency} context="table" columnCompact={totalCompact} multi hint={hint} />
                </TableCell>
                {cols.paid && (
                  <TableCell className="text-end text-13">
                    <Amount value={x.paid} currency={x.currency} context="table" columnCompact={paidCompact} multi />
                  </TableCell>
                )}
                {cols.due && (
                  <TableCell className="text-end text-13">
                    {cmpDec(parseDec(dueValue), parseDec('0')) > 0 ? (
                      <span className="text-warning-soft-foreground">
                        <Amount value={dueValue} currency={x.currency} context="table" columnCompact={dueCompact} multi />
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                )}
                {cols.equivalent && (
                  <TableCell className="text-end">
                    {eq ? (
                      <span className="inline-flex flex-col items-end leading-tight">
                        <Equivalent value={decToString(eq.value)} currency={env.display} multi className="text-13" />
                        <span className="text-10 text-muted-foreground" dir="ltr">
                          1 USD = {decToFixed(eq.rate, 4)} · {fmtDay(x.date, lang)}
                        </span>
                      </span>
                    ) : (
                      <span className="text-12 text-muted-foreground">{t.sameCurrencyShort}</span>
                    )}
                  </TableCell>
                )}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      <p className="border-t border-border/60 px-5 py-3 text-12 text-muted-foreground">{fill(t.tblFoot, { total: totalCompact ? t.yes : t.no })}</p>
    </div>
  );
}

/* Replicas of `Section` and `Row` of booking-overview.tsx (same classes). */
function Section({ title, badge, children }: { title: string; badge?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="overflow-hidden rounded-xl border border-border/70 bg-card shadow-xs">
      <div className="flex items-center justify-between border-b border-border/60 bg-linear-to-b from-primary/5 via-primary/[0.02] to-transparent px-3.5 py-2.5">
        <h3 className="flex items-center gap-2 text-13 font-bold text-foreground">
          <span aria-hidden className="flex size-6 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
            <Banknote className="size-3.5" />
          </span>
          {title}
        </h3>
        {badge}
      </div>
      <dl className="space-y-0.5 p-2">{children}</dl>
    </section>
  );
}
function Row({ label, children, highlight }: { label: React.ReactNode; children: React.ReactNode; highlight?: boolean }) {
  return (
    <div className={cn('flex items-center justify-between gap-4 rounded-lg px-2.5 py-2 text-13 transition-colors', highlight ? 'bg-primary/5 font-semibold text-primary' : 'hover:bg-muted/30')}>
      <dt className="flex items-center gap-1.5 text-12 font-medium text-muted-foreground">{label}</dt>
      <dd className="text-end font-semibold tabular-nums text-foreground">{children}</dd>
    </div>
  );
}

/** The booking facts block: native lines first, a muted equivalent line, USD lines tagged "USD". */
export function BookingFacts({ id }: { id: string }) {
  const t = useT(messages);
  const env = useEnv();
  const lang = useLocale();
  const x = TXS.find((r) => r.id === id) ?? TXS[0];
  const eq = txEquivalent(x, env.display);
  const totalUsd = txUsd(x);
  const markup = decToFixed(mulDec(parseDec(totalUsd), parseDec('0.04')), 2);
  const subtotal = decToFixed(addDec(parseDec(totalUsd), { n: -parseDec(markup).n, s: parseDec(markup).s }), 2);
  const usdTag = <BasisChip>USD</BasisChip>;
  return (
    <Section
      title={fill(t.factsTitle, { ref: x.ref })}
      badge={
        <span className="flex items-center gap-1.5 text-13">
          <span className="text-11 font-medium text-muted-foreground">{t.factsTotal}:</span>
          <span className="font-bold text-primary">
            <Amount value={x.total} currency={x.currency} context="detail" plain noTrigger />
          </span>
        </span>
      }
    >
      <Row label={t.factsTotal} highlight>
        <span className="flex flex-col items-end leading-tight">
          <Amount value={x.total} currency={x.currency} context="detail" noTrigger />
          {eq && (
            <span className="mt-1 text-12 font-medium">
              <Equivalent value={decToString(eq.value)} currency={env.display} />
            </span>
          )}
        </span>
      </Row>
      {eq && (
        <p className="flex items-start gap-1.5 px-2.5 pb-1.5 text-11 leading-4 text-muted-foreground">
          <Equal className="mt-0.5 size-3 shrink-0" aria-hidden />
          {fill(t.factsBasis, { usd: totalUsd, rate: decToFixed(eq.rate, 4), day: fmtDay(x.date, lang), cur: env.display })}
        </p>
      )}
      <Row label={t.factsPaid}>
        <Amount value={x.paid} currency={x.currency} context="detail" plain noTrigger />
      </Row>
      <Row label={t.factsDue}>
        <Amount value={due(x)} currency={x.currency} context="detail" plain noTrigger />
      </Row>
      <Row label={<>{t.factsSubtotal} {usdTag}</>}>
        <Amount value={subtotal} currency="USD" context="detail" plain noTrigger />
      </Row>
      <Row label={<>{t.factsMarkup} {usdTag}</>}>
        <Amount value={markup} currency="USD" context="detail" plain noTrigger />
      </Row>
      <Row label={<>{t.factsTotalUsd} {usdTag}</>}>
        <Amount value={totalUsd} currency="USD" context="detail" plain noTrigger />
      </Row>
      <Row label={t.factsFx}>
        <span dir="ltr">{x.currency === 'USD' ? '—' : `1 USD = ${x.fxRate} ${x.currency}`}</span>
      </Row>
    </Section>
  );
}

/** Bidi: an Arabic sentence with an isolated amount (the sign stays on the left of the figure). */
export function BidiDemo() {
  const t = useT(messages);
  const lang = useLocale();
  const [pre, post] = t.bidiSentence.split('{amount}');
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <div className="rounded-xl border bg-card p-4">
        <p className="mb-2 text-11 font-bold text-success-soft-foreground">✓ {t.bidiRight}</p>
        <p className="text-14 leading-7">
          {pre}
          <Amount value="-1250" currency="SAR" context="inline" />
          {post}
        </p>
        <p className="mt-3 text-12 text-muted-foreground">{t.bidiRightWhy}</p>
      </div>
      <div className="rounded-xl border bg-card p-4">
        <p className="mb-2 text-11 font-bold text-destructive">✗ {t.bidiWrong}</p>
        <p className="text-14 leading-7">
          {pre}
          {lang === 'ar' ? '⃁ -1,250.00' : 'SAR -1,250.00'}
          {post}
        </p>
        <p className="mt-1 text-14 leading-7">
          {pre}
          {lang === 'ar' ? '-1,250.00 SAR' : '-1,250.00 SAR'}
          {post}
        </p>
        <p className="mt-3 text-12 text-muted-foreground">{t.bidiWrongWhy}</p>
      </div>
    </div>
  );
}
