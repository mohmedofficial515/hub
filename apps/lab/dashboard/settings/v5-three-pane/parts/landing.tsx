import { useMemo, type ReactNode } from 'react';
import { ChevronLeft, Sparkles, SlidersHorizontal, TriangleAlert } from 'lucide-react';
import { proposedFields, SETTINGS_GROUPS, SETTINGS_SECTIONS } from '@lab/mocks/settings';
import { cn } from './cn';
import { changedCount, useGroupState } from './list';
import { fieldsOf, groupByKey, relative } from './lib';
import { useStore } from './store';
import { Icon, listKeys, Pill, StateDot } from './ui';

function Block({ title, icon, children, className }: { title: string; icon?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn('rounded-2xl border bg-card', className)}>
      <h2 className="flex items-center gap-2 px-4 pb-1 pt-3.5 text-14 font-bold">
        {icon}
        {title}
      </h2>
      {children}
    </section>
  );
}

/** The editor column when nothing is chosen: what deserves a look now. */
export function Landing() {
  const s = useStore();
  const { t, locale } = s;
  const visible = SETTINGS_GROUPS.filter((g) => !s.hidden(g.key));
  const attention = visible.filter((g) => g.attention);
  const changed = visible.reduce((n, g) => n + changedCount(s.values[g.key] ?? {}, g), 0);
  const fields = visible.reduce((n, g) => n + fieldsOf(g).length, 0);
  const proposed = proposedFields();
  const byPriority = (['P0', 'P1', 'P2'] as const).map((p) => ({ p, n: proposed.filter((f) => f.priority === p).length })).filter((x) => x.n);

  const recent = useMemo(() => {
    const rows = visible.map((g) => {
      const h = s.history[g.key]?.[0];
      return { g, at: h?.at ?? s.meta[g.key].at, by: h?.by ?? s.meta[g.key].by, note: h?.note, version: s.versions[g.key] };
    });
    return rows.sort((a, b) => b.at.localeCompare(a.at)).slice(0, 6);
  }, [visible, s.history, s.meta, s.versions]);

  return (
    <div className="@container mx-auto w-full max-w-3xl px-4 pb-12 pt-6 md:px-6">
      <h1 className="text-26 font-extrabold tracking-tight">{t.landing.title}</h1>
      <p className="mt-1 max-w-[60ch] text-14 text-muted-foreground">{t.landing.lead}</p>

      <dl className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border bg-border @lg:grid-cols-4">
        {[
          { v: visible.length, l: t.landing.stats.groups },
          { v: fields, l: t.landing.stats.fields },
          { v: changed, l: t.landing.stats.changed },
          { v: attention.length, l: t.landing.stats.attention, warn: true },
        ].map((x) => (
          <div key={x.l} className="bg-card px-4 py-3">
            <dt className="text-12 text-muted-foreground">{x.l}</dt>
            <dd className={cn('text-22 font-extrabold tabular-nums', x.warn && x.v ? 'text-warning-strong dark:text-warning' : '')}>{x.v}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-5 grid gap-4">
        <Block title={t.landing.attention} icon={<TriangleAlert className="size-4 text-warning-strong dark:text-warning" aria-hidden />}>
          <ul className="grid grid-cols-1 gap-0.5 p-1.5" onKeyDown={listKeys}>
            {attention.map((g) => (
              <li key={g.key}>
                <button
                  type="button"
                  data-nav
                  onClick={() => s.go({ group: g.key, pane: 'editor' })}
                  className="flex w-full items-start gap-3 rounded-xl px-2.5 py-2.5 text-start outline-none hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-warning-strong dark:text-warning">
                    <Icon name={g.icon} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-14 font-bold">{g.title[locale]}</span>
                      <span className="text-12 text-muted-foreground">{SETTINGS_SECTIONS.find((x) => x.id === g.section)?.title[locale]}</span>
                      {!g.inDashboard ? <Pill tone="info">{t.state.new}</Pill> : null}
                    </span>
                    <span className="mt-0.5 line-clamp-2 text-13 leading-relaxed text-muted-foreground">{g.attention![locale]}</span>
                  </span>
                  <ChevronLeft className="mt-2 size-4 shrink-0 text-muted-foreground ltr:rotate-180" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        </Block>

        <Block title={t.landing.recent}>
          <ul className="grid grid-cols-1 gap-0.5 p-1.5" onKeyDown={listKeys}>
            {recent.map((r) => (
              <li key={r.g.key}>
                <button
                  type="button"
                  data-nav
                  onClick={() => s.go({ group: r.g.key, pane: 'editor' })}
                  className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-start outline-none hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-primary">
                    <Icon name={r.g.icon} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-14 font-semibold">{r.g.title[locale]}</span>
                      <span className="shrink-0 text-11 tabular-nums text-muted-foreground">v{r.version}</span>
                    </span>
                    <span className="block truncate text-12 text-muted-foreground">
                      {t.landing.byWho(r.by, relative(r.at, locale))}
                      {r.note ? ` · ${r.note[locale]}` : ''}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </Block>

        <Block title={t.landing.proposed} icon={<Sparkles className="size-4 text-info" aria-hidden />}>
          <div className="flex flex-wrap items-center gap-3 px-4 pb-4 pt-1">
            <p className="min-w-0 flex-1 text-13 text-muted-foreground">{t.landing.proposedHint}</p>
            <div className="flex items-center gap-1.5">
              {byPriority.map((x) => (
                <Pill key={x.p} tone={x.p === 'P0' ? 'danger' : 'info'}>
                  {x.p} · {x.n}
                </Pill>
              ))}
            </div>
            <button
              type="button"
              onClick={() => {
                if (!s.flags.has('proposed')) s.toggleFlag('proposed');
                s.setPane('list');
              }}
              className="inline-flex min-h-11 items-center rounded-lg border bg-card px-3 text-13 font-semibold outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring lg:min-h-9"
            >
              {t.landing.showAll}
            </button>
          </div>
        </Block>
      </div>
    </div>
  );
}

/** Below 768 px: the first level of the drill-in stack (sections, preferences, then the state summary). */
export function SectionsList() {
  const s = useStore();
  const { t, locale } = s;
  const stateOf = useGroupState();
  return (
    <ul className="grid grid-cols-1 gap-0.5" onKeyDown={listKeys}>
      {SETTINGS_SECTIONS.map((sec) => {
        const groups = sec.groupKeys.map((k) => groupByKey.get(k)!).filter((g) => g && !s.hidden(g.key));
        const att = groups.filter((g) => stateOf(g).state === 'attention').length;
        return (
          <li key={sec.id}>
            <button
              type="button"
              data-nav
              data-section={sec.id}
              onClick={() => s.go({ section: sec.id, pane: 'list' })}
              className="flex min-h-14 w-full items-center gap-3 rounded-xl px-2.5 py-2 text-start outline-none hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted text-primary">
                <Icon name={sec.icon} className="size-[1.125rem]" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-15 font-semibold">{sec.title[locale]}</span>
                <span className="block truncate text-12 text-muted-foreground">{sec.description[locale]}</span>
              </span>
              {att ? <StateDot state="attention" label={t.state.attention} /> : null}
              <span className="text-12 tabular-nums text-muted-foreground">{groups.length}</span>
              <ChevronLeft className="size-4 shrink-0 text-muted-foreground ltr:rotate-180" aria-hidden />
            </button>
          </li>
        );
      })}
      <li className="mt-2 border-t pt-2">
        <button
          type="button"
          data-nav
          data-section="prefs"
          onClick={() => s.go({ section: 'prefs', pane: 'list' })}
          className="flex min-h-14 w-full items-center gap-3 rounded-xl px-2.5 py-2 text-start outline-none hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted text-primary">
            <SlidersHorizontal className="size-[1.125rem]" aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-15 font-semibold">{t.prefs.title}</span>
            <span className="block truncate text-12 text-muted-foreground">{t.prefsHint}</span>
          </span>
          <ChevronLeft className="size-4 shrink-0 text-muted-foreground ltr:rotate-180" aria-hidden />
        </button>
      </li>
    </ul>
  );
}
