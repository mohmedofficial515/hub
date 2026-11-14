/**
 * Section 12: "Language review". Thirty sample amounts written in words, Arabic and English side by side, with the rule that applied,
 * so the owner (a native speaker) can accept or correct the wording before it is ported. A sample can be marked, and the marked
 * ones are listed at the end as a plain-text block to copy back.
 */
import { useMemo, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { cn } from '@lab/utils';
import { Button } from '@dash/components/ui/button';
import { AmountView } from './amount';
import { useLab } from './env';
import { parseDec } from './money-core';
import { amountInWords, LANGUAGE_SAMPLES } from './words';

/** Which Arabic rule a sample mainly exercises (for the "rule" column). */
function ruleOf(value: string): 'subOnly' | 'one' | 'dual' | 'dualConstruct' | 'plural' | 'accusative' | 'oneInCompound' | 'genitive' | 'tanween' {
  const d = parseDec(value);
  if (!d) return 'genitive';
  const n = d.u / BigInt(10) ** BigInt(d.s);
  if (n === BigInt(0)) return 'subOnly';
  if (n === BigInt(1)) return 'one';
  if (n === BigInt(2)) return 'dual';
  if (n === BigInt(200) || n === BigInt(2000) || n === BigInt(2000000)) return 'dualConstruct';
  if (n >= BigInt(1000000) && n % BigInt(1000) !== BigInt(0)) return 'tanween';
  const low = Number(n % BigInt(100));
  if (low === 1) return 'oneInCompound';
  if (low >= 3 && low <= 10) return 'plural';
  if (low >= 11) return 'accusative';
  return 'genitive';
}

export function LanguageReview() {
  const { t } = useLab();
  const l = t.n.lang;
  const [marked, setMarked] = useState<Set<number>>(new Set());
  const [copied, setCopied] = useState(false);
  const rows = useMemo(
    () =>
      LANGUAGE_SAMPLES.map(([value, currency], i) => ({
        i,
        value,
        currency,
        ar: amountInWords(value, currency, 'ar') ?? '',
        en: amountInWords(value, currency, 'en') ?? '',
        rule: ruleOf(value),
      })),
    [],
  );
  const toggle = (i: number) =>
    setMarked((m) => {
      const n = new Set(m);
      if (n.has(i)) n.delete(i);
      else n.add(i);
      return n;
    });
  const report = rows
    .filter((r) => marked.has(r.i))
    .map((r) => `${r.value} ${r.currency}\n  ar: ${r.ar}\n  en: ${r.en}`)
    .join('\n');

  return (
    <div className="grid gap-4" data-testid="language-review">
      <div className="rounded-xl bg-muted/40 p-4 text-12 leading-6 text-muted-foreground">
        <p className="font-bold text-foreground">{l.rulesTitle}</p>
        <ul className="mt-1 grid gap-0.5 sm:grid-cols-2">
          {Object.values(l.rulesList).map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      </div>
      <div className="overflow-x-auto rounded-2xl border bg-card">
        <table className="w-full min-w-[820px] text-start text-13">
          <caption className="sr-only">{l.caption}</caption>
          <thead>
            <tr className="border-b bg-muted/40 text-11 text-muted-foreground">
              <th scope="col" className="w-10 px-3 py-2 text-start font-semibold">
                #
              </th>
              <th scope="col" className="px-3 py-2 text-start font-semibold">
                {l.amount}
              </th>
              <th scope="col" className="px-3 py-2 text-start font-semibold">
                {l.ar}
              </th>
              <th scope="col" className="px-3 py-2 text-start font-semibold">
                {l.en}
              </th>
              <th scope="col" className="px-3 py-2 text-start font-semibold">
                {l.rule}
              </th>
              <th scope="col" className="px-3 py-2 text-center font-semibold">
                {l.flag}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.i} className={cn('border-t border-border/60 align-top', marked.has(r.i) && 'bg-or/10')}>
                <td className="px-3 py-2.5 text-11 tabular-nums text-muted-foreground">{r.i + 1}</td>
                <td className="px-3 py-2.5 font-semibold">
                  <AmountView value={r.value} currency={r.currency} context="detail" softCents={false} />
                </td>
                <td className="px-3 py-2.5 leading-6" lang="ar" dir="rtl">
                  {r.ar}
                </td>
                <td className="px-3 py-2.5 leading-6" lang="en" dir="ltr">
                  {r.en}
                </td>
                <td className="px-3 py-2.5 text-12 text-muted-foreground">{l.rules[r.rule]}</td>
                <td className="px-3 py-1 text-center">
                  <button
                    type="button"
                    aria-pressed={marked.has(r.i)}
                    aria-label={`${l.flag} ${r.value} ${r.currency}`}
                    onClick={() => toggle(r.i)}
                    className={cn(
                      'inline-flex size-11 items-center justify-center rounded-full border outline-none focus-visible:ring-2 focus-visible:ring-ring sm:size-9',
                      marked.has(r.i) ? 'border-primary bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted',
                    )}
                  >
                    <Check className="size-4" aria-hidden />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="outline"
          disabled={marked.size === 0}
          className="min-h-11 gap-2 sm:min-h-9"
          onClick={() => {
            navigator.clipboard?.writeText(report).then(() => setCopied(true), () => setCopied(false));
          }}
        >
          <Copy className="size-4" aria-hidden />
          {l.copy}
        </Button>
        <p role="status" className="text-12 text-muted-foreground">
          {marked.size === 0 ? l.nothing : copied ? l.copied : l.marked.replace('{n}', String(marked.size))}
        </p>
      </div>
    </div>
  );
}
