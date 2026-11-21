// One field row: label, markers, help, key, the control at the inline end, and when staged the "in draft" line with its impact.
import { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Info, Link2, Lock, PencilRuler, RotateCcw, Ticket, TriangleAlert, Undo2, Users } from 'lucide-react';
import { cn } from '@dash/lib/utils';
import type { FieldValue, FlatField } from '@lab/mocks/settings';
import { getGroup } from '@lab/mocks/settings';
import { FieldControl } from './controls';
import { canonicalId } from './data';
import { formatValue, num, sameValue } from './format';
import { impactOf } from './impact';
import { useDesk } from './store';
import { Badge, Btn, Dot, focusRing, Tip, TipBadge } from './ui';

export function Arrow({ className }: { className?: string }) {
  const { t } = useDesk();
  const C = t.dir === 'rtl' ? ArrowLeft : ArrowRight;
  return <C aria-hidden className={cn('inline size-3.5 shrink-0', className)} />;
}

/** Before → after, each value isolated for bidi. */
export function FromTo({ field, from, to, strong = true }: { field: FlatField; from: FieldValue; to: FieldValue; strong?: boolean }) {
  const { t, l } = useDesk();
  return (
    <span className="inline-flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5">
      <span className="text-muted-foreground line-through decoration-muted-foreground/50">
        <bdi>{formatValue(field, from, l, t)}</bdi>
      </span>
      <Arrow className="text-muted-foreground" />
      <span className={cn(strong && 'font-bold text-foreground')}>
        <bdi>{formatValue(field, to, l, t)}</bdi>
      </span>
    </span>
  );
}

export function FieldMarkers({ field }: { field: FlatField }) {
  const { t } = useDesk();
  const f = t.field;
  return (
    <>
      {field.proposed && <TipBadge tone="info" label={f.proposed} tip={f.proposedTip(field.proposalId ?? '', field.priority ?? '', field.needsBackend !== false)} />}
      {field.deprecated && <TipBadge tone="warning" label={f.deprecated} tip={f.deprecatedTip} />}
      {field.risk === 'high' && <TipBadge tone="danger" label={f.highRisk} tip={f.highRiskTip} icon={<TriangleAlert aria-hidden />} />}
      {field.control === 'security' && <TipBadge tone="neutral" label={f.security} tip={f.securityTip} icon={<Lock aria-hidden />} />}
      {field.control === 'money' && <TipBadge tone="neutral" label={f.money} tip={f.moneyTip} icon={<Lock aria-hidden />} />}
      {field.twoPerson && <TipBadge tone="neutral" label={f.twoPerson} tip={f.twoPersonTip} icon={<Users aria-hidden />} />}
      {field.readOnly && <TipBadge tone="neutral" label={f.readOnly} tip={f.readOnlyTip} />}
    </>
  );
}

export function FieldRow({ field }: { field: FlatField }) {
  const { t, l, get, getApplied, draft, stage, unstage, route, toast, role, saveNow, staleGroups } = useDesk();
  const reduce = useReducedMotion();
  const id = canonicalId(field);
  const value = get(id);
  const applied = getApplied(id);
  const staged = id in draft;
  const changedFromDefault = !sameValue(value, field.default);
  const disabled = !!field.proposed || !!field.readOnly;
  const wide = field.type === 'string-list' || field.type === 'multi-enum' || field.multiline || (typeof value === 'string' && value.length > 48);
  const ref = useRef<HTMLDivElement>(null);
  const [flash, setFlash] = useState(false);
  const domId = `field-${field.id}`;
  const lbl = `lbl-${field.id}`;
  const focused = route.v === 'group' && route.f === field.key && route.g === field.groupKey;

  useEffect(() => {
    if (!focused || !ref.current) return;
    ref.current.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
    setFlash(true);
    const timer = window.setTimeout(() => setFlash(false), 2400);
    return () => window.clearTimeout(timer);
  }, [focused, reduce]);

  const onChange = (v: FieldValue) => stage(field, v);
  const impact = staged ? impactOf(id, getApplied, get, l, t) : null;
  const storedGroup = field.storedIn ? getGroup(field.storedIn) : undefined;

  const copyLink = async () => {
    const url = new URL(location.href);
    const [path, q = ''] = url.hash.replace(/^#/, '').split('?');
    const p = new URLSearchParams(q);
    p.set('v', 'group');
    p.set('g', field.groupKey);
    p.set('f', field.key);
    url.hash = `${path}?${p.toString()}`;
    try {
      await navigator.clipboard.writeText(url.toString());
    } catch {
      /* clipboard can be blocked in the frame; the toast still confirms the link was built */
    }
    toast(t.field.copied);
  };

  return (
    <motion.div
      ref={ref}
      id={domId}
      data-field={field.id}
      animate={flash && !reduce ? { backgroundColor: ['color-mix(in oklab, var(--primary) 0%, transparent)', 'color-mix(in oklab, var(--primary) 12%, transparent)', 'color-mix(in oklab, var(--primary) 0%, transparent)'] } : undefined}
      transition={{ duration: 2.2, ease: 'easeInOut' }}
      className={cn('scroll-mt-28 rounded-xl px-3 py-4 sm:px-4', flash && 'ring-2 ring-primary/60', staged && 'bg-warning/[0.06]')}
    >
      <div className={cn('grid gap-3', !wide && 'sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start sm:gap-6')}>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            {changedFromDefault && (
              <Tip content={`${t.field.changedFromDefault} · ${t.field.defaultIs(formatValue(field, field.default, l, t))}`}>
                <button type="button" className={cn('inline-flex size-11 items-center justify-center rounded-full sm:size-6', focusRing)} aria-label={`${t.field.changedFromDefault}. ${t.field.defaultIs(formatValue(field, field.default, l, t))}`}>
                  <Dot className="bg-[color:var(--primary)]" />
                </button>
              </Tip>
            )}
            <h4 id={lbl} className="text-14 font-bold leading-snug">
              {field.label[l]}
            </h4>
            {staged && (
              <Badge tone="warning" icon={<Ticket aria-hidden />}>
                {t.ticket.staged}
              </Badge>
            )}
            <FieldMarkers field={field} />
          </div>
          <p className="mt-1 max-w-[62ch] text-13 leading-relaxed text-muted-foreground">{field.help[l]}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-12 text-muted-foreground">
            <code dir="ltr" className="rounded bg-muted px-1 py-px">
              {field.key}
            </code>
            {(field.type === 'integer' || field.type === 'number' || field.type === 'money' || field.type === 'duration') && field.min != null && field.max != null && field.unit !== 'bytes' && (
              <span>{t.field.range(formatValue(field, field.min, l, t), formatValue(field, field.max, l, t))}</span>
            )}
            {storedGroup && <span>{t.field.storedIn(storedGroup.title[l])}</span>}
            {field.note && (
              <span className="inline-flex items-center gap-1">
                <Info aria-hidden className="size-3" />
                {field.note[l]}
              </span>
            )}
          </div>
        </div>

        <div className={cn('flex min-w-0 flex-wrap items-start gap-1', !wide && 'sm:justify-end')}>
          {field.structured ? (
            <Structured field={field} value={value} />
          ) : (
            <FieldControl field={field} value={value} onChange={onChange} disabled={disabled} id={`ctl-${field.id}`} labelledBy={lbl} />
          )}
          <div className="flex items-center">
            {changedFromDefault && !disabled && !field.structured && (
              <Tip content={`${t.field.reset} · ${t.field.defaultIs(formatValue(field, field.default, l, t))}`}>
                <Btn size="icon" variant="ghost" aria-label={`${t.field.reset}: ${field.label[l]}`} onClick={() => stage(field, field.default, false)}>
                  <RotateCcw aria-hidden />
                </Btn>
              </Tip>
            )}
            <Tip content={t.field.copyLink}>
              <Btn size="icon" variant="ghost" aria-label={`${t.field.copyLink}: ${field.label[l]}`} onClick={copyLink}>
                <Link2 aria-hidden />
              </Btn>
            </Tip>
          </div>
        </div>
      </div>

      {staged && (
        <div className="mt-3 flex flex-wrap items-start justify-between gap-2 rounded-lg bg-card px-3 py-2 text-13 shadow-xs ring-1 ring-border">
          <div className="grid min-w-0 gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-muted-foreground">{t.group.stagedLine}:</span>
              <FromTo field={field} from={applied} to={value} />
            </div>
            {impact && <p className="text-12 text-muted-foreground">{t.ticket.effect}: {impact}</p>}
            {role === 'staff' && field.control === 'security' && <p className="text-12 text-muted-foreground">{t.review.waitsApprover}</p>}
          </div>
          <div className="flex flex-wrap items-center gap-1">
            {Object.keys(draft).length === 1 && field.risk !== 'high' && field.control !== 'security' && !staleGroups.includes(field.groupKey) && (
              <Btn size="sm" variant="primary" title={t.ticket.saveNowHint} onClick={() => saveNow(id)}>
                {t.ticket.saveNow}
              </Btn>
            )}
            <Btn size="sm" variant="ghost" onClick={() => unstage(id)}>
              <Undo2 aria-hidden />
              {t.field.undo}
            </Btn>
          </div>
        </div>
      )}
    </motion.div>
  );
}

function Structured({ field, value }: { field: FlatField; value: FieldValue }) {
  const { t, l, toast } = useDesk();
  const items = Array.isArray(value) ? (value as string[]) : [];
  return (
    <div className="grid w-full gap-2">
      <ul className="grid gap-1">
        {items.length === 0 && <li className="text-13 text-muted-foreground">{t.field.items(0)}</li>}
        {items.map((it) => (
          <li key={String(it)} className="rounded-lg bg-muted px-3 py-1.5 text-13">
            <bdi>{String(it)}</bdi>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center gap-2 text-12 text-muted-foreground">
        <span>
          {t.field.items(items.length)} · {t.field.structured}
        </span>
        {!field.readOnly && (
          <Btn size="sm" variant="outline" onClick={() => toast(t.field.editorStub)}>
            <PencilRuler aria-hidden />
            {t.field.openEditor}
          </Btn>
        )}
      </div>
      <span className="sr-only">{num(items.length, l)}</span>
    </div>
  );
}
