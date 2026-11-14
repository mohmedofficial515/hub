/**
 * The persistent basis line under the header of money pages:
 *   [sign] SAR · converted at each transaction's day rate · balances in USD     [How is this calculated?]
 * Review P1 of the previous round: the bar flickered because it toggled its height at a scroll threshold. This line has a CONSTANT
 * height per breakpoint, is not sticky and reacts to nothing but the display currency: scrolling cannot change the layout.
 */
import { Info } from 'lucide-react';
import { CurrencySign } from './currency-sign';
import { markKind } from './amount';
import { fill, useLab } from './env';

export function BasisLine() {
  const lab = useLab();
  const { t, display, openReceipt } = lab;
  const b = t.n.basis;
  const usd = display === 'USD';
  const kind = markKind(display, lab);
  return (
    <div data-testid="basis-line" className="flex min-h-11 flex-wrap items-center gap-x-2 gap-y-0 text-12 text-muted-foreground sm:min-h-9">
      <span dir="ltr" className="inline-flex items-center gap-1.5 font-bold text-foreground">
        {kind === 'sign' && <CurrencySign code={display} />}
        {display}
      </span>
      <span aria-hidden className="text-border">
        ·
      </span>
      <span>{usd ? b.none : b.converted}</span>
      <span aria-hidden className="text-border">
        ·
      </span>
      <span>{fill(b.balances, { cur: 'USD' })}</span>
      <button
        type="button"
        onClick={() => openReceipt()}
        className="relative inline-flex min-h-8 items-center gap-1.5 rounded-md px-1.5 font-bold text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring max-sm:after:absolute max-sm:after:-inset-y-[6px] max-sm:after:inset-x-0 max-sm:after:content-['']"
      >
        <Info className="size-3.5" aria-hidden />
        {b.how}
      </button>
    </div>
  );
}
