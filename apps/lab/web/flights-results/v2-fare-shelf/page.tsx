import './tokens.css';
import { useEffect, useMemo, useState } from 'react';
import { MotionConfig } from 'framer-motion';
import { useLocale, useT } from '@lab/i18n';
import { messages } from './i18n';
import { FACETS, HIGHLIGHTS, ITINERARIES, SEARCH, type FareOption, type HighlightKey, type OfferSort } from './mock';
import { FilterSheet } from './parts/filter-sheet';
import { FlightCard } from './parts/flight-card';
import { LabPreview, useLabState } from './parts/lab-preview';
import { activeFilterCount, dateOf, defaultFare, eligibleFares, itineraryMatches, NO_FILTERS, sortItineraries, type Filters } from './parts/model';
import { ResultsStrip } from './parts/results-strip';
import { EmptyState, ErrorState, LoadingState } from './parts/states';

/**
 * v2-fare-shelf: the results strip (best / cheapest / fastest as the sort itself, the bag switch, the filter entry)
 * and the flight card whose one action opens a fare shelf in place. Scope of GTV-520: the strip and one card; three
 * itineraries are listed so the three refund states and the one-open-shelf rule can be seen.
 */
export default function Page() {
  const t = useT(messages);
  const locale = useLocale();
  const [labState, setLabState] = useLabState();

  const [sort, setSort] = useState<OfferSort>('best');
  const [withBag, setWithBag] = useState(false);
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [openId, setOpenId] = useState<string | null>(ITINERARIES[0].id);
  /** Fares the traveller picked in a shelf, by itinerary. Without a pick, a card shows its cheapest eligible fare. */
  const [picked, setPicked] = useState<Record<string, string>>({});

  // A pick that the filters no longer allow falls back to the default.
  useEffect(() => {
    setPicked((current) => {
      const next = { ...current };
      for (const it of ITINERARIES) {
        if (next[it.id] && !eligibleFares(it, filters).some((f) => f.offerId === next[it.id])) delete next[it.id];
      }
      return next;
    });
  }, [filters]);

  const list = useMemo(() => sortItineraries(ITINERARIES.filter((it) => itineraryMatches(it, filters)), sort), [filters, sort]);
  const highlights = withBag ? HIGHLIGHTS.withBag : HIGHLIGHTS.plain;
  const filterCount = activeFilterCount(filters);
  const countLabel = filterCount ? t.strip.matching(list.length) : t.strip.count(FACETS.total);
  const fareOf = (id: string): FareOption => {
    const it = ITINERARIES.find((i) => i.id === id)!;
    return it.fares.find((f) => f.offerId === picked[id]) ?? defaultFare(it, filters, withBag);
  };
  const markersOf = (id: string) => (Object.keys(highlights) as HighlightKey[]).filter((k) => highlights[k].itineraryId === id);
  const state = labState === 'ready' && list.length === 0 ? 'empty' : labState;
  const clear = () => {
    setFilters(NO_FILTERS);
    if (labState === 'empty') setLabState('ready');
  };

  const out = ITINERARIES[0].slices[0];
  const back = ITINERARIES[0].slices[1];

  return (
    <MotionConfig reducedMotion="user">
      <main className="fr min-h-dvh">
        <div className="mx-auto w-full max-w-[60rem] px-4 py-6 sm:px-6 md:py-10">
          {/* Context only: the collapsed search summary is GTV-519 / L-16 territory, not this version's. */}
          <header className="mb-5">
            <h1 className="text-2xl leading-tight font-bold text-brand-ink md:text-3xl">{t.route}</h1>
            <p className="mt-1 text-sm text-ink-muted">
              {dateOf(out.departingAt, locale)} – {dateOf(back.departingAt, locale)}
              <span aria-hidden> · </span>
              {t.travellers(SEARCH.passengers.length)}
              <span aria-hidden> · </span>
              {t.card.cabin.ECONOMY}
            </p>
          </header>

          {state === 'loading' ? (
            <LoadingState />
          ) : state === 'error' ? (
            <ErrorState onRetry={() => setLabState('ready')} />
          ) : (
            <div className="space-y-5">
              <ResultsStrip
                sort={sort}
                onSort={setSort}
                highlights={highlights}
                currency={FACETS.currency}
                withBag={withBag}
                onWithBag={setWithBag}
                countLabel={countLabel}
                priceNote={t.strip.priceNote(SEARCH.passengers.length)}
                filterCount={filterCount}
                onOpenFilters={() => setFiltersOpen(true)}
              />

              {state === 'empty' ? (
                <EmptyState onClear={clear} />
              ) : (
                <ol className="space-y-4">
                  {list.map((it) => (
                    <li key={it.id}>
                      <FlightCard
                        itinerary={it}
                        fare={fareOf(it.id)}
                        markers={markersOf(it.id)}
                        withBag={withBag}
                        open={openId === it.id}
                        onToggle={() => setOpenId((cur) => (cur === it.id ? null : it.id))}
                        onSelectFare={(fare) => setPicked((p) => ({ ...p, [it.id]: fare.offerId }))}
                      />
                    </li>
                  ))}
                </ol>
              )}
            </div>
          )}

          <FilterSheet open={filtersOpen} onOpenChange={setFiltersOpen} filters={filters} onChange={setFilters} resultCount={countLabel} />
          <LabPreview value={labState} onChange={setLabState} />
        </div>
      </main>
    </MotionConfig>
  );
}
