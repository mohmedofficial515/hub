/** Section 4: the compaction ladder (input -> output per context) and the self-test of the money core. */
import { useState } from 'react';
import { CheckCircle2, Play, XCircle } from 'lucide-react';
import { cn } from '@lab/utils';
import { Button } from '@dash/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@dash/components/ui/table';
import { AmountView } from './amount';
import { fill, useLab } from './env';
import { columnScale, runSelfTest, type TestResult } from './money-core';
import { runWordsTest } from './words';

interface Row {
  value: string;
  currency: string;
  note?: 'edge' | 'carry' | 'round' | 'digits' | 'neg' | 'zero' | 'cent' | 'long' | 'trillion' | 'tcarry';
}

const ROWS: Row[] = [
  { value: '999', currency: 'USD' },
  { value: '1000', currency: 'USD' },
  { value: '1500', currency: 'USD', note: 'round' },
  { value: '9999', currency: 'USD', note: 'edge' },
  { value: '10000', currency: 'USD', note: 'edge' },
  { value: '999950', currency: 'USD', note: 'carry' },
  { value: '1250000', currency: 'USD' },
  { value: '12500000', currency: 'USD' },
  { value: '1200000000', currency: 'USD' },
  { value: '999950000000', currency: 'USD', note: 'tcarry' },
  { value: '1500000000000', currency: 'USD', note: 'trillion' },
  { value: '123456789012345.12345678', currency: 'USD', note: 'long' },
  { value: '-1250000.5', currency: 'USD', note: 'neg' },
  { value: '0', currency: 'USD', note: 'zero' },
  { value: '1234.567', currency: 'KWD', note: 'digits' },
  { value: '18750000', currency: 'JPY', note: 'digits' },
  { value: '0.01', currency: 'USD', note: 'cent' },
];

export function Ladder() {
  const { t } = useLab();
  return (
    <div className="overflow-x-auto rounded-2xl border bg-card [&_th:first-child]:ps-4 [&_td:first-child]:ps-4 [&_th:last-child]:pe-4 [&_td:last-child]:pe-4">
      <Table className="min-w-[860px]">
        <TableHeader>
          <TableRow>
            <TableHead className="text-start">{t.ladder.input}</TableHead>
            <TableHead className="text-end">{t.ladder.kpi}</TableHead>
            <TableHead className="text-end">{t.ladder.chart}</TableHead>
            <TableHead className="text-end">{t.ladder.tableOn}</TableHead>
            <TableHead className="text-end">{t.ladder.tableOff}</TableHead>
            <TableHead className="text-end">{t.ladder.detail}</TableHead>
            <TableHead className="text-start">{t.ladder.note}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {ROWS.map((r) => (
            <TableRow key={`${r.value}-${r.currency}`}>
              <TableCell className="max-w-44 break-all text-start font-mono text-12 text-muted-foreground" dir="ltr">
                {r.value} {r.currency !== 'USD' && <span className="font-sans font-semibold">{r.currency}</span>}
              </TableCell>
              <TableCell className="text-end text-14 font-semibold">
                <AmountView value={r.value} currency={r.currency} context="kpi" />
              </TableCell>
              <TableCell className="text-end text-14 font-semibold">
                <AmountView value={r.value} currency={r.currency} context="chart" />
              </TableCell>
              <TableCell className="text-end text-14 font-semibold">
                <AmountView value={r.value} currency={r.currency} context="table" columnUnit={columnScale([r.value, '4250000'])} />
              </TableCell>
              <TableCell className="text-end text-14 font-semibold">
                <AmountView value={r.value} currency={r.currency} context="table" columnUnit={null} />
              </TableCell>
              <TableCell className="text-end text-14 font-semibold">
                <AmountView value={r.value} currency={r.currency} context="detail" />
              </TableCell>
              <TableCell className="min-w-40 ps-6 text-12 text-muted-foreground">{r.note ? t.ladder.notes[r.note] : ''}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export function SelfTest() {
  const { t } = useLab();
  const [results, setResults] = useState<TestResult[] | null>(null);
  const failed = results?.filter((r) => !r.pass).length ?? 0;
  const coreCount = results?.filter((r) => !r.id.startsWith('w')).length ?? 0;
  return (
    <div className="grid gap-3 rounded-2xl border bg-card p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-14 font-extrabold">{t.selfTest.title}</h3>
          <p className="text-12 text-muted-foreground">{t.selfTest.body}</p>
        </div>
        <Button type="button" className="h-11 gap-2 rounded-lg sm:h-9" onClick={() => setResults([...runSelfTest(), ...runWordsTest()])}>
          <Play className="size-4" aria-hidden />
          {t.selfTest.run}
        </Button>
      </div>
      {results && (
        <>
          <p role="status" className={cn('text-13 font-bold', failed ? 'text-destructive' : 'text-success-soft-foreground')}>
            {fill(t.selfTest.summary, { pass: results.length - failed, total: results.length })} · {fill(t.n.selfTestSplit, { core: coreCount, words: results.length - coreCount })}
          </p>
          <ul className="grid max-h-80 gap-1 overflow-y-auto text-12">
            {results.map((r) => (
              <li key={r.id} className={cn('flex items-start gap-2 rounded-md px-2 py-1.5', r.pass ? 'bg-muted/50' : 'bg-destructive/10')}>
                {r.pass ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success-soft-foreground" aria-label="PASS" /> : <XCircle className="mt-0.5 size-4 shrink-0 text-destructive" aria-label="FAIL" />}
                <span className="min-w-0 flex-1">
                  {r.label}
                  <bdi dir="ltr" className="mt-0.5 block break-all font-mono text-11 text-muted-foreground">
                    {r.pass ? r.actual : `expected ${r.expected} / got ${r.actual}`}
                  </bdi>
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
