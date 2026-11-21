import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { useLocale, useT } from '@lab/i18n';
import { cn } from '@lab/utils';
import { TooltipProvider } from '@dash/components/ui/tooltip';
import { messages } from './i18n';
import { BasisBar } from './parts/basis-bar';
import { BeforeAfter, KpiRange } from './parts/before-after';
import { ConfirmInWords } from './parts/confirm';
import { SignLab, SignStyles } from './parts/currency-sign';
import { CATALOG, DEFAULT_CURRENCY } from './parts/data';
import { DecisionsPanel } from './parts/decisions-panel';
import { DEFAULT_DECISIONS, EnvContext, type CatalogState, type Decisions, type Env } from './parts/env';
import { HeaderReplica } from './parts/header-replica';
import { ColumnRule, Ladder, SelfTest } from './parts/ladder';
import { LiveDemo } from './parts/live';
import { Receipt } from './parts/receipt';
import { A11y, States } from './parts/states';
import { BidiDemo, BookingFacts, BookingsTable } from './parts/table-demo';

function Section({ id, n, title, lead, children }: { id: string; n: string; title: string; lead?: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-40 space-y-4">
      <div>
        <h2 className="flex items-center gap-2.5 text-xl font-black">
          <span className="inline-flex size-7 items-center justify-center rounded-lg bg-primary/10 text-13 text-primary" dir="ltr">
            {n}
          </span>
          {title}
        </h2>
        {lead && <p className="mt-1.5 max-w-3xl text-13 leading-6 text-muted-foreground">{lead}</p>}
      </div>
      {children}
    </section>
  );
}

/** Showcase page: the smart <Amount> and the display-currency switcher in a faithful replica of the dashboard shell. */
export default function ConversionForward() {
  const t = useT(messages);
  const lang = useLocale();
  const [display, setDisplay] = useState(DEFAULT_CURRENCY);
  const [dec, setDec] = useState<Decisions>(DEFAULT_DECISIONS);
  const [catalogState, setCatalogState] = useState<CatalogState>('ready');
  const [switcherEnabled, setSwitcherEnabled] = useState(true);
  const [receipt, setReceipt] = useState<{ open: boolean; currency: string | null }>({ open: false, currency: null });
  const [selected, setSelected] = useState('tx1');

  const only = typeof location !== 'undefined' && /[?&]only=header/.test(location.hash);

  const openReceipt = useCallback((currency?: string) => setReceipt({ open: true, currency: currency ?? null }), []);
  const env: Env = useMemo(
    () => ({ lang, dec, display, setDisplay, catalog: CATALOG, catalogState, switcherEnabled, openReceipt }),
    [lang, dec, display, catalogState, switcherEnabled, openReceipt],
  );

  const toc: Array<[string, string]> = [
    ['surfaces', t.s11],
    ['header', t.s1],
    ['live', t.s2],
    ['kpi-range', t.s3],
    ['ladder', t.s4],
    ['tables', t.s5],
    ['charts', t.s6],
    ['sign', t.s7],
    ['confirm', t.s5b],
    ['states', t.s9],
    ['a11y', t.s10],
  ];

  const frameHash = typeof location !== 'undefined' ? location.hash.replace(/[?&]only=header/, '') : '';
  const base = typeof location !== 'undefined' ? location.pathname : '';
  const iframeSrc = `${base}${frameHash}${frameHash.includes('?') ? '&' : '?'}only=header`;

  return (
    <EnvContext.Provider value={env}>
      <TooltipProvider delayDuration={150}>
        <SignStyles />
        <div className="min-h-dvh bg-background text-foreground">
          {/* The real shell: header + the basis bar under it. Sticky so the bar's collapse on scroll is visible. */}
          <div className={cn('z-40 bg-background/95 backdrop-blur', !only && 'sticky top-0')}>
            <HeaderReplica />
            <BasisBar />
          </div>

          {only ? (
            <p className="px-4 py-3 text-12 text-muted-foreground">{t.onlyHeaderNote}</p>
          ) : (
            <main className="mx-auto max-w-[1400px] space-y-14 px-3 pb-32 pt-4 lg:px-8">
              <header className="space-y-4">
                <div>
                  <p className="text-12 font-bold text-primary">{t.eyebrow}</p>
                  <h1 className="mt-1 text-3xl font-black">{t.title}</h1>
                  <p className="mt-2 max-w-3xl text-14 leading-7 text-muted-foreground">{t.subtitle}</p>
                </div>
                <div className="rounded-2xl border bg-card p-4 shadow-sm sm:p-5">
                  <h2 className="text-15 font-bold">{t.howTitle}</h2>
                  <ol className="mt-2 list-decimal space-y-1.5 ps-5 text-13 leading-6 text-muted-foreground">
                    <li>{t.how1}</li>
                    <li>{t.how2}</li>
                    <li>{t.how3}</li>
                    <li>{t.how4}</li>
                    <li>{t.how5}</li>
                  </ol>
                  <nav aria-label={t.tocLabel} className="mt-4 flex flex-wrap gap-2">
                    {toc.map(([id, label]) => (
                      <a key={id} href={`#${id}`} className="inline-flex min-h-11 items-center rounded-full border bg-muted/50 px-3 text-12 font-bold text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/60 sm:min-h-8">
                        {label}
                      </a>
                    ))}
                  </nav>
                </div>
              </header>

              <Section id="surfaces" n="11" title={t.s11} lead={t.s11Lead}>
                <BeforeAfter />
              </Section>

              <Section id="header" n="1" title={t.s1} lead={t.s1Lead}>
                <div className="hidden sm:block">
                  <p className="mb-2 text-12 font-bold text-muted-foreground">{t.mobilePreview}</p>
                  <iframe title={t.mobilePreview} src={iframeSrc} className="mx-auto block h-[34rem] w-[390px] max-w-full rounded-2xl border bg-background shadow-sm" />
                </div>
                <p className="text-12 text-muted-foreground sm:hidden">{t.mobileIsLive}</p>
              </Section>

              <Section id="live" n="2" title={t.s2} lead={t.s2Lead}>
                <LiveDemo />
              </Section>

              <Section id="kpi-range" n="3" title={t.s3} lead={t.s3Lead}>
                <KpiRange />
              </Section>

              <Section id="ladder" n="4" title={t.s4} lead={t.s4Lead}>
                <Ladder />
                <ColumnRule />
                <SelfTest />
              </Section>

              <Section id="tables" n="5" title={t.s5} lead={t.s5Lead}>
                <div className="grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
                  <BookingsTable selected={selected} onSelect={setSelected} />
                  <BookingFacts id={selected} />
                </div>
                <h3 className="pt-2 text-15 font-bold">{t.bidiTitle}</h3>
                <BidiDemo />
              </Section>

              <Section id="charts" n="6" title={t.s6} lead={t.s6Lead}>
                <p className="rounded-xl border bg-muted/40 p-4 text-13 leading-6 text-muted-foreground">
                  {t.s6Body} <a href="#live-charts" className="font-bold text-primary underline-offset-4 hover:underline">{t.s2}</a>
                </p>
              </Section>

              <Section id="sign" n="7" title={t.s7} lead={t.s7Lead}>
                <SignLab box={dec.box} />
              </Section>

              <Section id="confirm" n="5+" title={t.s5b} lead={t.s5bLead}>
                <ConfirmInWords />
              </Section>

              <Section id="states" n="9" title={t.s9} lead={t.s9Lead}>
                <States catalogState={catalogState} setCatalogState={setCatalogState} switcherEnabled={switcherEnabled} setSwitcherEnabled={setSwitcherEnabled} />
              </Section>

              <Section id="a11y" n="10" title={t.s10} lead={t.s10Lead}>
                <A11y />
              </Section>

              <p className="rounded-xl border border-dashed p-4 text-12 text-muted-foreground">{t.s8Hint}</p>
            </main>
          )}

          {!only && <DecisionsPanel value={dec} onChange={setDec} />}
          <Receipt open={receipt.open} currency={receipt.currency ?? display} onClose={() => setReceipt({ open: false, currency: null })} />
        </div>
      </TooltipProvider>
    </EnvContext.Provider>
  );
}
