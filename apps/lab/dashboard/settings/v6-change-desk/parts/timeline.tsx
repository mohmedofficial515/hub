// Timeline: every version of every group in one chronological feed, filtered by person, group, section and risk.
import { useMemo, useState } from 'react';
import { FilterX } from 'lucide-react';
import { cn } from '@dash/lib/utils';
import { getGroup, SETTINGS_GROUPS, SETTINGS_SECTIONS } from '@lab/mocks/settings';
import { allEntries, entryRisk, type ChangeRisk } from './data';
import { EntryCard } from './entry';
import { formatDay } from './format';
import { useDesk } from './store';
import { Btn, Card, Segmented } from './ui';

const selectCls =
  'h-11 w-full min-w-0 rounded-lg border bg-background px-3 text-13 text-foreground outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 sm:h-9';

export function Timeline() {
  const { t, l, session, route, scenario } = useDesk();
  const all = useMemo(() => allEntries(session, scenario !== 'empty'), [session, scenario]);
  const [person, setPerson] = useState('');
  const [group, setGroup] = useState(route.g ?? '');
  const [section, setSection] = useState('');
  const [risk, setRisk] = useState<'any' | ChangeRisk>('any');
  const [limit, setLimit] = useState(12);

  const people = useMemo(() => [...new Set(all.map((e) => e.by))].sort(), [all]);
  const filtered = all.filter(
    (e) =>
      (!person || e.by === person) &&
      (!group || e.groupKey === group) &&
      (!section || getGroup(e.groupKey)?.section === section) &&
      (risk === 'any' || entryRisk(e) === risk),
  );
  const days = useMemo(() => {
    const map = new Map<string, typeof filtered>();
    for (const e of filtered.slice(0, limit)) {
      const day = e.at.slice(0, 10);
      map.set(day, [...(map.get(day) ?? []), e]);
    }
    return [...map.entries()];
  }, [filtered, limit]);
  const active = !!person || !!group || !!section || risk !== 'any';
  const clear = () => {
    setPerson('');
    setGroup('');
    setSection('');
    setRisk('any');
  };

  return (
    <div className="grid gap-5">
      <header className="grid gap-1">
        <h1 className="text-22 font-extrabold sm:text-26">{t.timeline.title}</h1>
        <p className="max-w-[70ch] text-14 leading-relaxed text-muted-foreground">{t.timeline.lead}</p>
      </header>
      <div className="grid gap-5 lg:grid-cols-[17rem_minmax(0,1fr)] lg:items-start">
        <Card as="aside" className="grid gap-4 p-4 lg:sticky lg:top-4" aria-label={t.timeline.title}>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-1">
            <div className="grid gap-1.5">
              <label htmlFor="tl-person" className="text-12 font-bold text-muted-foreground">
                {t.timeline.person}
              </label>
              <select id="tl-person" value={person} onChange={(e) => setPerson(e.target.value)} className={selectCls}>
                <option value="">{t.timeline.all}</option>
                {people.map((p) => (
                  <option key={p} value={p}>
                    {p === t.me ? `${p} ${t.meTag}` : p}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-1.5">
              <label htmlFor="tl-section" className="text-12 font-bold text-muted-foreground">
                {t.timeline.section}
              </label>
              <select id="tl-section" value={section} onChange={(e) => setSection(e.target.value)} className={selectCls}>
                <option value="">{t.timeline.all}</option>
                {SETTINGS_SECTIONS.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title[l]}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-span-2 grid gap-1.5 lg:col-span-1">
              <label htmlFor="tl-group" className="text-12 font-bold text-muted-foreground">
                {t.timeline.group}
              </label>
              <select id="tl-group" value={group} onChange={(e) => setGroup(e.target.value)} className={selectCls}>
                <option value="">{t.timeline.all}</option>
                {SETTINGS_GROUPS.filter((g) => g.kind === 'server' && (!section || g.section === section)).map((g) => (
                  <option key={g.key} value={g.key}>
                    {g.title[l]}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid gap-1.5">
            <span className="text-12 font-bold text-muted-foreground">{t.risk.label}</span>
            <Segmented
              label={t.risk.label}
              size="sm"
              value={risk}
              onChange={setRisk}
              className="w-full"
              options={[
                { value: 'any', label: t.risk.any },
                { value: 'high', label: t.risk.high },
                { value: 'security', label: t.risk.security },
                { value: 'money', label: t.risk.money },
              ]}
            />
          </div>
          <div className="flex items-center justify-between gap-2 border-t pt-3">
            <span className="text-12 text-muted-foreground" aria-live="polite">
              {t.timeline.entries(filtered.length)}
            </span>
            {active && (
              <Btn size="sm" variant="ghost" onClick={clear}>
                <FilterX aria-hidden />
                {t.timeline.clear}
              </Btn>
            )}
          </div>
        </Card>

        <div className="min-w-0">
          {days.length === 0 ? (
            <Card className="grid justify-items-start gap-2 p-8">
              <p className="text-16 font-bold">{t.timeline.empty}</p>
              <p className="text-13 text-muted-foreground">{t.timeline.emptyHint}</p>
              {active && (
                <Btn variant="outline" onClick={clear}>
                  {t.timeline.clear}
                </Btn>
              )}
            </Card>
          ) : (
            <ol className="grid gap-6">
              {days.map(([day, list]) => (
                <li key={day} className="grid gap-3">
                  <h2 className="sticky top-0 z-10 -mx-1 bg-background/95 px-1 py-1 text-13 font-extrabold text-muted-foreground backdrop-blur">{formatDay(`${day}T12:00:00Z`, l)}</h2>
                  <ol className="relative grid gap-3 ps-6">
                    <span aria-hidden className="absolute inset-y-2 start-[7px] w-px bg-border" />
                    {list.map((e) => (
                      <li key={`${e.groupKey}-${e.version}`} className="relative">
                        <span aria-hidden className={cn('absolute -start-6 top-6 size-[15px] rounded-full border-2 border-background', e.ticket ? 'bg-warning' : 'bg-muted-foreground/40')} />
                        <EntryCard entry={e} />
                      </li>
                    ))}
                  </ol>
                </li>
              ))}
            </ol>
          )}
          {filtered.length > limit && (
            <Btn variant="outline" className="mt-5 w-full" onClick={() => setLimit((n) => n + 12)}>
              {t.timeline.more(filtered.length - limit)}
            </Btn>
          )}
        </div>
      </div>
    </div>
  );
}
