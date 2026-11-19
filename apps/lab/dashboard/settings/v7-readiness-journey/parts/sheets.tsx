// Review (before save) and history (per group) side sheets. Both read as sentences, never JSON.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Dialog } from 'radix-ui';
import { ArrowLeft, ArrowRight, History, RotateCcw, ServerCog, ShieldAlert, TriangleAlert, Users, X } from 'lucide-react';
import type { FieldValue, SettingsGroup, SettingsHistoryEntry } from '@lab/mocks/settings';
import { cn } from '@lab/utils';
import { findField, formatDateTime, formatRelative, L } from './data';
import { inputCls } from './controls';
import { useFmt } from './nav';
import { displayAuthor, useSettings } from './store';
import { Btn, IconBtn, Pill } from './ui';

export function SideSheet({
  open,
  onClose,
  title,
  description,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const { t, lang } = useSettings();
  const reduce = useReducedMotion();
  const from = lang === 'ar' ? '-100%' : '100%';
  // Return focus to whatever opened the sheet (radix only does this for its own Trigger).
  const opener = useRef<HTMLElement | null>(null);
  const wasOpen = useRef(false);
  if (open && !wasOpen.current && typeof document !== 'undefined') opener.current = document.activeElement as HTMLElement | null;
  wasOpen.current = open;
  return (
    <Dialog.Root open={open} onOpenChange={(v) => !v && onClose()}>
      <AnimatePresence>
        {open ? (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild forceMount>
              <motion.div
                className="fixed inset-0 z-50 bg-black/40"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: reduce ? 0 : 0.18 }}
              />
            </Dialog.Overlay>
            <Dialog.Content
              asChild
              forceMount
              aria-describedby={undefined}
              onCloseAutoFocus={(e) => {
                e.preventDefault();
                const target = opener.current && document.contains(opener.current) && opener.current !== document.body ? opener.current : document.querySelector<HTMLElement>('main h1');
                target?.focus({ preventScroll: true });
              }}
            >
              <motion.div
                dir={lang === 'ar' ? 'rtl' : 'ltr'}
                className="fixed inset-y-0 end-0 z-50 flex w-full flex-col bg-card text-card-foreground shadow-2xl outline-none sm:max-w-[36rem]"
                initial={reduce ? { opacity: 0 } : { x: from }}
                animate={reduce ? { opacity: 1 } : { x: 0 }}
                exit={reduce ? { opacity: 0 } : { x: from }}
                transition={{ type: 'tween', duration: reduce ? 0 : 0.26, ease: [0.22, 1, 0.36, 1] }}
              >
                <div className="flex items-start gap-3 border-b border-border px-5 py-4">
                  <div className="min-w-0 flex-1">
                    <Dialog.Title className="text-18 font-bold leading-snug">{title}</Dialog.Title>
                    {description ? <div className="mt-1 text-13 leading-relaxed text-muted-foreground">{description}</div> : null}
                  </div>
                  <Dialog.Close asChild>
                    <IconBtn label={t.review.close} className="-me-2">
                      <X />
                    </IconBtn>
                  </Dialog.Close>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
                {footer ? <div className="border-t border-border bg-card px-5 py-4">{footer}</div> : null}
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        ) : null}
      </AnimatePresence>
    </Dialog.Root>
  );
}

function ChangeLine({
  group,
  field,
  from,
  to,
  showMarks,
}: {
  group: string;
  field: string;
  from: FieldValue;
  to: FieldValue;
  showMarks?: boolean;
}) {
  const { t, lang } = useSettings();
  const fmt = useFmt();
  const hit = findField(group, field);
  const Arrow = lang === 'ar' ? ArrowLeft : ArrowRight;
  const label = hit ? L(hit.field.label, lang) : field;
  const show = (v: FieldValue) => (hit ? fmt(hit.field, v) : JSON.stringify(v));
  const f = hit?.field;
  return (
    <li className="py-3">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="text-14 font-semibold">{label}</span>
        {showMarks && f?.risk === 'high' ? <Pill tone="danger" icon={<TriangleAlert />}>{t.review.impactHigh}</Pill> : null}
        {showMarks && f?.control === 'security' ? <Pill icon={<ShieldAlert />}>{t.badge.security}</Pill> : null}
        {showMarks && f?.control === 'money' ? <Pill>{t.badge.money}</Pill> : null}
        {showMarks && f?.twoPerson ? <Pill icon={<Users />}>{t.badge.twoPerson}</Pill> : null}
        {showMarks && f?.proposed ? <Pill tone="violet" icon={<ServerCog />}>{t.badge.proposed}</Pill> : null}
      </div>
      <p className="mt-1 flex flex-wrap items-center gap-2 text-13">
        <bdi className="rounded bg-muted px-1.5 py-0.5 text-muted-foreground line-through decoration-muted-foreground/60">{show(from)}</bdi>
        <Arrow className="size-3.5 shrink-0 text-muted-foreground" aria-label={t.review.to} />
        <bdi className="rounded bg-primary/10 px-1.5 py-0.5 font-semibold dark:bg-primary/20">{show(to)}</bdi>
      </p>
      {hit ? <p className="mt-1 text-12 text-muted-foreground">{L(hit.subsection.title, lang)}</p> : null}
    </li>
  );
}

export function ReviewSheet({ group }: { group: SettingsGroup }) {
  const { state, dispatch, t, lang } = useSettings();
  const open = state.view === 'group' && state.sheet === 'review';
  const draft = state.drafts[group.key] ?? {};
  const keys = Object.keys(draft);
  const saved = state.saved[group.key] ?? {};
  const next = state.meta[group.key].version + 1;
  const restoreFrom = state.restoreFrom[group.key];
  const fields = keys.map((k) => findField(group.key, k)?.field).filter(Boolean);
  const highRisk = fields.some((f) => f!.risk === 'high');
  const security = fields.some((f) => f!.control === 'security');
  const twoPerson = fields.some((f) => f!.twoPerson);
  const proposed = fields.some((f) => f!.proposed);
  const pending = state.role !== 'owner' && group.approval === 'second-approver';
  const [typed, setTyped] = useState('');
  const [ack, setAck] = useState(false);
  const [note, setNote] = useState('');
  useEffect(() => {
    if (open) {
      setTyped('');
      setAck(false);
    }
  }, [open]);
  const word = t.review.confirmWord;
  const typedOk = ['تأكيد', 'confirm'].includes(typed.trim().toLowerCase()) || typed.trim() === word;
  const ready = keys.length > 0 && (!highRisk || typedOk) && (highRisk || !security || ack);
  const title = L(group.title, lang);

  const save = () => {
    if (!ready) return;
    dispatch({ type: 'save', group: group.key, note, pending });
    dispatch({ type: 'toast', text: pending ? t.save.sent(title) : t.save.saved(title, next) });
    setNote('');
  };

  return (
    <SideSheet
      open={open}
      onClose={() => dispatch({ type: 'sheet', sheet: null })}
      title={t.review.title(title)}
      description={keys.length ? (restoreFrom ? t.review.restoreIntro(restoreFrom, next) : t.review.intro(keys.length, next)) : t.review.empty}
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
          {keys.length && !ready ? (
            <p id="save-reason" className="text-12 text-muted-foreground sm:me-auto">
              {highRisk ? t.review.needType(word) : t.review.needAck}
            </p>
          ) : null}
          <Btn variant="outline" onClick={() => dispatch({ type: 'sheet', sheet: null })}>
            {t.review.back}
          </Btn>
          <Btn onClick={save} disabled={!ready} aria-describedby={!ready ? 'save-reason' : undefined}>
            {pending ? t.review.sendApproval : t.review.saveAs(next)}
          </Btn>
        </div>
      }
    >
      <ul className="divide-y divide-border">
        {keys.map((k) => (
          <ChangeLine key={k} group={group.key} field={k} from={saved[k] ?? null} to={draft[k]} showMarks />
        ))}
      </ul>

      {keys.length ? (
        <div className="mt-4 space-y-3">
          {group.approval === 'second-approver' ? (
            <p className="flex gap-2 rounded-xl bg-muted px-3 py-2.5 text-13 leading-relaxed">
              <Users className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
              {pending ? <strong className="font-semibold">{t.review.waitsSecond}</strong> : t.review.ownerDirect}
            </p>
          ) : null}
          {twoPerson ? <p className="rounded-xl bg-muted px-3 py-2.5 text-13">{t.review.twoPersonNote}</p> : null}
          {proposed ? (
            <p className="flex gap-2 rounded-xl bg-accent-violet/10 px-3 py-2.5 text-13 leading-relaxed">
              <ServerCog className="mt-0.5 size-4 shrink-0 text-accent-violet-on-soft" aria-hidden />
              {t.review.proposedNote}
            </p>
          ) : null}

          {highRisk ? (
            <div className="rounded-xl border border-border p-3">
              <label htmlFor="type-confirm" className="flex gap-2 text-13 font-semibold leading-relaxed">
                <TriangleAlert className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
                {t.review.typeConfirm(word)}
              </label>
              <input
                id="type-confirm"
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                autoComplete="off"
                aria-label={t.review.typeLabel}
                aria-invalid={typed.length > 0 && !typedOk}
                className={cn(inputCls, 'mt-2')}
              />
            </div>
          ) : security ? (
            <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-border px-3 py-2 text-13 font-semibold">
              <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} className="size-5 accent-[color:var(--primary)]" />
              {t.review.securityAck}
            </label>
          ) : null}

          <div>
            <label htmlFor="review-note" className="text-13 font-semibold">
              {t.review.reason}
            </label>
            <textarea
              id="review-note"
              value={note}
              maxLength={500}
              rows={2}
              onChange={(e) => setNote(e.target.value)}
              aria-describedby="review-note-hint"
              className={cn(inputCls, 'mt-1.5 h-auto min-h-20 py-2')}
            />
            <p id="review-note-hint" className="mt-1 flex justify-between text-12 text-muted-foreground">
              <span>{t.review.reasonHint}</span>
              <span className="tabular-nums">{note.length}/500</span>
            </p>
          </div>
        </div>
      ) : null}
    </SideSheet>
  );
}

/** Values of version `v` for every field changed after it (forward-only restore). */
function revertTo(entries: SettingsHistoryEntry[], v: number): Record<string, FieldValue> {
  const values: Record<string, FieldValue> = {};
  for (const e of entries) {
    if (e.version <= v) continue;
    for (const c of e.changes) values[c.field] = c.from;
  }
  return values;
}

export function HistorySheet({ group }: { group: SettingsGroup }) {
  const { state, dispatch, t, lang } = useSettings();
  const open = state.view === 'group' && state.sheet === 'history';
  const entries = state.history[group.key] ?? [];
  const current = state.meta[group.key].version;
  const next = current + 1;
  const real = entries.filter((e) => e.changes.length || e.version === current);

  return (
    <SideSheet
      open={open}
      onClose={() => dispatch({ type: 'sheet', sheet: null })}
      title={t.history.title(L(group.title, lang))}
      description={real.length ? null : undefined}
    >
      {entries.length === 0 ? (
        <div className="grid place-items-center gap-2 py-12 text-center">
          <span className="grid size-12 place-items-center rounded-full bg-muted text-muted-foreground">
            <History className="size-5" aria-hidden />
          </span>
          <p className="text-14 font-semibold">{t.history.empty}</p>
          <p className="max-w-[40ch] text-13 text-muted-foreground">{t.history.emptyHint}</p>
        </div>
      ) : (
        <ol className="space-y-4">
          {entries.map((e) => (
            <li key={e.version} className="rounded-xl border border-border p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="flex items-center gap-2 text-15 font-bold">
                  {t.group.version(e.version)}
                  {e.version === current ? <Pill tone="success">{t.history.current}</Pill> : null}
                </p>
                <time dateTime={e.at} className="text-12 text-muted-foreground">
                  {formatDateTime(e.at, lang)} ({formatRelative(e.at, lang)})
                </time>
              </div>
              <p className="mt-1 text-13 text-muted-foreground">
                {t.history.by(displayAuthor(e.by, t))}
                {e.approvedBy ? `${lang === 'ar' ? '، ' : ', '}${t.history.approvedBy(e.approvedBy)}` : ''}
                {e.requestId ? (
                  <span className="block">
                    <bdi dir="ltr" className="font-mono text-12">
                      {e.requestId}
                    </bdi>
                  </span>
                ) : null}
              </p>
              <p className={cn('mt-2 text-13', !e.note && 'text-muted-foreground italic')}>{e.note ? `«${L(e.note, lang)}»` : t.history.noNote}</p>
              {e.changes.length ? (
                <ul className="mt-1 divide-y divide-border">
                  {e.changes.map((c) => (
                    <ChangeLine key={c.field} group={group.key} field={c.field} from={c.from} to={c.to} />
                  ))}
                </ul>
              ) : null}
              {e.version !== current ? (
                <div className="mt-2 flex flex-wrap items-center gap-3 border-t border-border pt-3">
                  <Btn
                    variant="outline"
                    onClick={() => {
                      dispatch({ type: 'stage', group: group.key, values: revertTo(entries, e.version), restoreFrom: e.version });
                      dispatch({ type: 'sheet', sheet: 'review' });
                    }}
                  >
                    <RotateCcw aria-hidden />
                    {t.history.restore(e.version)}
                  </Btn>
                  <span className="text-12 text-muted-foreground">{t.history.restoreHint(e.version, next)}</span>
                </div>
              ) : null}
            </li>
          ))}
        </ol>
      )}
    </SideSheet>
  );
}
