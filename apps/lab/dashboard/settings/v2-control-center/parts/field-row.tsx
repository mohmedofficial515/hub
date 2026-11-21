/**
 * One setting: label, markers (proposed, legacy, impact, control), help, the control at the inline end (or full
 * width for lists and long choices), and the two states a value can be in: unsaved edit (Edited · Was · Undo) and
 * different from the default (dot · Default · Reset). Deep links land here with a soft highlight.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Coins, Link2, RotateCcw, ShieldCheck, TriangleAlert, Undo2, Users } from 'lucide-react';
import { cn } from '@lab/utils';
import { getGroup, type Field, type SettingsGroup } from '@lab/mocks/settings';
import { FieldControl, isWide, useFieldId, validate } from './controls';
import { fill, num, valueText } from './format';
import { fieldLabel, same } from './model';
import { copyText, fieldLink, useStore } from './store';
import { Pill } from './ui';

/** The one chip a row may carry: the most important fact about the field (proposed > legacy > impact > approval > money > security). */
function rowChip(field: Field, t: ReturnType<typeof useStore>['t'], quietSecurity: boolean): ReactNode {
  const small = 'h-6 gap-1 px-2 text-12 [&_svg]:size-3.5';
  if (field.proposed) return <Pill tone="info" className={small}>{`${t.field.proposed} · ${field.proposalId} · ${field.priority}`}</Pill>;
  if (field.deprecated) return <Pill tone="neutral" className={small}>{t.field.deprecated}</Pill>;
  if (field.risk === 'high') return <Pill tone="warning" className={small}><TriangleAlert aria-hidden />{t.field.highRisk}</Pill>;
  if (field.twoPerson) return <Pill tone="outline" className={small}><Users aria-hidden />{t.field.twoPerson}</Pill>;
  if (field.control === 'money') return <Pill tone="outline" className={small}><Coins aria-hidden />{t.field.money}</Pill>;
  if (field.control === 'security' && !quietSecurity) return <Pill tone="outline" className={small}><ShieldCheck aria-hidden />{t.field.security}</Pill>;
  return null;
}

/** True when most fields of the group are security controls: the group says it once, rows stay quiet. */
export function mostlySecurity(group: SettingsGroup): boolean {
  const fields = group.subsections.flatMap((s) => s.fields);
  return fields.filter((f) => f.control === 'security').length * 2 >= fields.length;
}

export function FieldRow({ group, field, highlight, hideHelp }: { group: SettingsGroup; field: Field; highlight: number; hideHelp?: boolean }) {
  const { t, locale, valueOf, saved, setValue, resetFields, toast } = useStore();
  const reduce = useReducedMotion();
  const id = useFieldId(field.key);
  const value = valueOf(group.key, field.key);
  const savedValue = saved[group.key]?.[field.key] ?? null;
  const edited = !same(value, savedValue);
  const notDefault = !same(value, field.default);
  const error = validate(field, value, t, locale);
  const wide = isWide(field);
  const [glow, setGlow] = useState(0);

  useEffect(() => {
    if (!highlight) return;
    setGlow(highlight);
    const timer = window.setTimeout(() => setGlow(0), reduce ? 3200 : 2800);
    return () => window.clearTimeout(timer);
  }, [highlight, reduce]);

  const helpId = `${id}-help`;
  const errorId = `${id}-error`;
  const storedIn = field.storedIn ? getGroup(field.storedIn) : undefined;
  const label = fieldLabel(field, locale, t);
  const chip = rowChip(field, t, mostlySecurity(group));

  return (
    <div id={`field-${group.key}-${field.key}`} data-field={field.key} className="group/row relative scroll-mt-32 px-4 py-4 sm:px-5">
      {glow ? (
        <motion.span
          key={glow}
          aria-hidden
          className="pointer-events-none absolute inset-1 rounded-2xl bg-primary/12 ring-2 ring-primary/40"
          initial={{ opacity: 1 }}
          animate={{ opacity: reduce ? 1 : [1, 1, 0] }}
          transition={reduce ? { duration: 0 } : { duration: 2.6, times: [0, 0.55, 1], ease: 'easeOut' }}
        />
      ) : null}
      <div className={cn('relative grid gap-3', !wide && 'md:grid-cols-[minmax(0,1fr)_auto] md:items-start md:gap-8')}>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
            <label htmlFor={id} className={cn('text-14 font-bold leading-snug', field.deprecated && 'text-muted-foreground')}>
              {label}
            </label>
            {edited ? (
              <Pill tone="primary" className="h-5 px-2 text-11">
                {t.field.edited}
              </Pill>
            ) : notDefault ? (
              <span className="inline-flex items-center gap-1 text-12 font-semibold text-muted-foreground">
                <span aria-hidden className="size-1.5 rounded-full bg-primary" />
                {t.field.changedDot}
              </span>
            ) : null}
            {chip}
            <button
              type="button"
              aria-label={`${t.field.copyLink}: ${label}`}
              onClick={() => copyText(fieldLink(group.key, field.key), t, toast, t.field.copied)}
              className="grid size-11 shrink-0 place-items-center rounded-lg text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 sm:size-8"
            >
              <Link2 className="size-4" aria-hidden />
            </button>
          </div>
          <p id={helpId} className={cn('mt-1 max-w-[68ch] text-13 leading-relaxed text-muted-foreground', hideHelp && 'sr-only')}>
            {field.help[locale]}
          </p>
          {field.proposed ? <p className="mt-1 max-w-[68ch] text-12 font-medium text-info-soft-foreground">{field.needsBackend ? t.field.proposedTip : t.field.proposedTipNoBackend}</p> : null}
          {field.note ? <p className="mt-1.5 max-w-[68ch] text-12 leading-relaxed text-info-soft-foreground">{field.note[locale]}</p> : null}
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-12 text-muted-foreground empty:hidden">
            {field.min !== undefined && field.max !== undefined && (field.type === 'integer' || field.type === 'number' || field.type === 'duration' || field.type === 'money') ? (
              <span>{fill(t.field.range, { min: num(locale, field.min), max: num(locale, field.max) })}</span>
            ) : null}
            {storedIn ? <span>{fill(t.field.storedIn, { group: storedIn.title[locale] })}</span> : null}
            {edited ? (
              <span className="inline-flex flex-wrap items-center gap-1">
                <span>
                  {fill(t.field.was, { v: '' })}
                  <bdi className="font-semibold text-foreground/80">{valueText(locale, t, field, savedValue)}</bdi>
                </span>
                <button
                  type="button"
                  onClick={() => setValue(group.key, field.key, savedValue)}
                  aria-label={fill(t.field.undoAria, { label })}
                  className="inline-flex min-h-11 items-center gap-1 rounded-md px-2 font-semibold text-primary sm:min-h-9 outline-none hover:bg-primary/8 focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Undo2 className="size-3.5" aria-hidden />
                  {t.field.undo}
                </button>
              </span>
            ) : null}
            {notDefault && !field.readOnly && !field.structured && field.type !== 'secret' ? (
              <span className="inline-flex flex-wrap items-center gap-1">
                <span>
                  {fill(t.field.defaultIs, { v: '' })}
                  <bdi className="font-semibold text-foreground/80">{valueText(locale, t, field, field.default)}</bdi>
                </span>
                <button
                  type="button"
                  onClick={() => resetFields(group.key, [field.key])}
                  aria-label={fill(t.field.resetAria, { label })}
                  className="inline-flex min-h-11 items-center gap-1 rounded-md px-2 font-semibold text-primary sm:min-h-9 outline-none hover:bg-primary/8 focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <RotateCcw className="size-3.5" aria-hidden />
                  {t.field.reset}
                </button>
              </span>
            ) : null}
          </div>
          {error ? (
            <p id={errorId} className="mt-1.5 text-12 font-semibold text-destructive-soft-foreground" role="alert">
              {error}
            </p>
          ) : null}
        </div>
        <div className={cn('min-w-0', !wide && 'md:justify-self-end')}>
          <FieldControl
            field={field}
            value={value}
            id={id}
            invalid={!!error}
            describedBy={error ? `${helpId} ${errorId}` : helpId}
            onChange={(v) => setValue(group.key, field.key, v)}
          />
        </div>
      </div>
    </div>
  );
}

/**
 * Deep links into a group: a new group starts at the top; a `field` in the route scrolls that row to the middle,
 * focuses its control and returns the key to glow (the nonce restarts the glow on a repeated link).
 */
export function useFocusField(groupKey: string): { key: string; nonce: number } | null {
  const { route, focusNonce } = useStore();
  const reduce = useReducedMotion();
  const [highlight, setHighlight] = useState<{ key: string; nonce: number } | null>(null);

  useEffect(() => {
    if (!route.field) window.scrollTo({ top: 0, behavior: 'auto' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupKey]);

  useEffect(() => {
    if (!route.field) return;
    const key = route.field;
    const raf = window.requestAnimationFrame(() => {
      const el = document.getElementById(`field-${groupKey}-${key}`);
      el?.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' });
      setHighlight({ key, nonce: Date.now() });
      el?.querySelector<HTMLElement>('input, select, textarea, button[role="switch"], button[role="radio"][aria-checked="true"]')?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupKey, route.field, focusNonce]);

  return highlight;
}
