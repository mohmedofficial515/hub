/**
 * v2-departure-line: the home page with the flight search first.
 * One navy block (header + hero) carries a gold route arc that draws what the traveller types; the white search
 * card overlaps its lower edge; under it recent searches, what can be booked, how booking works and support.
 * Scenarios: `?scenario=empty|loading|error|long` (see parts/mocks.ts).
 */
import './tokens.css';
import { useMemo, useState } from 'react';
import { motion, MotionConfig, useReducedMotion } from 'framer-motion';
import { useLocale, useT } from '@lab/i18n';
import { cn } from '@lab/utils';
import { fill, messages } from './i18n';
import { shortDate, type Criteria } from './parts/format';
import { airportByCode, homeScenario, scenarioFromHash, type HistoryEntry, type Scenario } from './parts/mocks';
import { cabinLabel } from './parts/party-field';
import { RecentSearches } from './parts/recent-searches';
import { RouteArc } from './parts/route-arc';
import { emptyCriteria, SEARCH_ID, SearchCard } from './parts/search-card';
import { Services, Steps, Support } from './parts/sections';
import { SiteHeader } from './parts/site-header';

export default function Page() {
  const scenario = scenarioFromHash();
  return (
    <MotionConfig reducedMotion="user">
      <Home key={scenario} scenario={scenario} />
    </MotionConfig>
  );
}

const CABIN = { ECONOMY: 'economy', PREMIUM_ECONOMY: 'premium_economy', BUSINESS: 'business', FIRST: 'first' } as const;

function Home({ scenario }: { scenario: Scenario }) {
  const t = useT(messages);
  const locale = useLocale();
  const reduce = useReducedMotion();
  const data = useMemo(() => homeScenario(scenario, locale), [scenario, locale]);
  const [criteria, setCriteria] = useState<Criteria>(emptyCriteria);

  /** A recent search fills the form (the real row opens the results; here the arc shows what it would search). */
  const fromHistory = (e: HistoryEntry) => {
    const round = e.slices.length === 2 && e.slices[0].origin.iataCode === e.slices[1].destination.iataCode;
    const multi = e.slices.length > 1 && !round;
    const legs = (round ? e.slices.slice(0, 1) : e.slices).map((s, i) => ({
      id: 100 + i,
      from: airportByCode(s.origin.iataCode, locale) ?? null,
      to: airportByCode(s.destination.iataCode, locale) ?? null,
      date: s.departureDate,
    }));
    setCriteria({
      trip: round ? 'roundTrip' : multi ? 'multiCity' : 'oneWay',
      legs,
      returnDate: round ? e.slices[1].departureDate : null,
      party: {
        adults: e.passengers.adults,
        childAges: e.passengers.children,
        infantAges: e.passengers.infants,
        cabin: CABIN[e.cabinClass],
      },
    });
    document.getElementById(SEARCH_ID)?.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' });
  };

  // What the arc shows: the legs of the trip, and one quiet line of dates, party and cabin.
  const legs = criteria.trip === 'multiCity' ? criteria.legs : criteria.legs.slice(0, 1);
  const stops = [{ airport: legs[0].from }, ...legs.map((l) => ({ airport: l.to }))];
  const dates = legs.map((l) => l.date).filter(Boolean) as string[];
  if (criteria.trip === 'roundTrip' && criteria.returnDate) dates.push(criteria.returnDate);
  const party = criteria.party.adults + criteria.party.childAges.length + criteria.party.infantAges.length;
  const ready = stops.every((s) => s.airport);
  const summary = ready
    ? [
        dates.length ? dates.map((d) => shortDate(d, locale)).join(' – ') : null,
        t.travellers(party),
        cabinLabel(criteria.party.cabin, t.form),
      ]
        .filter(Boolean)
        .join(' · ')
    : null;
  const routeText =
    legs[0].from && legs[legs.length - 1].to
      ? fill(t.route, { from: legs[0].from.city, to: legs[legs.length - 1].to!.city })
      : null;

  const enter = (delay: number) =>
    reduce ? {} : { initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.32, delay, ease: [0.2, 0.8, 0.2, 1] as const } };

  return (
    <div className="gv-home min-h-dvh overflow-x-clip" id="top">
      <a
        href={`#${SEARCH_ID}`}
        className="sr-only z-50 rounded-md bg-(--card) px-4 py-2 font-semibold text-(--brand-ink) focus:not-sr-only focus:absolute focus:start-4 focus:top-4"
      >
        {t.skip}
      </a>

      {/* the navy block: header and hero on one flat surface */}
      <div className="bg-(--surface-brand) text-(--on-brand)">
        <SiteHeader t={t.header} sandbox={data.sandbox ? t.sandbox : null} />
        <div className="mx-auto grid w-full max-w-[80rem] items-center gap-6 px-4 pt-6 pb-20 sm:px-6 sm:pb-24 lg:grid-cols-[minmax(0,6fr)_minmax(0,6fr)] lg:gap-10 lg:px-8 lg:pt-10 lg:pb-36">
          <motion.div {...enter(0)}>
            <h1
              className={cn(
                'max-w-xl text-[1.875rem] font-bold text-balance sm:text-4xl lg:text-5xl',
                locale === 'ar' ? 'leading-[1.3]' : 'leading-[1.12] tracking-[-0.01em]',
              )}
            >
              {t.hero.title}
            </h1>
            <p className="mt-4 max-w-lg text-base leading-relaxed text-(--on-brand-muted) sm:text-lg">{t.hero.lead}</p>
          </motion.div>
          {/* In maintenance there is no search for the arc to listen to, so it is left out. */}
          {!data.flightSearchInMaintenance && (
            <motion.div {...enter(0.08)} className="-mx-1 lg:mx-0">
              <div className="hidden sm:block">
                <RouteArc stops={stops} summary={summary} emptyHint={t.hero.routeEmpty} ariaLabel={t.hero.routeAria} routeText={routeText} ends={{ from: t.hero.from, to: t.hero.to }} />
              </div>
              <div className="sm:hidden">
                <RouteArc compact stops={stops} summary={summary} emptyHint={t.hero.routeEmpty} ariaLabel={t.hero.routeAria} routeText={routeText} ends={{ from: t.hero.from, to: t.hero.to }} />
              </div>
            </motion.div>
          )}
        </div>
      </div>

      {/* the card sits over the block's lower edge */}
      <main>
        <div className="relative z-10 mx-auto -mt-14 w-full max-w-[80rem] px-3 sm:-mt-16 sm:px-6 lg:-mt-24 lg:px-8">
          <SearchCard criteria={criteria} onChange={setCriteria} maintenance={data.flightSearchInMaintenance} t={t} />
          <RecentSearches source={data.historySource} history={data.history} onPick={fromHistory} t={t} />
        </div>
        <Services t={t.services} />
        <Steps t={t.steps} />
        <Support t={t.support} phone={data.contacts.supportPhone} email={data.contacts.supportEmail} />
      </main>
    </div>
  );
}
