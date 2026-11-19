// Search results grouped by group. Each row: path (Section › Group › Subsection), label with the match marked,
// value or an inline control (boolean / enum / number), markers, pin and open.

import { useState, type KeyboardEvent } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { ChevronLeft, ChevronRight, SearchX, Star, TriangleAlert, Zap } from 'lucide-react';
import { useLocale, useT } from '@lab/i18n';
import { cn } from '@lab/utils';
import { messages } from '../i18n';
import { ChangedMark, FieldBadges, GroupBadges, UnsavedMark } from './badges';
import { FieldControl } from './controls';
import { formatValue, loc } from './format';
import { iconFor } from './icons';
import { groupByKey, isInlineEditable, ownerOnly, same, type Entry } from './model';
import { navigate } from './route';
import { highlightTokens, type Hit, type HitGroup } from './search';
import { useStore } from './store';
import { Badge, Btn, Highlight, IconTile, focusRing } from './ui';

export function openEntry(entry: Entry) {
  if (entry.scope === 'pref') navigate({ view: 'prefs', field: entry.key });
  else navigate({ view: 'group', group: entry.groupKey, field: entry.key });
}

/** ↑ / ↓ move between result rows, Esc returns to the search box. */
export function onResultsKeyDown(e: KeyboardEvent<HTMLElement>, focusSearch: () => void) {
  const target = e.target as HTMLElement;
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
    const open = target.closest('[data-row]')?.querySelector<HTMLElement>('[data-open]');
    if (open) {
      e.preventDefault();
      open.click();
    }
    return;
  }
  if (!target.matches('[data-result]')) return;
  const all = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('[data-result]'));
  const i = all.indexOf(target);
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    all[Math.min(all.length - 1, i + 1)]?.focus();
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    if (i <= 0) focusSearch();
    else all[i - 1]?.focus();
  } else if (e.key === 'Escape') {
    e.preventDefault();
    focusSearch();
  }
}

export function ResultRow({ entry, tokens, matchedIn, via }: { entry: Entry; tokens: string[]; matchedIn: Hit['matchedIn']; via?: string }) {
  const t = useT(messages);
  const locale = useLocale();
  const store = useStore();
  const field = entry.field;
  const value = store.value(entry.groupKey, entry.key);
  const savedValue = store.saved(entry.groupKey, entry.key);
  const dirty = entry.scope === 'org' && !same(value, savedValue);
  const changed = !same(savedValue, field.default);
  const label = loc(field.label, locale);
  const pinned = store.pinned.includes(entry.id);
  const Chevron = locale === 'ar' ? ChevronLeft : ChevronRight;
  const path =
    entry.scope === 'pref'
      ? [loc(entry.sectionTitle, locale), loc(entry.groupTitle, locale)]
      : [loc(entry.sectionTitle, locale), loc(entry.groupTitle, locale), loc(entry.subsectionTitle, locale)];
  const onChange = (next: typeof value) => {
    if (entry.scope === 'pref') {
      store.setPref(entry.groupKey, entry.key, next);
      store.toast(t.toasts.applied(label, formatValue(field, next, locale, t)));
    } else store.setDraft(entry.groupKey, entry.key, next);
  };
  const inline = isInlineEditable(field);
  const snippet =
    matchedIn === 'help'
      ? loc(field.help, locale)
      : matchedIn === 'key'
        ? entry.id
        : matchedIn === 'value'
          ? formatValue(field, value, locale, t, 6)
          : (matchedIn === 'synonym' || matchedIn === 'typo') && via
            ? via
            : null;

  return (
    <li data-row="" className="grid gap-x-4 gap-y-2 px-4 py-3 transition-colors hover:bg-muted/40 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
      <div className="min-w-0">
        {/* The section shrinks first, so «Group › Subsection» (the specific part) stays readable. */}
        <p className="flex min-w-0 text-12 font-medium text-muted-foreground" title={path.join(' › ')}>
          {path.map((p, i) => (
            <span key={i} className={cn('flex min-w-0 items-center truncate', i === 0 ? 'shrink-[12]' : 'shrink')}>
              {i > 0 && <span aria-hidden className="mx-1 shrink-0 opacity-70">›</span>}
              <span className="truncate">
                <Highlight text={p} tokens={matchedIn === 'path' ? tokens : []} />
              </span>
            </span>
          ))}
        </p>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
          <button
            type="button"
            data-result=""
            onClick={() => openEntry(entry)}
            className={cn('-mx-1 inline-flex min-h-11 items-center rounded-md px-1 text-start text-15 font-semibold leading-snug text-foreground hover:underline hover:decoration-primary/60 hover:underline-offset-4', focusRing)}
          >
            <Highlight text={label} tokens={tokens} />
            <span className="sr-only">
              {' — '}
              {path.join(' › ')}
            </span>
          </button>
          {changed && <ChangedMark defaultText={formatValue(field, field.default, locale, t)} />}
          {dirty && <UnsavedMark />}
          {entry.scope === 'pref' && (
            <Badge tone="neutral" icon={<Zap aria-hidden />}>
              {t.results.instant}
            </Badge>
          )}
          <FieldBadges field={field} compact />
        </div>
        {snippet && (
          <p className="mt-1 line-clamp-1 text-12 text-muted-foreground">
            <span className="font-semibold">{t.results.matchedIn[matchedIn as keyof typeof t.results.matchedIn]} </span>
            {matchedIn === 'key' ? (
              <code dir="ltr" className="rounded bg-muted px-1 text-12">
                <Highlight text={snippet} tokens={tokens} />
              </code>
            ) : matchedIn === 'synonym' || matchedIn === 'typo' ? (
              <bdi className="font-semibold text-foreground">«{snippet}»</bdi>
            ) : (
              <Highlight text={snippet} tokens={tokens} />
            )}
          </p>
        )}
      </div>
      <div className="flex min-w-0 items-center justify-between gap-1 sm:justify-end">
        <div data-row-control="" className="min-w-0 sm:max-w-[22rem]">
          {inline ? (
            <FieldControl field={field} value={value} onChange={onChange} mode="inline" label={label} />
          ) : (
            <span className="block max-w-[15rem] truncate text-14 font-semibold text-foreground sm:text-end">
              <bdi>{formatValue(field, value, locale, t)}</bdi>
            </span>
          )}
        </div>
        <div className="flex shrink-0 items-center">
          <Btn
            variant="quiet"
            size="icon"
            aria-pressed={pinned}
            aria-label={pinned ? t.results.unpin(label) : t.results.pin(label)}
            onClick={() => store.togglePin(entry.id)}
          >
            <Star className={cn('size-[18px]', pinned && 'fill-warning text-warning-strong')} aria-hidden />
          </Btn>
          <Btn variant="quiet" size="icon" data-open="" aria-label={t.results.open(label)} title={t.results.open(label)} onClick={() => openEntry(entry)}>
            <Chevron className="size-5" aria-hidden />
          </Btn>
        </div>
      </div>
    </li>
  );
}

const PER_GROUP = 5;

export function ResultGroups({ groups, query }: { groups: HitGroup[]; query: string }) {
  const t = useT(messages);
  const locale = useLocale();
  const reduce = useReducedMotion();
  const [open, setOpen] = useState<Record<string, boolean>>({});
  return (
    <div className="flex flex-col gap-7">
      {groups.map((g, gi) => {
        const first = g.hits[0].entry;
        const group = groupByKey(g.groupKey);
        const Icon = iconFor(first.icon);
        const all = open[g.groupKey];
        const shown = all ? g.hits : g.hits.slice(0, PER_GROUP);
        const headId = `rg-${g.groupKey.replace(':', '-')}`;
        return (
          <motion.section
            key={g.groupKey}
            aria-labelledby={headId}
            initial={reduce || gi > 6 ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, delay: gi * 0.025 }}
          >
            <header className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 px-1">
              <IconTile icon={Icon} size="sm" />
              <div className="flex min-w-0 flex-1 basis-[calc(100%-3rem)] flex-wrap items-baseline gap-x-2 sm:basis-0">
                <h3 id={headId} className="text-16 font-bold">
                  {loc(first.groupTitle, locale)}
                </h3>
                <span className="text-13 text-muted-foreground">
                  {loc(first.sectionTitle, locale)} · {t.n.results(g.hits.length)}
                </span>
              </div>
              {group && <GroupBadges group={group} ownerOnly={ownerOnly(group.key)} />}
              <Btn
                variant="quiet"
                size="sm"
                onClick={() => (first.scope === 'pref' ? navigate({ view: 'prefs' }) : navigate({ view: 'group', group: g.groupKey }))}
              >
                {t.results.openGroup}
              </Btn>
            </header>
            {group?.attention && (
              <p className="mb-2 flex items-start gap-2 px-1 text-13 leading-relaxed text-muted-foreground">
                <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-warning-strong" />
                <span className="line-clamp-2">{loc(group.attention, locale)}</span>
              </p>
            )}
            <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
              {shown.map((hit) => (
                <ResultRow key={hit.entry.id} entry={hit.entry} tokens={highlightTokens(query, hit.via)} matchedIn={hit.matchedIn} via={hit.via} />
              ))}
            </ul>
            {g.hits.length > PER_GROUP && (
              <button
                type="button"
                onClick={() => setOpen((o) => ({ ...o, [g.groupKey]: !all }))}
                className={cn('mt-1 min-h-11 rounded-lg px-2 text-13 font-semibold text-primary hover:underline dark:text-foreground', focusRing)}
              >
                {all ? t.results.showLess : t.results.showMore(g.hits.length - PER_GROUP, loc(first.groupTitle, locale))}
              </button>
            )}
          </motion.section>
        );
      })}
    </div>
  );
}

export function NoResults({
  query,
  hasFilters,
  onClearFilters,
  onTry,
}: {
  query: string;
  hasFilters: boolean;
  onClearFilters: () => void;
  onTry: (q: string) => void;
}) {
  const t = useT(messages);
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center rounded-2xl border border-dashed border-border px-6 py-10 text-center">
      <span className="grid size-12 place-items-center rounded-2xl bg-muted text-muted-foreground">
        <SearchX className="size-6" aria-hidden />
      </span>
      <h3 className="mt-4 text-18 font-bold">{query ? t.empty.noResultsFor(query) : t.empty.noResults}</h3>
      <p className="mt-2 text-14 leading-relaxed text-muted-foreground">{hasFilters ? t.empty.noResultsFilters : t.empty.noResultsHelp}</p>
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        {hasFilters && (
          <Btn variant="primary" onClick={onClearFilters}>
            {t.empty.clearFilters}
          </Btn>
        )}
        {t.empty.suggestions.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onTry(s)}
            className={cn('inline-flex min-h-11 items-center rounded-full border border-border bg-card px-4 text-14 font-semibold hover:bg-muted', focusRing)}
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}


/** Enter in the search box: move to the first result's own control (switch, choice, number), else to its label. */
export function focusFirstResult(container: HTMLElement | null): boolean {
  const row = container?.querySelector<HTMLElement>('[data-row]');
  if (!row) return false;
  const control = row.querySelector<HTMLElement>(
    '[data-row-control] [role=switch], [data-row-control] [role=radio][tabindex="0"], [data-row-control] select, [data-row-control] input, [data-row-control] button',
  );
  (control ?? row.querySelector<HTMLElement>('[data-result]'))?.focus();
  return true;
}
