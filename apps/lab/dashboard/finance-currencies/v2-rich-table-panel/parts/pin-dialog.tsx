import { useState } from 'react';
import { Pin } from 'lucide-react';
import { fmtRate } from '@lab/mocks/currencies';
import { cn } from '@lab/utils';
import { Button } from '@dash/components/ui/button';
import { Input } from '@dash/components/ui/input';
import { fill, type CurrencyMessages } from '../i18n';
import { rateDigits } from './columns';
import type { Meta } from './derive';
import { CurrencyMark } from './marks';
import { Overlay } from './sheet';
import { Ltr } from './ui';

const RATE_RE = /^\d{1,10}(\.\d{1,8})?$/;
const EXPIRY = [
  { key: 'expiryNone', days: null },
  { key: 'expiry1d', days: 1 },
  { key: 'expiry3d', days: 3 },
  { key: 'expiry7d', days: 7 },
] as const;

interface Props {
  meta: Meta | null;
  t: CurrencyMessages;
  onClose: () => void;
  onSubmit: (code: string, rate: string, days: number | null, note: string) => void;
}

export function PinDialog({ meta, t, onClose, onSubmit }: Props) {
  return (
    <Overlay open={!!meta} onClose={onClose} label={meta ? fill(t.pinDialog.title, { code: meta.code }) : ''} closeLabel={t.panel.close} variant="dialog">
      {meta && <PinForm key={meta.code} meta={meta} t={t} onClose={onClose} onSubmit={onSubmit} />}
    </Overlay>
  );
}

function PinForm({ meta, t, onClose, onSubmit }: Omit<Props, 'meta'> & { meta: Meta }) {
  const [rate, setRate] = useState('');
  const [again, setAgain] = useState('');
  const [days, setDays] = useState<number | null>(3);
  const [note, setNote] = useState('');
  const [touched, setTouched] = useState(false);
  const d = rateDigits(meta.code);

  const valid = RATE_RE.test(rate) && Number(rate) > 0;
  const match = rate === again;
  const rateError = touched && !valid ? t.pinDialog.invalid : null;
  const confirmError = touched && valid && !match ? t.pinDialog.mismatch : null;

  return (
    <form
      className="flex min-h-0 flex-1 flex-col"
      onSubmit={(e) => {
        e.preventDefault();
        setTouched(true);
        if (valid && match) {
          onSubmit(meta.code, rate, days, note);
          onClose();
        }
      }}
    >
      <div className="grid gap-4 overflow-y-auto p-5 pt-6">
        <div className="flex items-center gap-3 pe-12">
          <CurrencyMark code={meta.code} size={44} ring={meta.ring} className="text-foreground" />
          <div>
            <h2 className="text-16 font-extrabold">{fill(t.pinDialog.title, { code: meta.code })}</h2>
            <p className="text-13 text-muted-foreground">
              {t.rawLabel} <Ltr>{fmtRate(meta.row.rate.raw, d)}</Ltr> · {t.effectiveLabel}{' '}
              <Ltr>{fmtRate(meta.row.rate.effective, d)}</Ltr>
            </p>
          </div>
        </div>
        <p className="text-13 text-muted-foreground">{t.pinDialog.desc}</p>

        <label className="grid gap-1 text-13 font-semibold">
          {t.pinDialog.rate}
          <Input dir="ltr" inputMode="decimal" autoComplete="off" value={rate} onChange={(e) => setRate(e.target.value.trim())} aria-invalid={!!rateError} aria-describedby="pin-rate-hint" className="h-11 text-start text-15 tabular-nums" />
          <span id="pin-rate-hint" className={cn('text-12 font-normal', rateError ? 'text-destructive-soft-foreground' : 'text-muted-foreground')}>
            {rateError ?? t.pinDialog.rateHint}
          </span>
        </label>
        <label className="grid gap-1 text-13 font-semibold">
          {t.pinDialog.confirm}
          <Input dir="ltr" inputMode="decimal" autoComplete="off" value={again} onChange={(e) => setAgain(e.target.value.trim())} aria-invalid={!!confirmError} className="h-11 text-start text-15 tabular-nums" />
          {confirmError && <span className="text-12 font-normal text-destructive-soft-foreground">{confirmError}</span>}
        </label>

        <fieldset className="grid gap-2">
          <legend className="mb-1 text-13 font-semibold">{t.pinDialog.expiry}</legend>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {EXPIRY.map((x) => (
              <button
                key={x.key}
                type="button"
                aria-pressed={days === x.days}
                onClick={() => setDays(x.days)}
                className={cn(
                  'min-h-11 rounded-xl border px-2 text-13 font-semibold outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
                  days === x.days ? 'border-primary bg-primary/10 text-primary-text' : 'border-border hover:bg-accent',
                )}
              >
                {t.pinDialog[x.key]}
              </button>
            ))}
          </div>
        </fieldset>

        <label className="grid gap-1 text-13 font-semibold">
          {t.pinDialog.note}
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={200}
            rows={2}
            placeholder={t.pinDialog.notePlaceholder}
            className="rounded-lg border border-input bg-background px-3 py-2 text-14 font-normal outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          />
        </label>
      </div>
      <div className="flex justify-end gap-2 border-t border-border bg-card p-4">
        <Button type="button" variant="outline" className="h-11" onClick={onClose}>
          {t.pinDialog.cancel}
        </Button>
        <Button type="submit" className="h-11">
          <Pin /> {t.pinDialog.submit}
        </Button>
      </div>
    </form>
  );
}
