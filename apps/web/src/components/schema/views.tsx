'use client';

/**
 * @file views.tsx
 * @description Schema Studio's other three views (docs/17 §4). The dictionary: every column as a row, searchable and filterable, named in place, exported as Markdown, shown a page at a
 * time with how many are shown of how many (review M11). The enums: each list with its values, named one by one. The history, in the side panel: each version of the design with
 * what changed, and the drafts that were applied or discarded with Claude's review.
 */
import type { SchemaChangeSummary, SchemaDraftDto } from '@hub/contracts';
import { changeCount } from '@hub/contracts';
import { motion, type MotionStyle } from 'framer-motion';
import {
  CheckCircle2,
  Download,
  GitCommitHorizontal,
  History,
  ListTree,
  Search,
  XCircle,
} from 'lucide-react';
import { useDeferredValue, useEffect, useMemo, useState } from 'react';

import {
  Button,
  cn,
  detectSecret,
  EmptyState,
  fmt,
  MarkdownView,
  num,
  plural,
  RelativeTime,
  Select,
  showToast,
  SkeletonRows,
  TextInput,
  useLocale,
} from '@/components/kit';
import { useAnnotate, useSchemaHistory } from '@/features/schema/queries';
import { isHubError } from '@/lib/api/errors';

import { dictionaryMarkdown, enumTarget, fieldTarget, modelTarget, toneStyle } from './model';
import { useSchemaWords, useStudio } from './studio';

/** Rows shown at once; "Show more" adds as many again. */
export const PAGE_ROWS = 600;

/** The Arabic name in place. A refused save keeps what was typed and says why (review M12); a secret is never sent. */
function InlineName({ target, placeholder, label }: { target: string; placeholder: string; label: string }) {
  const studio = useStudio();
  const t = useSchemaWords();
  const annotate = useAnnotate();
  const current = studio.annotations.get(target)?.nameAr ?? '';
  const [text, setText] = useState<string | null>(null);
  return (
    <TextInput
      aria-label={label}
      dir="rtl"
      className="h-9 md:h-8"
      placeholder={placeholder}
      value={text ?? current}
      readOnly={!studio.can.annotate}
      aria-invalid={annotate.isError || undefined}
      onChange={(event) => setText(event.target.value)}
      onBlur={() => {
        if (text === null || text.trim() === current) {
          setText(null);
          return;
        }
        const found = detectSecret(text);
        if (found) {
          showToast({ tone: 'error', message: fmt(t.inspector.secret, { pattern: found }) });
          return;
        }
        annotate.mutate([{ target, nameAr: text.trim() || null }], {
          onSuccess: () => setText(null),
          onError: (error) =>
            showToast({
              tone: 'error',
              message: isHubError(error)
                ? fmt(t.inspector.saveFailedWhy, { why: error.message })
                : t.inspector.saveFailed,
            }),
        });
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter') (event.target as HTMLInputElement).blur();
      }}
    />
  );
}

export function DictionaryView() {
  const studio = useStudio();
  const t = useSchemaWords();
  const locale = useLocale();
  const [query, setQuery] = useState('');
  const [domain, setDomain] = useState('');
  const [unnamedOnly, setUnnamedOnly] = useState(false);
  const [limit, setLimit] = useState(PAGE_ROWS);
  const deferred = useDeferredValue(query.trim().toLowerCase());
  useEffect(() => setLimit(PAGE_ROWS), [domain, unnamedOnly, deferred]);

  const rows = useMemo(() => {
    const out: {
      model: string;
      field: string;
      type: string;
      domain: string;
      descriptionAr: string | null;
      doc: string | null;
    }[] = [];
    for (const model of studio.doc.models) {
      if (domain && model.domain !== domain) continue;
      for (const field of model.fields) {
        const entry = studio.annotations.get(fieldTarget(model.name, field.name));
        if (unnamedOnly && entry?.nameAr) continue;
        if (deferred) {
          const hay =
            `${model.name} ${field.name} ${field.type} ${entry?.nameAr ?? ''} ${entry?.descriptionAr ?? ''} ${studio.annotations.get(modelTarget(model.name))?.nameAr ?? ''}`.toLowerCase();
          if (!hay.includes(deferred)) continue;
        }
        out.push({
          model: model.name,
          field: field.name,
          type: field.type,
          domain: model.domain,
          descriptionAr: entry?.descriptionAr ?? null,
          doc: field.doc,
        });
      }
    }
    return out;
  }, [studio.doc, studio.annotations, domain, unnamedOnly, deferred]);

  const exportMarkdown = () => {
    const text = dictionaryMarkdown(
      studio.doc,
      studio.annotations,
      `${t.title} · ${studio.data.source?.name ?? ''}`,
    );
    const url = URL.createObjectURL(new Blob([text], { type: 'text/markdown;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `${studio.data.source?.name ?? 'schema'}-dictionary.md`;
    link.click();
    URL.revokeObjectURL(url);
    showToast({ message: t.toasts.exported, tone: 'success' });
  };

  return (
    <div className="schema-scroll">
      <div className="schema-view-bar">
        <div className="relative min-w-0 flex-1 md:max-w-80">
          <Search
            aria-hidden
            className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            strokeWidth={1.75}
          />
          <TextInput
            aria-label={t.dictionary.search}
            placeholder={t.dictionary.search}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="ps-9"
          />
        </div>
        <Select
          aria-label={t.dictionary.domain}
          value={domain}
          onChange={(event) => setDomain(event.target.value)}
          className="w-auto"
        >
          <option value="">{t.dictionary.allDomains}</option>
          {studio.doc.domains.map((entry) => (
            <option key={entry.name} value={entry.name}>
              {entry.name}
            </option>
          ))}
        </Select>
        <label className="schema-toggle">
          <input
            type="checkbox"
            checked={unnamedOnly}
            onChange={(event) => setUnnamedOnly(event.target.checked)}
          />
          <span>{t.dictionary.unnamedOnly}</span>
        </label>
        <span className="text-body-sm text-muted-foreground" role="status" data-dictionary-count>
          {rows.length > limit
            ? fmt(t.dictionary.showing, { shown: num(limit, locale), total: num(rows.length, locale) })
            : plural(rows.length, locale, t.dictionary.count)}
        </span>
        <span className="flex-1" />
        <Button size="sm" variant="outline" onClick={exportMarkdown}>
          <Download aria-hidden className="size-4" strokeWidth={1.75} />
          {t.actions.exportMarkdown}
        </Button>
      </div>
      {rows.length === 0 ? (
        <EmptyState icon={ListTree} title={t.dictionary.empty} />
      ) : (
        <div className="schema-table-wrap">
          <table className="schema-table">
            <thead>
              <tr>
                <th>{t.dictionary.table}</th>
                <th>{t.dictionary.column}</th>
                <th>{t.dictionary.type}</th>
                <th>{t.dictionary.nameAr}</th>
                <th className="hidden lg:@page-lg:table-cell">{t.dictionary.descriptionAr}</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, limit).map((row) => (
                <tr key={`${row.model}.${row.field}`} style={toneStyle(studio.tones.get(row.domain))}>
                  <td>
                    <button
                      type="button"
                      className="schema-link"
                      onClick={() => {
                        studio.select({ kind: 'model', name: row.model, field: row.field }, { focus: true });
                      }}
                    >
                      <span className="schema-node-dot" aria-hidden />
                      <span dir="ltr" className="font-mono">
                        {row.model}
                      </span>
                    </button>
                  </td>
                  <td className="font-mono text-foreground" dir="ltr">
                    {row.field}
                  </td>
                  <td className="font-mono text-muted-foreground" dir="ltr">
                    {row.type}
                  </td>
                  <td className="min-w-48">
                    <InlineName
                      target={fieldTarget(row.model, row.field)}
                      placeholder={t.node.unnamed}
                      label={fmt(t.dictionary.nameOf, { column: `${row.model}.${row.field}` })}
                    />
                  </td>
                  <td
                    className="hidden max-w-96 truncate text-muted-foreground lg:@page-lg:table-cell"
                    title={row.descriptionAr ?? row.doc ?? ''}
                  >
                    {row.descriptionAr ??
                      (row.doc && (
                        <span className="font-mono" dir="ltr">
                          /// {row.doc}
                        </span>
                      ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length > limit && (
            <div className="flex flex-wrap items-center gap-3 px-1 py-4 text-body-sm text-muted-foreground">
              <span>{t.dictionary.moreHint}</span>
              <Button size="sm" variant="outline" onClick={() => setLimit((value) => value + PAGE_ROWS)}>
                {fmt(t.dictionary.showMore, { n: num(Math.min(PAGE_ROWS, rows.length - limit), locale) })}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function EnumsView() {
  const studio = useStudio();
  const t = useSchemaWords();
  const locale = useLocale();
  const [query, setQuery] = useState('');
  const deferred = useDeferredValue(query.trim().toLowerCase());
  const enums = studio.doc.enums.filter(
    (value) =>
      !deferred ||
      `${value.name} ${value.values.map((item) => item.name).join(' ')} ${studio.annotations.get(enumTarget(value.name))?.nameAr ?? ''}`
        .toLowerCase()
        .includes(deferred),
  );
  return (
    <div className="schema-scroll">
      <div className="schema-view-bar">
        <div className="relative min-w-0 flex-1 md:max-w-80">
          <Search
            aria-hidden
            className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            strokeWidth={1.75}
          />
          <TextInput
            aria-label={t.enums.search}
            placeholder={t.enums.search}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="ps-9"
          />
        </div>
      </div>
      {enums.length === 0 ? (
        <EmptyState icon={ListTree} title={studio.doc.enums.length === 0 ? t.enums.none : t.enums.empty} />
      ) : (
        <div className="schema-enum-grid">
          {enums.map((value, index) => {
            const name = studio.annotations.get(enumTarget(value.name))?.nameAr;
            return (
              <motion.button
                type="button"
                key={value.name}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(index, 20) * 0.015, duration: 0.2 }}
                className={cn('schema-enum-card', studio.selection?.name === value.name && 'is-active')}
                style={toneStyle(studio.tones.get(value.domain)) as MotionStyle}
                onClick={() => studio.select({ kind: 'enum', name: value.name }, { focus: true })}
              >
                <span className="flex items-center gap-2">
                  <span className="schema-node-dot" aria-hidden />
                  <span className="min-w-0 flex-1 truncate text-start font-semibold text-foreground">
                    {name ?? value.name}
                  </span>
                  <span className="shrink-0 text-caption text-muted-foreground">
                    {plural(value.values.length, locale, t.enums.values)}
                  </span>
                </span>
                {name && (
                  <span
                    className="block truncate text-start font-mono text-caption text-muted-foreground"
                    dir="ltr"
                  >
                    {value.name}
                  </span>
                )}
                <span className="mt-2 flex flex-wrap gap-1" dir="ltr">
                  {value.values.slice(0, 8).map((item) => (
                    <span key={item.name} className="schema-chip">
                      {studio.annotations.get(`enumValue:${value.name}.${item.name}`)?.nameAr ?? item.name}
                    </span>
                  ))}
                  {value.values.length > 8 && <span className="schema-chip">+{value.values.length - 8}</span>}
                </span>
              </motion.button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ChangeChips({ changes }: { changes: SchemaChangeSummary | null }) {
  const t = useSchemaWords();
  const locale = useLocale();
  if (!changes) return <span className="text-body-sm text-muted-foreground">{t.history.first}</span>;
  if (changeCount(changes) === 0)
    return <span className="text-body-sm text-muted-foreground">{t.history.unchanged}</span>;
  const groups: [string, string[], 'added' | 'removed' | 'changed'][] = [
    [t.history.groups.addedModels, changes.addedModels, 'added'],
    [t.history.groups.removedModels, changes.removedModels, 'removed'],
    [t.history.groups.changedModels, changes.changedModels, 'changed'],
    [t.history.groups.addedFields, changes.addedFields, 'added'],
    [t.history.groups.removedFields, changes.removedFields, 'removed'],
    [t.history.groups.changedFields, changes.changedFields, 'changed'],
    [t.history.groups.addedEnums, changes.addedEnums, 'added'],
    [t.history.groups.changedEnums, [...changes.changedEnums, ...changes.removedEnums], 'changed'],
  ];
  return (
    <div className="flex flex-col gap-1.5">
      {groups
        .filter(([, list]) => list.length > 0)
        .map(([label, list, kind]) => (
          <div key={label} className="flex flex-wrap items-baseline gap-1.5">
            <span className="schema-chip" data-mark={kind}>
              {fmt(label, { n: num(list.length, locale) })}
            </span>
            <span
              className="min-w-0 truncate font-mono text-caption text-muted-foreground"
              dir="ltr"
              title={list.join(', ')}
            >
              {list.slice(0, 6).join(', ')}
              {list.length > 6 ? '…' : ''}
            </span>
          </div>
        ))}
    </div>
  );
}

function ClosedDraft({ draft }: { draft: SchemaDraftDto }) {
  const t = useSchemaWords();
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const Icon = draft.status === 'applied' ? CheckCircle2 : XCircle;
  return (
    <li className="schema-history-item">
      <Icon
        aria-hidden
        className={cn(
          'mt-0.5 size-4 shrink-0',
          draft.status === 'applied' ? 'text-success-soft-foreground' : 'text-muted-foreground',
        )}
        strokeWidth={1.75}
      />
      <div className="min-w-0 flex-1">
        <p className="font-medium text-foreground">{draft.title}</p>
        <p className="text-body-sm text-muted-foreground">
          {t.draft.statuses[draft.status]} · {plural(draft.changes.length, locale, t.draft.count)} ·{' '}
          <RelativeTime iso={draft.updatedAt} />
        </p>
        {draft.review && (
          <>
            <button
              type="button"
              className="schema-link mt-1 text-body-sm"
              onClick={() => setOpen((value) => !value)}
              aria-expanded={open}
            >
              {t.history.review}
            </button>
            {open && (
              <div className="mt-2 rounded-md border border-border bg-muted p-3">
                <MarkdownView source={draft.review} />
              </div>
            )}
          </>
        )}
      </div>
    </li>
  );
}

/** The design's versions and the closed drafts, in the side panel's Overview tab. */
export function HistoryList() {
  const studio = useStudio();
  const t = useSchemaWords();
  const history = useSchemaHistory(true);
  const closed = studio.data.drafts.filter(
    (draft) => draft.status === 'applied' || draft.status === 'discarded',
  );
  return (
    <>
      <section className="flex flex-col gap-3">
        <h3 className="schema-panel-heading">
          <History aria-hidden className="size-4" strokeWidth={1.75} />
          {t.history.title}
        </h3>
        {history.isPending ? (
          <SkeletonRows count={3} />
        ) : (
          <ol className="schema-timeline">
            {(history.data?.snapshots ?? []).slice(0, 12).map((snapshot, index) => (
              <li key={snapshot.id} className="schema-timeline-item" data-current={index === 0 || undefined}>
                <span className="schema-timeline-dot" aria-hidden>
                  <GitCommitHorizontal className="size-3.5" strokeWidth={2} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-x-2 text-caption text-muted-foreground">
                    <span className="font-medium text-foreground">
                      {t.history.triggers[snapshot.trigger]}
                    </span>
                    {snapshot.takenBy && <span>{fmt(t.history.by, { name: snapshot.takenBy })}</span>}
                    <RelativeTime iso={snapshot.createdAt} />
                    <span className="font-mono" dir="ltr">
                      {snapshot.hash.slice(0, 8)}
                    </span>
                  </p>
                  <div className="mt-1.5">
                    <ChangeChips changes={snapshot.changes} />
                  </div>
                </div>
              </li>
            ))}
          </ol>
        )}
        {history.data && history.data.snapshots.length <= 1 && (
          <p className="text-body-sm text-muted-foreground">{t.history.empty}</p>
        )}
      </section>
      <section className="flex flex-col gap-3">
        <h3 className="schema-panel-heading">{t.history.drafts}</h3>
        {closed.length === 0 ? (
          <p className="text-body-sm text-muted-foreground">{t.history.noDrafts}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {closed.map((draft) => (
              <ClosedDraft key={draft.id} draft={draft} />
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
