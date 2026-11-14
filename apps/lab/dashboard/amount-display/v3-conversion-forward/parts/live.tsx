import { useCallback, useState } from 'react';
import { Banknote, Percent, Receipt as ReceiptIcon, TrendingUp, Wallet } from 'lucide-react';
import { useLocale, useT } from '@lab/i18n';
import { Badge } from '@dash/components/ui/badge';
import { fill, messages } from '../i18n';
import { Amount, Equivalent } from './amount';
import { AreaChart, Donut, TopList } from './charts';
import { BALANCES } from './data';
import { aggregate, rateOn, type DayPoint } from './engine';
import { useEnv } from './env';
import { BasisChip, KpiTile, MoneyCard, ViewIn } from './kpi';
import { addDec, decToFixed, decToString, mulDec, parseDec } from './money-core';

const fmtDay = (iso: string, lang: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString(lang === 'ar' ? 'ar-u-nu-latn' : 'en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });

function useCardCurrency() {
  const env = useEnv();
  const [override, setOverride] = useState<string | null>(null);
  const cur = override ?? env.display;
  const options = env.display === 'USD' ? ['USD', 'SAR'] : ['USD', env.display];
  return { cur, override, setOverride, options };
}

/** Section 2 + 3: the live demo. Switching the header currency, or one card's "View in", recomputes everything. */
export function LiveDemo() {
  const t = useT(messages);
  const lang = useLocale();
  const env = useEnv();
  const kpi = useCardCurrency();
  const chart = useCardCurrency();
  const mix = useCardCurrency();
  const rank = useCardCurrency();
  const [scrub, setScrub] = useState<DayPoint | null>(null);
  const onScrub = useCallback((p: DayPoint | null) => setScrub(p), []);

  const ak = aggregate(kpi.cur);
  const ac = aggregate(chart.cur);
  const am = aggregate(mix.cur);
  const chip = (cur: string) => (cur === 'USD' ? t.chipUsd : fill(t.chipDayRates, { cur }));
  const todayRate = rateOn(kpi.cur, ak.days[ak.days.length - 1].date).rate;
  const eqToday = (usd: string) => decToString(mulDec(parseDec(usd), todayRate));

  const swap =
    scrub ? (
      <span className="inline-flex items-center gap-1.5">
        <span dir="ltr">{fmtDay(scrub.date, lang)}</span>
        <span aria-hidden>·</span>
        <Amount value={decToString(scrub.value)} currency={chart.cur} context="detail" plain noTrigger />
      </span>
    ) : undefined;

  return (
    <div className="space-y-4">
      <MoneyCard
        title={t.cardOverview}
        note={t.cardOverviewNote}
        control={<ViewIn value={kpi.cur} override={kpi.override} onChange={kpi.setOverride} options={kpi.options} />}
      >
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <KpiTile
            title={t.kGross}
            titleSwap={swap}
            icon={Banknote}
            badge={<BasisChip>{chip(kpi.cur)}</BasisChip>}
            value={<Amount value={decToString(ak.gross)} currency={kpi.cur} context="kpi" from="USD" />}
            subtitle={t.last30}
          />
          <KpiTile
            title={t.kNet}
            icon={TrendingUp}
            badge={<BasisChip>{chip(kpi.cur)}</BasisChip>}
            value={<Amount value={decToString(ak.net)} currency={kpi.cur} context="kpi" from="USD" />}
            subtitle={t.afterRefunds}
          />
          <KpiTile
            title={t.kAvg}
            icon={ReceiptIcon}
            badge={<BasisChip>{t.chipFromSums}</BasisChip>}
            value={<Amount value={decToString(ak.average)} currency={kpi.cur} context="kpi" from="USD" />}
            subtitle={fill(t.perBooking, { n: String(ak.bookings) })}
          />
          <KpiTile
            title={t.kRefundRate}
            icon={Percent}
            badge={<BasisChip>{t.chipFromSums}</BasisChip>}
            value={decToFixed(ak.refundPct, 1)}
            unit="%"
            subtitle={t.ofGross}
          />
        </div>
        <p className="mb-2 mt-5 text-12 font-bold text-muted-foreground">{t.balancesTitle}</p>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {([
            [t.kReceivable, BALANCES.receivableUsd],
            [t.kWallets, BALANCES.walletsUsd],
          ] as const).map(([title, usd]) => (
            <KpiTile
              key={title}
              title={title}
              icon={Wallet}
              badge={<BasisChip>{t.chipUsdBalance}</BasisChip>}
              value={<Amount value={usd} currency="USD" context="kpi" />}
              footer={
                env.display !== 'USD' ? (
                  <p className="text-12 font-medium text-muted-foreground">
                    <Equivalent value={eqToday(usd)} currency={env.display} /> <span className="text-11">{t.atTodayRate}</span>
                  </p>
                ) : undefined
              }
            />
          ))}
        </div>
      </MoneyCard>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <MoneyCard
          id="live-charts"
          title={t.cardChart}
          note={
            <span className="inline-flex flex-wrap items-center gap-1.5">
              {fill(t.chartNote, { cur: chart.cur })}
              {ac.estimatedDays.length > 0 && (
                <Badge variant="warning" className="px-1.5 py-0 text-10">
                  {fill(t.estimatedDays, { n: String(ac.estimatedDays.length) })}
                </Badge>
              )}
            </span>
          }
          control={<ViewIn value={chart.cur} override={chart.override} onChange={chart.setOverride} options={chart.options} />}
        >
          <AreaChart points={ac.days} currency={chart.cur} onScrub={onScrub} />
          <p className="mt-2 text-11 text-muted-foreground">{t.scrubHint}</p>
        </MoneyCard>

        <MoneyCard
          title={t.cardRanking}
          note={t.rankNote2}
          control={<ViewIn value={rank.cur} override={rank.override} onChange={rank.setOverride} options={rank.options} />}
        >
          <TopList currency={rank.cur} />
        </MoneyCard>
      </div>

      <MoneyCard
        title={t.cardMix}
        note={t.cardMixNote}
        control={<ViewIn value={mix.cur} override={mix.override} onChange={mix.setOverride} options={mix.options} />}
      >
        <div className="max-w-2xl"><Donut agg={am} label={t.kGross} /></div>
      </MoneyCard>
    </div>
  );
}
