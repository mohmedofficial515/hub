import { Banknote, TrendingUp, Wallet } from 'lucide-react';
import type { ReactNode } from 'react';
import { useT } from '@lab/i18n';
import { cn } from '@lab/utils';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@dash/components/ui/table';
import { messages } from '../i18n';
import { Amount } from './amount';
import { KpiTile } from './kpi';
import { BookingFacts } from './table-demo';
import { BasisChip } from './kpi';
import { groupInt, minorDigits, parseDec, decToFixed } from './money-core';
import { KPI_SAMPLES } from './data';

/** What the current dashboard prints: `formatAmount()` = code + space + grouped figure, whatever the size. */
const before = (value: string, cur: string) => {
  const t = decToFixed(parseDec(value), minorDigits(cur));
  const [i, f] = t.split('.');
  return `${cur} ${groupInt(i)}${f ? `.${f}` : ''}`;
};

function Pair({ title, was, now }: { title: string; was: ReactNode; now: ReactNode }) {
  const t = useT(messages);
  return (
    <div className="space-y-3">
      <h3 className="text-15 font-bold">{title}</h3>
      <div className="grid gap-4 xl:grid-cols-2">
        <div className="min-w-0 space-y-2">
          <p className="text-12 font-bold text-muted-foreground">{t.baBefore}</p>
          {was}
        </div>
        <div className="min-w-0 space-y-2">
          <p className="text-12 font-bold text-primary">{t.baAfter}</p>
          {now}
        </div>
      </div>
    </div>
  );
}

const ROWS: Array<[string, string, string, string]> = [
  ['GT-48213', 'SAR', '1250.00', '1250.00'],
  ['GT-48214', 'USD', '12450.75', '12450.75'],
  ['GT-48215', 'TRY', '4250000.00', '2000000.00'],
  ['GT-48216', 'JPY', '18750000', '18750000'],
];

export function BeforeAfter() {
  const t = useT(messages);
  const tiles = [
    { title: t.kGross, icon: Banknote, v: '12345678.50' },
    { title: t.kNet, icon: TrendingUp, v: '11912034.18' },
    { title: t.kReceivable, icon: Wallet, v: '1842650.40' },
  ];
  return (
    <div className="space-y-10">
      <Pair
        title={t.baKpiTitle}
        was={
          <div className="grid gap-3">
            {tiles.slice(0, 2).map((x) => (
              <KpiTile key={x.title} title={x.title} icon={x.icon} value={before(x.v, 'USD')} subtitle={t.last30} />
            ))}
          </div>
        }
        now={
          <div className="grid gap-3">
            {tiles.slice(0, 2).map((x) => (
              <KpiTile
                key={x.title}
                title={x.title}
                icon={x.icon}
                badge={<BasisChip>SAR · {t.dayRatesShort}</BasisChip>}
                value={<Amount value="46296294.38" currency="SAR" context="kpi" from="USD" />}
                subtitle={t.last30}
              />
            ))}
          </div>
        }
      />
      <Pair
        title={t.baTableTitle}
        was={
          <div className="overflow-hidden rounded-xl border bg-card">
            <Table className="min-w-[24rem] text-13">
              <TableHeader>
                <TableRow className="bg-muted hover:bg-muted">
                  <TableHead className="h-11 text-start text-12">{t.colRef}</TableHead>
                  <TableHead className="h-11 text-end text-12">{t.colTotal}</TableHead>
                  <TableHead className="h-11 text-end text-12">{t.colPaid}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ROWS.map(([ref, cur, total, paid]) => (
                  <TableRow key={ref}>
                    <TableCell className="font-bold text-primary" dir="ltr">{ref}</TableCell>
                    <TableCell className="text-end tabular-nums" dir="ltr">{before(total, cur)}</TableCell>
                    <TableCell className="text-end tabular-nums" dir="ltr">{before(paid, cur)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        }
        now={
          <div className="overflow-hidden rounded-xl border bg-card">
            <Table className="min-w-[24rem] text-13">
              <TableHeader>
                <TableRow className="bg-muted hover:bg-muted">
                  <TableHead className="h-11 text-start text-12">{t.colRef}</TableHead>
                  <TableHead className="h-11 text-end text-12">{t.colTotal}</TableHead>
                  <TableHead className="h-11 text-end text-12">{t.colPaid}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ROWS.map(([ref, cur, total, paid]) => (
                  <TableRow key={ref}>
                    <TableCell className="font-bold text-primary" dir="ltr">{ref}</TableCell>
                    <TableCell className="text-end"><Amount value={total} currency={cur} context="table" columnCompact multi noTrigger /></TableCell>
                    <TableCell className="text-end"><Amount value={paid} currency={cur} context="table" columnCompact multi noTrigger /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        }
      />
      <Pair
        title={t.baFactsTitle}
        was={
          <section className="overflow-hidden rounded-xl border border-border/70 bg-card shadow-xs">
            <div className="border-b border-border/60 bg-linear-to-b from-primary/5 to-transparent px-3.5 py-2.5 text-13 font-bold">{t.factsTitle.replace('{ref}', 'GT-48213')}</div>
            <dl className="space-y-0.5 p-2">
              {[
                [t.factsTotal, before('1250', 'SAR'), true],
                [t.factsPaid, before('1250', 'SAR'), false],
                [t.factsDue, before('0', 'SAR'), false],
                [t.factsSubtotal + ' (USD)', before('320', 'USD'), false],
                [t.factsTotalUsd + ' (USD)', before('333.33', 'USD'), false],
              ].map(([k, v, hl]) => (
                <div key={String(k)} className={cn('flex items-center justify-between gap-4 rounded-lg px-2.5 py-2 text-13', hl ? 'bg-primary/5 font-semibold text-primary' : '')}>
                  <dt className="text-12 font-medium text-muted-foreground">{k}</dt>
                  <dd className="text-end font-semibold tabular-nums" dir="ltr">{v}</dd>
                </div>
              ))}
            </dl>
          </section>
        }
        now={<BookingFacts id="tx1" />}
      />
    </div>
  );
}

/** Section 3: the same value from 9,999 to 12 billion, today's tile against the new one. */
export function KpiRange() {
  const t = useT(messages);
  return (
    <div className="space-y-3">
      {KPI_SAMPLES.map((v) => (
        <div key={v} className="grid gap-3 lg:grid-cols-2">
          <KpiTile title={t.kGross} icon={Banknote} value={before(v, 'USD')} subtitle={t.baBefore} />
          <KpiTile
            title={t.kGross}
            icon={Banknote}
            badge={<BasisChip>USD · {t.chipUsdShort}</BasisChip>}
            value={<Amount value={v} currency="USD" context="kpi" />}
            subtitle={t.baAfter}
          />
        </div>
      ))}
    </div>
  );
}
