import { useState } from 'react';
import { ChevronDown, FilePlus2, Pause, Play, Plus, Search, X } from 'lucide-react';
import { useLocale, useT } from '@lab/i18n';
import { Bidi, cn, focusRing, IconButton, Ltr, RowMenu, showToast } from '../core/kit';
import { DoNext, HistoryList, RunIcon, RunsFootnote, useRunGroups } from '../core/panels';
import { newChat, removeRun, setRunState, useWb } from '../core/store';
import { wbMessages } from '../core/strings';
import type { Run } from '../core/mock';
import { messages } from '../i18n';

/** A run in the river is one line, ordered by who has to do something. The whole row goes to its chat. */
function RiverRun({ run, onOpen }: { run: Run; onOpen: (id: string) => void }) {
  const t = useT(wbMessages);
  const locale = useLocale();
  const r = t.runsPanel;
  const line = run.command ?? run.step?.[locale] ?? run.summary?.[locale] ?? run.when?.[locale] ?? r.states[run.state];
  const menu = [
    ...(run.state === 'running' ? [{ label: r.pause, icon: Pause, onSelect: () => setRunState(run.id, 'paused') }] : []),
    ...(run.state === 'paused' ? [{ label: r.resume, icon: Play, onSelect: () => setRunState(run.id, 'running') }] : []),
    ...(['next', 'scheduled', 'paused', 'running'].includes(run.state)
      ? [
          {
            label: r.cancel,
            icon: X,
            destructive: true,
            onSelect: () => {
              const undo = removeRun(run.id);
              showToast({ message: r.canceled, onUndo: undo });
            },
          },
        ]
      : []),
  ];
  const body = (
    <>
      <RunIcon state={run.state} className="mt-0.5" />
      <span className="flex min-w-0 flex-1 flex-col text-start">
        <span className="truncate text-body font-medium text-foreground">
          <Bidi>{run.title[locale]}</Bidi>
        </span>
        <span className="sr-only">{r.states[run.state]}: </span>
        {run.command ? (
          <Ltr mono className="truncate text-start text-body-sm text-muted-foreground">
            {line}
          </Ltr>
        ) : (
          <span className="truncate text-body-sm text-muted-foreground">
            <Bidi>{line}</Bidi>
          </span>
        )}
      </span>
    </>
  );
  return (
    <li data-wb-run={run.state} className="flex min-w-0 items-center gap-0.5">
      {run.chatId ? (
        <button type="button" data-wb-river-run onClick={() => onOpen(run.chatId!)} className={cn('flex min-h-11 min-w-0 flex-1 items-start gap-2 rounded-md px-2 py-1.5 transition-colors duration-120 hover:bg-accent', focusRing)}>
          {body}
        </button>
      ) : (
        <div className="flex min-h-11 min-w-0 flex-1 items-start gap-2 px-2 py-1.5">{body}</div>
      )}
      {menu.length > 0 && <RowMenu label={t.more} items={menu} />}
    </li>
  );
}

function Fold({ title, count, open, onToggle }: { title: string; count?: number; open: boolean; onToggle: () => void }) {
  return (
    <button type="button" aria-expanded={open} onClick={onToggle} className={cn('flex min-h-9 w-full items-center gap-1.5 rounded-md px-2 text-body-sm font-semibold text-muted-foreground hover:bg-accent max-md:min-h-11', focusRing)}>
      <ChevronDown aria-hidden className={cn('size-3.5 transition-transform duration-120', !open && 'ltr:-rotate-90 rtl:rotate-90')} strokeWidth={2} />
      <span className="flex-1 text-start">{title}</span>
      {count !== undefined && <span className="tabular-nums">{count}</span>}
    </button>
  );
}

/**
 * The river replaces the sidebar's job while on the desk: runs and chats are one list, ordered by what wants the owner. There is no separate queue
 * to visit: what waits for approval is at the top, because that is the next thing to do.
 */
export function River({ onOpenChat, onOpenPalette, onOpenNew }: { onOpenChat: (id: string) => void; onOpenPalette: () => void; onOpenNew: () => void }) {
  const t = useT(wbMessages);
  const m = useT(messages);
  const wb = useWb();
  const groups = useRunGroups();
  const [nextOpen, setNextOpen] = useState(false);
  const [recentOpen, setRecentOpen] = useState(false);
  const pick = (name: 'needs' | 'running' | 'next' | 'scheduled' | 'recent') => groups.find(([g]) => g === name)![1];
  return (
    <div data-wb-river className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center gap-1 border-b border-border p-2">
        <h2 className="min-w-0 flex-1 truncate px-1 text-body-lg font-semibold text-foreground">{m.river}</h2>
        <IconButton label={t.newChat} data-wb-new onClick={() => { newChat(); }}>
          <Plus aria-hidden className="size-4" strokeWidth={1.75} />
        </IconButton>
        <IconButton label={m.search} aria-haspopup="dialog" onClick={onOpenPalette}>
          <Search aria-hidden className="size-4" strokeWidth={1.75} />
        </IconButton>
        <IconButton label={m.newCard} aria-haspopup="dialog" onClick={onOpenNew}>
          <FilePlus2 aria-hidden className="size-4" strokeWidth={1.75} />
        </IconButton>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-2">
        {wb.engine === 'limit' && <p className="px-2 text-body-sm font-medium text-warning-strong">{t.runsPanel.limitPaused}</p>}
        {(['needs', 'running'] as const).map((name) =>
          pick(name).length ? (
            <section key={name} aria-labelledby={`wb-r-${name}`}>
              <h3 id={`wb-r-${name}`} className="px-2 text-body-sm font-semibold text-muted-foreground">
                {t.runsPanel.groups[name]}
              </h3>
              <ul className="flex flex-col">
                {pick(name).map((run) => (
                  <RiverRun key={run.id} run={run} onOpen={onOpenChat} />
                ))}
              </ul>
            </section>
          ) : null,
        )}
        <HistoryList onOpen={onOpenChat} />
        <section aria-labelledby="wb-r-next">
          <span id="wb-r-next" className="sr-only">{t.runsPanel.groups.next}</span>
          <Fold title={t.next.title} open={nextOpen} onToggle={() => setNextOpen((v) => !v)} count={pick('next').length + pick('scheduled').length} />
          {nextOpen && (
            <div className="flex flex-col gap-2 pt-1">
              <ul className="flex flex-col">
                {[...pick('next'), ...pick('scheduled')].map((run) => (
                  <RiverRun key={run.id} run={run} onOpen={onOpenChat} />
                ))}
              </ul>
              <DoNext className="px-2" limit={3} />
              <RunsFootnote className="px-2" />
            </div>
          )}
        </section>
        <section>
          <Fold title={t.runsPanel.groups.recent} open={recentOpen} onToggle={() => setRecentOpen((v) => !v)} count={pick('recent').length} />
          {recentOpen && (
            <ul className="flex flex-col pt-1">
              {pick('recent').map((run) => (
                <RiverRun key={run.id} run={run} onOpen={onOpenChat} />
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
