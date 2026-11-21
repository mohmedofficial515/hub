// Review before Save: every change as a readable sentence ("Refund destination: Card → Wallet"), grouped by group with
// its next version, marks for high risk / security / second approver / proposed, an optional reason, a checkbox for
// security or high-risk changes and type-to-confirm only when a high-risk field is in the list.

import { useEffect, useMemo, useState } from 'react';
import { Coins, ShieldCheck, Sparkles, TriangleAlert, Undo2, Users } from 'lucide-react';
import { useLocale, useT } from '@lab/i18n';
import { cn } from '@lab/utils';
import { messages } from '../i18n';
import { formatValue, fmtNumber, loc, validate } from './format';
import { iconFor } from './icons';
import { entryOf, groupByKey, needsConfirm, waitsForApprover } from './model';
import { navigate } from './route';
import { fold } from './search';
import { useStore } from './store';
import { Badge, Btn, IconTile, Sheet, focusRing } from './ui';

export function ReviewSheet({ open, onOpenChange, groupKeys }: { open: boolean; onOpenChange: (o: boolean) => void; groupKeys: string[] }) {
  const t = useT(messages);
  const locale = useLocale();
  const store = useStore();
  const [note, setNote] = useState('');
  const [ack, setAck] = useState(false);
  const [typed, setTyped] = useState('');

  const blocks = useMemo(
    () =>
      groupKeys
        .map((groupKey) => {
          const group = groupByKey(groupKey);
          const lines = Object.entries(store.drafts[groupKey] ?? {})
            .map(([key, to]) => {
              const entry = entryOf(groupKey, key);
              if (!entry) return null;
              const from = store.saved(groupKey, key);
              return {
                key,
                entry,
                from,
                to,
                error: validate(entry.field, to, t, locale),
                waits: waitsForApprover(store.role, group, entry.field),
              };
            })
            .filter((l): l is NonNullable<typeof l> => !!l);
          return { groupKey, group, lines };
        })
        .filter((b) => b.lines.length && b.group),
    [groupKeys, store, t, locale],
  );

  const prefill = groupKeys.map((k) => store.draftNote[k]).find(Boolean) ?? '';
  useEffect(() => {
    if (open) {
      setNote(prefill);
      setAck(false);
      setTyped('');
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const lines = blocks.flatMap((b) => b.lines);
  const errors = lines.filter((l) => l.error);
  const highRisk = lines.some((l) => l.entry.field.risk === 'high');
  const sensitive = lines.some((l) => needsConfirm(l.entry.field));
  const waiting = lines.filter((l) => l.waits).length;
  const word = t.review.confirmWord;
  const typedOk = !highRisk || fold(typed.trim()) === fold(word);
  const ackOk = !sensitive || highRisk || ack;
  const canSave = lines.length > 0 && errors.length === 0 && typedOk && ackOk;

  const submit = () => {
    if (!canSave) return;
    const result = store.save(
      blocks.map((b) => b.groupKey),
      note,
    );
    for (const s of result.saved) store.toast(t.toasts.saved(loc(groupByKey(s.groupKey)?.title, locale), fmtNumber(s.version, locale)));
    for (const r of result.requested) store.toast(t.toasts.requested(loc(groupByKey(r.groupKey)?.title, locale), r.id), 'info');
    onOpenChange(false);
  };

  const single = blocks.length === 1 ? blocks[0] : null;
  const primaryLabel =
    waiting === lines.length
      ? t.review.sendForApproval
      : waiting > 0
        ? t.review.saveAndSend(lines.length - waiting, waiting)
        : single
          ? t.review.saveAsVersion(fmtNumber(store.version(single.groupKey) + 1, locale))
          : t.review.saveAll(lines.length);

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      closeLabel={t.common.close}
      title={single ? t.review.titleGroup(loc(single.group?.title, locale)) : t.review.title}
      description={t.review.lead(t.n.changes(lines.length), t.n.groups(blocks.length))}
      footer={
        <div className="flex flex-col gap-2 sm:flex-row-reverse sm:items-center">
          <Btn variant={highRisk ? 'danger' : 'primary'} onClick={submit} aria-disabled={!canSave} className={cn(!canSave && 'opacity-55')}>
            {primaryLabel}
          </Btn>
          <Btn variant="ghost" onClick={() => onOpenChange(false)}>
            {t.review.keepEditing}
          </Btn>
          {!canSave && lines.length > 0 && (
            <p className="text-12 text-muted-foreground sm:me-auto" role="status">
              {errors.length ? t.review.fixErrors(errors.length) : !typedOk ? t.review.typeToSave(word) : t.review.tickToSave}
            </p>
          )}
        </div>
      }
    >
      {lines.length === 0 ? (
        <p className="py-8 text-center text-14 text-muted-foreground">{t.review.nothing}</p>
      ) : (
        <div className="flex flex-col gap-6">
          {blocks.map(({ groupKey, group, lines: gl }) => {
            const Icon = iconFor(group!.icon);
            const groupWaits = gl.every((l) => l.waits);
            return (
              <section key={groupKey} aria-label={loc(group!.title, locale)}>
                <header className="mb-2 flex items-center gap-3">
                  <IconTile icon={Icon} size="sm" />
                  <h3 className="min-w-0 flex-1 text-15 font-bold">{loc(group!.title, locale)}</h3>
                  <span className="text-12 font-semibold text-muted-foreground">
                    {groupWaits
                      ? t.review.toRequest
                      : t.review.versionStep(fmtNumber(store.version(groupKey), locale), fmtNumber(store.version(groupKey) + 1, locale))}
                  </span>
                </header>
                <ul className="divide-y divide-border rounded-2xl border border-border bg-card">
                  {gl.map((l) => {
                    const f = l.entry.field;
                    const label = loc(f.label, locale);
                    return (
                      <li key={l.key} className="flex items-start gap-3 px-4 py-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-12 text-muted-foreground">{loc(l.entry.subsectionTitle, locale)}</p>
                          <p className="mt-0.5 text-14 leading-relaxed">
                            <span className="font-semibold">{label}: </span>
                            <bdi className="text-muted-foreground line-through decoration-muted-foreground/50">{formatValue(f, l.from, locale, t, 4)}</bdi>{' '}
                            <span aria-hidden>{t.arrow}</span>
                            <span className="sr-only">{t.review.becomes}</span>{' '}
                            <bdi className="font-bold">{formatValue(f, l.to, locale, t, 4)}</bdi>
                          </p>
                          <div className="mt-1.5 flex flex-wrap gap-1.5">
                            {f.risk === 'high' && (
                              <Badge tone="danger" icon={<TriangleAlert aria-hidden />}>
                                {t.badges.highRisk}
                              </Badge>
                            )}
                            {f.control === 'security' && (
                              <Badge icon={<ShieldCheck aria-hidden />}>{t.badges.security}</Badge>
                            )}
                            {f.control === 'money' && <Badge icon={<Coins aria-hidden />}>{t.badges.money}</Badge>}
                            {l.waits && (
                              <Badge tone="warning" icon={<Users aria-hidden />}>
                                {t.review.waits}
                              </Badge>
                            )}
                            {!l.waits && group!.approval === 'second-approver' && (f.control === 'security' || f.twoPerson) && (
                              <Badge icon={<Users aria-hidden />}>{t.review.ownerDirect}</Badge>
                            )}
                            {(f.proposed || f.proposedOptions?.length) && (
                              <Badge tone="violet" icon={<Sparkles aria-hidden />}>
                                {t.review.proposedLine}
                              </Badge>
                            )}
                          </div>
                          {l.error && (
                            <p className="mt-1.5 text-13 font-semibold text-destructive">
                              {l.error}{' '}
                              <button
                                type="button"
                                className={cn('underline underline-offset-2', focusRing)}
                                onClick={() => {
                                  onOpenChange(false);
                                  navigate({ view: 'group', group: groupKey, field: l.key });
                                }}
                              >
                                {t.review.fix}
                              </button>
                            </p>
                          )}
                        </div>
                        <Btn variant="quiet" size="icon" aria-label={t.review.undo(label)} onClick={() => store.discard(groupKey, l.key)}>
                          <Undo2 aria-hidden className="size-4" />
                        </Btn>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}

          {waiting > 0 && (
            <p className="flex items-start gap-2 rounded-2xl bg-muted px-4 py-3 text-13 leading-relaxed">
              <Users aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              {t.review.waitNote(waiting)}
            </p>
          )}

          <div>
            <label htmlFor="review-note" className="text-14 font-semibold">
              {t.review.reason}
            </label>
            <p className="text-12 text-muted-foreground">{t.review.reasonHelp}</p>
            <textarea
              id="review-note"
              value={note}
              maxLength={500}
              rows={2}
              onChange={(e) => setNote(e.target.value)}
              className={cn('mt-2 w-full rounded-xl border border-muted-foreground/85 bg-card px-3 py-2 text-14 leading-relaxed', focusRing)}
            />
            <p className="text-end text-12 tabular-nums text-muted-foreground">{fmtNumber(note.length, locale)} / 500</p>
          </div>

          {sensitive && !highRisk && (
            <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-2xl border border-border bg-card px-4 py-3 text-14 leading-relaxed">
              <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} className="mt-1 size-5 shrink-0 accent-[var(--primary)]" />
              <span>{t.review.ack}</span>
            </label>
          )}
          {highRisk && (
            <div className="rounded-2xl border border-border bg-card px-4 py-3">
              <p className="flex items-start gap-2 text-14 leading-relaxed">
                <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-destructive" />
                <span>{t.review.highRiskLead}</span>
              </p>
              <label htmlFor="review-confirm" className="mt-3 block text-13 font-semibold">
                {t.review.typeLabel(word)}
              </label>
              <input
                id="review-confirm"
                value={typed}
                autoComplete="off"
                onChange={(e) => setTyped(e.target.value)}
                aria-invalid={typed.length > 0 && !typedOk}
                className={cn('mt-1.5 h-11 w-full rounded-xl border border-muted-foreground/85 bg-background px-3 text-14', focusRing)}
              />
            </div>
          )}
        </div>
      )}
    </Sheet>
  );
}
