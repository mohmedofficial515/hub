/**
 * SAMA rule 3 treats the written value as first class. On irreversible confirmations (refund, wallet top-up) the amount is repeated in
 * words in the UI language: a misplaced comma or digit stands out before staff press Confirm. The wording is reviewed in section 11.
 */
import { useState } from 'react';
import { CheckCircle2, HandCoins, Undo2 } from 'lucide-react';
import { cn } from '@lab/utils';
import { Button } from '@dash/components/ui/button';
import { Checkbox } from '@dash/components/ui/checkbox';
import { Amount } from './amount';
import { infoOf } from './data';
import { fill, useLab } from './env';
import { parseDec } from './money-core';
import { Overlay } from './overlay';
import { Segmented } from './segmented';
import { amountInWords, hasWords, WORD_CODES } from './words';

const PRESETS = ['1250', '12450.75', '3000000', '1234.567', '18750000'];
const pill = (on: boolean) =>
  cn('min-h-11 min-w-14 rounded-lg border px-3 text-12 font-bold outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-8', on ? 'border-primary bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted');

export function ConfirmInWords() {
  const { t, locale } = useLab();
  const cf = t.n.cf;
  const [kind, setKind] = useState<'refund' | 'wallet'>('refund');
  const [cur, setCur] = useState('SAR');
  const [raw, setRaw] = useState('1250');
  const [open, setOpen] = useState(false);
  const [ack, setAck] = useState(false);
  const [done, setDone] = useState(false);

  const d = parseDec(raw);
  const valid = d !== null && d.u > BigInt(0);
  const words = valid && hasWords(cur) ? amountInWords(raw, cur, locale) : null;
  const info = infoOf(cur);
  const name = info ? (locale === 'ar' ? info.nameAr : info.nameEn) : cur;
  const close = () => {
    setOpen(false);
    setAck(false);
  };

  return (
    <div className="rounded-2xl border bg-card p-4 shadow-sm sm:p-5">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="grid gap-4">
          <Segmented
            label={cf.kind}
            value={kind}
            onChange={setKind}
            className="inline-flex w-fit rounded-lg border bg-muted/60 p-0.5"
            itemClassName={(on) => cn('min-h-11 rounded-md px-3 text-12 font-bold outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-8', on ? 'bg-background shadow-sm' : 'text-muted-foreground')}
            options={[
              { value: 'refund', content: cf.refund },
              { value: 'wallet', content: cf.wallet },
            ]}
          />
          <div>
            <label htmlFor="cf-amount" className="text-12 font-bold text-muted-foreground">
              {cf.amount}
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
              className="mt-1.5 h-11 w-full rounded-lg border bg-background px-3 text-start text-15 font-bold tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-ring aria-[invalid=true]:border-destructive"
            />
            {!valid && <p className="mt-1 text-12 text-destructive">{cf.invalid}</p>}
            <div className="mt-2 flex flex-wrap gap-1.5">
              {PRESETS.map((p) => (
                <button key={p} type="button" onClick={() => setRaw(p)} dir="ltr" className="min-h-11 rounded-full border px-3 text-11 font-bold text-muted-foreground outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring sm:min-h-8">
                  {p}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-12 font-bold text-muted-foreground">{cf.currency}</p>
            <Segmented
              label={cf.currency}
              value={cur}
              onChange={setCur}
              className="mt-1.5 flex flex-wrap gap-1.5"
              itemClassName={pill}
              options={WORD_CODES.map((c) => ({ value: c, content: <bdi dir="ltr">{c}</bdi> }))}
            />
          </div>
          <Button type="button" disabled={!valid} onClick={() => setOpen(true)} className="min-h-11 w-fit gap-2 sm:min-h-9">
            <HandCoins className="size-4" aria-hidden />
            {kind === 'refund' ? cf.openRefund : cf.openWallet}
          </Button>
          {done && (
            <p className="flex items-center gap-2 text-13 font-medium text-success-soft-foreground" role="status">
              <CheckCircle2 className="size-4" aria-hidden />
              {cf.done}
            </p>
          )}
        </div>
        <div className="rounded-xl bg-muted/40 p-4">
          <p className="text-12 font-bold text-muted-foreground">{cf.why}</p>
          <ul className="mt-2 list-disc space-y-1.5 ps-5 text-12 leading-5 text-muted-foreground">
            {cf.whyList.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
      </div>

      <Overlay open={open} onClose={close} placement="center" title={kind === 'refund' ? cf.titleRefund : cf.titleWallet} description={cf.lead}>
        <div className="grid gap-4 p-4" data-testid="confirm-dialog">
          <div className="rounded-xl bg-muted/50 p-4 text-center">
            <p className="text-11 font-medium text-muted-foreground">{cf.exactLabel}</p>
            <p className="mt-1 text-4xl font-black">
              <Amount value={raw} currency={cur} context="detail" reveal={false} />
            </p>
            <p className="mt-1 text-12 text-muted-foreground">{name}</p>
          </div>
          <div className="rounded-xl border border-dashed p-4">
            <p className="text-11 font-bold text-muted-foreground">{cf.wordsLabel}</p>
            <p className="mt-1 text-15 font-bold leading-7" data-testid="amount-in-words">
              {words ?? cf.noWords}
            </p>
          </div>
          <label className="flex min-h-11 cursor-pointer items-start gap-3 text-13">
            <Checkbox checked={ack} onCheckedChange={(v) => setAck(v === true)} className="mt-0.5 size-5" />
            <span>{cf.ack}</span>
          </label>
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="outline" onClick={close} className="min-h-11 gap-2 sm:min-h-9">
              <Undo2 className="size-4 rtl:-scale-x-100" aria-hidden />
              {cf.cancel}
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
              {fill(cf.confirm, { cur })}
            </Button>
          </div>
        </div>
      </Overlay>
    </div>
  );
}
