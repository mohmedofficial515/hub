import { useEffect, useId, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, CircleCheck, Clock3, ShieldAlert, TriangleAlert, X } from 'lucide-react';
import { cn } from './cn';
import { findField, groupByKey, readable, subsectionOf } from './lib';
import { useStore } from './store';
import { Btn, Modal, Pill } from './ui';

export function ReviewDialog() {
  const s = useStore();
  const { t, locale } = s;
  const review = s.review;
  const group = review ? groupByKey.get(review.groupKey) : undefined;
  const [checked, setChecked] = useState(false);
  const [typed, setTyped] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState(false);
  const ids = useId();

  useEffect(() => {
    setChecked(false);
    setTyped('');
    setReason('');
    setError(false);
  }, [review]);

  if (!review || !group) return null;
  const rows = review.changes.map((c) => ({ c, f: findField(group, c.field), sub: subsectionOf(group, c.field) }));
  const high = rows.some((r) => r.f?.risk === 'high');
  const security = rows.some((r) => r.f?.control === 'security');
  const needsCheck = !high && security;
  const send = review.mode === 'save' && s.needsApproval(group, review.changes.map((c) => c.field));
  const next = s.versions[group.key] + 1;
  const ok = high ? typed.trim() === group.key : needsCheck ? checked : true;
  const empty = review.changes.length === 0;

  const submit = () => {
    if (!ok) {
      setError(true);
      return;
    }
    s.confirmReview(reason);
  };

  return (
    <Modal
      open
      onOpenChange={(o) => !o && s.setReview(null)}
      returnTo='[data-act="review"]'
      wide
      closeLabel={t.review.cancel}
      title={review.mode === 'restore' ? t.review.restoreTitle(review.restoreFrom!, group.title[locale]) : t.review.title(group.title[locale])}
      description={
        empty ? t.review.nothing : review.mode === 'restore' ? t.review.restoreLead(review.restoreFrom!, next) : send ? t.review.leadSend(review.changes.length) : t.review.lead(review.changes.length, next)
      }
      footer={
        <>
          <Btn variant="ghost" onClick={() => s.setReview(null)}>
            {t.review.cancel}
          </Btn>
          {!empty ? (
            <Btn variant={high ? 'danger' : 'primary'} onClick={submit} disabled={!ok} aria-describedby={!ok ? `${ids}-why` : undefined} data-act="confirm-save">
              {send ? t.review.send : review.mode === 'restore' ? t.review.restoreAs(next) : t.review.saveAs(next)}
            </Btn>
          ) : null}
        </>
      }
    >
      {!empty ? (
        <ol className="grid grid-cols-1 gap-2">
          {rows.map(({ c, f, sub }) => {
            const waits = (group.approval === 'second-approver' && f?.control === 'security') || f?.twoPerson;
            return (
              <li key={c.field} className="rounded-xl border bg-background px-4 py-3">
                {sub ? <p className="text-12 text-muted-foreground">{sub.title[locale]}</p> : null}
                <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-14 leading-relaxed">
                  <span className="font-bold">{f?.label[locale] ?? c.field}:</span>
                  <span className="text-muted-foreground line-through decoration-muted-foreground/50">
                    <bdi>{readable(f, c.from, t, locale)}</bdi>
                  </span>
                  <ArrowRight className="size-4 shrink-0 text-muted-foreground rtl:rotate-180" aria-label="→" />
                  <span className="font-semibold">
                    <bdi>{readable(f, c.to, t, locale)}</bdi>
                  </span>
                  {f?.risk === 'high' ? <Pill tone="danger">{t.review.highRisk}</Pill> : null}
                  {f?.control === 'security' ? <Pill tone="neutral">{t.review.security}</Pill> : null}
                </p>
                {waits && review.mode === 'save' ? (
                  <p className="mt-1.5 flex items-center gap-1.5 text-12 font-semibold text-muted-foreground">
                    <Clock3 className="size-3.5" aria-hidden />
                    {s.role === 'owner' ? t.review.appliesOwner : t.review.waits}
                  </p>
                ) : null}
              </li>
            );
          })}
        </ol>
      ) : null}

      {!empty && (high || needsCheck) ? (
        <div className={cn('mt-4 rounded-xl border p-4', error && !ok && 'border-destructive')}>
          <p className="flex items-center gap-2 text-13 font-bold">
            <ShieldAlert className={cn('size-4', high ? 'text-destructive' : 'text-primary')} aria-hidden />
            {high ? t.review.typeToConfirm(group.key) : t.review.confirmCheck}
          </p>
          {high ? (
            <input
              id={`${ids}-type`}
              aria-label={t.review.typeLabel}
              dir="ltr"
              autoComplete="off"
              spellCheck={false}
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              aria-invalid={error && !ok ? true : undefined}
              aria-describedby={`${ids}-why`}
              className="mt-2 h-11 w-full rounded-lg border border-input bg-background px-3 font-mono text-14 outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            />
          ) : (
            <label className="mt-2 flex min-h-11 cursor-pointer items-center gap-3 text-13">
              <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} className="size-5 accent-[var(--primary)]" />
              {t.review.confirmCheck}
            </label>
          )}
          <p id={`${ids}-why`} className="mt-2 text-12 text-muted-foreground" aria-live="polite">
            {ok ? t.review.ready : high ? t.review.whyType : t.review.whyCheck}
          </p>
        </div>
      ) : null}

      {!empty ? (
        <div className="mt-4">
          <label htmlFor={`${ids}-reason`} className="text-13 font-semibold">
            {t.review.reason}
          </label>
          <textarea
            id={`${ids}-reason`}
            value={reason}
            maxLength={500}
            rows={2}
            onChange={(e) => setReason(e.target.value)}
            className="mt-1.5 w-full resize-y rounded-lg border border-input bg-background px-3 py-2 text-14 outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          />
          <p className="mt-1 flex justify-between text-11 text-muted-foreground">
            <span>{t.review.reasonHint}</span>
            <span className="tabular-nums">{reason.length}/500</span>
          </p>
        </div>
      ) : null}
    </Modal>
  );
}

export function GuardDialog() {
  const s = useStore();
  const { t, locale } = s;
  if (!s.guard || !s.current) return null;
  return (
    <Modal
      open
      onOpenChange={(o) => !o && s.resolveGuard('stay')}
      closeLabel={t.guard.stay}
      title={
        <span className="flex items-center gap-2">
          <TriangleAlert className="size-5 text-warning-strong dark:text-warning" aria-hidden />
          {t.guard.title}
        </span>
      }
      description={t.guard.body(s.current.title[locale], s.dirtyCount)}
      footer={
        <>
          <Btn variant="ghost" onClick={() => s.resolveGuard('stay')}>
            {t.guard.stay}
          </Btn>
          <Btn onClick={() => s.resolveGuard('discard')}>{t.guard.discard}</Btn>
          <Btn variant="primary" onClick={() => s.resolveGuard('save')}>
            {t.guard.save}
          </Btn>
        </>
      }
    />
  );
}

export function Toast() {
  const s = useStore();
  const reduce = useReducedMotion();
  useEffect(() => {
    if (!s.toast) return;
    const id = window.setTimeout(s.dismissToast, 4200);
    return () => window.clearTimeout(id);
  }, [s.toast, s.dismissToast]);
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-20 z-[60] flex justify-center px-4 md:bottom-6" aria-live="polite" role="status">
      <AnimatePresence>
        {s.toast ? (
          <motion.div
            key={s.toast.id}
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="pointer-events-auto flex max-w-md items-center gap-3 rounded-xl bg-foreground py-2 pe-2 ps-4 text-14 text-background shadow-xl"
          >
            <CircleCheck className="size-4 shrink-0" aria-hidden />
            <span className="min-w-0 flex-1">{s.toast.text}</span>
            <button type="button" aria-label={s.t.toast.dismiss} onClick={s.dismissToast} className="inline-flex size-11 items-center justify-center rounded-lg outline-none hover:bg-background/15 focus-visible:ring-2 focus-visible:ring-background">
              <X className="size-4" aria-hidden />
            </button>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
