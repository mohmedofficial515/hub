// As-of time travel: settings read-only as they were at the end of a chosen day, with the differences from today.
import { useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { CalendarClock, ChevronLeft, ChevronRight, Eye, HelpCircle } from 'lucide-react';
import { cn } from '@dash/lib/utils';
import { SETTINGS_GROUPS, type FieldValue } from '@lab/mocks/settings';
import { FIELD_INDEX, groupAsOf, isServer, type AsOfGroup } from './data';
import { formatDateLong, formatValue, NOW, num } from './format';
import { useDesk } from './store';
import { Badge, Btn, Card, focusRing, Icon } from './ui';

const MIN = '2026-09-01';
const MAX = '2026-11-18';

export function AsOf() {
  const { t, l, route, go, values, session, versions } = useDesk();
  const reduce = useReducedMotion();
  const [date, setDate] = useState(route.d && /^\d{4}-\d{2}-\d{2}$/.test(route.d) ? route.d : '2026-10-03');
  const [picked, setPicked] = useState<string | undefined>(route.g);
  const [showAll, setShowAll] = useState(false);

  const endOfDay = useMemo(() => {
    const d = new Date(`${date}T23:59:59+03:00`);
    return Number.isNaN(d.getTime()) ? NOW.toISOString() : d.toISOString();
  }, [date]);
  const future = endOfDay > NOW.toISOString();

  const states = useMemo(
    () => SETTINGS_GROUPS.filter(isServer).map((g) => groupAsOf(g, future ? NOW.toISOString() : endOfDay, values, session, versions[g.key])),
    [endOfDay, future, values, session, versions],
  );
  const differing = states.filter((s) => s.status.kind === 'notYet' || Object.keys(s.then).length > 0);
  const unknown = states.filter((s) => s.status.kind === 'unknown');
  const same = states.length - differing.length - unknown.length;
  const selected = differing.find((s) => s.group.key === picked) ?? differing[0];

  const setDay = (d: string) => {
    setDate(d);
    setPicked(undefined);
    setShowAll(false);
    const [path, query = ''] = location.hash.replace(/^#/, '').split('?');
    const params = new URLSearchParams(query);
    params.set('d', d);
    history.replaceState(null, '', `#${path}?${params.toString()}`);
  };

  const dateLabel = formatDateLong(new Date(endOfDay), l);
  const Chevron = t.dir === 'rtl' ? ChevronLeft : ChevronRight;

  return (
    <div className="grid gap-5">
      <header className="grid gap-1">
        <h1 className="text-22 font-extrabold sm:text-26">{t.asof.title}</h1>
        <p className="max-w-[72ch] text-14 leading-relaxed text-muted-foreground">{t.asof.lead}</p>
      </header>

      <Card className="grid gap-4 p-5 sm:p-6">
        <div className="flex flex-wrap items-end gap-4">
          <div className="grid gap-1.5">
            <label htmlFor="asof-date" className="text-12 font-bold text-muted-foreground">
              {t.asof.date}: <span className="text-foreground">{formatDateLong(new Date(`${date}T12:00:00+03:00`), l)}</span>
            </label>
            <input
              id="asof-date"
              type="date"
              lang="en-GB"
              dir="ltr"
              min={MIN}
              max={MAX}
              value={date}
              onChange={(e) => e.target.value && setDay(e.target.value)}
              className="h-11 rounded-lg border bg-background px-3 text-14 font-semibold outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
            />
          </div>
          <div className="grid min-w-0 gap-1.5">
            <span className="text-12 font-bold text-muted-foreground">{t.asof.quick}</span>
            <div className="flex flex-wrap gap-1.5">
              {t.asof.samples.map((s) => (
                <button
                  key={s.ref}
                  type="button"
                  aria-pressed={date === s.date}
                  onClick={() => setDay(s.date)}
                  className={cn(
                    'grid min-h-11 rounded-lg border px-3 py-1 text-start transition-colors',
                    focusRing,
                    date === s.date ? 'border-foreground/30 bg-muted' : 'bg-card hover:bg-muted',
                  )}
                >
                  <bdi dir="ltr" className="text-12 font-bold">
                    {s.ref}
                  </bdi>
                  <span className="text-12 text-muted-foreground">
                    {formatDateLong(new Date(`${s.date}T12:00:00+03:00`), l)} · {s.note}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
        <motion.p
          key={date}
          initial={reduce ? false : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-start gap-3 text-18 font-extrabold leading-snug sm:text-20"
          aria-live="polite"
        >
          <CalendarClock aria-hidden className="mt-1 size-5 shrink-0 text-[color:var(--primary)]" />
          {future ? t.asof.future : t.asof.summary(dateLabel, differing.length)}
        </motion.p>
        <p className="flex items-center gap-2 text-12 text-muted-foreground">
          <Eye aria-hidden className="size-3.5" />
          {t.asof.readOnly}
        </p>
      </Card>

      {differing.length > 0 && selected && (
        <div className="grid gap-5 lg:grid-cols-[18rem_minmax(0,1fr)] lg:items-start">
          <Card as="aside" className="p-2 lg:sticky lg:top-4" aria-label={t.asof.groupsWithDiff}>
            <h2 className="px-3 pb-1 pt-2 text-12 font-bold text-muted-foreground">{t.asof.groupsWithDiff}</h2>
            <ul className="grid">
              {differing.map((s) => {
                const on = s.group.key === selected.group.key;
                const n = Object.keys(s.then).length;
                return (
                  <li key={s.group.key}>
                    <button
                      type="button"
                      aria-current={on ? 'true' : undefined}
                      onClick={() => (setPicked(s.group.key), setShowAll(false))}
                      className={cn('flex min-h-12 w-full items-center gap-3 rounded-xl px-3 py-2 text-start', focusRing, on ? 'bg-muted' : 'hover:bg-muted/60')}
                    >
                      <Icon name={s.group.icon} className="size-4 shrink-0 text-[color:var(--primary)]" />
                      <span className="grid min-w-0 flex-1">
                        <span className="truncate text-13 font-bold">{s.group.title[l]}</span>
                        <span className="truncate text-12 text-muted-foreground">
                          <StatusText s={s} />
                        </span>
                      </span>
                      {n > 0 && <Badge tone="warning">{num(n, l)}</Badge>}
                      <Chevron aria-hidden className="size-4 text-muted-foreground" />
                    </button>
                  </li>
                );
              })}
            </ul>
            <div className="grid gap-1 border-t px-3 py-3 text-12 text-muted-foreground">
              <p>{t.asof.unchangedGroups(same)}</p>
              {unknown.length > 0 && (
                <details className="group">
                  <summary className={cn('flex min-h-11 cursor-pointer list-none items-center gap-1.5 rounded-md sm:min-h-8', focusRing)}>
                    <HelpCircle aria-hidden className="size-3.5 shrink-0" />
                    <span>{t.asof.unknownCount(unknown.length)}</span>
                  </summary>
                  <p className="mt-1 leading-relaxed">
                    {unknown.map((u) => u.group.title[l]).join(t.listSep)}: {t.asof.unknown}
                  </p>
                </details>
              )}
            </div>
          </Card>

          <GroupThen state={selected} showAll={showAll} onToggle={() => setShowAll((x) => !x)} onOpen={() => go({ v: 'group', g: selected.group.key })} />
        </div>
      )}
    </div>
  );
}

function StatusText({ s }: { s: AsOfGroup }) {
  const { t, versions } = useDesk();
  const now = versions[s.group.key];
  switch (s.status.kind) {
    case 'version':
      return <>{`${t.asof.versionThen(s.status.version)} · ${t.asof.versionNow(now)}`}</>;
    case 'before':
      return <>{t.asof.beforeHistory(s.status.version + 1)}</>;
    case 'notYet':
      return <>{t.asof.notYet}</>;
    case 'unknown':
      return <>{t.asof.unknown}</>;
    default:
      return <>{t.asof.noDiff}</>;
  }
}

function GroupThen({ state, showAll, onToggle, onOpen }: { state: AsOfGroup; showAll: boolean; onToggle: () => void; onOpen: () => void }) {
  const { t, l, values } = useDesk();
  const g = state.group;
  return (
    <Card className="overflow-hidden" aria-labelledby="then-title">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b p-5">
        <div className="flex min-w-0 items-start gap-3">
          <Icon name={g.icon} className="mt-1 size-5 shrink-0 text-[color:var(--primary)]" />
          <div className="grid min-w-0 gap-0.5">
            <h2 id="then-title" className="text-18 font-extrabold">
              {g.title[l]}
            </h2>
            <p className="text-12 text-muted-foreground">
              <StatusText s={state} />
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {state.status.kind !== 'notYet' && (
            <Btn size="sm" variant="outline" aria-pressed={showAll} onClick={onToggle}>
              {showAll ? t.asof.hideAll : t.asof.showAll}
            </Btn>
          )}
          <Btn size="sm" variant="ghost" onClick={onOpen}>
            {t.search.open}
          </Btn>
        </div>
      </div>
      {state.status.kind === 'notYet' ? (
        <p className="p-5 text-14 text-muted-foreground">{t.asof.notYet}</p>
      ) : (
        <div className="grid divide-y">
          {g.subsections.map((sub) => {
            const fields = sub.fields
              .map((f) => FIELD_INDEX.get(`${g.key}.${f.key}`)!)
              .filter((f) => showAll || f.key in state.then);
            if (fields.length === 0) return null;
            return (
              <section key={sub.id} className="px-5 py-4" aria-label={sub.title[l]}>
                <h3 className="mb-2 text-13 font-extrabold text-muted-foreground">{sub.title[l]}</h3>
                <dl className="grid gap-2">
                  {fields.map((f) => {
                    const differs = f.key in state.then;
                    const then: FieldValue = differs ? state.then[f.key] : values[f.id];
                    return (
                      <div key={f.id} className={cn('grid gap-1 rounded-xl px-3 py-2.5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] sm:items-center sm:gap-4', differs && 'bg-muted/60')}>
                        <dt className="text-13 font-semibold">{f.label[l]}</dt>
                        <dd className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
                          <span className="grid gap-0.5">
                            {differs && <span className="text-12 font-semibold text-muted-foreground">{t.asof.then}</span>}
                            <span className={cn('text-14', differs ? 'rounded-md bg-warning/20 px-1.5 font-bold' : 'text-foreground')}>
                              <bdi>{formatValue(f, then, l, t)}</bdi>
                            </span>
                          </span>
                          {differs && (
                            <span className="grid gap-0.5">
                              <span className="text-12 font-semibold text-muted-foreground">{t.asof.today}</span>
                              <span className="text-14 text-muted-foreground">
                                <bdi>{formatValue(f, values[f.id], l, t)}</bdi>
                              </span>
                            </span>
                          )}
                          {differs && <span className="sr-only">{t.asof.differs}</span>}
                        </dd>
                      </div>
                    );
                  })}
                </dl>
              </section>
            );
          })}
        </div>
      )}
    </Card>
  );
}
