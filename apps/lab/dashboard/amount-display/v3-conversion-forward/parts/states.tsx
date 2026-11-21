import { AlertTriangle, Inbox, RefreshCw } from 'lucide-react';
import type { ReactNode } from 'react';
import { useLocale, useT } from '@lab/i18n';
import { Badge } from '@dash/components/ui/badge';
import { Button } from '@dash/components/ui/button';
import { Switch } from '@dash/components/ui/switch';
import { messages } from '../i18n';
import { Amount } from './amount';
import { EnvContext, useEnv, type CatalogState } from './env';
import { CurrencySwitcher } from './switcher';
import { amountInWords, amountParts, FSI, PDI } from './money-core';
import { CurrencySign } from './currency-sign';

function Tile({ title, note, children }: { title: string; note: string; children: ReactNode }) {
  return (
    <div className="flex flex-col rounded-2xl border bg-card p-4 shadow-sm">
      <p className="text-13 font-bold">{title}</p>
      <p className="mb-3 mt-0.5 text-12 text-muted-foreground">{note}</p>
      <div className="mt-auto rounded-xl bg-muted/40 p-3">{children}</div>
    </div>
  );
}

export function States({
  catalogState,
  setCatalogState,
  switcherEnabled,
  setSwitcherEnabled,
}: {
  catalogState: CatalogState;
  setCatalogState: (s: CatalogState) => void;
  switcherEnabled: boolean;
  setSwitcherEnabled: (v: boolean) => void;
}) {
  const t = useT(messages);
  const env = useEnv();
  const loadingEnv = { ...env, catalogState: 'loading' as const };
  const loadedEnv = { ...env, catalogState: 'ready' as const };

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      <Tile title={t.stLoading} note={t.stLoadingNote}>
        <div className="flex items-center justify-between gap-3 text-2xl font-black">
          <EnvContext.Provider value={loadingEnv}>
            <Amount value="1250" currency="SAR" context="kpi" noTrigger />
          </EnvContext.Provider>
          <span aria-hidden className="text-12 text-muted-foreground">→</span>
          <EnvContext.Provider value={loadedEnv}>
            <Amount value="1250" currency="SAR" context="kpi" noTrigger />
          </EnvContext.Provider>
        </div>
        <label className="mt-3 flex min-h-11 items-center gap-2 text-12 sm:min-h-8">
          <Switch checked={catalogState === 'loading'} onCheckedChange={(v) => setCatalogState(v ? 'loading' : 'ready')} aria-label={t.stLoadingToggle} />
          {t.stLoadingToggle}
        </label>
      </Tile>

      <Tile title={t.stUnknown} note={t.stUnknownNote}>
        <div className="text-2xl font-black">
          <Amount value="1250" currency="XYZ" context="kpi" noTrigger />
        </div>
      </Tile>

      <Tile title={t.stNull} note={t.stNullNote}>
        <div className="flex gap-6 text-2xl font-black">
          <Amount value={null} currency="USD" context="kpi" />
          <Amount value="" currency="USD" context="table" />
        </div>
      </Tile>

      <Tile title={t.stStale} note={t.stStaleNote}>
        <div className="flex items-center gap-3 text-xl font-black">
          <Amount value="4687.5" currency="SAR" context="detail" estimated />
        </div>
        <p className="mt-2 flex items-center gap-2 text-11 text-muted-foreground">
          <Badge variant="warning" className="px-1.5 py-0 text-10">{t.estimatedShort}</Badge>
          {t.stStaleLegend}
        </p>
      </Tile>

      <Tile title={t.stError} note={t.stErrorNote}>
        <div role="alert" className="flex items-start gap-2.5 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-12">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
          <div className="min-w-0 flex-1">
            <p className="font-bold">{t.stErrorTitle}</p>
            <p className="mt-0.5 text-muted-foreground">{t.stErrorBody}</p>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <span className="text-15 font-black">
                <Amount value="12345678.5" currency="USD" context="kpi" from="USD" />
              </span>
              <Button size="sm" variant="outline" className="min-h-11 gap-1.5 sm:min-h-8">
                <RefreshCw className="size-3.5" />
                {t.retry}
              </Button>
            </div>
          </div>
        </div>
      </Tile>

      <Tile title={t.stEmpty} note={t.stEmptyNote}>
        <div className="flex items-center gap-3 text-muted-foreground">
          <Inbox className="size-8 shrink-0" strokeWidth={1.25} />
          <div className="min-w-0">
            <p className="text-13 font-bold text-foreground">{t.stEmptyTitle}</p>
            <p className="text-12">{t.stEmptyBody}</p>
          </div>
          <span className="ms-auto text-xl font-black text-foreground">
            <Amount value="0" currency="SAR" context="kpi" noTrigger />
          </span>
        </div>
      </Tile>

      <Tile title={t.stFlag} note={t.stFlagNote}>
        <div className="flex flex-wrap items-center gap-4">
          <label className="flex min-h-11 items-center gap-2 text-12 sm:min-h-8">
            <Switch checked={!switcherEnabled} onCheckedChange={(v) => setSwitcherEnabled(!v)} aria-label={t.stFlagToggle} />
            {t.stFlagToggle}
          </label>
          <div className="inline-flex items-center rounded-lg border bg-muted/80 p-1">
            <CurrencySwitcher forceShow />
          </div>
        </div>
      </Tile>
    </div>
  );
}

/** Section 10: accessibility made visible. */
export function A11y() {
  const t = useT(messages);
  const lang = useLocale();
  const env = useEnv();
  const value = '12345678.5';
  const p = amountParts({ value, currency: 'SAR', context: 'kpi' });
  const label = `${FSI}${p.exact}${PDI} ${env.catalog.find((c) => c.code === 'SAR')!.names[lang]}`;
  const words = amountInWords(value, 'SAR', lang);
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <div className="min-w-0 rounded-2xl border bg-card p-4 shadow-sm">
        <p className="text-13 font-bold">{t.a11yTry}</p>
        <p className="mb-3 mt-0.5 text-12 text-muted-foreground">{t.a11yTryNote}</p>
        <div className="rounded-xl bg-muted/40 p-4 text-4xl font-black">
          <Amount value={value} currency="SAR" context="kpi" from="USD" />
        </div>
        <dl className="mt-3 space-y-2 text-12">
          <div>
            <dt className="font-bold text-muted-foreground">{t.a11yLabel}</dt>
            <dd className="mt-0.5 rounded-md bg-muted px-2 py-1.5 font-mono text-[11px]" dir="ltr">
              aria-label="{label}"
            </dd>
          </div>
          <div>
            <dt className="font-bold text-muted-foreground">{t.a11yWords}</dt>
            <dd className="mt-0.5">{words}</dd>
          </div>
          <div>
            <dt className="font-bold text-muted-foreground">{t.a11ySign}</dt>
            <dd className="mt-0.5 font-mono text-[11px]" dir="ltr">
              &lt;span aria-hidden data-cur="SAR" class="cur-sign"/&gt;
            </dd>
          </div>
        </dl>
      </div>
      <div className="min-w-0 rounded-2xl border bg-card p-4 shadow-sm">
        <p className="text-13 font-bold">{t.a11yPrint}</p>
        <p className="mb-3 mt-0.5 text-12 text-muted-foreground">{t.a11yPrintNote}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border bg-white p-3 text-neutral-900" style={{ colorScheme: 'light' }}>
            <p className="mb-1 text-10 font-bold uppercase tracking-wide opacity-60">print</p>
            <p className="text-2xl font-black" dir="ltr">
              <span className="inline-flex items-baseline" style={{ ['--sign-box' as string]: '0.725em' }}>
                <CurrencySign code="SAR" className="me-[.25em]" />
                1,250.00
              </span>
            </p>
            <p className="mt-1 text-11 opacity-70">print-color-adjust: exact</p>
          </div>
          <div className="rounded-lg border bg-black p-3 text-white" style={{ colorScheme: 'dark' }}>
            <p className="mb-1 text-10 font-bold uppercase tracking-wide opacity-60">forced-colors</p>
            <p className="text-2xl font-black" dir="ltr">
              <span className="inline-flex items-baseline" style={{ ['--sign-box' as string]: '0.725em' }}>
                <span aria-hidden className="me-[.25em] inline-block" style={{ height: '.725em', aspectRatio: '1124/1256', background: 'Canvas', outline: '1px solid CanvasText' }} />
                1,250.00
              </span>
            </p>
            <p className="mt-1 text-11 opacity-70">background: CanvasText</p>
          </div>
        </div>
        <pre className="mt-3 overflow-x-auto rounded-lg bg-muted px-3 py-2 text-[11px] leading-5" dir="ltr">{`@media (forced-colors: active) {
  .cur-sign { background: CanvasText; forced-color-adjust: none }
}
.cur-sign { print-color-adjust: exact }`}</pre>
      </div>
    </div>
  );
}
