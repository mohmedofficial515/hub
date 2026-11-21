import { useState } from 'react';
import { CheckCircle2, Play, XCircle } from 'lucide-react';
import { useT } from '@lab/i18n';
import { cn } from '@lab/utils';
import { Button } from '@dash/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@dash/components/ui/table';
import { fill, messages } from '../i18n';
import { Amount } from './amount';
import { TABLE_COLUMN_THRESHOLD, cmpDec, parseDec, runSelfTest, type TestResult } from './money-core';

const ROWS: Array<{ v: string; c: string; note?: string }> = [
  { v: '999', c: 'USD' },
  { v: '1000', c: 'USD' },
  { v: '1500', c: 'USD', note: 'round' },
  { v: '9999', c: 'USD' },
  { v: '10000', c: 'USD' },
  { v: '999950', c: 'USD', note: 'carry' },
  { v: '1250000', c: 'USD' },
  { v: '12500000', c: 'USD' },
  { v: '1200000000', c: 'USD' },
  { v: '123456789012345.12345678', c: 'USD', note: 'huge' },
  { v: '-1250000', c: 'USD', note: 'neg' },
  { v: '0', c: 'USD' },
  { v: '1234.567', c: 'KWD', note: 'kwd' },
  { v: '18750000', c: 'JPY', note: 'jpy' },
  { v: '0.01', c: 'USD', note: 'cent' },
];

export function Ladder() {
  const t = useT(messages);
  const notes = t.ladderNotes as Record<string, string>;
  const columnCompact = ROWS.some((r) => cmpDec(abs(r.v), parseDec(String(TABLE_COLUMN_THRESHOLD))) >= 0);
  return (
    <div className="overflow-hidden rounded-2xl border bg-card">
      <Table className="min-w-[56rem] text-13">
        <TableHeader>
          <TableRow className="bg-muted/60 hover:bg-muted/60">
            <TableHead className="h-11 text-start text-12">{t.ladInput}</TableHead>
            <TableHead className="h-11 text-end text-12">{t.ladKpi}</TableHead>
            <TableHead className="h-11 text-end text-12">{t.ladChart}</TableHead>
            <TableHead className="h-11 text-end text-12">{t.ladTable}</TableHead>
            <TableHead className="h-11 text-end text-12">{t.ladDetail}</TableHead>
            <TableHead className="h-11 text-start text-12">{t.ladNote}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {ROWS.map((r) => (
            <TableRow key={r.v + r.c}>
              <TableCell className="font-mono text-12 text-muted-foreground" dir="ltr">
                <span className="inline-block max-w-[15rem] truncate align-bottom">{r.v}</span> <span className="text-10">{r.c}</span>
              </TableCell>
              <TableCell className="text-end text-15 font-black">
                <Amount value={r.v} currency={r.c} context="kpi" multi />
              </TableCell>
              <TableCell className="text-end font-bold">
                <Amount value={r.v} currency={r.c} context="chart" multi plain />
              </TableCell>
              <TableCell className="text-end">
                <Amount value={r.v} currency={r.c} context="table" columnCompact={columnCompact} multi noTrigger />
              </TableCell>
              <TableCell className="text-end text-12">
                <Amount value={r.v} currency={r.c} context="detail" multi plain />
              </TableCell>
              <TableCell className="text-12 text-muted-foreground">{r.note ? notes[r.note] : ''}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <p className="border-t px-4 py-3 text-12 text-muted-foreground">{fill(t.ladFoot, { max: columnCompact ? t.yes : t.no })}</p>
    </div>
  );
}
const abs = (v: string) => {
  const d = parseDec(v);
  return { n: d.n < BigInt(0) ? -d.n : d.n, s: d.s };
};

/** The table rule shown on two columns: decided per column, uniform inside it. */
export function ColumnRule() {
  const t = useT(messages);
  const a = ['845300', '120450.5', '99000', '1250'];
  const b = ['12500000', '845300', '950', '4250000'];
  const col = (vals: string[], compact: boolean, title: string, why: string) => (
    <div className="rounded-xl border bg-card p-3">
      <p className="text-12 font-bold">{title}</p>
      <p className="mb-2 text-11 text-muted-foreground">{why}</p>
      <ul className="space-y-1.5 text-end text-13">
        {vals.map((v) => (
          <li key={v}>
            <Amount value={v} currency="USD" context="table" columnCompact={compact} multi noTrigger />
          </li>
        ))}
      </ul>
    </div>
  );
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {col(a, false, t.colA, t.colAWhy)}
      {col(b, true, t.colB, t.colBWhy)}
    </div>
  );
}

export function SelfTest() {
  const t = useT(messages);
  const [res, setRes] = useState<TestResult[] | null>(null);
  const pass = res?.filter((r) => r.ok).length ?? 0;
  return (
    <div className="rounded-2xl border bg-card p-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" onClick={() => setRes(runSelfTest())} className="min-h-11 gap-2 sm:min-h-9">
          <Play className="size-4 rtl:-scale-x-100" />
          {t.runSelfTest}
        </Button>
        {res && (
          <span className={cn('text-13 font-bold', pass === res.length ? 'text-success-soft-foreground' : 'text-destructive')} data-testid="selftest-summary">
            {fill(t.selfTestSummary, { pass: String(pass), total: String(res.length) })}
          </span>
        )}
      </div>
      {res && (
        <ul className="mt-3 grid gap-1 sm:grid-cols-2" dir="ltr">
          {res.map((r) => (
            <li key={r.name} className="flex items-start gap-2 rounded-md px-2 py-1 text-12 hover:bg-muted/50">
              {r.ok ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" /> : <XCircle className="mt-0.5 size-4 shrink-0 text-destructive" />}
              <span className="min-w-0">
                <span className="font-bold">{r.ok ? 'PASS' : 'FAIL'}</span> <span className="text-muted-foreground">{r.name}</span>
                {!r.ok && (
                  <span className="block text-destructive">
                    got "{r.got}" want "{r.want}"
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
