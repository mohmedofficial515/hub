import { useMemo, type CSSProperties } from 'react';
import { cn } from '@lab/utils';
import { SIGN_PATHS } from './sign-paths';
import { useT } from '@lab/i18n';
import { messages } from '../i18n';

/**
 * One CSS rule per currency, injected once (plan 5.4: `<style href precedence>`), so a cell costs a class
 * name and not a 4 KB data URI. The sign is a MASK painted with currentColor: it follows the text colour,
 * dark mode, forced-colors and print. It is never mirrored (SAMA rule 8) and never stretched (rules 5-6).
 *
 *  --sign-box   height of the box in em of the figure font (decision e: 0.725em or 0.8em)
 *  drop         box bottom sits below the baseline by 7.5% of its height (the Yaa dots of the SAMA mark)
 */
export function SignStyles() {
  const css = useMemo(() => {
    const rules = Object.entries(SIGN_PATHS)
      .map(([code, { viewBox, d }]) => {
        const [, , w, h] = viewBox.split(' ').map(Number);
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}"><path d="${d}"/></svg>`;
        return `.cur-sign[data-cur="${code}"]{--cur-sign:url("data:image/svg+xml,${encodeURIComponent(svg)}");aspect-ratio:${w}/${h}}`;
      })
      .join('\n');
    return `${rules}
.cur-sign{display:inline-block;flex:none;height:var(--sign-box,.725em);background:currentColor;-webkit-mask:var(--cur-sign) center/contain no-repeat;mask:var(--cur-sign) center/contain no-repeat;transform:translateY(calc(var(--sign-box,.725em)*.0754));print-color-adjust:exact;-webkit-print-color-adjust:exact}
@media (forced-colors:active){.cur-sign{background:CanvasText;forced-color-adjust:none}}`;
  }, []);
  return <style data-cur-style>{css}</style>;
}

export function CurrencySign({ code, className, style }: { code: string; className?: string; style?: CSSProperties }) {
  return <span aria-hidden data-cur={code} className={cn('cur-sign', className)} style={style} />;
}

/* ---------------------------------------------------------------- sign lab */

const SAR = 'SAR';
function Sample({ label, bad, children }: { label: string; bad?: boolean; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex min-h-12 items-center rounded-lg bg-muted/50 px-3 py-2" dir="ltr">
        <span className="inline-flex items-baseline whitespace-nowrap text-2xl font-black tabular-nums">{children}</span>
      </div>
      <span className={cn('text-11 font-medium', bad ? 'text-destructive' : 'text-success-soft-foreground')}>
        {bad ? '✗ ' : '✓ '}
        {label}
      </span>
    </div>
  );
}

export function SignLab({ box }: { box: number }) {
  const t = useT(messages);
  const sizes = [12, 14, 16, 20, 24, 32, 48];
  const panel = (cls: string, title: string) => (
    <div className={cn('rounded-xl border p-4', cls)} dir="ltr">
      <p className="mb-3 text-11 font-bold opacity-70">{title}</p>
      <div className="flex flex-wrap items-baseline gap-x-6 gap-y-3">
        {sizes.map((px) => (
          <span key={px} className="inline-flex flex-col gap-1">
            <span className="inline-flex items-baseline whitespace-nowrap font-bold tabular-nums" style={{ fontSize: px }}>
              <CurrencySign code={SAR} className="me-[.25em]" />
              1,250
            </span>
            <span className="text-9 opacity-60">{px}px</span>
          </span>
        ))}
      </div>
    </div>
  );
  return (
    <div className="space-y-5">
      <div className="grid gap-3 md:grid-cols-2">
        {panel('bg-white text-neutral-900 border-neutral-200', t.signLightPanel)}
        {panel('bg-neutral-950 text-neutral-50 border-neutral-800', t.signDarkPanel)}
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" style={{ ['--sign-box' as string]: `${box}em` }}>
        <Sample label={t.signRight}>
          <CurrencySign code={SAR} className="me-[.25em]" />
          1,250.00
        </Sample>
        <Sample bad label={t.signMirrored}>
          <CurrencySign code={SAR} className="me-[.25em] -scale-x-100" />
          1,250.00
        </Sample>
        <Sample bad label={t.signNoSpace}>
          <CurrencySign code={SAR} />
          1,250.00
        </Sample>
        <Sample bad label={t.signAfter}>
          1,250.00
          <CurrencySign code={SAR} className="ms-[.25em]" />
        </Sample>
        <Sample bad label={t.signSmall}>
          <CurrencySign code={SAR} className="me-[.25em]" style={{ ['--sign-box' as string]: '.45em' }} />
          1,250.00
        </Sample>
        <Sample bad label={t.signStretched}>
          <CurrencySign code={SAR} className="me-[.25em]" style={{ width: '1em', aspectRatio: 'auto' }} />
          1,250.00
        </Sample>
        <Sample bad label={t.signMinusFirst}>
          -<CurrencySign code={SAR} className="mx-[.25em]" />
          1,250.00
        </Sample>
        <Sample label={t.signNegativeRight}>
          <CurrencySign code={SAR} className="me-[.25em]" />
          -1,250.00
        </Sample>
      </div>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-xl border bg-card p-4" dir="ltr">
        {Object.keys(SIGN_PATHS).map((code) => (
          <span key={code} className="inline-flex flex-col items-start gap-1">
            <span className="inline-flex items-baseline text-2xl font-black tabular-nums">
              <CurrencySign code={code} className="me-[.25em]" />
              1,250
            </span>
            <span className="text-11 text-muted-foreground">{code}</span>
          </span>
        ))}
        <span className="inline-flex flex-col items-start gap-1">
          <span className="inline-flex items-baseline text-2xl font-black tabular-nums">
            <span className="me-[.25em] text-[.55em] font-bold text-muted-foreground">KWD</span>1,250.000
          </span>
          <span className="text-11 text-muted-foreground">{t.signCodeFallback}</span>
        </span>
      </div>
    </div>
  );
}
