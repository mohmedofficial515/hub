// Version history of one group: who, when, the reason, readable changes, approvals. Restore is forward-only:
// "Restore v12" shows what would change and loads it as a draft that saves as the next version.

import { useState } from 'react';
import { CircleDot, Clock3, History, RotateCcw, Users } from 'lucide-react';
import type { FieldValue, SettingsGroup } from '@lab/mocks/settings';
import { useLocale, useT } from '@lab/i18n';
import { messages } from '../i18n';
import { formatValue, fmtDateTime, fmtNumber, fmtRelative, loc } from './format';
import { entryOf, fieldsOf, same, valuesAt } from './model';
import { useStore } from './store';
import { Badge, Btn, Sheet } from './ui';

export function HistorySheet({ open, onOpenChange, group }: { open: boolean; onOpenChange: (o: boolean) => void; group: SettingsGroup }) {
  const t = useT(messages);
  const locale = useLocale();
  const store = useStore();
  const [staging, setStaging] = useState<number | null>(null);
  const entries = store.history(group.key);
  const current = store.version(group.key);
  const pending = store.pending[group.key];
  const savedNow: Record<string, FieldValue> = Object.fromEntries(fieldsOf(group).map((f) => [f.key, store.saved(group.key, f.key)]));
  const synthetic = entries.length === 1 && entries[0].changes.length === 0;

  const sentence = (field: string, from: FieldValue, to: FieldValue) => {
    const e = entryOf(group.key, field);
    if (!e) return { label: field, from: String(from), to: String(to) };
    return { label: loc(e.field.label, locale), from: formatValue(e.field, from, locale, t, 4), to: formatValue(e.field, to, locale, t, 4) };
  };

  const restoreDiff = (k: number) => {
    const target = valuesAt(entries, savedNow, k);
    return Object.keys(target)
      .filter((key) => !same(target[key], savedNow[key]) && entryOf(group.key, key))
      .map((key) => ({ key, from: savedNow[key], to: target[key] }));
  };

  const load = (k: number) => {
    const diff = restoreDiff(k);
    diff.forEach((d) => store.setDraft(group.key, d.key, d.to));
    store.setDraftNote(group.key, t.history.restoreNote(fmtNumber(k, locale)));
    store.toast(t.toasts.restoreLoaded(fmtNumber(k, locale)), 'info');
    setStaging(null);
    onOpenChange(false);
  };

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => {
        if (!o) setStaging(null);
        onOpenChange(o);
      }}
      closeLabel={t.common.close}
      title={t.history.title(loc(group.title, locale))}
      description={t.history.lead}
    >
      <ol className="relative flex flex-col gap-4">
        {pending && (
          <li className="rounded-2xl border border-border bg-card p-4">
            <p className="flex flex-wrap items-center gap-2 text-14 font-semibold">
              <Users aria-hidden className="size-4 text-muted-foreground" />
              {t.history.pending}
              <Badge tone="warning">{pending.id}</Badge>
            </p>
            <p className="mt-1 text-12 text-muted-foreground">{t.history.pendingBy(pending.by, fmtRelative(pending.at, locale))}</p>
            <ul className="mt-2 flex flex-col gap-1">
              {pending.changes.map((c) => {
                const s = sentence(c.field, c.from, c.to);
                return (
                  <li key={c.field} className="text-13">
                    <span className="font-semibold">{s.label}:</span> <bdi className="text-muted-foreground">{s.from}</bdi> {t.arrow} <bdi className="font-semibold">{s.to}</bdi>
                  </li>
                );
              })}
            </ul>
          </li>
        )}
        {entries.map((h, i) => {
          const isCurrent = h.version === current;
          const diff = staging === h.version ? restoreDiff(h.version) : [];
          return (
            <li key={h.version} className="rounded-2xl border border-border bg-card p-4">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="inline-flex items-center gap-1.5 text-15 font-bold">
                  {isCurrent ? <CircleDot aria-hidden className="size-4 text-primary dark:text-foreground" /> : <History aria-hidden className="size-4 text-muted-foreground" />}
                  {t.history.version(fmtNumber(h.version, locale))}
                </span>
                {isCurrent && <Badge tone="primary">{t.history.current}</Badge>}
                <span className="ms-auto text-12 text-muted-foreground" title={fmtDateTime(h.at, locale)}>
                  <Clock3 aria-hidden className="me-1 inline size-3.5 align-[-2px]" />
                  {fmtRelative(h.at, locale)}
                </span>
              </div>
              <p className="mt-1 text-13 text-muted-foreground">
                {t.history.by(h.by, fmtDateTime(h.at, locale))}
                {h.approvedBy && ` · ${t.history.approvedBy(h.approvedBy)}`}
                {h.requestId && (
                  <>
                    {' · '}
                    <bdi>{h.requestId}</bdi>
                  </>
                )}
              </p>
              {h.note && <p className="mt-2 rounded-xl bg-muted px-3 py-2 text-13 leading-relaxed">«{loc(h.note, locale)}»</p>}
              {h.changes.length > 0 ? (
                <ul className="mt-2 flex flex-col gap-1">
                  {h.changes.map((c) => {
                    const s = sentence(c.field, c.from, c.to);
                    return (
                      <li key={c.field} className="text-13 leading-relaxed">
                        <span className="font-semibold">{s.label}:</span> <bdi className="text-muted-foreground">{s.from}</bdi> {t.arrow}{' '}
                        <bdi className="font-semibold">{s.to}</bdi>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="mt-2 text-13 text-muted-foreground">{synthetic ? t.history.noEarlier : t.history.noChanges}</p>
              )}
              {!isCurrent && i > 0 && staging !== h.version && (
                <Btn size="sm" className="mt-3" onClick={() => setStaging(h.version)}>
                  <RotateCcw aria-hidden className="size-4" />
                  {t.history.restore(fmtNumber(h.version, locale))}
                </Btn>
              )}
              {staging === h.version && (
                <div className="mt-3 rounded-xl bg-muted p-3">
                  <p className="text-13 font-semibold">{t.history.restoreLead(fmtNumber(h.version, locale), fmtNumber(current + 1, locale))}</p>
                  {diff.length ? (
                    <ul className="mt-2 flex flex-col gap-1">
                      {diff.map((d) => {
                        const s = sentence(d.key, d.from, d.to);
                        return (
                          <li key={d.key} className="text-13">
                            <span className="font-semibold">{s.label}:</span> <bdi className="text-muted-foreground">{s.from}</bdi> {t.arrow}{' '}
                            <bdi className="font-semibold">{s.to}</bdi>
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <p className="mt-1 text-13 text-muted-foreground">{t.history.restoreSame}</p>
                  )}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Btn variant="primary" size="sm" disabled={!diff.length} onClick={() => load(h.version)}>
                      {t.history.loadDraft}
                    </Btn>
                    <Btn variant="ghost" size="sm" onClick={() => setStaging(null)}>
                      {t.common.cancel}
                    </Btn>
                  </div>
                </div>
              )}
            </li>
          );
        })}
        {entries.length === 0 && <li className="rounded-2xl border border-dashed border-border p-6 text-center text-14 text-muted-foreground">{t.history.empty}</li>}
      </ol>
    </Sheet>
  );
}
