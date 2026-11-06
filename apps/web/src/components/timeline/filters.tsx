'use client';

/**
 * @file filters.tsx
 * @description The stream is what this page is for, so filters sit behind one button at every width (review M6). A member arriving with a filter on
 * sees it as a chip they can remove. All of it is the URL, and the server filters.
 */
import { CARD_TYPES, ROLES } from '@hub/contracts';
import { type RefObject, useMemo } from 'react';

import {
  dayKey,
  type ExtraChip,
  FilterBar,
  type FilterGroup,
  kitMessages,
  nowMs,
  rememberMine,
  roleIcon,
  Select,
  setQuery,
  TypeDot,
  useFilter,
  useMembers,
  useRoute,
  useT,
} from '@/components/kit';

import { NS, type TimelineMessages } from './messages';

export const FILTER_PARAMS = ['roles', 'types', 'repos', 'modules', 'members', 'from', 'to', 'mine'] as const;

/** Local midnight, as the instant the API takes. Istanbul stays at UTC+3 all year. */
const dayStart = (dayOffset: number) =>
  new Date(`${dayKey(nowMs() + dayOffset * 86_400_000)}T00:00:00+03:00`).toISOString();

/** The date presets and what they write. `from` and `to` stay real dates, so Today's "See all" link just works. */
function useRanges(since: string | undefined) {
  return useMemo(() => ({ today: dayStart(0), week: dayStart(-6), visit: since }), [since]);
}

function useRangeValue(since: string | undefined) {
  const ranges = useRanges(since);
  const from = useFilter('from');
  const to = useFilter('to');
  if (!from && !to) return '';
  if (!to && from === ranges.today) return 'today';
  if (!to && from === ranges.week) return 'week';
  if (!to && from === ranges.visit) return 'visit';
  return 'custom';
}

function DateFilter({ since }: { since: string | undefined }) {
  const t = useT<TimelineMessages>(NS);
  const ranges = useRanges(since);
  const value = useRangeValue(since);
  return (
    <label className="flex min-w-0 flex-col gap-1.5 md:@page-md:flex-row md:@page-md:items-center md:gap-2">
      <span className="shrink-0 text-body-sm text-muted-foreground">{t.filters.range}</span>
      <Select
        value={value}
        onChange={(e) => {
          const next = e.target.value as keyof typeof ranges | '';
          setQuery({ from: next ? (ranges[next] ?? null) : null, to: null });
        }}
        className="w-auto max-w-44 text-body-sm md:h-8"
      >
        <option value="">{t.filters.anyRange}</option>
        <option value="today">{t.filters.rangeToday}</option>
        <option value="week">{t.filters.rangeWeek}</option>
        {since && <option value="visit">{t.filters.rangeVisit}</option>}
        {value === 'custom' && <option value="custom">{t.filters.rangeCustom}</option>}
      </Select>
    </label>
  );
}

export function useActiveFilters() {
  const { query } = useRoute();
  return FILTER_PARAMS.filter((p) => query.get(p)).length;
}

export function TimelineFilters({
  repos,
  modules,
  since,
  openRef,
}: {
  repos: string[];
  modules: string[];
  since: string | undefined;
  openRef: RefObject<(() => void) | null>;
}) {
  const t = useT<TimelineMessages>(NS);
  const kit = useT(kitMessages);
  const range = useRangeValue(since);
  const members = useMembers().data ?? [];
  const groups: FilterGroup[] = [
    {
      param: 'roles',
      label: t.filters.roles,
      multi: true,
      options: ROLES.map((r) => {
        const Icon = roleIcon[r];
        return {
          value: r,
          label: kit.roles[r],
          icon: <Icon aria-hidden className="size-3.5" strokeWidth={1.75} />,
        };
      }),
    },
    {
      param: 'types',
      label: t.filters.types,
      multi: true,
      options: CARD_TYPES.map((type) => ({
        value: type,
        label: kit.types[type],
        icon: <TypeDot type={type} />,
      })),
    },
  ];
  const rangeWord = {
    today: t.filters.rangeToday,
    week: t.filters.rangeWeek,
    visit: t.filters.rangeVisit,
    custom: t.filters.rangeCustom,
  }[range as 'today'];
  const extraChips: ExtraChip[] = range
    ? [
        {
          key: 'range',
          label: `${t.filters.range}: ${rangeWord}`,
          onRemove: () => setQuery({ from: null, to: null }),
        },
      ]
    : [];
  return (
    <FilterBar
      collapse="always"
      openRef={openRef}
      mine={{ page: 'timeline', param: 'mine', value: '1' }}
      groups={groups}
      selects={[
        {
          param: 'repos',
          label: t.filters.repo,
          any: t.filters.anyRepo,
          options: repos.map((r) => ({ value: r, label: r })),
        },
        {
          param: 'modules',
          label: t.filters.module,
          any: t.filters.anyModule,
          options: modules.map((m) => ({ value: m, label: m })),
        },
        {
          param: 'members',
          label: t.filters.member,
          any: t.filters.anyMember,
          options: members.map((m) => ({ value: m.id, label: m.name })),
        },
      ]}
      extra={<DateFilter since={since} />}
      extraChips={extraChips}
    />
  );
}

export const clearFilters = (memberId: string) => {
  rememberMine('timeline', memberId, false);
  setQuery(Object.fromEntries(FILTER_PARAMS.map((p) => [p, null])));
};
