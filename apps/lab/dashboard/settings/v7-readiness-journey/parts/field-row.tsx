// One field: label with state markers, help, "why it matters" from the readiness rules, the recommended value,
// default + reset, edited + undo, and its control. Highlighted (background pulse, never a side bar) on deep links.
import { useEffect, useRef, useState } from 'react';
import { Link2, PencilLine, RotateCcw, ServerCog, ShieldAlert, Sparkles, SquareStack, TriangleAlert, Undo2 } from 'lucide-react';
import type { Field, FieldValue } from '@lab/mocks/settings';
import { cn } from '@lab/utils';
import { groupOf, L, sameValue } from './data';
import { FieldControl, isCompact, rangeText } from './controls';
import { useFmt } from './nav';
import { checksForField, recommendationFor } from './readiness';
import { effectiveValue, fieldLink, useSettings } from './store';
import { Btn, IconBtn, Pill, Tip } from './ui';

export const fieldDomId = (group: string, key: string) => `f-${group}-${key}`.replace(/[^a-zA-Z0-9_-]/g, '_');

export function FieldRow({ groupKey, field, focusTick }: { groupKey: string; field: Field; focusTick?: number }) {
  const { state, dispatch, t, lang, checks } = useSettings();
  const fmt = useFmt();
  const ref = useRef<HTMLDivElement>(null);
  const [pulse, setPulse] = useState(false);

  const value = effectiveValue(state, groupKey, field.key);
  const saved = state.saved[groupKey]?.[field.key];
  const dirty = !!state.drafts[groupKey] && field.key in state.drafts[groupKey];
  const changed = !sameValue(value, field.default);
  const rec = recommendationFor(groupKey, field.key) ?? (field.proposed && field.default !== null ? field.default : undefined);
  const recMatches = rec !== undefined && sameValue(value, rec);
  const openChecks = checksForField(checks, groupKey, field.key).filter((c) => c.status !== 'done');
  const id = fieldDomId(groupKey, field.key);
  const ctlId = `${id}-ctl`;
  const labelId = `${id}-label`;
  const helpId = `${id}-help`;
  const edit = (v: FieldValue) => dispatch({ type: 'edit', group: groupKey, field: field.key, value: v });
  const range = rangeText(field, lang, t.field.range);
  const compact = isCompact(field);

  useEffect(() => {
    if (!focusTick) return;
    const el = ref.current;
    if (!el) return;
    el.scrollIntoView({ block: 'center', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    const pick = () =>
      [`#${CSS.escape(ctlId)}`, '[role="radio"][tabindex="0"]', 'button[role="switch"]', 'input, select, textarea', '[aria-pressed]']
        .map((sel) => el.querySelector<HTMLElement>(sel))
        .find(Boolean) ?? null;
    const focusable = pick();
    const tryFocus = () => {
      const target = pick() ?? focusable;
      target?.focus({ preventScroll: true });
    };
    window.setTimeout(tryFocus, 350);
    window.setTimeout(() => {
      if (document.activeElement === document.body || !el.contains(document.activeElement)) tryFocus();
    }, 800);
    setPulse(true);
    const timer = window.setTimeout(() => setPulse(false), 2600);
    return () => window.clearTimeout(timer);
  }, [focusTick, ctlId]);

  const copyLink = () => {
    void navigator.clipboard?.writeText(fieldLink(groupKey, field.key)).catch(() => undefined);
    dispatch({ type: 'toast', text: t.group.linkCopied });
  };

  return (
    <div
      ref={ref}
      id={id}
      data-field={field.key}
      className={cn(
        'group/row scroll-mt-24 rounded-xl px-3 py-4 transition-colors duration-700 sm:px-4',
        pulse ? 'bg-primary/10 ring-2 ring-primary/40' : 'bg-transparent',
      )}
    >
      <div className={cn('grid gap-3', compact && 'md:grid-cols-[minmax(0,1fr)_auto] md:items-start md:gap-6')}>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="inline-flex items-center gap-0.5">
              <label id={labelId} htmlFor={ctlId} className="text-14 font-semibold leading-snug">
                {L(field.label, lang)}
              </label>
              <IconBtn label={t.group.copyLink} onClick={copyLink} className="-my-2 size-11 text-muted-foreground [&_svg]:size-4">
                <Link2 />
              </IconBtn>
            </span>
            {changed && !dirty ? (
              <Tip content={t.field.defaultIs(fmt(field, field.default))}>
                <span tabIndex={0} className="inline-flex size-5 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
                  <span className="size-2 rounded-full bg-primary dark:bg-[color:var(--primary)]" aria-hidden />
                  <span className="sr-only">{t.field.changedFromDefault}</span>
                </span>
              </Tip>
            ) : null}
            {dirty ? (
              <Pill tone="info" icon={<PencilLine />}>
                {t.field.edited}
              </Pill>
            ) : null}
            <FieldBadges field={field} />
          </div>
          <p id={helpId} className="mt-1 max-w-[70ch] text-13 leading-relaxed text-muted-foreground">
            {L(field.help, lang)}
            {range ? <span className="whitespace-nowrap"> ({range})</span> : null}
          </p>
          {field.note ? <p className="mt-1 max-w-[70ch] text-12 leading-relaxed text-muted-foreground">{L(field.note, lang)}</p> : null}
          {field.deprecated ? <p className="mt-1 text-12 font-medium text-warning-soft-foreground">{t.field.deprecatedHint}</p> : null}
          {openChecks.map((c) => (
            <p key={c.id} className="mt-2 flex max-w-[70ch] gap-2 rounded-lg bg-warning/12 px-3 py-2 text-13 leading-relaxed">
              <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning-strong" aria-hidden />
              <span>
                <span className="font-semibold">{t.group.whyMatters}: </span>
                {t.checks[c.id]?.why}
              </span>
            </p>
          ))}
        </div>
        <div className={cn('min-w-0', compact && 'md:justify-self-end')}>
          {field.structured ? <Structured field={field} value={value} /> : (
            <FieldControl field={field} value={value} onChange={edit} id={ctlId} labelId={labelId} describedBy={helpId} />
          )}
        </div>
      </div>

      {/* State line: recommended value, default + reset, edited + undo, copy link */}
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 empty:hidden">
        {rec !== undefined && !field.readOnly ? (
          recMatches ? (
            <span className="inline-flex min-h-11 items-center gap-1 text-12 font-semibold text-success-soft-foreground">
              <Sparkles className="size-3.5" aria-hidden />
              {t.field.matchesRecommended}
            </span>
          ) : (
            <span className="inline-flex min-h-11 items-center gap-1.5 rounded-md bg-success/12 ps-2 text-12 text-success-soft-foreground">
              <Sparkles className="size-3.5" aria-hidden />
              «{t.field.recommended}»
              <bdi className="font-bold">{fmt(field, rec)}</bdi>
              <button
                type="button"
                onClick={() => edit(rec)}
                className="min-h-11 rounded-md px-2 font-bold underline underline-offset-4 hover:no-underline focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                {t.field.useRecommended}
              </button>
            </span>
          )
        ) : null}
        {dirty ? (
          <span className="inline-flex min-h-11 items-center gap-1 text-12 text-muted-foreground">
            <bdi>{t.field.was(fmt(field, saved))}</bdi>
            <button
              type="button"
              onClick={() => edit(saved ?? null)}
              className="inline-flex min-h-11 items-center gap-1 rounded-md px-2 font-semibold text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              <Undo2 className="size-3.5" aria-hidden />
              {t.field.undo}
            </button>
          </span>
        ) : null}
        {changed && !field.readOnly && !field.structured ? (
          <span className="inline-flex min-h-11 items-center gap-1 text-12 text-muted-foreground">
            <bdi>{t.field.defaultIs(fmt(field, field.default))}</bdi>
            <button
              type="button"
              onClick={() => edit(field.default)}
              className="inline-flex min-h-11 items-center gap-1 rounded-md px-2 font-semibold text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              <RotateCcw className="size-3.5" aria-hidden />
              {t.field.reset}
            </button>
          </span>
        ) : null}
      </div>
    </div>
  );
}

export function FieldBadges({ field }: { field: Field }) {
  const { t, lang } = useSettings();
  return (
    <>
      {field.proposed ? (
        <Tip content={t.check.proposalTip(field.proposalId ?? '', field.priority ?? '')}>
          <button type="button" className="rounded-md focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
            <Pill tone="violet" icon={<ServerCog />}>
              {t.badge.proposed} {field.proposalId} {field.priority}
            </Pill>
          </button>
        </Tip>
      ) : null}
      {field.deprecated ? <Pill tone="warning">{t.badge.deprecated}</Pill> : null}
      {field.risk === 'high' ? <Pill tone="danger" icon={<TriangleAlert />}>{t.badge.highRisk}</Pill> : null}
      {field.control === 'security' ? <Pill icon={<ShieldAlert />}>{t.badge.security}</Pill> : null}
      {field.control === 'money' ? <Pill>{t.badge.money}</Pill> : null}
      {field.twoPerson ? <Pill>{t.badge.twoPerson}</Pill> : null}
      {field.storedIn ? <Pill>{t.field.storedIn(L(groupOf(field.storedIn)?.title, lang) || field.storedIn)}</Pill> : null}
    </>
  );
}

function Structured({ field, value }: { field: Field; value: FieldValue | undefined }) {
  const { t } = useSettings();
  const items = Array.isArray(value) ? value.map(String) : [];
  return (
    <div className="rounded-xl border border-border bg-background">
      {items.length ? (
        <ul className="divide-y divide-border">
          {items.map((item, i) => (
            <li key={`${item}-${i}`} className="px-3 py-2.5 text-13">
              <bdi>{item}</bdi>
            </li>
          ))}
        </ul>
      ) : (
        <p className="px-3 py-3 text-13 text-muted-foreground">{t.field.items(0)}</p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-3 py-2">
        <span className="text-12 text-muted-foreground">
          {t.field.items(items.length)}. {t.field.structuredHint}
        </span>
        {field.readOnly ? (
          <Pill>{t.badge.readOnly}</Pill>
        ) : (
          <Tip content={t.field.structuredStub}>
            <span>
              <Btn variant="outline" disabled className="pointer-events-none">
                <SquareStack aria-hidden />
                {t.field.structuredOpen}
              </Btn>
            </span>
          </Tip>
        )}
      </div>
    </div>
  );
}
