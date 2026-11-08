'use client';

/**
 * @file table-node.tsx
 * @description A table on the diagram (docs/17 §4): its domain's colour, its Arabic name above its code name, its columns with key marks, and the draft's and the last version's marks.
 * Far out, a table shrinks to its name so the whole design reads as a map. A domain is a soft tinted zone behind its tables, with its name and how much of it is named.
 */
import { Handle, type NodeProps, Position, useStore } from '@xyflow/react';
import { CircleDashed, Fingerprint, KeyRound, Link2, Plus, Sparkles } from 'lucide-react';
import { createContext, memo, useContext } from 'react';

import { cn, fmt, num, useLocale } from '@/components/kit';

import { type Coverage, fieldTarget, labelOf, modelTarget, toneStyle, visibleFields } from './model';
import { useSchemaWords, useStudio } from './studio';

export interface DiagramHot {
  /** The table under the pointer or selected, and its neighbours. */
  hot: ReadonlySet<string> | null;
  active: string | null;
  hover: (model: string | null) => void;
}

export const HotContext = createContext<DiagramHot>({ hot: null, active: null, hover: () => {} });

export type TableNodeData = { model: string; ghost?: { summary: string } };
export type DomainNodeData = { domain: string; coverage: Coverage; count: number };

const farOut = (zoom: number) => zoom < 0.42;

function Handles() {
  return (
    <>
      <Handle id="l" type="source" position={Position.Left} className="schema-handle" isConnectable={false} />
      <Handle
        id="r"
        type="source"
        position={Position.Right}
        className="schema-handle"
        isConnectable={false}
      />
      <Handle
        id="tl"
        type="target"
        position={Position.Left}
        className="schema-handle"
        isConnectable={false}
      />
      <Handle
        id="tr"
        type="target"
        position={Position.Right}
        className="schema-handle"
        isConnectable={false}
      />
    </>
  );
}

function TableNodeView({ data, selected }: NodeProps & { data: TableNodeData }) {
  const studio = useStudio();
  const t = useSchemaWords();
  const locale = useLocale();
  const { hot, active, hover } = useContext(HotContext);
  const far = useStore((state) => farOut(state.transform[2]));
  const dir = locale === 'ar' ? 'rtl' : 'ltr';

  if (data.ghost) {
    return (
      <div dir={dir} className="schema-node schema-node-ghost" data-mark="added">
        <Handles />
        <div className="flex items-center gap-2 px-3 py-2.5">
          <Plus aria-hidden className="size-4 shrink-0 text-success-soft-foreground" strokeWidth={2} />
          <div className="min-w-0">
            <p className="truncate font-mono text-body-sm font-semibold text-foreground" dir="ltr">
              {data.model}
            </p>
            <p className="truncate text-caption text-muted-foreground">{data.ghost.summary}</p>
          </div>
        </div>
        <span className="schema-node-badge">{t.node.proposed}</span>
      </div>
    );
  }

  const model = studio.doc.models.find((entry) => entry.name === data.model);
  if (!model) return null;
  const tone = studio.tones.get(model.domain);
  const label = labelOf(studio.annotations, modelTarget(model.name), model.name, studio.prefs.labels);
  const named = Boolean(studio.annotations.get(modelTarget(model.name))?.nameAr);
  const touched = (field: string) => studio.marks.proposedFields.has(`${model.name}.${field}`);
  const fields = visibleFields(model, studio.prefs.detail, touched);
  const hidden = model.fields.length - fields.length;
  const added = studio.marks.newFields.get(model.name) ?? [];
  const mark = studio.marks.proposedModels.get(model.name);
  const recent = studio.marks.recentModels.has(model.name);
  const dimmed = hot !== null && !hot.has(model.name);
  const isActive = active === model.name || studio.selection?.name === model.name;

  return (
    <div
      dir={dir}
      style={toneStyle(tone)}
      className={cn('schema-node', far && 'schema-node-far')}
      data-dimmed={dimmed || undefined}
      data-active={isActive || selected || undefined}
      data-mark={mark}
      data-recent={recent || undefined}
      onPointerEnter={() => hover(model.name)}
      onPointerLeave={() => hover(null)}
    >
      <Handles />
      <div className="schema-node-head">
        <span className="schema-node-dot" aria-hidden />
        <div className="min-w-0 flex-1">
          <p
            className={cn('truncate font-semibold text-foreground', far ? 'text-title' : 'text-body')}
            dir={label.main === model.name ? 'ltr' : undefined}
          >
            {label.main}
          </p>
          {!far && (
            <p className="truncate font-mono text-caption text-muted-foreground" dir="ltr">
              {label.sub ?? model.dbName ?? model.name}
            </p>
          )}
        </div>
        {!far && !named && (
          <span title={t.node.unnamed} className="schema-node-unnamed">
            <CircleDashed aria-hidden className="size-3.5" strokeWidth={2} />
            <span className="sr-only">{t.node.unnamed}</span>
          </span>
        )}
        {!far && recent && (
          <Sparkles aria-hidden className="size-3.5 shrink-0 text-info-soft-foreground" strokeWidth={2} />
        )}
        {model.block === 'view' && <span className="schema-chip">{t.node.view}</span>}
      </div>
      {!far && (
        <ul className="schema-node-rows">
          {fields.map((field) => {
            const fieldLabel = labelOf(
              studio.annotations,
              fieldTarget(model.name, field.name),
              field.name,
              studio.prefs.labels,
            );
            const fieldMark = studio.marks.proposedFields.get(`${model.name}.${field.name}`);
            const isRecent = studio.marks.recentFields.has(`${model.name}.${field.name}`);
            const sensitivity = studio.annotations.get(fieldTarget(model.name, field.name))?.sensitivity;
            return (
              <li
                key={field.name}
                className="schema-row"
                data-mark={fieldMark}
                data-recent={isRecent || undefined}
                data-selected={
                  studio.selection?.name === model.name && studio.selection.field === field.name
                    ? true
                    : undefined
                }
              >
                <span className="schema-row-icon" aria-hidden>
                  {field.isId ? (
                    <KeyRound className="size-3.5 text-warning-strong" strokeWidth={2} />
                  ) : field.isForeignKey || field.kind === 'relation' ? (
                    <Link2 className="size-3.5 text-info-soft-foreground" strokeWidth={2} />
                  ) : field.isUnique ? (
                    <Fingerprint className="size-3.5 text-muted-foreground" strokeWidth={2} />
                  ) : null}
                </span>
                <span
                  className={cn(
                    'min-w-0 flex-1 truncate',
                    field.kind === 'relation' && 'text-muted-foreground',
                  )}
                  dir={fieldLabel.main === field.name ? 'ltr' : undefined}
                >
                  {fieldLabel.main}
                </span>
                {sensitivity && sensitivity !== 'none' && (
                  <span className="schema-sensitive" data-kind={sensitivity} aria-hidden />
                )}
                <span className="schema-row-type" dir="ltr">
                  {field.type}
                </span>
              </li>
            );
          })}
          {added.map((entry) => (
            <li key={`new-${entry.name}`} className="schema-row" data-mark="added">
              <span className="schema-row-icon" aria-hidden>
                <Plus className="size-3.5 text-success-soft-foreground" strokeWidth={2} />
              </span>
              <span className="min-w-0 flex-1 truncate" dir="ltr">
                {entry.name}
              </span>
              <span className="schema-row-type">{t.node.proposed}</span>
            </li>
          ))}
          {hidden > 0 && (
            <li className="schema-row schema-row-more">{fmt(t.node.more, { n: num(hidden, locale) })}</li>
          )}
        </ul>
      )}
    </div>
  );
}

export const TableNode = memo(TableNodeView);

function DomainNodeView({ data }: NodeProps & { data: DomainNodeData }) {
  const studio = useStudio();
  const t = useSchemaWords();
  const locale = useLocale();
  const zoom = useStore((state) => state.transform[2]);
  const far = farOut(zoom);
  const tone = studio.tones.get(data.domain);
  // Far out, the domain's name grows against the zoom, so the overview reads as a labelled map.
  const titleSize = far ? Math.min(15 / zoom, 140) : undefined;
  return (
    <div dir={locale === 'ar' ? 'rtl' : 'ltr'} style={toneStyle(tone)} className="schema-domain">
      <div className="schema-domain-title">
        <span
          className={cn('font-semibold text-foreground', !far && 'text-title-sm')}
          style={titleSize ? { fontSize: titleSize, lineHeight: 1.1 } : undefined}
        >
          {data.domain}
        </span>
        <span className="text-body-sm text-muted-foreground">
          {fmt(t.domains.tables, { n: num(data.count, locale) })}
        </span>
        <span
          className="schema-domain-meter"
          aria-label={fmt(t.domains.coverage, { pct: num(data.coverage.pct, locale) })}
        >
          <span style={{ inlineSize: `${data.coverage.pct}%` }} />
        </span>
      </div>
    </div>
  );
}

export const DomainNode = memo(DomainNodeView);
