import { Clock, Pin } from 'lucide-react';
import { fmtRate } from '@lab/mocks/currencies';
import { cn } from '@lab/utils';
import { Switch } from '@dash/components/ui/switch';
import { fill } from '../i18n';
import { IdentityCell, RowMenu, rateDigits, type CellCtx } from './columns';
import { relTime, type Meta } from './derive';
import { Change, Ltr, Pill, Sparkline } from './ui';
import { RowCheck } from './table';

interface Props {
  rows: Meta[];
  ctx: CellCtx;
  selectedCode: string | null;
  checked: Set<string>;
  onCheck: (code: string, v: boolean) => void;
}

/** Mobile layout: one card per currency, whole body opens the detail sheet. */
export function CurrencyCards({ rows, ctx, selectedCode, checked, onCheck }: Props) {
  const { t, act } = ctx;
  return (
    <ul className="space-y-3">
      {rows.map((m) => {
        const dir = m.changePct > 0.0049 ? 'up' : m.changePct < -0.0049 ? 'down' : 'flat';
        const c = m.row.currency;
        return (
          <li
            key={m.code}
            className={cn(
              'relative overflow-hidden rounded-xl border bg-card',
              m.code === selectedCode && 'border-primary/40 bg-primary/5',
              m.hidden && 'bg-muted/40',
            )}
          >
            <span
              aria-hidden
              className={cn(
                'absolute inset-y-0 start-0 w-1',
                m.stale ? 'bg-warning' : m.hidden ? 'bg-muted-foreground/40' : m.pin ? 'bg-primary' : 'bg-transparent',
              )}
            />
            <div className="flex items-center gap-1 ps-1 pe-1 pt-1">
              <RowCheck checked={checked.has(m.code)} onChange={(v) => onCheck(m.code, v)} label={fill(t.selectRow, { code: m.code })} />
              <div className="min-w-0 flex-1">
                <IdentityCell m={m} ctx={ctx} />
              </div>
              <label className="flex size-11 shrink-0 cursor-pointer items-center justify-center">
                <Switch
                  checked={!m.hidden}
                  disabled={m.isBase}
                  onCheckedChange={() => act.toggle(m.code)}
                  aria-label={fill(t.visibleSwitch, { code: m.code })}
                />
              </label>
              <RowMenu m={m} ctx={ctx} />
            </div>
            <button
              type="button"
              onClick={() => act.open(m.code)}
              aria-label={fill(t.rowOpen, { code: m.code })}
              className="grid w-full gap-3 px-4 pb-4 pt-2 text-start outline-none focus-visible:ring-[3px] focus-visible:ring-inset focus-visible:ring-ring/50"
            >
              <span className="flex items-end justify-between gap-3">
                <span>
                  <span className="block text-12 text-muted-foreground">
                    {t.col.rate} · <Ltr>1 USD =</Ltr>
                  </span>
                  <span className="flex items-center gap-1.5">
                    {m.pin && <Pin className="size-4 fill-current text-primary-text" aria-label={t.pinnedLabel} />}
                    <Ltr className="text-22 font-extrabold">{fmtRate(m.row.rate.effective, rateDigits(m.code))}</Ltr>
                    <Ltr className="font-mono text-13 text-muted-foreground">{m.code}</Ltr>
                  </span>
                  {!m.isBase && (
                    <span className="text-12 text-muted-foreground">
                      {t.rawLabel} <Ltr>{fmtRate(m.row.rate.raw, rateDigits(m.code))}</Ltr>
                    </span>
                  )}
                </span>
                <span className="flex flex-col items-end gap-1">
                  <Change pct={m.changePct} />
                  <Sparkline values={m.row.history} dir={dir} width={88} height={28} />
                </span>
              </span>
              <span className="flex flex-wrap items-center gap-1.5">
                {c.effectivePaymentMode === 'CHARGEABLE' ? (
                  <Pill tone="success">{t.chargeable}</Pill>
                ) : (
                  <Pill tone={c.degraded ? 'warning' : 'outline'}>{c.degraded ? t.degraded : t.displayOnly}</Pill>
                )}
                {m.stale && <Pill tone="warning" icon={<Clock />}>{t.staleLabel}</Pill>}
                {m.pin && <Pill tone="primary" icon={<Pin className="fill-current" />}>{t.pinnedLabel}</Pill>}
                <span className="ms-auto text-12 text-muted-foreground">{relTime(m.ageMin, t)}</span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
