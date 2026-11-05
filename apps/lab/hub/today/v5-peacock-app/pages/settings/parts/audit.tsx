import { Fragment, useMemo, useState } from 'react';
import { ChevronDown, Download, Lock, ScrollText, SlidersHorizontal } from 'lucide-react';
import { useLocale, useT } from '@lab/i18n';
import { NOW, members } from '@lab/mocks/hub-app';
import { auditActionGroups, type AuditRow, type AuditVia } from '@lab/mocks/hub-app/settings';
import { ActorChip, Bidi, Button, CardChip, cardsActedWith, cn, dayKey, EmptyState, Field, fmt, kitMessages, longDate, Ltr, num, plural, SectionHeader, Select, setQuery, showToast, TextInput, time, useAdmin, useCardStoreVersion, useFilter, useKeyboardList, useMedia, useSession, type CardAction } from '../../../kit';
import { messages } from '../i18n';
import { rowFocus } from './shared';

const PAGE = 20;
const VIA: AuditVia[] = ['web', 'mcp', 'hook', 'adapter', 'scheduler', 'telegram'];
const ACTED: CardAction[] = ['decide', 'withdraw', 'deliver', 'start', 'verify', 'cancel', 'acknowledge', 'apply', 'dismiss', 'approve', 'reject', 'request_changes', 'claim', 'unclaim', 'submit', 'done'];

/** Actions taken in the card sheet this session, as the API would log them (09 §18.7: deciding writes `cards.decide`). */
function useSessionCardRows(memberId: string, doneText: Record<CardAction, string>, doneEn: Record<CardAction, string>): AuditRow[] {
  useCardStoreVersion();
  return ACTED.flatMap((action) =>
    cardsActedWith(action).map(
      (card): AuditRow => ({
        id: `card-${card.key}-${action}`,
        actorKind: 'user',
        actorId: memberId,
        via: 'web',
        action: `cards.${action}`,
        targetType: 'card',
        targetId: card.key,
        summary: { ar: fmt(doneText[action], { key: card.key }), en: fmt(doneEn[action], { key: card.key }) },
        ip: '10.20.0.14',
        userAgent: 'Chrome 141 on Windows',
        createdAt: NOW,
      }),
    ),
  );
}

const csvCell = (value: string | null) => `"${(value ?? '').replaceAll('"', '""')}"`;

/** Same columns and BOM as `GET …/audit?format=csv` (04 §3.23), built from the rows the filters left. */
function downloadCsv(rows: AuditRow[], locale: 'ar' | 'en') {
  const name = (r: AuditRow) => (r.actorId ? (members.find((m) => m.id === r.actorId)?.name[locale] ?? '') : (r.adapter ?? ''));
  const lines = [
    'id,createdAt,actorKind,actorId,actorName,via,action,targetType,targetId,summary,ip',
    ...rows.map((r) => [r.id, r.createdAt, r.actorKind, r.actorId, name(r), r.via, r.action, r.targetType, r.targetId, r.summary[locale], r.ip].map(csvCell).join(',')),
  ];
  const url = URL.createObjectURL(new Blob([`﻿${lines.join('\n')}`], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `hub-audit-${dayKey(NOW)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function Actor({ row }: { row: AuditRow }) {
  return <ActorChip kind={row.actorKind} memberId={row.actorId ?? undefined} adapter={row.adapter} />;
}

function Target({ row }: { row: AuditRow }) {
  const locale = useLocale();
  if (!row.targetId) return <span className="text-muted-foreground">-</span>;
  if (row.targetType === 'card') return <CardChip k={row.targetId} />;
  const member = row.targetType === 'member' ? members.find((m) => m.id === row.targetId) : undefined;
  if (member) return <span className="text-body-sm text-foreground">{member.name[locale]}</span>;
  if (row.targetType === 'member') return <Ltr mono className="text-caption text-muted-foreground">{row.targetId}</Ltr>;
  return (
    <code dir="ltr" translate="no" title={row.targetId} className="key text-caption wrap-anywhere text-foreground">
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
  const t = useT(messages);
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
      <ChevronDown aria-hidden className={cn('size-4 transition-transform duration-150 motion-reduce:transition-none', open && 'rotate-180')} strokeWidth={1.75} />
    </button>
  );
}

export function AuditTab() {
  const t = useT(messages);
  const kit = useT(kitMessages);
  const locale = useLocale();
  const { scenario, me } = useSession();
  const { audit } = useAdmin(scenario);
  const s = t.audit;
  // Six columns need the room of a laptop. Tablet and phone read the same rows as a compact ledger.
  const wide = useMedia('(min-width: 1024px)');
  const filtersInline = useMedia('(min-width: 768px)');
  const actor = useFilter('actor');
  // Not `action`: the card sheet owns that param. It maps to the API's `action` prefix.
  const verb = useFilter('verb');
  const via = useFilter('via');
  const from = useFilter('from');
  const to = useFilter('to');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [shown, setShown] = useState(PAGE);
  const [open, setOpen] = useState<string | null>(null);

  const ar = kitMessages.ar.done;
  const en = kitMessages.en.done;
  const sessionRows = useSessionCardRows(me.id, ar, en);

  const rows = useMemo(() => {
    return [...sessionRows, ...audit].filter((r) => {
      if (actor && (actor === 'system' ? r.actorKind !== 'system' : r.actorId !== actor)) return false;
      if (verb && !r.action.startsWith(`${verb}.`)) return false;
      if (via && r.via !== via) return false;
      const day = dayKey(r.createdAt);
      if (from && day < from) return false;
      if (to && day > to) return false;
      return true;
    });
  }, [sessionRows, audit, actor, verb, via, from, to]);

  const page = rows.slice(0, shown);
  const days = useMemo(() => {
    const groups = new Map<string, AuditRow[]>();
    page.forEach((r) => groups.set(dayKey(r.createdAt), [...(groups.get(dayKey(r.createdAt)) ?? []), r]));
    return [...groups.entries()];
  }, [page]);

  const toggle = (id: string) => setOpen((current) => (current === id ? null : id));
  const list = useKeyboardList({ ids: page.map((r) => r.id), onOpen: toggle });
  const activeFilters = [actor, verb, via, from, to].filter(Boolean).length;
  const clear = () => setQuery({ actor: null, verb: null, via: null, from: null, to: null });
  const rangeError = from && to && from > to ? s.rangeInvalid : undefined;

  const filters = (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-[repeat(3,minmax(0,1fr))_auto_auto] md:items-start">
      <Field id="audit-actor" label={s.filters.actor}>
        <Select id="audit-actor" value={actor ?? ''} onChange={(e) => setQuery({ actor: e.target.value || null })}>
          <option value="">{kit.all}</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name[locale]}
            </option>
          ))}
          <option value="system">{kit.actor.system}</option>
        </Select>
      </Field>
      <Field id="audit-verb" label={s.filters.action}>
        <Select id="audit-verb" value={verb ?? ''} onChange={(e) => setQuery({ verb: e.target.value || null })}>
          <option value="">{kit.all}</option>
          {auditActionGroups.map((g) => (
            <option key={g} value={g}>
              {s.groups[g]}
            </option>
          ))}
        </Select>
      </Field>
      <Field id="audit-via" label={s.filters.via} className="col-span-2 md:col-span-1">
        <Select id="audit-via" value={via ?? ''} onChange={(e) => setQuery({ via: e.target.value || null })}>
          <option value="">{kit.all}</option>
          {VIA.map((v) => (
            <option key={v} value={v}>
              {s.via[v]}
            </option>
          ))}
        </Select>
      </Field>
      <Field id="audit-from" label={s.filters.from} error={rangeError}>
        <TextInput id="audit-from" type="date" dir="ltr" className="text-start" value={from ?? ''} onChange={(e) => setQuery({ from: e.target.value || null })} aria-invalid={!!rangeError} />
      </Field>
      <Field id="audit-to" label={s.filters.to}>
        <TextInput id="audit-to" type="date" dir="ltr" className="text-start" value={to ?? ''} onChange={(e) => setQuery({ to: e.target.value || null })} />
      </Field>
    </div>
  );

  return (
    <section aria-labelledby="audit-title" className="flex flex-col gap-4">
      <SectionHeader
        id="audit-title"
        icon={ScrollText}
        title={s.title}
        aside={
          <Button
            disabled={rows.length === 0}
            onClick={() => {
              downloadCsv(rows, locale);
              showToast({ message: plural(rows.length, locale, s.exported) });
            }}
          >
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
        <Button className="self-start" aria-expanded={filtersOpen} aria-controls="audit-filters" onClick={() => setFiltersOpen((v) => !v)}>
          <SlidersHorizontal aria-hidden className="size-4" strokeWidth={1.75} />
          {activeFilters ? fmt(s.filtersCount, { n: num(activeFilters, locale) }) : s.filtersToggle}
        </Button>
      )}
      <div id="audit-filters" hidden={!filtersInline && !filtersOpen}>
        {filters}
      </div>
      <p role="status" className="flex flex-wrap items-center gap-x-3 text-body-sm text-muted-foreground">
        <span>{plural(rows.length, locale, s.count)}</span>
        {activeFilters > 0 && (
          <button type="button" onClick={clear} className="hit-44 rounded-sm text-primary-text underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
            {s.clear}
          </button>
        )}
      </p>

      {rows.length === 0 ? (
        activeFilters > 0 ? (
          <EmptyState icon={ScrollText} title={s.noMatchTitle} action={<Button onClick={clear}>{s.clear}</Button>}>
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
                  <th key={h} scope="col" className="border-b border-border px-3 py-2 text-start font-medium whitespace-nowrap">
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
                  <th colSpan={7} scope="rowgroup" className="border-b border-border bg-muted px-3 py-1 text-start text-body-sm font-medium text-foreground">
                    {longDate(group[0].createdAt, locale)}
                  </th>
                </tr>
                {group.map((r) => (
                  <Fragment key={r.id}>
                    <tr {...list.rowProps(r.id)} className={cn('border-b border-border align-top last:border-b-0', rowFocus)}>
                      <td className="px-3 py-2 whitespace-nowrap text-muted-foreground tabular-nums">
                        <Ltr>{time(r.createdAt, locale)}</Ltr>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <Actor row={r} />
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">{s.via[r.via]}</td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <code dir="ltr" translate="no" className="key text-caption text-foreground">
                          {r.action}
                        </code>
                      </td>
                      <td className="px-3 py-2">
                        <Target row={r} />
                      </td>
                      <td className="px-3 py-2 text-foreground">
                        <Bidi>{r.summary[locale]}</Bidi>
                      </td>
                      <td className="py-1.5 pe-2">
                        <ExpandButton open={open === r.id} label={fmt(s.expand, { action: r.action })} onClick={() => toggle(r.id)} />
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
            <section key={day} aria-label={longDate(group[0].createdAt, locale)} className="overflow-hidden rounded-lg border border-border bg-card">
              <h3 className="border-b border-border bg-muted px-3 py-1 text-body-sm font-medium text-foreground">{longDate(group[0].createdAt, locale)}</h3>
              <ol className="flex flex-col divide-y divide-border">
                {group.map((r) => (
                  <li key={r.id} {...list.rowProps(r.id)} className={cn('py-2 ps-3 pe-1', rowFocus)}>
                    <div className="flex items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="flex flex-wrap items-baseline gap-x-2">
                          <Ltr className="text-body-sm text-muted-foreground tabular-nums">{time(r.createdAt, locale)}</Ltr>
                          <code dir="ltr" translate="no" className="key text-caption break-all text-foreground">
                            {r.action}
                          </code>
                        </p>
                        <p className="mt-0.5 text-body-sm text-foreground">
                          <Bidi>{r.summary[locale]}</Bidi>
                        </p>
                        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-2">
                          <Actor row={r} />
                          <span className="text-body-sm text-muted-foreground">{s.via[r.via]}</span>
                          {r.targetId && <Target row={r} />}
                        </div>
                      </div>
                      <ExpandButton open={open === r.id} label={fmt(s.expand, { action: r.action })} onClick={() => toggle(r.id)} />
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
      {rows.length > shown && (
        <Button className="self-center" onClick={() => setShown((n) => n + PAGE)}>
          {fmt(s.more, { n: num(rows.length - shown, locale) })}
        </Button>
      )}
    </section>
  );
}
