import { useEffect, useRef } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Info, RotateCcw, Undo2 } from 'lucide-react';
import type { Field, FieldValue } from '@lab/mocks/settings';
import { cn } from './cn';
import { Control } from './controls';
import { groupByKey, readable, same } from './lib';
import { useStore } from './store';
import { IconBtn, Pill, Tip } from './ui';

const WIDE = (f: Field) =>
  f.structured ||
  f.type === 'string-list' ||
  f.type === 'url' ||
  (f.type === 'multi-enum' && (f.options?.length ?? 0) > 3) ||
  (f.type === 'enum' && (f.options?.length ?? 0) > 4 && !!f.options?.some((o) => o.hint)) ||
  f.multiline;

export function FieldRow({
  field,
  value,
  saved,
  onChange,
  domId,
  focused,
  onFocus,
  onInfo,
  flashN,
}: {
  field: Field;
  value: FieldValue;
  /** Saved value (org groups); undefined for instant preferences. */
  saved?: FieldValue;
  onChange: (v: FieldValue) => void;
  domId: string;
  focused: boolean;
  onFocus: () => void;
  onInfo?: () => void;
  flashN?: number;
}) {
  const { t, locale, role } = useStore();
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const edited = saved !== undefined && !same(saved, value);
  const changed = !field.readOnly && field.type !== 'secret' && !same(value, field.default);
  const labelId = `${domId}-label`;

  useEffect(() => {
    if (!flashN) return;
    const el = ref.current;
    if (!el) return;
    el.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' });
    const target = el.querySelector<HTMLElement>('input, select, button[role="switch"], button[role="radio"][tabindex="0"], button');
    window.setTimeout(() => target?.focus({ preventScroll: true }), reduce ? 0 : 350);
  }, [flashN, reduce]);

  return (
    <div
      ref={ref}
      id={domId}
      data-field={field.key}
      onFocusCapture={onFocus}
      onPointerDown={onFocus}
      className={cn(
        'relative grid grid-cols-1 scroll-mt-40 gap-3 rounded-xl px-3 py-3.5 transition-colors @2xl:px-4',
        !WIDE(field) && '@xl:grid-cols-[minmax(0,1fr)_auto] @xl:items-center @xl:gap-6',
        focused ? 'bg-muted/70' : 'hover:bg-muted/35',
      )}
    >
      {flashN ? (
        <motion.span
          key={flashN}
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-xl bg-primary/15 ring-2 ring-primary/30"
          initial={{ opacity: 1 }}
          animate={{ opacity: reduce ? [1, 1, 0] : [1, 0.35, 1, 0] }}
          transition={{ duration: reduce ? 2.4 : 2.2, times: reduce ? [0, 0.9, 1] : [0, 0.3, 0.55, 1] }}
        />
      ) : null}
      <div className="relative min-w-0">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {changed ? (
            <Tip label={`${t.field.changedFromDefault} · ${t.field.default}: ${readable(field, field.default, t, locale)}`}>
              <span className="inline-flex size-4 items-center justify-center" tabIndex={-1}>
                <span className="size-2 rounded-full bg-primary" role="img" aria-label={t.field.changedFromDefault} />
              </span>
            </Tip>
          ) : null}
          <span id={labelId} className={cn('text-14 font-semibold leading-snug', field.deprecated && 'text-muted-foreground line-through decoration-muted-foreground/50')}>
            {field.label[locale]}
          </span>
          {field.proposed || field.proposedOptions?.length ? (
            <Tip label={t.field.proposedTip(field.proposalId ?? '—', field.priority ?? '—', !!field.needsBackend)}>
              {onInfo ? (
                <button
                  type="button"
                  onClick={onInfo}
                  aria-label={`${t.field.proposed} ${field.proposalId ?? ''}: ${t.field.proposedTip(field.proposalId ?? '—', field.priority ?? '—', !!field.needsBackend)}`}
                  className="relative rounded-full outline-none after:absolute after:-inset-x-1 after:-inset-y-3 after:content-[''] focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Pill tone="info">
                    {t.field.proposed}
                    {field.proposalId ? <bdi dir="ltr" className="font-mono text-10">{field.proposalId}</bdi> : null}
                  </Pill>
                </button>
              ) : (
                <span title={t.field.proposedTip(field.proposalId ?? '—', field.priority ?? '—', !!field.needsBackend)}>
                  <Pill tone="info">{t.field.proposed}</Pill>
                </span>
              )}
            </Tip>
          ) : null}
          {field.deprecated ? <Pill tone="neutral">{t.field.deprecated}</Pill> : null}
          {field.risk === 'high' ? <Pill tone="danger">{t.field.highRisk}</Pill> : null}
          {field.control === 'security' ? <Pill tone="neutral">{t.field.security}</Pill> : null}
          {field.twoPerson ? <Pill tone="neutral">{t.field.twoPerson}</Pill> : null}
          {field.storedIn ? <Pill tone="neutral">{t.field.storedIn(groupByKey.get(field.storedIn)?.title[locale] ?? field.storedIn)}</Pill> : null}
          {edited ? <Pill tone="warning">{t.field.edited}</Pill> : null}
        </div>
        <p className="mt-1 line-clamp-3 max-w-[62ch] text-13 leading-relaxed text-muted-foreground @2xl:line-clamp-2">{field.help[locale]}</p>
        {edited ? (
          <p className="mt-1 text-12 text-muted-foreground">
            <span className="line-through decoration-muted-foreground/60">
              <bdi>{readable(field, saved, t, locale)}</bdi>
            </span>
          </p>
        ) : null}
        {field.note ? <p className="mt-1 max-w-[62ch] text-12 text-warning-strong dark:text-warning">{field.note[locale]}</p> : null}
      </div>
      <div className="relative flex min-w-0 flex-wrap items-center gap-1.5 @xl:justify-end">
        <div className="min-w-0 max-w-full">
          <Control field={field} value={value} onChange={onChange} id={`${domId}-ctl`} labelId={labelId} t={t} locale={locale} role={role} />
        </div>
        <div className="flex items-center">
          {edited ? (
            <IconBtn label={t.field.undo} onClick={() => onChange(saved as FieldValue)}>
              <Undo2 className="size-4" aria-hidden />
            </IconBtn>
          ) : null}
          {changed && !field.readOnly && !field.structured ? (
            <IconBtn label={t.field.reset} onClick={() => onChange(field.default)}>
              <RotateCcw className="size-4" aria-hidden />
            </IconBtn>
          ) : null}
          {onInfo ? (
            <IconBtn label={t.field.info} onClick={onInfo} className="xl:hidden" data-info={field.key}>
              <Info className="size-4" aria-hidden />
            </IconBtn>
          ) : null}
        </div>
      </div>
    </div>
  );
}
