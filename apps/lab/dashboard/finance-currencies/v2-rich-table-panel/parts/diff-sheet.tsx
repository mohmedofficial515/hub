import { useEffect, useState } from 'react';
import { ArrowRight, Pin, TriangleAlert } from 'lucide-react';
import { FX_ENVELOPE, FX_OUTLIER_PERCENT, fmtRate } from '@lab/mocks/currencies';
import { cn } from '@lab/utils';
import { Button } from '@dash/components/ui/button';
import { fill, type CurrencyMessages } from '../i18n';
import type { Locale } from '@lab/i18n';
import { CurrencyMark } from './marks';
import { Overlay } from './sheet';
import type { DiffRow } from './store';
import { Change, Ltr, Pill } from './ui';
import { RowCheck } from './table';
import { rateDigits } from './columns';

interface Props {
  diff: { phase: 'loading' | 'ready'; rows: DiffRow[] } | null;
  t: CurrencyMessages;
  locale: Locale;
  names: Record<string, string>;
  onApply: (codes: string[]) => void;
  onDiscard: () => void;
}

export function DiffSheet({ diff, t, names, onApply, onDiscard }: Props) {
  return (
    <Overlay open={!!diff} onClose={onDiscard} label={t.diff.title} closeLabel={t.diff.close}>
      {diff && <DiffBody diff={diff} t={t} names={names} onApply={onApply} onDiscard={onDiscard} />}
    </Overlay>
  );
}

function DiffBody({ diff, t, names, onApply, onDiscard }: Omit<Props, 'locale'> & { diff: NonNullable<Props['diff']> }) {
  const [on, setOn] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (diff.phase === 'ready') setOn(new Set(diff.rows.filter((r) => !r.pinned && !r.outlier && !r.unchanged).map((r) => r.code)));
  }, [diff]);

  const rows = diff.rows;
  const kept = rows.filter((r) => r.pinned).length;
  const outliers = rows.filter((r) => r.outlier).length;
  const actionable = rows.filter((r) => !r.pinned && !r.unchanged).length;
  const skipped = actionable - on.size;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="px-5 pb-3 pt-6 pe-16">
        <h2 className="text-18 font-extrabold">{t.diff.title}</h2>
        <p className="mt-1 text-13 text-muted-foreground">{fill(t.diff.desc, { provider: FX_ENVELOPE.provider })}</p>
        {diff.phase === 'ready' && outliers > 0 && (
          <p className="mt-3 flex items-start gap-2 rounded-xl bg-warning/15 p-3 text-13 text-warning-soft-foreground">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
            {fill(t.diff.outlierNote, { pct: FX_OUTLIER_PERCENT })}
          </p>
        )}
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3 md:px-5">
        {diff.phase === 'loading' ? (
          <div role="status" aria-label={t.diff.loading} className="grid gap-2 px-2 pt-2">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="h-14 rounded-xl animate-pulse bg-muted" aria-hidden />
            ))}
            <p className="sr-only">{t.diff.loading}</p>
          </div>
        ) : (
          <ul className="grid gap-1.5">
            {rows.map((r) => {
              const d = rateDigits(r.code);
              const selectable = !r.pinned && !r.unchanged;
              return (
                <li
                  key={r.code}
                  className={cn(
                    'grid grid-cols-[auto_1fr_auto] items-center gap-x-2 gap-y-1 rounded-xl border px-2 py-2 md:grid-cols-[auto_minmax(0,1.2fr)_minmax(0,1.6fr)_auto]',
                    r.outlier ? 'border-destructive/50 bg-destructive/5' : 'border-border/70',
                    !selectable && 'bg-muted/40',
                  )}
                >
                  {selectable ? (
                    <RowCheck
                      checked={on.has(r.code)}
                      onChange={(v) =>
                        setOn((s) => {
                          const n = new Set(s);
                          if (v) n.add(r.code);
                          else n.delete(r.code);
                          return n;
                        })
                      }
                      label={`${t.diff.colApply} ${r.code}`}
                    />
                  ) : (
                    <span className="grid size-11 place-items-center text-muted-foreground">{r.pinned ? <Pin className="size-4 fill-current" aria-hidden /> : null}</span>
                  )}
                  <span className="flex min-w-0 items-center gap-2.5">
                    <CurrencyMark code={r.code} size={32} />
                    <span className="min-w-0">
                      <Ltr className="block font-mono text-14 font-extrabold">{r.code}</Ltr>
                      <span className="block truncate text-12 text-muted-foreground">{names[r.code]}</span>
                    </span>
                  </span>
                  <span className="col-span-3 col-start-1 row-start-2 flex items-center justify-between gap-2 ps-12 md:col-span-1 md:col-start-auto md:row-start-auto md:justify-center md:ps-0">
                    <Ltr className="text-14 text-muted-foreground">{fmtRate(r.oldEffective, d)}</Ltr>
                    <ArrowRight className="size-4 text-muted-foreground rtl:rotate-180" aria-hidden />
                    <Ltr className={cn('text-14 font-extrabold', r.pinned && 'text-muted-foreground')}>{fmtRate(r.newEffective, d)}</Ltr>
                  </span>
                  <span className="flex flex-col items-end gap-1">
                    {r.pinned ? (
                      <Pill tone="primary" icon={<Pin className="fill-current" />}>
                        {t.diff.kept}
                      </Pill>
                    ) : r.unchanged ? (
                      <span className="text-12 text-muted-foreground">{t.diff.unchanged}</span>
                    ) : (
                      <>
                        <Change pct={r.deltaPct} />
                        {r.outlier && <Pill tone="danger" icon={<TriangleAlert />}>{t.diff.outlier}</Pill>}
                      </>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-card px-5 py-3">
        <p className="text-13 text-muted-foreground" aria-live="polite">
          {diff.phase === 'ready' && fill(t.diff.summary, { n: on.size, total: rows.length, kept, skipped })}
        </p>
        <div className="flex gap-2">
          <Button variant="outline" className="h-11" onClick={onDiscard}>
            {t.diff.discard}
          </Button>
          <Button className="h-11" disabled={diff.phase !== 'ready' || on.size === 0} onClick={() => onApply([...on])}>
            {fill(t.diff.apply, { n: on.size })}
          </Button>
        </div>
      </footer>
    </div>
  );
}
