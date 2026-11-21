/**
 * Section 7: the sign lab. The sign is an SVG mask painted in currentColor (works in dark mode), sized by the SAMA metrics,
 * never mirrored, always LEFT of the number with a space. Right and wrong variants side by side.
 */
import type { CSSProperties, ReactNode } from 'react';
import { cn } from '@lab/utils';
import { Badge } from '@dash/components/ui/badge';
import { CurrencySign, hasSign } from './currency-sign';
import { AmountView } from './amount';
import { useLab } from './env';

const LIGHT: CSSProperties = { '--muted-foreground': 'oklch(0.52 0.02 256)' } as CSSProperties;
const DARK: CSSProperties = { '--muted-foreground': 'oklch(0.7 0.02 256)' } as CSSProperties;
const SIZES = [12, 14, 16, 20, 24, 32, 40, 48];

/** A pane with its own explicit colours, so light and dark can be shown at the same time inside either theme. */
function Pane({ dark, children, className }: { dark?: boolean; children: ReactNode; className?: string }) {
  return (
    <div
      style={dark ? DARK : LIGHT}
      className={cn('min-w-0 rounded-xl border p-4', dark ? 'border-neutral-800 bg-neutral-950 text-neutral-50' : 'border-neutral-200 bg-white text-neutral-900', className)}
    >
      {children}
    </div>
  );
}

/** Raw composition for the "wrong" variants: [sign][number] with explicit overrides. */
function Raw({ scale = 1, gap = 0.25, mirror, stretch, after }: { scale?: number; gap?: number; mirror?: boolean; stretch?: boolean; after?: boolean }) {
  const sign = <CurrencySign code="SAR" scale={scale} gap={after ? 0 : gap} mirror={mirror} className={cn('text-muted-foreground', stretch && 'origin-left scale-x-[1.45]')} />;
  return (
    <bdi dir="ltr" className="inline-block whitespace-nowrap font-bold tabular-nums">
      {!after && sign}
      1,250.00
      {after && <span className="ms-[0.25em] inline-block">{sign}</span>}
    </bdi>
  );
}

export function SignLab() {
  const lab = useLab();
  const { t, signScale } = lab;
  const variants: { key: keyof typeof t.sign.variants; node: ReactNode; ok?: boolean }[] = [
    { key: 'right', ok: true, node: <Raw scale={signScale} /> },
    { key: 'big', node: <Raw scale={1.45} /> },
    { key: 'small', node: <Raw scale={0.6} /> },
    { key: 'mirrored', node: <Raw scale={signScale} mirror /> },
    { key: 'noSpace', node: <Raw scale={signScale} gap={0} /> },
    { key: 'after', node: <Raw scale={signScale} after /> },
    { key: 'stretched', node: <Raw scale={signScale} stretch /> },
  ];
  return (
    <div className="grid gap-5">
      <div className="grid gap-4 lg:grid-cols-2">
        {[false, true].map((dark) => (
          <Pane key={String(dark)} dark={dark}>
            <p className="mb-3 text-11 font-semibold opacity-70">{dark ? t.sign.dark : t.sign.light}</p>
            <ul className="grid gap-2">
              {SIZES.map((px) => (
                <li key={px} className="flex items-baseline gap-4">
                  <span className="w-9 shrink-0 text-11 tabular-nums opacity-60" dir="ltr">
                    {px}px
                  </span>
                  <span style={{ fontSize: px }} className="min-w-0 font-bold leading-tight">
                    <AmountView value="1250.00" currency="SAR" context="detail" />
                  </span>
                </li>
              ))}
            </ul>
          </Pane>
        ))}
      </div>

      <div className="rounded-2xl border bg-card p-4 sm:p-5">
        <h3 className="mb-3 text-14 font-extrabold">{t.sign.compare}</h3>
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {variants.map((v) => (
            <li key={v.key} className={cn('grid gap-2 rounded-xl border p-3', v.ok ? 'bg-muted/50' : 'bg-card')}>
              <Badge variant={v.ok ? 'success' : 'danger'} className="w-fit text-11">
                {v.ok ? t.sign.ok : t.sign.wrong}
              </Badge>
              <span className="text-[32px] leading-tight">{v.node}</span>
              <span className="text-12 text-muted-foreground">{t.sign.variants[v.key]}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <div className="rounded-2xl border bg-card p-4 sm:p-5">
          <h3 className="mb-3 text-14 font-extrabold">{t.sign.seven}</h3>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {['SAR', 'AED', 'OMR', 'TRY', 'EUR', 'GBP', 'USD', 'EGP', 'KWD', 'JPY'].map((c) => (
              <li key={c} className="grid gap-1 rounded-lg border bg-muted/40 p-2.5 text-center">
                <span className="text-22 font-bold">
                  <AmountView value="12.5" currency={c} context="detail" />
                </span>
                <span className="text-11 font-semibold text-muted-foreground" dir="ltr">
                  {c} · {hasSign(c) ? t.sign.official : t.sign.codeFallback}
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-2xl border bg-card p-4 text-13 sm:p-5">
          <h3 className="mb-2 text-14 font-extrabold">{t.sign.rulesTitle}</h3>
          <ul className="grid list-disc gap-1.5 ps-5 text-muted-foreground marker:text-border">
            {t.sign.rules.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
          <div className="mt-3 grid gap-1.5 rounded-lg bg-muted/50 p-3 text-14 font-semibold">
            <AmountView value="-1250.00" currency="SAR" context="detail" />
            <span className="text-11 font-normal text-muted-foreground">{t.sign.negative}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
