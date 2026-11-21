// What the overview shows before anything is typed: pinned fields (editable in place), recent changes from history,
// groups that need attention, and a compact index of the 8 sections → groups, so browsing still works.

import { useMemo, useState } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, History, Lock, Sparkles, Star, TriangleAlert } from 'lucide-react';
import { SETTINGS_GROUPS, SETTINGS_SECTIONS, type SettingsGroup } from '@lab/mocks/settings';
import { useLocale, useT } from '@lab/i18n';
import { cn } from '@lab/utils';
import { messages } from '../i18n';
import { formatValue, fmtNumber, fmtRelative, loc } from './format';
import { iconFor } from './icons';
import { canSee, entryOf, fieldsOf, ownerOnly } from './model';
import { navigate } from './route';
import { ResultRow } from './results';
import { useStore } from './store';
import { IconTile, focusRing, useMedia } from './ui';

/** Phones and small tablets get short lists with «show more» and a folded index, so the home stays a short page. */
const useCompact = () => useMedia('(max-width: 767px)');

function useCap<T>(items: T[], cap: number) {
  const compact = useCompact();
  const [all, setAll] = useState(false);
  const limited = compact && !all && items.length > cap;
  return { shown: limited ? items.slice(0, cap) : items, rest: limited ? items.length - cap : 0, expanded: all, toggle: () => setAll((v) => !v), compact };
}

function MoreButton({ rest, expanded, onClick }: { rest: number; expanded: boolean; onClick: () => void }) {
  const t = useT(messages);
  if (!rest && !expanded) return null;
  return (
    <button
      type="button"
      aria-expanded={expanded}
      onClick={onClick}
      className={cn('mt-1 inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-13 font-semibold text-primary hover:underline dark:text-foreground', focusRing)}
    >
      <ChevronDown aria-hidden className={cn('size-4 transition-transform motion-reduce:transition-none', expanded && 'rotate-180')} />
      {expanded ? t.results.showLess : t.home.showMore(rest)}
    </button>
  );
}

function BlockHead({ icon: Icon, title, aside, id }: { icon: React.ComponentType<{ className?: string }>; title: string; aside?: React.ReactNode; id: string }) {
  return (
    <div className="mb-3 flex items-center gap-2 px-1">
      <Icon aria-hidden className="size-[18px] text-muted-foreground" />
      <h2 id={id} className="text-16 font-bold">
        {title}
      </h2>
      {aside && <span className="ms-auto text-13 text-muted-foreground">{aside}</span>}
    </div>
  );
}

export function PinnedBlock() {
  const t = useT(messages);
  const store = useStore();
  const entries = store.pinned
    .map((id) => {
      if (id.startsWith('pref.')) {
        const [, tab, ...rest] = id.split('.');
        return entryOf(`pref:${tab}`, rest.join('.'));
      }
      const [g, ...rest] = id.split('.');
      return entryOf(g, rest.join('.'));
    })
    .filter((e): e is NonNullable<typeof e> => !!e && canSee(store.role, e.groupKey, e.field));
  const cap = useCap(entries, 3);
  return (
    <section aria-labelledby="blk-pinned">
      <BlockHead id="blk-pinned" icon={Star} title={t.home.pinned} aside={entries.length ? t.n.settings(entries.length) : undefined} />
      {entries.length ? (
        <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
          {cap.shown.map((e) => (
            <ResultRow key={e.id} entry={e} tokens={[]} matchedIn={null} />
          ))}
        </ul>
      ) : null}
      {entries.length ? (
        <MoreButton rest={cap.rest} expanded={cap.expanded && cap.compact} onClick={cap.toggle} />
      ) : (
        <p className="rounded-2xl border border-dashed border-border px-5 py-6 text-14 leading-relaxed text-muted-foreground">
          <Star aria-hidden className="me-1.5 inline size-4 align-[-2px]" />
          {t.home.pinnedEmpty}
        </p>
      )}
    </section>
  );
}

export function RecentBlock() {
  const t = useT(messages);
  const locale = useLocale();
  const store = useStore();
  const Chevron = locale === 'ar' ? ChevronLeft : ChevronRight;
  const items = useMemo(
    () =>
      SETTINGS_GROUPS.filter((g) => canSee(store.role, g.key))
        .flatMap((group) => store.history(group.key).filter((h) => h.changes.length).map((entry) => ({ group, entry })))
        .sort((a, b) => b.entry.at.localeCompare(a.entry.at) || b.entry.version - a.entry.version)
        .slice(0, 6),
    [store],
  );
  const cap = useCap(items, 3);
  return (
    <section aria-labelledby="blk-recent">
      <BlockHead id="blk-recent" icon={History} title={t.home.recent} />
      {items.length ? (
        <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
          {cap.shown.map(({ group, entry }) => {
            const first = entry.changes[0];
            const e = entryOf(group.key, first.field);
            const label = e ? loc(e.field.label, locale) : first.field;
            const from = e ? formatValue(e.field, first.from, locale, t, 2) : String(first.from);
            const to = e ? formatValue(e.field, first.to, locale, t, 2) : String(first.to);
            return (
              <li key={`${group.key}-${entry.version}`}>
                <button
                  type="button"
                  onClick={() => navigate({ view: 'group', group: group.key, field: first.field })}
                  className={cn('flex w-full items-start gap-3 px-4 py-3 text-start transition-colors hover:bg-muted/40', focusRing, 'focus-visible:ring-inset focus-visible:ring-offset-0')}
                >
                  <span aria-hidden className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-muted text-12 font-bold text-muted-foreground">
                    {entry.by
                      .split(' ')
                      .map((w) => w[0])
                      .slice(0, 2)
                      .join('')}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-13 text-muted-foreground">
                      {t.home.changedBy(entry.by, loc(group.title, locale))}
                    </span>
                    <span className="mt-0.5 block text-14 font-semibold leading-snug">
                      {label}:{' '}
                      <span className="font-normal text-muted-foreground">
                        <bdi>{from}</bdi> {t.arrow} <bdi className="font-semibold text-foreground">{to}</bdi>
                      </span>
                      {entry.changes.length > 1 && <span className="ms-1 text-13 font-normal text-muted-foreground">{t.value.more(entry.changes.length - 1)}</span>}
                    </span>
                    <span className="mt-0.5 block text-12 text-muted-foreground">
                      {t.home.versionAt(fmtNumber(entry.version, locale), fmtRelative(entry.at, locale))}
                      {entry.requestId && ` · ${t.history.approvedBy(entry.approvedBy ?? '—')}`}
                    </span>
                  </span>
                  <Chevron aria-hidden className="mt-2 size-4 shrink-0 text-muted-foreground" />
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
      {items.length ? (
        <MoreButton rest={cap.rest} expanded={cap.expanded && cap.compact} onClick={cap.toggle} />
      ) : (
        <p className="rounded-2xl border border-dashed border-border px-5 py-6 text-14 text-muted-foreground">{t.home.recentEmpty}</p>
      )}
    </section>
  );
}

export function AttentionBlock() {
  const t = useT(messages);
  const locale = useLocale();
  const store = useStore();
  const groups = store.scenario === 'empty' ? [] : SETTINGS_GROUPS.filter((g) => g.attention && canSee(store.role, g.key));
  const cap = useCap(groups, 3);
  return (
    <section aria-labelledby="blk-attention">
      <BlockHead id="blk-attention" icon={TriangleAlert} title={t.home.attention} aside={groups.length ? t.n.groups(groups.length) : undefined} />
      {groups.length ? (
        <ul className="flex flex-col gap-2">
          {cap.shown.map((g) => {
            const Icon = iconFor(g.icon);
            return (
              <li key={g.key}>
                <button
                  type="button"
                  onClick={() => navigate({ view: 'group', group: g.key })}
                  className={cn('flex w-full items-start gap-3 rounded-2xl border border-border bg-card p-4 text-start transition-colors hover:bg-muted/40', focusRing)}
                >
                  <span className="relative">
                    <IconTile icon={Icon} />
                    <span className="absolute -bottom-1 -end-1 grid size-5 place-items-center rounded-full bg-card">
                      <TriangleAlert aria-hidden className="size-3.5 text-warning-strong" />
                    </span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2 text-15 font-bold">
                      {loc(g.title, locale)}
                      {!g.inDashboard && (
                        <span className="inline-flex h-5 items-center gap-1 rounded-md bg-info/12 px-1.5 text-11 font-semibold text-info-soft-foreground dark:bg-info/20">
                          <Sparkles aria-hidden className="size-3" />
                          {t.badges.newGroup}
                        </span>
                      )}
                    </span>
                    <span className="mt-1 line-clamp-2 block text-13 md:line-clamp-3 leading-relaxed text-muted-foreground">{loc(g.attention, locale)}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
      {groups.length ? (
        <MoreButton rest={cap.rest} expanded={cap.expanded && cap.compact} onClick={cap.toggle} />
      ) : (
        <p className="rounded-2xl border border-dashed border-border px-5 py-6 text-14 text-muted-foreground">{t.home.attentionEmpty}</p>
      )}
    </section>
  );
}

export function IndexBlock() {
  const t = useT(messages);
  const locale = useLocale();
  const store = useStore();
  const sorter = useMemo(() => new Intl.Collator(locale), [locale]);
  const compact = useCompact();
  return (
    <section aria-labelledby="blk-index">
      <BlockHead id="blk-index" icon={iconFor('ListChecks')} title={t.home.index} aside={t.home.indexHint} />
      <div className="columns-1 gap-x-8 rounded-2xl border border-border bg-card px-4 py-2 md:px-5 md:py-4 sm:columns-2 lg:columns-4">
        {SETTINGS_SECTIONS.map((section) => {
          const all = section.groupKeys.map((k) => SETTINGS_GROUPS.find((g) => g.key === k)).filter((g): g is SettingsGroup => !!g);
          const visible = all.filter((g) => canSee(store.role, g.key));
          const hidden = all.length - visible.length;
          const sorted = [...visible].sort((a, b) => sorter.compare(loc(a.title, locale), loc(b.title, locale)));
          const Icon = iconFor(section.icon);
          return (
            <details key={`${section.id}-${compact}`} open={!compact} className="group/sec mb-1 break-inside-avoid md:mb-4">
              <summary
                className={cn(
                  'flex min-h-11 list-none items-center gap-2 rounded-lg text-14 font-bold md:pointer-events-none xl:min-h-10 [&::-webkit-details-marker]:hidden',
                  focusRing,
                )}
                tabIndex={compact ? 0 : -1}
              >
                <Icon aria-hidden className="size-4 text-primary dark:text-foreground" />
                <h3 className="min-w-0 flex-1">{loc(section.title, locale)}</h3>
                <span className="text-12 font-normal text-muted-foreground md:hidden">{fmtNumber(sorted.length, locale)}</span>
                <ChevronDown aria-hidden className="size-4 text-muted-foreground transition-transform group-open/sec:rotate-180 motion-reduce:transition-none md:hidden" />
              </summary>
              <ul>
                {sorted.map((g) => (
                  <li key={g.key}>
                    <button
                      type="button"
                      onClick={() => navigate({ view: 'group', group: g.key })}
                      className={cn(
                        'flex min-h-11 w-full items-center gap-2 rounded-lg px-2 text-start text-14 text-foreground hover:bg-muted xl:min-h-10',
                        focusRing,
                      )}
                    >
                      <span className="min-w-0 flex-1 truncate">{loc(g.title, locale)}</span>
                      {g.attention && (
                        <span title={t.home.attention}>
                          <TriangleAlert aria-label={t.home.attention} className="size-3.5 text-warning-strong" />
                        </span>
                      )}
                      {!g.inDashboard && <span className="rounded bg-info/12 px-1 text-11 font-semibold text-info-soft-foreground dark:bg-info/20">{t.badges.newGroup}</span>}
                      {ownerOnly(g.key) && <Lock aria-label={t.badges.ownerOnly} className="size-3.5 text-muted-foreground" />}
                      <span className="text-12 tabular-nums text-muted-foreground">{fmtNumber(fieldsOf(g).length, locale)}</span>
                    </button>
                  </li>
                ))}
              </ul>
              {hidden > 0 && <p className="px-2 py-1 text-12 text-muted-foreground">{t.home.hiddenByPermission(hidden)}</p>}
            </details>
          );
        })}
      </div>
    </section>
  );
}
