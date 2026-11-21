import { useMemo, type RefObject } from 'react';
import { useLocale, useT } from '@lab/i18n';
import { members, type CardType, type Role } from '@lab/mocks/hub-app';
import { dayKey, FilterBar, kitMessages, nowMs, rememberMine, roleIcon, Select, setQuery, TypeDot, useFilter, useRoute, useSession, type ExtraChip, type FilterGroup, type HubCard } from '../../../kit';
import { messages } from '../i18n';

const ROLES: Role[] = ['owner', 'pm', 'accountant', 'backend', 'frontend', 'designer', 'qa'];
const TYPES: CardType[] = ['task', 'decision', 'need', 'handoff', 'change', 'redesign', 'doc', 'release'];
export const FILTER_PARAMS = ['roles', 'types', 'repos', 'modules', 'members', 'from', 'to', 'awaiting'] as const;

const dayStart = (dayOffset: number) => `${dayKey(nowMs() + dayOffset * 86_400_000)}T00:00:00+03:00`;

/** The date presets and what they write. `from` and `to` stay real dates so Today's "See all" link just works. */
function useRanges() {
  const { today } = useSession();
  return useMemo(
    () => ({
      today: dayStart(0),
      week: dayStart(-6),
      visit: today.lastSeenAt,
    }),
    [today.lastSeenAt],
  );
}

function useRangeValue() {
  const ranges = useRanges();
  const from = useFilter('from');
  const to = useFilter('to');
  return !from && !to ? '' : !to && from === ranges.today ? 'today' : !to && from === ranges.week ? 'week' : !to && from === ranges.visit ? 'visit' : 'custom';
}

function DateFilter() {
  const t = useT(messages);
  const ranges = useRanges();
  const value = useRangeValue();
  return (
    <label className="flex min-w-0 flex-col gap-1.5 md:flex-row md:items-center md:gap-2">
      <span className="shrink-0 text-body-sm text-muted-foreground">{t.filters.range}</span>
      <Select
        value={value}
        onChange={(e) => {
          const next = e.target.value as keyof typeof ranges | '';
          setQuery({ from: next ? ranges[next] : null, to: null });
        }}
        className="w-auto max-w-44 text-body-sm md:h-8"
      >
        <option value="">{t.filters.anyRange}</option>
        <option value="today">{t.filters.rangeToday}</option>
        <option value="week">{t.filters.rangeWeek}</option>
        <option value="visit">{t.filters.rangeVisit}</option>
        {value === 'custom' && <option value="custom">{t.filters.rangeCustom}</option>}
      </Select>
    </label>
  );
}

export function useActiveFilters() {
  const { query } = useRoute();
  return FILTER_PARAMS.filter((p) => query.get(p)).length;
}

/**
 * The stream is what this page is for, so filters sit behind one button at every width (review M6). A member arriving with a
 * filter on sees it as a chip they can remove.
 */
export function TimelineFilters({ cards, openRef }: { cards: HubCard[]; openRef: RefObject<(() => void) | null> }) {
  const t = useT(messages);
  const kit = useT(kitMessages);
  const locale = useLocale();
  const range = useRangeValue();
  const repos = [...new Set(cards.map((c) => c.repo).filter((r): r is NonNullable<HubCard['repo']> => !!r))].sort();
  const modules = [...new Set(cards.map((c) => c.module).filter((m): m is string => !!m))].sort();
  const groups: FilterGroup[] = [
    {
      param: 'roles',
      label: t.filters.roles,
      multi: true,
      options: ROLES.map((r) => {
        const Icon = roleIcon[r];
        return { value: r, label: kit.roles[r], icon: <Icon aria-hidden className="size-3.5" strokeWidth={1.75} /> };
      }),
    },
    { param: 'types', label: t.filters.types, multi: true, options: TYPES.map((type) => ({ value: type, label: kit.types[type], icon: <TypeDot type={type} /> })) },
  ];
  const rangeWord = { today: t.filters.rangeToday, week: t.filters.rangeWeek, visit: t.filters.rangeVisit, custom: t.filters.rangeCustom }[range as 'today'];
  const extraChips: ExtraChip[] = range ? [{ key: 'range', label: `${t.filters.range}: ${rangeWord}`, onRemove: () => setQuery({ from: null, to: null }) }] : [];
  return (
    <FilterBar
      collapse="always"
      openRef={openRef}
      mine={{ page: 'timeline' }}
      groups={groups}
      selects={[
        { param: 'repos', label: t.filters.repo, any: t.filters.anyRepo, options: repos.map((r) => ({ value: r, label: r })) },
        { param: 'modules', label: t.filters.module, any: t.filters.anyModule, options: modules.map((m) => ({ value: m, label: m })) },
        { param: 'members', label: t.filters.member, any: t.filters.anyMember, options: members.map((m) => ({ value: m.id, label: m.name[locale] })) },
      ]}
      extra={<DateFilter />}
      extraChips={extraChips}
    />
  );
}

export const clearFilters = (memberId: string) => {
  rememberMine('timeline', memberId, false);
  setQuery(Object.fromEntries(FILTER_PARAMS.map((p) => [p, null])));
};
