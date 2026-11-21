import { useState } from 'react';
import { CheckCircle2, HandCoins, Undo2 } from 'lucide-react';
import { useLocale, useT } from '@lab/i18n';
import { cn } from '@lab/utils';
import { Button } from '@dash/components/ui/button';
import { Checkbox } from '@dash/components/ui/checkbox';
import { fill, messages } from '../i18n';
import { Amount } from './amount';
import { nameOf, useEnv } from './env';
import { amountInWords, hasWords, parseDec } from './money-core';
import { Overlay } from './overlay';

const CURS = ['SAR', 'USD', 'AED', 'KWD', 'JPY', 'TRY'];
const PRESETS = ['1250', '12450.75', '3000000', '1234.567', '18750000'];

/**
 * SAMA rule 3 treats the written value as first class. On irreversible confirmations (refund, wallet credit) the
 * amount is repeated in words in the UI language: a misplaced comma or digit stands out before staff press Confirm.
 */
export function ConfirmInWords() {
  const t = useT(messages);
  const lang = useLocale();
  const env = useEnv();
  const [kind, setKind] = useState<'refund' | 'wallet'>('refund');
  const [cur, setCur] = useState('SAR');
  const [raw, setRaw] = useState('1250');
  const [open, setOpen] = useState(false);
  const [ack, setAck] = useState(false);
  const [done, setDone] = useState(false);

  let valid = true;
  try {
    parseDec(raw);
    if (!raw.trim() || raw.trim().startsWith('-')) valid = false;
  } catch {
    valid = false;
  }
  const words = valid && hasWords(cur) ? amountInWords(raw, cur, lang) : null;

  const close = () => {
    setOpen(false);
    setAck(false);
  };

  return (
    <div className="rounded-2xl border bg-card p-4 shadow-sm sm:p-5">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          <div role="radiogroup" aria-label={t.cfKind} className="inline-flex rounded-lg border bg-muted/60 p-0.5">
            {(['refund', 'wallet'] as const).map((k) => (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={kind === k}
                onClick={() => setKind(k)}
                className={cn('min-h-11 rounded-md px-3 text-12 font-bold outline-none focus-visible:ring-[3px] focus-visible:ring-ring/60 sm:min-h-8', kind === k ? 'bg-background shadow-sm' : 'text-muted-foreground')}
              >
                {k === 'refund' ? t.cfRefund : t.cfWallet}
              </button>
            ))}
          </div>
          <div>
            <label htmlFor="cf-amount" className="text-12 font-bold text-muted-foreground">
              {t.cfAmount}
            </label>
            <input
              id="cf-amount"
              dir="ltr"
              inputMode="decimal"
              value={raw}
              onChange={(e) => {
                setRaw(e.target.value);
                setDone(false);
              }}
              aria-invalid={!valid}
              className="mt-1.5 h-11 w-full rounded-lg border bg-background px-3 text-start text-15 font-bold tabular-nums outline-none focus-visible:ring-[3px] focus-visible:ring-ring/60 aria-[invalid=true]:border-destructive"
            />
            {!valid && <p className="mt-1 text-12 text-destructive">{t.cfInvalid}</p>}
            <div className="mt-2 flex flex-wrap gap-1.5">
              {PRESETS.map((p) => (
                <button key={p} type="button" onClick={() => setRaw(p)} className="min-h-11 rounded-full border px-3 text-11 font-bold text-muted-foreground outline-none hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/60 sm:min-h-8" dir="ltr">
                  {p}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-12 font-bold text-muted-foreground">{t.cfCurrency}</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5" role="radiogroup" aria-label={t.cfCurrency}>
              {CURS.map((c) => (
                <button
                  key={c}
                  type="button"
                  role="radio"
                  aria-checked={cur === c}
                  onClick={() => setCur(c)}
                  className={cn('min-h-11 min-w-14 rounded-lg border px-3 text-12 font-bold outline-none focus-visible:ring-[3px] focus-visible:ring-ring/60 sm:min-h-8', cur === c ? 'border-primary bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted')}
                  dir="ltr"
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
          <Button type="button" disabled={!valid} onClick={() => setOpen(true)} className="min-h-11 gap-2 sm:min-h-9">
            <HandCoins className="size-4" />
            {kind === 'refund' ? t.cfOpenRefund : t.cfOpenWallet}
          </Button>
          {done && (
            <p className="flex items-center gap-2 text-13 font-medium text-success-soft-foreground" role="status">
              <CheckCircle2 className="size-4" />
              {t.cfDone}
            </p>
          )}
        </div>
        <div className="rounded-xl bg-muted/40 p-4">
          <p className="text-12 font-bold text-muted-foreground">{t.cfWhy}</p>
          <ul className="mt-2 list-disc space-y-1.5 ps-5 text-12 leading-5 text-muted-foreground">
            <li>{t.cfWhy1}</li>
            <li>{t.cfWhy2}</li>
            <li>{t.cfWhy3}</li>
          </ul>
        </div>
      </div>

      <Overlay open={open} onClose={close} placement="center" title={kind === 'refund' ? t.cfTitleRefund : t.cfTitleWallet} description={t.cfLead}>
        <div className="space-y-4 p-4" data-testid="confirm-dialog">
          <div className="rounded-xl bg-muted/50 p-4 text-center">
            <p className="text-11 font-medium text-muted-foreground">{t.cfExactLabel}</p>
            <p className="mt-1 text-4xl font-black">
              <Amount value={raw} currency={cur} context="detail" noTrigger />
            </p>
            <p className="mt-1 text-12 text-muted-foreground">{nameOf(env, cur)}</p>
          </div>
          <div className="rounded-xl border border-dashed p-4">
            <p className="text-11 font-bold text-muted-foreground">{t.cfWordsLabel}</p>
            <p className="mt-1 text-15 font-bold leading-7" data-testid="amount-in-words">
              {words ?? t.cfNoWords}
            </p>
          </div>
          <label className="flex min-h-11 cursor-pointer items-start gap-3 text-13">
            <Checkbox checked={ack} onCheckedChange={(v) => setAck(v === true)} className="mt-0.5 size-5" />
            <span>{t.cfAck}</span>
          </label>
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="outline" onClick={close} className="min-h-11 gap-2 sm:min-h-9">
              <Undo2 className="size-4 rtl:-scale-x-100" />
              {t.cfCancel}
            </Button>
            <Button
              type="button"
              disabled={!ack}
              onClick={() => {
                close();
                setDone(true);
              }}
              className="min-h-11 sm:min-h-9"
            >
              {fill(t.cfConfirm, { cur })}
            </Button>
          </div>
        </div>
      </Overlay>
    </div>
  );
}
