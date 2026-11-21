import { useMemo, type ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Card } from '@dash/components/ui/card';
import { TooltipProvider } from '@dash/components/ui/tooltip';
import { cn } from '@lab/utils';
import { A11yNotes } from './parts/a11y';
import { DonutCard, RevenueChart, TopList } from './parts/charts';
import { aggregate } from './parts/convert';
import { SignStyles } from './parts/currency-sign';
import { DecisionsPanel } from './parts/decisions-panel';
import { LabProvider, useLab } from './parts/env';
import { HeaderReplica } from './parts/header-replica';
import { KpiBeforeAfter, LiveKpis } from './parts/kpi';
import { Ladder, SelfTest } from './parts/ladder';
import { SignLab } from './parts/sign-lab';
import { States } from './parts/states';
import { Surfaces } from './parts/surfaces';
import { BidiDemo, BookingsTable, FactsBlock } from './parts/table-demo';

const NAV = ['surfaces', 'live', 'kpi', 'ladder', 'tables', 'charts', 'sign', 'decisions', 'states', 'a11y'] as const;
type SectionId = (typeof NAV)[number];

function goTo(id: SectionId) {
  document.getElementById(`sec-${id}`)?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
}

function Section({ id, index, children }: { id: SectionId; index: number; children: ReactNode }) {
  const { t } = useLab();
  const s = t.sections[id];
  return (
    <section id={`sec-${id}`} aria-labelledby={`h-${id}`} className="scroll-mt-24 grid gap-4">
      <div className="grid gap-1">
        <p className="text-12 font-bold tabular-nums text-primary">
          <bdi dir="ltr">{String(index).padStart(2, '0')}</bdi>
        </p>
        <h2 id={`h-${id}`} className="text-22 font-extrabold leading-tight">
          {s.title}
        </h2>
        <p className="max-w-3xl text-14 text-muted-foreground">{s.lead}</p>
      </div>
      {children}
    </section>
  );
}

function QuickPick() {
  const { t, display, setDisplay } = useLab();
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-12 font-semibold text-muted-foreground">{t.live.quick}</span>
      <div role="radiogroup" aria-label={t.live.quick} className="flex flex-wrap gap-1.5">
        {['SAR', 'USD', 'TRY', 'KWD', 'JPY', 'EGP'].map((c) => (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={display === c}
            onClick={() => setDisplay(c)}
            className={cn(
              'min-h-11 min-w-12 rounded-full border px-3 text-12 font-bold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring sm:min-h-9',
              display === c ? 'border-primary bg-primary text-primary-foreground' : 'bg-card hover:bg-muted',
            )}
          >
            <bdi dir="ltr">{c}</bdi>
          </button>
        ))}
      </div>
    </div>
  );
}

function Chrome() {
  const { t, display } = useLab();
  const reduce = useReducedMotion();
  const gross = useMemo(() => aggregate('gross', display), [display]);
  const fade = (i: number) => (reduce ? {} : { initial: { opacity: 0, y: 8 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true, margin: '-40px' }, transition: { duration: 0.3, delay: i * 0.03 } });

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <SignStyles />
      <div className="sticky top-0 z-30 bg-background/90 backdrop-blur">
        <HeaderReplica />
      </div>

      <main className="mx-auto grid max-w-[1360px] gap-12 px-3 pb-28 pt-4 lg:px-8">
        <motion.header {...fade(0)} className="grid gap-5">
          <div className="grid gap-2">
            <h1 className="text-26 font-extrabold leading-tight sm:text-32">{t.title}</h1>
            <p className="max-w-3xl text-15 text-muted-foreground">{t.subtitle}</p>
          </div>
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
            <Card className="gap-3 rounded-2xl border bg-card p-5 shadow-none">
              <h2 className="text-14 font-extrabold">{t.howto.title}</h2>
              <ol className="grid gap-2 text-13">
                {t.howto.steps.map((s, i) => (
                  <li key={s} className="flex gap-3">
                    <span className="mt-px flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-11 font-bold tabular-nums text-primary">{i + 1}</span>
                    <span className="min-w-0 text-muted-foreground">{s}</span>
                  </li>
                ))}
              </ol>
            </Card>
            <Card className="gap-3 rounded-2xl border bg-card p-5 shadow-none">
              <h2 className="text-14 font-extrabold">{t.howto.conceptTitle}</h2>
              <ul className="grid gap-2 text-13 text-muted-foreground">
                {t.howto.concept.map((s) => (
                  <li key={s} className="flex gap-2">
                    <span aria-hidden className="mt-2 size-1 shrink-0 rounded-full bg-primary" />
                    {s}
                  </li>
                ))}
              </ul>
            </Card>
          </div>
          <nav aria-label={t.nav.label} className="-mx-3 overflow-x-auto px-3 lg:mx-0 lg:px-0">
            <ul className="flex w-max gap-1.5 lg:w-auto lg:flex-wrap">
              {NAV.map((id, i) => (
                <li key={id}>
                  <button type="button" onClick={() => goTo(id)} className="flex min-h-11 items-center gap-1.5 rounded-full border bg-card px-3.5 text-12 font-semibold outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring sm:min-h-9">
                    <span className="tabular-nums text-primary" dir="ltr">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    {t.sections[id].nav}
                  </button>
                </li>
              ))}
            </ul>
          </nav>
        </motion.header>

        <Section id="surfaces" index={1}>
          <Surfaces />
        </Section>

        <Section id="live" index={2}>
          <div className="grid gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-card p-4">
              <QuickPick />
              <p className="text-12 text-muted-foreground">{t.live.hint}</p>
            </div>
            <LiveKpis />
            <p className="text-12 text-muted-foreground">{t.live.rules}</p>
          </div>
        </Section>

        <Section id="kpi" index={3}>
          <KpiBeforeAfter />
        </Section>

        <Section id="ladder" index={4}>
          <Ladder />
          <SelfTest />
        </Section>

        <Section id="tables" index={5}>
          <div className="grid gap-8">
            <BookingsTable />
            <FactsBlock />
            <div className="grid gap-3">
              <h3 className="text-14 font-extrabold">{t.bidi.title}</h3>
              <BidiDemo />
            </div>
          </div>
        </Section>

        <Section id="charts" index={6}>
          <div className="grid gap-4">
            <Card className="gap-3 rounded-2xl border bg-card p-4 shadow-none sm:p-5">
              <RevenueChart points={gross.series} currency={display} estimatedDays={gross.estimatedDays} />
            </Card>
            <div className="grid gap-4 xl:grid-cols-2">
              <DonutCard currency={display} total={gross.total} />
              <TopList currency={display} />
            </div>
          </div>
        </Section>

        <Section id="sign" index={7}>
          <SignLab />
        </Section>

        <Section id="decisions" index={8}>
          <Card className="gap-0 overflow-hidden rounded-2xl border bg-card py-0 shadow-none">
            <ul>
              {t.decisions.list.map((d, i) => (
                <li key={d.q} className="grid gap-1 border-t border-border/60 px-5 py-3 first:border-t-0 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] sm:gap-6">
                  <p className="text-13 font-bold">
                    <span className="me-2 inline-flex size-5 items-center justify-center rounded-full bg-primary/10 align-middle text-11 font-bold uppercase text-primary">
                      {'abcde'[i]}
                    </span>
                    {d.q}
                  </p>
                  <p className="text-12 text-muted-foreground">{d.a}</p>
                </li>
              ))}
            </ul>
          </Card>
        </Section>

        <Section id="states" index={9}>
          <States />
        </Section>

        <Section id="a11y" index={10}>
          <A11yNotes />
        </Section>
      </main>
      <DecisionsPanel />
    </div>
  );
}

export default function AmountDisplayQuietFigures() {
  return (
    <LabProvider>
      <TooltipProvider delayDuration={120}>
        <Chrome />
      </TooltipProvider>
    </LabProvider>
  );
}
