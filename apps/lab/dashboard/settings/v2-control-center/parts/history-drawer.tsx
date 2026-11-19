/**
 * Version history of one group as a timeline: who, when, the reason, the approval trail and every change as a
 * sentence. Restore is forward only: it stages the old values as a draft and opens the same review sheet, which
 * saves them as the next version.
 */
import { History } from 'lucide-react';
import type { SettingsGroup } from '@lab/mocks/settings';
import { ChangeLine } from './changes';
import { dateTime, fill, num, relative } from './format';
import { historyChanges } from './model';
import { Sheet } from './overlay';
import { useStore, who } from './store';
import { Btn, Pill } from './ui';

export function HistoryDrawer({ group, open, onClose }: { group: SettingsGroup; open: boolean; onClose: () => void }) {
  const { t, locale, history, meta, stageRestore, go, route } = useStore();
  const entries = history[group.key] ?? [];
  const current = meta[group.key].version;
  const next = current + 1;

  return (
    <Sheet open={open} onOpenChange={(o) => (o ? null : onClose())} title={fill(t.history.title, { group: group.title[locale] })} description={t.history.lead} closeLabel={t.toast.dismiss} width="lg">
      {entries.length === 0 ? (
        <div className="grid justify-items-center gap-2 rounded-2xl bg-muted/60 px-6 py-10 text-center">
          <span className="grid size-11 place-items-center rounded-2xl bg-card text-muted-foreground">
            <History className="size-5" aria-hidden />
          </span>
          <p className="text-15 font-bold">{t.history.empty}</p>
          <p className="max-w-sm text-13 text-muted-foreground">{fill(t.history.emptyLead, { v: num(locale, current) })}</p>
        </div>
      ) : (
        <ol className="relative grid gap-4 before:absolute before:inset-y-3 before:start-[1.0625rem] before:w-px before:bg-border">
          {entries.map((entry) => {
            const isCurrent = entry.version === current;
            const changes = historyChanges(group, entry);
            return (
              <li key={entry.version} className="relative grid grid-cols-[2.25rem_minmax(0,1fr)] gap-3">
                <span className={`relative z-[1] grid h-7 place-items-center self-start rounded-lg text-12 font-extrabold tabular-nums ${isCurrent ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'}`}>
                  v{num(locale, entry.version)}
                </span>
                <article className="min-w-0 rounded-2xl border border-border bg-card p-4">
                  <header className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="text-14 font-bold">{who(t, entry.by)}</span>
                    <span className="text-13 text-muted-foreground">
                      {relative(locale, entry.at)} · <bdi>{dateTime(locale, entry.at)}</bdi>
                    </span>
                    {isCurrent ? <Pill tone="primary" className="ms-auto h-5 px-2 text-11">{t.history.current}</Pill> : null}
                  </header>
                  <p className="mt-1.5 text-13 leading-relaxed text-muted-foreground">{entry.note ? `«${entry.note[locale]}»` : t.history.noNote}</p>
                  {entry.requestId || entry.approvedBy ? (
                    <p className="mt-1 flex flex-wrap gap-x-3 text-12 text-muted-foreground">
                      {entry.requestId ? <span dir="ltr">{fill(t.history.request, { id: entry.requestId })}</span> : null}
                      {entry.approvedBy ? <span>{fill(t.history.approvedBy, { who: entry.approvedBy })}</span> : null}
                    </p>
                  ) : null}
                  <div className="mt-2 divide-y divide-border/70 border-t border-border/70">
                    {changes.length ? changes.map((c) => <ChangeLine key={c.key} change={c} compact showTags={false} />) : <p className="py-2 text-13 text-muted-foreground">{t.history.noChanges}</p>}
                  </div>
                  {!isCurrent ? (
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Btn
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          stageRestore(group.key, entry.version);
                          go({ ...route, panel: 'review', field: undefined }, { replace: true });
                        }}
                      >
                        {fill(t.history.restore, { v: num(locale, entry.version) })}
                      </Btn>
                      <span className="text-12 text-muted-foreground">{fill(t.history.restoreHint, { next: num(locale, next) })}</span>
                    </div>
                  ) : null}
                </article>
              </li>
            );
          })}
        </ol>
      )}
    </Sheet>
  );
}
