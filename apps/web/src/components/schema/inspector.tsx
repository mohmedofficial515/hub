'use client';

/**
 * @file inspector.tsx
 * @description The details of what is selected (docs/17 §4): a table, a column or an enum. Its Arabic name, description, notes, tags and sensitivity are edited in place and saved as you leave a field;
 * beside them, what the files say: the `///` text, the type and attributes, the relations both ways, the indexes, and where it is written. Every part has a Propose a change.
 */
import type { SchemaAnnotationDto, SchemaEnum, SchemaField, SchemaModel, Sensitivity } from '@hub/contracts';
import { SENSITIVITIES } from '@hub/contracts';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  CircleDashed,
  Focus,
  GitPullRequestDraft,
  Link2,
  Sparkles,
  X,
} from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';

import {
  Button,
  cn,
  detectSecret,
  Field,
  fill,
  fmt,
  focusRing,
  IconButton,
  kitMessages,
  matchKey,
  RelativeTime,
  SecretFilterError,
  Select,
  showToast,
  Textarea,
  TextInput,
  Tooltip,
  useLocale,
  useT,
} from '@/components/kit';
import { useAnnotate } from '@/features/schema/queries';
import { isHubError } from '@/lib/api/errors';

import { enumTarget, enumValueTarget, fieldTarget, modelTarget, toneStyle } from './model';
import { useSchemaWords, useStudio } from './studio';

function SyncMark({ entry }: { entry: SchemaAnnotationDto | undefined }) {
  const t = useSchemaWords();
  if (!entry?.nameAr) return null;
  return entry.syncedAt ? (
    <span className="schema-chip" data-tone="success">
      <CheckCircle2 aria-hidden className="size-3.5" strokeWidth={2} />
      {t.inspector.synced}
    </span>
  ) : (
    <Tooltip content={t.inspector.unsyncedTip}>
      <span className="schema-chip" data-tone="warning" tabIndex={0}>
        <CircleDashed aria-hidden className="size-3.5" strokeWidth={2} />
        {t.inspector.unsynced}
      </span>
    </Tooltip>
  );
}

/** The Arabic name and the rest, saved on blur. One form per target; it resets when the target changes. */
function AnnotationForm({ target, compact = false }: { target: string; compact?: boolean }) {
  const studio = useStudio();
  const t = useSchemaWords();
  const annotate = useAnnotate();
  const id = useId();
  const kit = useT(kitMessages);
  const entry = studio.annotations.get(target);
  const [nameAr, setNameAr] = useState(entry?.nameAr ?? '');
  const [descriptionAr, setDescriptionAr] = useState(entry?.descriptionAr ?? '');
  const [notes, setNotes] = useState(entry?.notes ?? '');
  const [tags, setTags] = useState((entry?.tags ?? []).join('، '));
  const [secret, setSecret] = useState<string | null>(null);
  const last = useRef<Parameters<typeof annotate.mutate>[0][number] | null>(null);
  const failed = annotate.isError;

  // A save from Claude or another tab shows here, unless this field is being typed in, or a save of it was refused: then the typed text stays.
  useEffect(() => {
    const active = document.activeElement?.id ?? '';
    if (!active.startsWith(id) && !failed) {
      setNameAr(entry?.nameAr ?? '');
      setDescriptionAr(entry?.descriptionAr ?? '');
      setNotes(entry?.notes ?? '');
      setTags((entry?.tags ?? []).join('، '));
    }
  }, [entry, id, failed]);

  const readOnly = !studio.can.annotate;
  const save = (change: Parameters<typeof annotate.mutate>[0][number]) => {
    if (readOnly) return;
    const found = Object.values(change)
      .flat()
      .map((value) => (typeof value === 'string' ? detectSecret(value) : null))
      .find(Boolean);
    setSecret(found ?? null);
    if (found) return;
    last.current = change;
    annotate.mutate([change]);
  };
  const commit = (key: 'nameAr' | 'descriptionAr' | 'notes', value: string) => {
    const before = entry?.[key] ?? '';
    if (value.trim() === before.trim()) return;
    save({ target, [key]: value.trim() || null });
  };

  return (
    <div className="flex flex-col gap-3">
      <Field id={`${id}-name`} label={t.inspector.nameAr} hint={compact ? undefined : t.inspector.nameArHint}>
        <TextInput
          id={`${id}-name`}
          dir="rtl"
          value={nameAr}
          readOnly={readOnly}
          maxLength={120}
          onChange={(event) => setNameAr(event.target.value)}
          onBlur={() => commit('nameAr', nameAr)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') (event.target as HTMLInputElement).blur();
          }}
        />
      </Field>
      <Field
        id={`${id}-desc`}
        label={t.inspector.descriptionAr}
        hint={compact ? undefined : t.inspector.descriptionArHint}
      >
        <Textarea
          id={`${id}-desc`}
          dir="rtl"
          rows={compact ? 2 : 3}
          value={descriptionAr}
          readOnly={readOnly}
          maxLength={2000}
          onChange={(event) => setDescriptionAr(event.target.value)}
          onBlur={() => commit('descriptionAr', descriptionAr)}
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field id={`${id}-sens`} label={t.inspector.sensitivity}>
          <Select
            id={`${id}-sens`}
            value={entry?.sensitivity ?? 'none'}
            disabled={readOnly}
            onChange={(event) => save({ target, sensitivity: event.target.value as Sensitivity })}
          >
            {SENSITIVITIES.map((value) => (
              <option key={value} value={value}>
                {t.inspector.sensitivities[value]}
              </option>
            ))}
          </Select>
        </Field>
        <Field id={`${id}-tags`} label={t.inspector.tags}>
          <TextInput
            id={`${id}-tags`}
            value={tags}
            readOnly={readOnly}
            placeholder={t.inspector.tagsHint}
            onChange={(event) => setTags(event.target.value)}
            onBlur={() => {
              const list = tags
                .split(/[,،]/)
                .map((tag) => tag.trim())
                .filter(Boolean)
                .slice(0, 12);
              if (list.join('|') !== (entry?.tags ?? []).join('|')) save({ target, tags: list });
            }}
          />
        </Field>
      </div>
      {!compact && (
        <Field id={`${id}-notes`} label={t.inspector.notes} hint={t.inspector.notesHint}>
          <Textarea
            id={`${id}-notes`}
            rows={3}
            value={notes}
            readOnly={readOnly}
            maxLength={4000}
            onChange={(event) => setNotes(event.target.value)}
            onBlur={() => commit('notes', notes)}
          />
        </Field>
      )}
      {secret && <SecretFilterError pattern={secret} />}
      <div
        className="flex min-h-6 flex-wrap items-center gap-2 text-caption text-muted-foreground"
        aria-live="polite"
      >
        {annotate.isPending ? t.inspector.saving : annotate.isSuccess ? t.inspector.saved : null}
        {failed && (
          <span
            className="flex flex-wrap items-center gap-2 text-destructive-soft-foreground"
            data-annotation-failed
          >
            {isHubError(annotate.error)
              ? fmt(t.inspector.saveFailedWhy, { why: annotate.error.message })
              : t.inspector.saveFailed}
            <Button size="sm" variant="ghost" onClick={() => last.current && annotate.mutate([last.current])}>
              {kit.retry}
            </Button>
          </span>
        )}
        <SyncMark entry={entry} />
        {entry?.updatedBy && (
          <span>
            {fill(t.inspector.updatedBy, {
              name: <bdi>{entry.updatedBy}</bdi>,
              when: <RelativeTime iso={entry.updatedAt} />,
            })}
          </span>
        )}
      </div>
      {readOnly && <p className="text-body-sm text-muted-foreground">{t.inspector.readOnly}</p>}
    </div>
  );
}

function FromFiles({ doc, comment }: { doc: string | null; comment: string | null }) {
  const t = useSchemaWords();
  return (
    <section className="flex flex-col gap-1.5">
      <h3 className="text-caption font-semibold tracking-wide text-muted-foreground uppercase">
        {t.inspector.fromFiles}
      </h3>
      {doc || comment ? (
        <div className="schema-code" dir="ltr">
          {doc && <p className="whitespace-pre-wrap text-foreground">/// {doc}</p>}
          {comment && <p className="whitespace-pre-wrap text-muted-foreground">// {comment}</p>}
        </div>
      ) : (
        <p className="text-body-sm text-muted-foreground">{t.inspector.noDoc}</p>
      )}
    </section>
  );
}

function Facts({ rows }: { rows: [string, string | null | undefined][] }) {
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-body-sm">
      {rows
        .filter(([, value]) => value)
        .map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="min-w-0 truncate font-mono text-foreground" dir="ltr" title={value ?? ''}>
              {value}
            </dd>
          </div>
        ))}
    </dl>
  );
}

function Relations({ model }: { model: SchemaModel }) {
  const studio = useStudio();
  const t = useSchemaWords();
  const locale = useLocale();
  const Arrow = locale === 'ar' ? ArrowLeft : ArrowRight;
  const outgoing = studio.doc.relations.filter((relation) => relation.from === model.name);
  const incoming = studio.doc.relations.filter(
    (relation) => relation.to === model.name && relation.from !== model.name,
  );
  if (outgoing.length === 0 && incoming.length === 0)
    return <p className="text-body-sm text-muted-foreground">{t.inspector.noRelations}</p>;
  const row = (other: string, field: string, relation: (typeof outgoing)[number]) => {
    const name = studio.annotations.get(modelTarget(other))?.nameAr;
    return (
      <li key={relation.id}>
        <button
          type="button"
          className="schema-list-button"
          onClick={() => {
            studio.select({ kind: 'model', name: other });
            studio.revealModel(other);
          }}
        >
          <Link2
            aria-hidden
            className={cn(
              'size-3.5 shrink-0',
              relation.implied ? 'text-muted-foreground' : 'text-info-soft-foreground',
            )}
            strokeWidth={2}
          />
          <span className="min-w-0 flex-1 truncate text-start">
            <span className="font-mono" dir="ltr">
              {field}
            </span>
            <Arrow aria-hidden className="mx-1 inline size-3" strokeWidth={2} />
            <span className="font-mono" dir="ltr">
              {other}
            </span>
            {name && <span className="ms-1 text-muted-foreground">· {name}</span>}
          </span>
          <span className="shrink-0 text-caption text-muted-foreground">
            {relation.implied
              ? t.inspector.impliedRelation
              : relation.cardinality === 'one_to_one'
                ? t.inspector.oneToOne
                : t.inspector.manyToOne}
          </span>
        </button>
      </li>
    );
  };
  return (
    <div className="flex flex-col gap-3">
      {outgoing.length > 0 && (
        <section className="flex flex-col gap-1">
          <h3 className="text-caption font-semibold text-muted-foreground">{t.inspector.outgoing}</h3>
          <ul className="flex flex-col">
            {outgoing.map((relation) => row(relation.to, relation.fromField, relation))}
          </ul>
        </section>
      )}
      {incoming.length > 0 && (
        <section className="flex flex-col gap-1">
          <h3 className="text-caption font-semibold text-muted-foreground">{t.inspector.incoming}</h3>
          <ul className="flex flex-col">
            {incoming.map((relation) => row(relation.from, relation.fromField, relation))}
          </ul>
        </section>
      )}
    </div>
  );
}

type Tab = 'overview' | 'fields' | 'relations' | 'prisma';

function ModelInspector({ model }: { model: SchemaModel }) {
  const studio = useStudio();
  const t = useSchemaWords();
  const [tab, setTab] = useState<Tab>('overview');
  const field = studio.selection?.field
    ? model.fields.find((entry) => entry.name === studio.selection?.field)
    : undefined;
  useEffect(() => setTab('overview'), [model.name]);

  if (field) return <FieldInspector model={model} field={field} />;
  const named = studio.annotations.get(modelTarget(model.name))?.nameAr;
  const tabs: [Tab, string][] = [
    ['overview', t.inspector.overview],
    ['fields', `${t.inspector.fields} · ${model.fields.length}`],
    ['relations', t.inspector.relations],
    ['prisma', t.inspector.prisma],
  ];
  return (
    <>
      <header className="schema-inspector-head" style={toneStyle(studio.tones.get(model.domain))}>
        <span className="schema-chip">
          <span className="schema-node-dot" aria-hidden />
          {t.inspector.table} · {model.domain}
        </span>
        <h2
          tabIndex={-1}
          data-inspector-heading
          className={cn('mt-1.5 rounded-sm text-title-sm font-semibold text-foreground', focusRing)}
        >
          {named ?? model.name}
        </h2>
        <p className="font-mono text-body-sm text-muted-foreground" dir="ltr">
          {model.name}
          {model.dbName ? ` → ${model.dbName}` : ''}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => studio.setFocus(model.name)}>
            <Focus aria-hidden className="size-4" strokeWidth={1.75} />
            {t.actions.focus}
          </Button>
          {studio.can.draft && (
            <Button size="sm" variant="outline" onClick={() => studio.propose({ target: model.name })}>
              <GitPullRequestDraft aria-hidden className="size-4" strokeWidth={1.75} />
              {t.actions.propose}
            </Button>
          )}
          {studio.can.annotate && !named && (
            <Button size="sm" variant="ghost" onClick={() => void studio.suggestNames({ model: model.name })}>
              <Sparkles aria-hidden className="size-4" strokeWidth={1.75} />
              {t.actions.suggestNames}
            </Button>
          )}
        </div>
      </header>
      <div role="tablist" className="schema-tabs" aria-label={t.inspector.label}>
        {tabs.map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={tab === value}
            className="schema-tab"
            onClick={() => setTab(value)}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="schema-inspector-body" role="tabpanel">
        {tab === 'overview' && (
          <div className="flex flex-col gap-5">
            <AnnotationForm key={model.name} target={modelTarget(model.name)} />
            <FromFiles doc={model.doc} comment={model.comment} />
          </div>
        )}
        {tab === 'fields' && (
          <ul className="flex flex-col">
            {model.fields.map((entry) => {
              const name = studio.annotations.get(fieldTarget(model.name, entry.name))?.nameAr;
              return (
                <li key={entry.name}>
                  <button
                    type="button"
                    className="schema-list-button"
                    onClick={() => studio.select({ kind: 'model', name: model.name, field: entry.name })}
                  >
                    <span className="min-w-0 flex-1 text-start">
                      <span className="block truncate font-mono text-body-sm text-foreground" dir="ltr">
                        {entry.name}
                      </span>
                      <span
                        className={cn(
                          'block truncate text-caption',
                          name ? 'text-muted-foreground' : 'text-warning-soft-foreground',
                        )}
                      >
                        {name ?? t.node.unnamed}
                      </span>
                    </span>
                    <span className="shrink-0 font-mono text-caption text-muted-foreground" dir="ltr">
                      {entry.type}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {tab === 'relations' && <Relations model={model} />}
        {tab === 'prisma' && (
          <div className="flex flex-col gap-4">
            <Facts
              rows={[
                [t.inspector.dbName, model.dbName],
                [t.inspector.domain, model.domain],
                [
                  t.inspector.file,
                  fmt(t.inspector.line, {
                    file: studio.doc.domains.find((d) => d.name === model.domain)?.file ?? '',
                    line: String(model.line),
                  }),
                ],
              ]}
            />
            {model.indexes.length > 0 && (
              <section className="flex flex-col gap-1.5">
                <h3 className="text-caption font-semibold text-muted-foreground">{t.inspector.indexes}</h3>
                <div className="schema-code" dir="ltr">
                  {model.attributes.map((attribute) => (
                    <p key={attribute}>@@{attribute}</p>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </>
  );
}

function FieldInspector({ model, field }: { model: SchemaModel; field: SchemaField }) {
  const studio = useStudio();
  const t = useSchemaWords();
  const locale = useLocale();
  const Back = locale === 'ar' ? ArrowRight : ArrowLeft;
  const tableName = studio.annotations.get(modelTarget(model.name))?.nameAr ?? model.name;
  const flags = [
    field.isId && t.node.pk,
    field.isForeignKey && t.node.fk,
    field.isUnique && t.node.unique,
    field.optional && t.node.optional,
    field.list && t.node.list,
    field.isUpdatedAt && t.node.updatedAt,
  ].filter(Boolean) as string[];
  return (
    <>
      <header className="schema-inspector-head" style={toneStyle(studio.tones.get(model.domain))}>
        <button
          type="button"
          className="schema-back"
          onClick={() => studio.select({ kind: 'model', name: model.name })}
        >
          <Back aria-hidden className="size-3.5" strokeWidth={2} />
          {fmt(t.inspector.backToTable, { name: tableName })}
        </button>
        <h2
          tabIndex={-1}
          data-inspector-heading
          className={cn('mt-1.5 rounded-sm text-title-sm font-semibold text-foreground', focusRing)}
        >
          {studio.annotations.get(fieldTarget(model.name, field.name))?.nameAr ?? field.name}
        </h2>
        <p className="font-mono text-body-sm text-muted-foreground" dir="ltr">
          {model.name}.{field.name}: {field.type}
        </p>
        {flags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {flags.map((flag) => (
              <span key={flag} className="schema-chip">
                {flag}
              </span>
            ))}
          </div>
        )}
        {studio.can.draft && (
          <div className="mt-3">
            <Button
              size="sm"
              variant="outline"
              onClick={() => studio.propose({ kind: 'change_field', target: `${model.name}.${field.name}` })}
            >
              <GitPullRequestDraft aria-hidden className="size-4" strokeWidth={1.75} />
              {t.actions.propose}
            </Button>
          </div>
        )}
      </header>
      <div className="schema-inspector-body flex flex-col gap-5">
        <AnnotationForm key={`${model.name}.${field.name}`} target={fieldTarget(model.name, field.name)} />
        <FromFiles doc={field.doc} comment={field.comment} />
        <Facts
          rows={[
            [t.inspector.dbName, field.dbName],
            [t.inspector.type, field.type],
            [t.inspector.native, field.nativeType],
            [t.inspector.defaultValue, field.default],
            [t.inspector.attributes, field.attributes.map((attribute) => `@${attribute}`).join(' ')],
          ]}
        />
      </div>
    </>
  );
}

function EnumInspector({ value }: { value: SchemaEnum }) {
  const studio = useStudio();
  const t = useSchemaWords();
  const users = studio.doc.models.filter((model) =>
    model.fields.some((field) => field.type.replace(/[[\]?]/g, '') === value.name),
  );
  return (
    <>
      <header className="schema-inspector-head" style={toneStyle(studio.tones.get(value.domain))}>
        <span className="schema-chip">
          <span className="schema-node-dot" aria-hidden />
          {t.inspector.enum} · {value.domain}
        </span>
        <h2
          tabIndex={-1}
          data-inspector-heading
          className={cn('mt-1.5 rounded-sm text-title-sm font-semibold text-foreground', focusRing)}
        >
          {studio.annotations.get(enumTarget(value.name))?.nameAr ?? value.name}
        </h2>
        <p className="font-mono text-body-sm text-muted-foreground" dir="ltr">
          {value.name}
          {value.dbName ? ` → ${value.dbName}` : ''}
        </p>
        {users.length > 0 && (
          <p className="mt-1 text-body-sm text-muted-foreground">
            {fmt(t.enums.usedBy, { list: users.map((model) => model.name).join('، ') })}
          </p>
        )}
      </header>
      <div className="schema-inspector-body flex flex-col gap-5">
        <AnnotationForm key={value.name} target={enumTarget(value.name)} compact />
        <section className="flex flex-col gap-2">
          <h3 className="text-caption font-semibold text-muted-foreground">{t.inspector.values}</h3>
          <ul className="flex flex-col gap-2">
            {value.values.map((item) => (
              <EnumValueRow key={item.name} name={value.name} value={item.name} doc={item.doc} />
            ))}
          </ul>
        </section>
        <FromFiles doc={value.doc} comment={value.comment} />
      </div>
    </>
  );
}

function EnumValueRow({ name, value, doc }: { name: string; value: string; doc: string | null }) {
  const studio = useStudio();
  const t = useSchemaWords();
  const annotate = useAnnotate();
  const target = enumValueTarget(name, value);
  const current = studio.annotations.get(target)?.nameAr ?? '';
  const [text, setText] = useState(current);
  const failed = annotate.isError;
  useEffect(() => {
    if (!failed) setText(current);
  }, [current, failed]);
  return (
    <li className="flex items-center gap-2">
      <span
        className="w-40 shrink-0 truncate font-mono text-body-sm text-foreground"
        dir="ltr"
        title={doc ?? value}
      >
        {value}
      </span>
      <TextInput
        aria-label={value}
        dir="rtl"
        value={text}
        readOnly={!studio.can.annotate}
        onChange={(event) => setText(event.target.value)}
        aria-invalid={failed || undefined}
        onBlur={() => {
          if (text.trim() === current) return;
          const found = detectSecret(text);
          if (found) {
            showToast({ tone: 'error', message: fmt(t.inspector.secret, { pattern: found }) });
            return;
          }
          annotate.mutate([{ target, nameAr: text.trim() || null }], {
            onError: (error) =>
              showToast({
                tone: 'error',
                message: isHubError(error)
                  ? fmt(t.inspector.saveFailedWhy, { why: error.message })
                  : t.inspector.saveFailed,
              }),
          });
        }}
      />
    </li>
  );
}

export function Inspector() {
  const studio = useStudio();
  const t = useSchemaWords();
  const selection = studio.selection;
  const aside = useRef<HTMLElement>(null);
  const tick = studio.inspectorFocus;
  useEffect(() => {
    if (!tick) return;
    // After a dialog that opened it has given focus back to its opener.
    const id = window.setTimeout(
      () =>
        aside.current?.querySelector<HTMLElement>('[data-inspector-heading]')?.focus({ preventScroll: true }),
      60,
    );
    return () => window.clearTimeout(id);
  }, [tick]);
  if (!selection) return null;
  const model =
    selection.kind === 'model' ? studio.doc.models.find((entry) => entry.name === selection.name) : undefined;
  const value =
    selection.kind === 'enum' ? studio.doc.enums.find((entry) => entry.name === selection.name) : undefined;
  if (!model && !value) return null;
  return (
    <motion.aside
      key={selection.kind + selection.name}
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.22, ease: 'easeOut' }}
      ref={aside}
      className="schema-inspector"
      aria-label={t.inspector.label}
      onKeyDown={(event) => {
        const typing = (event.target as HTMLElement).closest('input, textarea, select, [role="dialog"]');
        if (matchKey(event, 'Escape') && !typing) {
          event.preventDefault();
          event.stopPropagation();
          studio.closeInspector();
        }
      }}
      data-schema-inspector
    >
      <IconButton
        label={t.actions.close}
        className="schema-inspector-close"
        onClick={() => studio.closeInspector()}
      >
        <X aria-hidden className="size-4" strokeWidth={1.75} />
      </IconButton>
      {model ? <ModelInspector model={model} /> : value ? <EnumInspector value={value} /> : null}
    </motion.aside>
  );
}
