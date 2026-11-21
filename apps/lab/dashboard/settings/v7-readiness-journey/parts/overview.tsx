// Overview. Setup mode: the readiness dial (focal point), the narrative + next action, section bars, then the
// journey. Operate mode: the day-to-day index.
import { useMemo } from 'react';
import { ArrowLeft, ArrowRight, PartyPopper } from 'lucide-react';
import { SETTINGS_SECTIONS, type SectionId } from '@lab/mocks/settings';
import { useReducedMotion } from 'framer-motion';
import { DialLegend, ReadinessDial, SectionBars } from './dial';
import { Journey } from './journey';
import { useNav } from './nav';
import { OperateIndex } from './operate';
import { bySection, byUrgency, tally } from './readiness';
import { useSettings } from './store';
import { Btn, Card } from './ui';

export function Overview() {
  const { state } = useSettings();
  return state.mode === 'setup' ? (
    <>
      <Hero />
      <Journey />
    </>
  ) : (
    <OperateIndex />
  );
}

function Hero() {
  const { checks, t, lang, dispatch } = useSettings();
  const nav = useNav();
  const reduce = useReducedMotion();
  const total = useMemo(() => tally(checks), [checks]);
  const rows = useMemo(() => bySection(checks), [checks]);
  const next = useMemo(() => checks.filter((c) => c.status === 'todo').sort(byUrgency)[0], [checks]);
  const ids = SETTINGS_SECTIONS.map((s) => s.id);
  const Arrow = lang === 'ar' ? ArrowLeft : ArrowRight;
  const launchReady = total.todo === 0;

  const pick = (id: SectionId) => {
    document.getElementById(`stop-${id}`)?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  };

  return (
    <Card className="p-5 sm:p-7 lg:p-8">
      <div className="grid grid-cols-1 items-center gap-6 md:grid-cols-[13rem_minmax(0,1fr)] md:gap-8 lg:grid-cols-[16rem_minmax(0,1fr)] lg:gap-12">
        <ReadinessDial checks={checks} tally={total} sections={ids} className="mx-auto max-w-56 md:max-w-none" />
        <div className="min-w-0">
          <h2 className="text-22 font-extrabold leading-tight tracking-tight sm:text-26">
            {launchReady ? t.readiness.launchReady : t.readiness.title}
          </h2>
          <p className="mt-2 max-w-[58ch] text-15 leading-relaxed">
            {launchReady ? (
              t.readiness.summary(total.done, total.own)
            ) : (
              <>
                <span className="font-semibold">{t.readiness.summary(total.done, total.own)}</span> {t.readiness.detail(total.todo, total.blocked)}
              </>
            )}
          </p>

          {next ? (
            <div className="mt-5 flex flex-col gap-3 rounded-xl bg-muted/70 p-3 sm:flex-row sm:items-center sm:justify-between sm:p-2 sm:ps-4">
              <p className="min-w-0 text-14">
                <span className="text-muted-foreground">{t.readiness.next}: </span>
                <span className="font-bold">{t.checks[next.id]?.title}</span>
              </p>
              <Btn onClick={() => nav.group(next.group, next.field)} className="shrink-0">
                {t.readiness.continueWith}
                <Arrow aria-hidden />
              </Btn>
            </div>
          ) : (
            <div className="mt-5 flex flex-col gap-3 rounded-xl bg-success/10 p-3 sm:flex-row sm:items-center sm:justify-between sm:p-2 sm:ps-4">
              <p className="flex min-w-0 items-start gap-2 text-14">
                <PartyPopper className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
                <span>
                  {total.blocked ? t.readiness.allDoneHint : t.readiness.launchReadyHint}
                </span>
              </p>
              <Btn variant="outline" onClick={() => dispatch({ type: 'mode', mode: 'operate' })} className="shrink-0">
                {t.readiness.goOperate}
              </Btn>
            </div>
          )}

          <div className="mt-5">
            <DialLegend tally={total} />
          </div>
        </div>
      </div>
      <div className="mt-6 border-t border-border pt-4">
        <SectionBars rows={rows} onPick={pick} />
      </div>
    </Card>
  );
}
