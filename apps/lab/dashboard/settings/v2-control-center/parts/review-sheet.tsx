/**
 * Review before save: the draft as readable sentences grouped by subsection, the approval path, friction in
 * proportion to risk (a checkbox for security controls, typing the group name only for high-impact fields),
 * an optional reason, then "Save as vN" or "Send for approval". Restores use the same sheet.
 */
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { ShieldCheck, TriangleAlert } from 'lucide-react';
import { cn } from '@lab/utils';
import type { SettingsGroup } from '@lab/mocks/settings';
import { ChangeLine } from './changes';
import { count, fill, num } from './format';
import { diff, isApprovalChange, needsSecurityConfirm, needsTypedConfirm, type Change } from './model';
import { Sheet } from './overlay';
import { useStore } from './store';
import { Btn } from './ui';

const fold = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[ً-ٰٟـ]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/\s+/g, ' ')
    .trim();

export function ReviewSheet({ group, open, onClose }: { group: SettingsGroup; open: boolean; onClose: () => void }) {
  const { t, locale, drafts, saved, meta, commit, sendForApproval, needsApproval, toast, restoreFrom, viewer } = useStore();
  const changes = useMemo(() => diff(group, saved[group.key], drafts[group.key] ?? {}), [group, saved, drafts]);
  const next = meta[group.key].version + 1;
  const restoring = restoreFrom[group.key];
  const typed = needsTypedConfirm(changes);
  const security = !typed && needsSecurityConfirm(changes);
  const approvalChanges = changes.filter(isApprovalChange);
  const waits = needsApproval(group) && approvalChanges.length > 0;
  const name = group.title[locale];

  const [confirmText, setConfirmText] = useState('');
  const [checked, setChecked] = useState(false);
  const [reason, setReason] = useState('');
  const [nudge, setNudge] = useState(false);
  const confirmRef = useRef<HTMLInputElement>(null);
  const checkRef = useRef<HTMLInputElement>(null);
  const ids = useId();

  useEffect(() => {
    if (!open) {
      setConfirmText('');
      setChecked(false);
      setReason('');
      setNudge(false);
    }
  }, [open]);

  const bySection = useMemo(() => {
    const map = new Map<string, { title: string; items: Change[] }>();
    for (const c of changes) {
      const id = c.ref?.sub.id ?? '_';
      const entry = map.get(id) ?? { title: c.ref?.sub.title[locale] ?? '', items: [] };
      entry.items.push(c);
      map.set(id, entry);
    }
    return [...map.values()];
  }, [changes, locale]);

  const confirmed = typed ? fold(confirmText) === fold(name) : security ? checked : true;

  const submit = () => {
    if (!confirmed) {
      setNudge(true);
      (typed ? confirmRef.current : checkRef.current)?.focus();
      return;
    }
    if (waits) {
      sendForApproval(group.key, reason.trim());
      toast(t.review.sent);
    } else {
      const v = commit(group.key, reason.trim());
      toast(restoring ? fill(t.review.restored, { from: num(locale, restoring), v: num(locale, v) }) : fill(t.review.saved, { v: num(locale, v) }));
    }
    onClose();
  };

  const title = restoring ? fill(t.review.titleRestore, { v: num(locale, restoring) }) : t.review.title;
  const lead = restoring
    ? fill(t.review.leadRestore, { v: num(locale, next), from: num(locale, restoring) })
    : fill(t.review.lead, { group: name, v: num(locale, next) });

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => (o ? null : onClose())}
      title={title}
      description={lead}
      closeLabel={t.review.back}
      footer={
        changes.length ? (
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Btn variant="ghost" onClick={onClose}>
              {t.review.back}
            </Btn>
            <Btn variant="primary" onClick={submit} className="flex-1 sm:flex-none" aria-describedby={nudge && !confirmed ? `${ids}-nudge` : undefined}>
              {waits ? t.review.send : fill(t.review.save, { v: num(locale, next) })}
            </Btn>
          </div>
        ) : null
      }
    >
      {changes.length === 0 ? (
        <p className="text-14 text-muted-foreground">{t.review.nothing}</p>
      ) : (
        <div className="grid gap-5">
          <p className="text-13 font-semibold text-muted-foreground">
            {fill(t.review.countLine, { n: num(locale, changes.length), s: num(locale, bySection.length) })}
          </p>
          {bySection.map((section) => (
            <section key={section.title} className="rounded-2xl border border-border">
              <h3 className="border-b border-border px-4 py-2.5 text-13 font-bold text-muted-foreground">{section.title}</h3>
              <div className="divide-y divide-border/70 px-4">
                {section.items.map((c) => (
                  <ChangeLine key={c.key} change={c} />
                ))}
              </div>
            </section>
          ))}

          {group.approval === 'second-approver' && approvalChanges.length ? (
            waits ? (
              <div className="flex gap-3 rounded-2xl bg-info/10 p-4">
                <ShieldCheck className="mt-0.5 size-5 shrink-0 text-info-soft-foreground" aria-hidden />
                <div>
                  <p className="text-14 font-bold">{t.review.approvalTitle}</p>
                  <p className="mt-0.5 text-13 leading-relaxed text-muted-foreground">{t.review.approvalLead}</p>
                </div>
              </div>
            ) : (
              <p className="flex gap-2 text-13 leading-relaxed text-muted-foreground">
                <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
                {viewer === 'owner' ? t.review.approvalOwner : t.review.approvalLead}
              </p>
            )
          ) : null}

          {typed ? (
            <div className="grid gap-2 rounded-2xl border border-border p-4">
              <p className="flex items-center gap-2 text-14 font-bold">
                <TriangleAlert className="size-4 text-warning-strong" aria-hidden />
                {t.review.typeTitle}
              </p>
              <label htmlFor={`${ids}-type`} className="text-13 leading-relaxed text-muted-foreground">
                {fill(t.review.typeLead, { name: '' })}
                <bdi className="font-bold text-foreground">{name}</bdi>
              </label>
              <input
                id={`${ids}-type`}
                ref={confirmRef}
                autoComplete="off"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                aria-invalid={nudge && !confirmed ? true : undefined}
                className={cn(
                  'min-h-11 rounded-xl border border-input bg-background px-3 text-14 outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40',
                  nudge && !confirmed && 'border-destructive',
                )}
              />
            </div>
          ) : null}

          {security ? (
            <label className={cn('flex cursor-pointer items-start gap-3 rounded-2xl border p-4', nudge && !checked ? 'border-destructive' : 'border-border')}>
              <input
                ref={checkRef}
                type="checkbox"
                checked={checked}
                onChange={(e) => setChecked(e.target.checked)}
                className="mt-0.5 size-5 shrink-0 cursor-pointer accent-primary"
              />
              <span className="text-13 leading-relaxed">{t.review.securityConfirm}</span>
            </label>
          ) : null}

          {nudge && !confirmed ? (
            <p id={`${ids}-nudge`} role="alert" className="text-13 font-semibold text-destructive-soft-foreground">
              {typed ? fill(t.review.typeLead, { name }) : t.review.securityConfirm}
            </p>
          ) : null}

          <div className="grid gap-1.5">
            <label htmlFor={`${ids}-reason`} className="text-13 font-bold">
              {t.review.reason}
            </label>
            <textarea
              id={`${ids}-reason`}
              maxLength={500}
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              aria-describedby={`${ids}-reason-hint`}
              className="min-h-20 resize-y rounded-xl border border-input bg-background px-3 py-2.5 text-14 leading-relaxed outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40"
            />
            <p id={`${ids}-reason-hint`} className="flex justify-between gap-3 text-12 text-muted-foreground">
              <span>{t.review.reasonHint}</span>
              <span className="tabular-nums">{num(locale, reason.length)}/500</span>
            </p>
          </div>
          <p className="sr-only">{count(locale, changes.length, t.units.changes)}</p>
        </div>
      )}
    </Sheet>
  );
}
