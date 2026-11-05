'use client';

/**
 * @file audit.tsx
 * @description Ported from the approved design, pages/settings/parts/audit.tsx, on the real API. Contract: apps/web/README.md.
 */
import { ChevronDown, Download, Lock, ScrollText, SlidersHorizontal } from 'lucide-react';
import { Fragment, useMemo, useState } from 'react';

import {
  ActorChip,
  Bidi,
  Button,
  CardChip,
  cn,
  dayKey,
  EmptyState,
  ErrorState,
  Field,
  fmt,
  kitMessages,
  longDate,
  Ltr,
  num,
  plural,
  SectionHeader,
  Select,
  setQuery,
  showToast,
  SkeletonRows,
  TextInput,
  time,
  useFilter,
  useKeyboardList,
  useLocale,
  useMedia,
  useMembers,
  useRoute,
  useT,
} from '@/components/kit';
import type { SettingsMessages } from '@/features/settings/messages';
import { auditExportHref, type AuditFilters, type AuditRow, useAudit } from '@/features/settings/queries';
import { isHubError } from '@/lib/api/errors';

import { rowFocus } from './shared';

const GROUPS = [
  'cards',
  'members',
  'identity',
  'settings',
  'sources',
  'capture',
  'redesign',
  'digests',
  'system',
] as const;
const CARD_KEY = /^[A-Z]{2,6}-\d+$/;

function Actor({ row }: { row: AuditRow }) {
  return (
    <ActorChip
      kind={row.actor.kind}
      memberId={row.actor.userId ?? undefined}
      adapter={row.actor.displayName ?? row.via}
    />
  );
}

function Target({ row }: { row: AuditRow }) {
  const members = useMembers().data;
  if (!row.targetId) return <span className="text-muted-foreground">-</span>;
  if (CARD_KEY.test(row.targetId)) return <CardChip k={row.targetId} />;
  const member = row.targetType === 'user' ? members?.find((m) => m.id === row.targetId) : undefined;
  if (member) return <span className="text-body-sm text-foreground">{member.name}</span>;
  return (
    <code
      dir="ltr"
      translate="no"
      title={row.targetId}
      className="key text-caption wrap-anywhere text-foreground"
    >
      {/* A long key or address wraps after a dot or an @, not in the middle of a word. */}
      {row.targetId.split(/(?<=[.@_])/).map((part, i) => (
        <Fragment key={i}>
          {i > 0 && <wbr />}
          {part}
        </Fragment>
      ))}
      {row.targetType === 'token' && '…'}
    </code>
  );
}

/** IP, client and record number: for the one row someone is checking, so they do not widen every row. */
function RowDetail({ row }: { row: AuditRow }) {
  const t = useT<SettingsMessages>('settings');
  const items = [
    { label: t.audit.detail.record, value: row.id },
    { label: t.audit.detail.ip, value: row.ip ?? t.audit.detail.none },
    { label: t.audit.detail.client, value: row.userAgent ?? t.audit.detail.none },
  ];
  return (
    <dl className="grid gap-x-6 gap-y-1 sm:grid-cols-3">
      {items.map((i) => (
        <div key={i.label} className="min-w-0">
          <dt className="text-caption text-muted-foreground">{i.label}</dt>
          <dd dir="auto" className="text-body-sm break-words text-foreground">
            {i.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function ExpandButton({ open, label, onClick }: { open: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-expanded={open}
      aria-label={label}
      title={label}
      onClick={onClick}
      className="inline-flex size-11 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors duration-150 hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none md:size-7"
    >
      <ChevronDown
        aria-hidden
        className={cn(
          'size-4 transition-transform duration-150 motion-reduce:transition-none',
          open && 'rotate-180',
        )}
        strokeWidth={1.75}
      />
    </button>
  );
}

export function AuditTab() {
  const t = useT<SettingsMessages>('settings');
  const kit = useT(kitMessages);
  const locale = useLocale();
  const { ws } = useRoute();
  const members = useMembers().data ?? [];
  const s = t.audit;
  // Six columns need the room of a laptop. Tablet and phone read the same rows as a compact ledger.
  const wide = useMedia('(min-width: 1024px)');
  const filtersInline = useMedia('(min-width: 768px)');
  const actor = useFilter('actor');
  // Not `action`: the card sheet owns that param. It maps to the API's `action` prefix.
  const verb = useFilter('verb');
  const from = useFilter('from');
  const to = useFilter('to');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [open, setOpen] = useState<string | null>(null);

  // A day, in the project's time, as the API's bounds.
  const apiFilters = useMemo<AuditFilters>(
    () => ({
      ...(actor ? { actor } : {}),
      ...(verb ? { action: `${verb}.` } : {}),
      ...(from ? { from: new Date(`${from}T00:00:00`).toISOString() } : {}),
      ...(to ? { to: new Date(`${to}T23:59:59`).toISOString() } : {}),
    }),
    [actor, verb, from, to],
  );
  const query = useAudit(apiFilters);
  const page = useMemo(() => query.data?.pages.flatMap((p) => p.items) ?? [], [query.data]);
  const days = useMemo(() => {
    const groups = new Map<string, AuditRow[]>();
    page.forEach((r) => groups.set(dayKey(r.createdAt), [...(groups.get(dayKey(r.createdAt)) ?? []), r]));
    return [...groups.entries()];
  }, [page]);

  const toggle = (id: string) => setOpen((current) => (current === id ? null : id));
  const list = useKeyboardList({ ids: page.map((r) => r.id), onOpen: toggle });
  const activeFilters = [actor, verb, from, to].filter(Boolean).length;
  const clear = () => setQuery({ actor: null, verb: null, from: null, to: null });
  const rangeError = from && to && from > to ? s.rangeInvalid : undefined;

  const filters = (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-[repeat(2,minmax(0,1fr))_auto_auto] md:items-start">
      <Field id="audit-actor" label={s.filters.actor}>
        <Select
          id="audit-actor"
          value={actor ?? ''}
          onChange={(e) => setQuery({ actor: e.target.value || null })}
        >
          <option value="">{kit.all}</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field id="audit-verb" label={s.filters.action}>
        <Select
          id="audit-verb"
          value={verb ?? ''}
          onChange={(e) => setQuery({ verb: e.target.value || null })}
        >
          <option value="">{kit.all}</option>
          {GROUPS.map((g) => (
            <option key={g} value={g}>
              {s.groups[g]}
            </option>
          ))}
        </Select>
      </Field>
      <Field id="audit-from" label={s.filters.from} error={rangeError}>
        <TextInput
          id="audit-from"
          type="date"
          dir="ltr"
          className="text-start"
          value={from ?? ''}
          onChange={(e) => setQuery({ from: e.target.value || null })}
          aria-invalid={!!rangeError}
        />
      </Field>
      <Field id="audit-to" label={s.filters.to}>
        <TextInput
          id="audit-to"
          type="date"
          dir="ltr"
          className="text-start"
          value={to ?? ''}
          onChange={(e) => setQuery({ to: e.target.value || null })}
        />
      </Field>
    </div>
  );

  if (query.isError) {
    const { error } = query;
    return (
      <ErrorState
        thing={t.errorThing}
        code={isHubError(error) ? error.code : undefined}
        requestId={isHubError(error) ? error.requestId : undefined}
        onRetry={() => void query.refetch()}
      />
    );
  }

  const rows = page;
  const exportAll = () => {
    const link = document.createElement('a');
    link.href = auditExportHref(ws, apiFilters);
    link.download = `hub-audit-${dayKey(Date.now())}.csv`;
    link.click();
    showToast({ message: s.exportStarted });
  };

  return (
    <section aria-labelledby="audit-title" className="flex flex-col gap-4">
      <SectionHeader
        id="audit-title"
        icon={ScrollText}
        title={s.title}
        aside={
          <Button disabled={rows.length === 0} onClick={exportAll}>
            <Download aria-hidden className="size-4" strokeWidth={1.75} />
            {s.export}
          </Button>
        }
      />
      <p className="flex items-start gap-2 text-body-sm text-muted-foreground">
        <Lock aria-hidden className="mt-0.5 size-3.5 shrink-0" strokeWidth={1.75} />
        {s.appendOnly}
      </p>

      {!filtersInline && (
        <Button
          className="self-start"
          aria-expanded={filtersOpen}
          aria-controls="audit-filters"
          onClick={() => setFiltersOpen((v) => !v)}
        >
          <SlidersHorizontal aria-hidden className="size-4" strokeWidth={1.75} />
          {activeFilters ? fmt(s.filtersCount, { n: num(activeFilters, locale) }) : s.filtersToggle}
        </Button>
      )}
      <div id="audit-filters" hidden={!filtersInline && !filtersOpen}>
        {filters}
      </div>
      <p role="status" className="flex flex-wrap items-center gap-x-3 text-body-sm text-muted-foreground">
        <span>{plural(rows.length, locale, s.loaded)}</span>
        {activeFilters > 0 && (
          <button
            type="button"
            onClick={clear}
            className="hit-44 rounded-sm text-primary-text underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            {s.clear}
          </button>
        )}
      </p>

      {query.isPending ? (
        <SkeletonRows count={6} withAction={false} />
      ) : rows.length === 0 ? (
        activeFilters > 0 ? (
          <EmptyState
            icon={ScrollText}
            title={s.noMatchTitle}
            action={<Button onClick={clear}>{s.clear}</Button>}
          >
            {s.noMatchBody}
          </EmptyState>
        ) : (
          <EmptyState icon={ScrollText} title={s.emptyTitle}>
            {s.emptyBody}
          </EmptyState>
        )
      ) : wide ? (
        <div data-hub-list className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full min-w-200 text-body-sm">
            <thead>
              <tr className="text-muted-foreground">
                {[s.col.time, s.col.actor, s.col.via, s.col.action, s.col.target, s.col.summary].map((h) => (
                  <th
                    key={h}
                    scope="col"
                    className="border-b border-border px-3 py-2 text-start font-medium whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
                <th scope="col" className="border-b border-border p-0">
                  <span className="sr-only">{s.col.more}</span>
                </th>
              </tr>
            </thead>
            {days.map(([day, group]) => (
              <tbody key={day}>
                <tr>
                  <th
                    colSpan={7}
                    scope="rowgroup"
                    className="border-b border-border bg-muted px-3 py-1 text-start text-body-sm font-medium text-foreground"
                  >
                    {longDate(group[0]?.createdAt ?? '', locale)}
                  </th>
                </tr>
                {group.map((r) => (
                  <Fragment key={r.id}>
                    <tr
                      {...list.rowProps(r.id)}
                      className={cn('border-b border-border align-top last:border-b-0', rowFocus)}
                    >
                      <td className="px-3 py-2 whitespace-nowrap text-muted-foreground tabular-nums">
                        <Ltr>{time(r.createdAt, locale)}</Ltr>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <Actor row={r} />
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">
                        {s.via[r.via as keyof typeof s.via] ?? r.via}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <code dir="ltr" translate="no" className="key text-caption text-foreground">
                          {r.action}
                        </code>
                      </td>
                      <td className="px-3 py-2">
                        <Target row={r} />
                      </td>
                      <td className="px-3 py-2 text-foreground">
                        <Bidi>{r.summary}</Bidi>
                      </td>
                      <td className="py-1.5 pe-2">
                        <ExpandButton
                          open={open === r.id}
                          label={fmt(s.expand, { action: r.action })}
                          onClick={() => toggle(r.id)}
                        />
                      </td>
                    </tr>
                    {open === r.id && (
                      <tr className="border-b border-border bg-muted">
                        <td colSpan={7} className="px-3 py-2">
                          <RowDetail row={r} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            ))}
          </table>
        </div>
      ) : (
        <div data-hub-list className="flex flex-col gap-3">
          {days.map(([day, group]) => (
            <section
              key={day}
              aria-label={longDate(group[0]?.createdAt ?? '', locale)}
              className="overflow-hidden rounded-lg border border-border bg-card"
            >
              <h3 className="border-b border-border bg-muted px-3 py-1 text-body-sm font-medium text-foreground">
                {longDate(group[0]?.createdAt ?? '', locale)}
              </h3>
              <ol className="flex flex-col divide-y divide-border">
                {group.map((r) => (
                  <li key={r.id} {...list.rowProps(r.id)} className={cn('py-2 ps-3 pe-1', rowFocus)}>
                    <div className="flex items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="flex flex-wrap items-baseline gap-x-2">
                          <Ltr className="text-body-sm text-muted-foreground tabular-nums">
                            {time(r.createdAt, locale)}
                          </Ltr>
                          <code
                            dir="ltr"
                            translate="no"
                            className="key text-caption break-all text-foreground"
                          >
                            {r.action}
                          </code>
                        </p>
                        <p className="mt-0.5 text-body-sm text-foreground">
                          <Bidi>{r.summary}</Bidi>
                        </p>
                        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-2">
                          <Actor row={r} />
                          <span className="text-body-sm text-muted-foreground">
                            {s.via[r.via as keyof typeof s.via] ?? r.via}
                          </span>
                          {r.targetId && <Target row={r} />}
                        </div>
                      </div>
                      <ExpandButton
                        open={open === r.id}
                        label={fmt(s.expand, { action: r.action })}
                        onClick={() => toggle(r.id)}
                      />
                    </div>
                    {open === r.id && (
                      <div className="mt-2 me-2 rounded-md bg-muted p-2">
                        <RowDetail row={r} />
                      </div>
                    )}
                  </li>
                ))}
              </ol>
            </section>
          ))}
        </div>
      )}
      {query.hasNextPage && (
        <Button
          className="self-center"
          busy={query.isFetchingNextPage}
          onClick={() => void query.fetchNextPage()}
        >
          {s.moreOlder}
        </Button>
      )}
    </section>
  );
}
