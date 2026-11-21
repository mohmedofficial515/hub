/** Section 10: accessibility notes made visible (labels, focus ring, forced colours, print). */
import { Card } from '@dash/components/ui/card';
import { Amount, AmountView, amountLabel } from './amount';
import { useLab } from './env';
import { amountParts } from './money-core';

const SAMPLES: [string, string][] = [
  ['1250000.00', 'USD'],
  ['-1250.00', 'SAR'],
  ['1234.567', 'KWD'],
];

export function A11yNotes() {
  const lab = useLab();
  const { t } = lab;
  const a = t.a11y;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="gap-3 rounded-2xl border bg-card p-4 shadow-none sm:p-5">
        <h3 className="text-14 font-extrabold">{a.label.title}</h3>
        <p className="text-12 text-muted-foreground">{a.label.body}</p>
        <ul className="grid gap-2">
          {SAMPLES.map(([v, c]) => {
            const p = amountParts(v, c, { context: 'detail' });
            return (
              <li key={v + c} className="grid gap-1 rounded-lg bg-muted/40 p-2.5">
                <span className="text-16 font-bold">
                  <AmountView value={v} currency={c} context="detail" />
                </span>
                <code dir="ltr" className="break-all text-start text-11 text-muted-foreground">
                  aria-label=&quot;{p ? amountLabel(p, lab) : ''}&quot;
                </code>
              </li>
            );
          })}
        </ul>
        <div className="rounded-lg border border-dashed p-2.5 text-12">
          <p className="font-semibold">{a.label.words}</p>
          <p className="mt-0.5 text-muted-foreground">{a.label.wordsValue}</p>
        </div>
        <p className="text-11 text-muted-foreground">{a.label.signHidden}</p>
      </Card>

      <Card className="gap-3 rounded-2xl border bg-card p-4 shadow-none sm:p-5">
        <h3 className="text-14 font-extrabold">{a.focus.title}</h3>
        <p className="text-12 text-muted-foreground">{a.focus.body}</p>
        <div className="flex flex-wrap items-center gap-4 rounded-lg bg-muted/40 p-4 text-26 font-black">
          <Amount value="12345678.50" currency="USD" context="kpi" />
          <Amount value="1250000.00" currency="SAR" context="chart" className="text-18" />
        </div>
        <ul className="grid gap-1.5 text-12 text-muted-foreground">
          {a.focus.list.map((x) => (
            <li key={x} className="flex gap-2">
              <span aria-hidden className="mt-1.5 size-1 shrink-0 rounded-full bg-muted-foreground" />
              {x}
            </li>
          ))}
        </ul>
      </Card>

      <Card className="gap-3 rounded-2xl border bg-card p-4 shadow-none sm:p-5">
        <h3 className="text-14 font-extrabold">{a.forced.title}</h3>
        <p className="text-12 text-muted-foreground">{a.forced.body}</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-1 rounded-lg border bg-background p-3 text-18 font-bold">
            <AmountView value="1250.00" currency="SAR" context="detail" />
            <span className="text-11 font-normal text-muted-foreground">{a.forced.normal}</span>
          </div>
          <div style={{ background: '#000', color: '#fff', ['--muted-foreground' as string]: '#fff' }} className="grid gap-1 rounded-lg border border-white p-3 text-18 font-bold">
            <AmountView value="1250.00" currency="SAR" context="detail" />
            <span className="text-11 font-normal">{a.forced.simulated}</span>
          </div>
        </div>
      </Card>

      <Card className="gap-3 rounded-2xl border bg-card p-4 shadow-none sm:p-5">
        <h3 className="text-14 font-extrabold">{a.print.title}</h3>
        <p className="text-12 text-muted-foreground">{a.print.body}</p>
        <div style={{ ['--muted-foreground' as string]: '#555' }} className="grid gap-2 rounded-sm border border-neutral-300 bg-white p-4 text-neutral-950 shadow-md">
          <p className="text-11 font-bold uppercase tracking-wide text-neutral-500">{a.print.paper}</p>
          {[
            ['1250.00', 'SAR'],
            ['4687.50', 'AED'],
            ['12450.75', 'USD'],
          ].map(([v, c]) => (
            <div key={c} className="flex items-baseline justify-between gap-4 border-b border-neutral-200 pb-1.5 text-14">
              <span className="text-neutral-600" dir="ltr">
                {c}
              </span>
              <span className="font-semibold">
                <AmountView value={v} currency={c} context="detail" />
              </span>
            </div>
          ))}
        </div>
        <code dir="ltr" className="break-all text-start text-11 text-muted-foreground">
          .cur-sign {'{'} print-color-adjust: exact; background: currentColor; {'}'} @media (forced-colors: active) {'{'} background: CanvasText {'}'}
        </code>
      </Card>
    </div>
  );
}
