'use client';

/**
 * @file table-node.tsx
 * @description A table on the map (docs/17 §4): one neutral card with its domain's coloured dot, its Arabic name above its code name, its columns with key marks, and the
 * draft's and the last version's marks as icons and small badges, never a coloured edge or a tinted row (owner's choice on review B3, 2026-11-08).
 * The zoom is semantic and costs no redraw: the canvas carries `data-zoom` (near, mid, far) and `--schema-zinv` (one over the zoom), and the stylesheet hides the columns far out
 * and grows the table's and the domain's names against the zoom, so the overview reads as a labelled map. Hover is painted the same way, by the canvas, not by the tables.
 * A selected table wears a selection frame with corner handles and a size label, as a design tool draws one.
 */
import { Handle, type NodeProps, Position } from '@xyflow/react';
import { CircleDashed, Fingerprint, KeyRound, Link2, Minus, PencilLine, Plus, Sparkles } from 'lucide-react';
import { createContext, memo, useContext } from 'react';

import { cn, fmt, num, plural, useLocale } from '@/components/kit';

import { type Coverage, fieldTarget, labelOf, modelTarget, toneStyle, visibleFields } from './model';
import { useSchemaWords, useStudio } from './studio';

/** The canvas's hover painter. Stable: a table calls it and nothing re-renders. */
export const HoverContext = createContext<(model: string | null) => void>(() => {});

export type TableNodeData = { model: string; height: number; ghost?: { summary: string } };
export type DomainNodeData = { domain: string; coverage: Coverage; count: number; width: number };

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

/** The selection frame: four corner handles and, above the card, how many columns it has. */
function SelectionFrame({ label }: { label: string }) {
  return (
    <span className="schema-select" aria-hidden>
      <i data-corner="ts" />
      <i data-corner="te" />
      <i data-corner="bs" />
      <i data-corner="be" />
      <span className="schema-select-label">{label}</span>
    </span>
  );
}

function TableNodeView({ data, selected }: NodeProps & { data: TableNodeData }) {
  const studio = useStudio();
  const t = useSchemaWords();
  const locale = useLocale();
  const hover = useContext(HoverContext);
  const dir = locale === 'ar' ? 'rtl' : 'ltr';

  if (data.ghost) {
    return (
      <div
        dir={dir}
        className="schema-node schema-node-ghost"
        data-mark="added"
        style={{ minBlockSize: data.height }}
      >
        <Handles />
        <div className="schema-node-near flex items-center gap-2 px-3 py-2.5">
          <Plus aria-hidden className="size-4 shrink-0 text-success-soft-foreground" strokeWidth={2} />
          <div className="min-w-0">
            <p className="truncate font-mono text-body-sm font-semibold text-foreground" dir="ltr">
              {data.model}
            </p>
            <p className="truncate text-caption text-muted-foreground">{data.ghost.summary}</p>
          </div>
        </div>
        <p className="schema-far-name" dir="ltr">
          {data.model}
        </p>
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
  const isActive = selected || studio.selection?.name === model.name;

  return (
    <div
      dir={dir}
      style={{ ...toneStyle(tone), minBlockSize: data.height }}
      className="schema-node"
      data-active={isActive || undefined}
      data-mark={mark}
      data-recent={recent || undefined}
      onPointerEnter={() => hover(model.name)}
      onPointerLeave={() => hover(null)}
    >
      <Handles />
      {isActive && <SelectionFrame label={plural(model.fields.length, locale, t.stats.fields)} />}
      <div className="schema-node-head">
        <span className="schema-node-dot" aria-hidden />
        <div className="min-w-0 flex-1">
          <p
            className="truncate text-body font-semibold text-foreground"
            dir={label.main === model.name ? 'ltr' : undefined}
          >
            {label.main}
          </p>
          <p className="truncate font-mono text-caption text-muted-foreground" dir="ltr">
            {label.sub ?? model.dbName ?? model.name}
          </p>
        </div>
        {!named && (
          <span title={t.node.unnamed} className="schema-node-unnamed">
            <CircleDashed aria-hidden className="size-3.5" strokeWidth={2} />
            <span className="sr-only">{t.node.unnamed}</span>
          </span>
        )}
        {recent && (
          <Sparkles aria-hidden className="size-3.5 shrink-0 text-info-soft-foreground" strokeWidth={2} />
        )}
        {model.block === 'view' && <span className="schema-chip">{t.node.view}</span>}
        {(mark === 'changed' || mark === 'removed') && (
          <span className="schema-chip" data-mark={mark}>
            {mark === 'removed' ? t.node.markRemoved : t.node.markChanged}
          </span>
        )}
      </div>
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
              {fieldMark === 'changed' && (
                <PencilLine
                  aria-hidden
                  className="size-3.5 shrink-0 text-warning-soft-foreground"
                  strokeWidth={2}
                />
              )}
              {fieldMark === 'removed' && (
                <Minus
                  aria-hidden
                  className="size-3.5 shrink-0 text-destructive-soft-foreground"
                  strokeWidth={2}
                />
              )}
              {isRecent && (
                <Sparkles
                  aria-hidden
                  className="size-3.5 shrink-0 text-info-soft-foreground"
                  strokeWidth={2}
                />
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
        {hidden > 0 && <li className="schema-row schema-row-more">{plural(hidden, locale, t.node.more)}</li>}
      </ul>
      {/* Far out, the card is its name, grown against the zoom by the stylesheet. */}
      <p className="schema-far-name" dir={label.main === model.name ? 'ltr' : undefined}>
        {label.main}
      </p>
    </div>
  );
}

export const TableNode = memo(TableNodeView);

function DomainNodeView({ data }: NodeProps & { data: DomainNodeData }) {
  const studio = useStudio();
  const t = useSchemaWords();
  const locale = useLocale();
  const tone = studio.tones.get(data.domain);
  return (
    <div dir={locale === 'ar' ? 'rtl' : 'ltr'} style={toneStyle(tone)} className="schema-domain">
      <div className="schema-domain-title">
        <span className="schema-node-dot" aria-hidden />
        <span className="schema-domain-name">{data.domain}</span>
        <span className="schema-domain-count">{plural(data.count, locale, t.domains.tables)}</span>
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
