/**
 * The three views as a strip of a departures board. Labels sit on flap tiles that run through other faces and settle
 * when the page opens (tab by tab), flip once more when their tab is chosen, and the chosen tab lights its gold
 * "boarding" lamp. The unread count is a flap counter. WAI-ARIA tabs: roving tab index, arrows follow the page
 * direction, Home/End.
 */
import { useState, type KeyboardEvent } from 'react';
import { useLocale } from '@lab/i18n';
import { INBOX_VIEWS, type InboxView } from '@lab/mocks/notifications-inbox';
import { cn } from '@lab/utils';
import type { Messages } from '../i18n';
import { FlapCounter, FlapLetters, FlapWords, Lamp } from './flap';

export const tabId = (view: InboxView) => `split-flap-tab-${view}`;
export const panelId = (view: InboxView) => `split-flap-panel-${view}`;

export function BoardTabs({
  view,
  unread,
  t,
  onChange,
}: {
  view: InboxView;
  unread: number;
  t: Messages;
  onChange: (view: InboxView) => void;
}) {
  const locale = useLocale();
  const rtl = locale === 'ar';
  // How often each tab has been chosen; a change re-runs its tiles once.
  const [picks, setPicks] = useState<Record<InboxView, number>>({ all: 0, unread: 0, trips: 0 });

  const choose = (next: InboxView) => {
    if (next === view) return;
    setPicks((p) => ({ ...p, [next]: p[next] + 1 }));
    onChange(next);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, from: InboxView) => {
    const index = INBOX_VIEWS.indexOf(from);
    const forward = rtl ? 'ArrowLeft' : 'ArrowRight';
    const back = rtl ? 'ArrowRight' : 'ArrowLeft';
    const n = INBOX_VIEWS.length;
    let next: InboxView | undefined;
    if (event.key === forward) next = INBOX_VIEWS[(index + 1) % n];
    else if (event.key === back) next = INBOX_VIEWS[(index - 1 + n) % n];
    else if (event.key === 'Home') next = INBOX_VIEWS[0];
    else if (event.key === 'End') next = INBOX_VIEWS[n - 1];
    if (!next) return;
    event.preventDefault();
    choose(next);
    document.getElementById(tabId(next))?.focus();
  };

  return (
    <div
      role="tablist"
      aria-label={t.viewsLabel}
      className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_minmax(0,1fr)] gap-1.5 rounded-xl border border-(--board-line) bg-(--board) p-1.5 sm:grid-cols-3"
    >
      {INBOX_VIEWS.map((value, i) => {
        const active = view === value;
        const label = t.views[value];
        const tile = cn(
          'transition-colors duration-200',
          active ? 'text-(--flap-ink-active)' : 'text-(--flap-ink)',
        );
        // The opening run is longer and goes tab by tab; a later pick flips the tiles once.
        const opening = picks[value] === 0;
        const run = {
          trigger: picks[value],
          delay: opening ? 120 + i * 260 : 0,
          frames: opening ? 6 : 2,
          blankFirst: true,
        };
        return (
          <button
            key={value}
            type="button"
            role="tab"
            id={tabId(value)}
            aria-selected={active}
            aria-controls={active ? panelId(value) : undefined}
            tabIndex={active ? 0 : -1}
            onClick={() => choose(value)}
            onKeyDown={(event) => onKeyDown(event, value)}
            className={cn(
              'group relative flex min-h-[64px] min-w-0 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg px-1 py-2 transition-colors duration-200 sm:min-h-[60px] sm:flex-row sm:gap-3 sm:px-3',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--lamp)',
              active ? 'bg-(--board-active)' : 'hover:bg-(--board-active)/60',
            )}
          >
            <span className="sr-only">
              {label}
              {value === 'unread' ? `${rtl ? '،' : ','} ${t.unreadCount(unread)}` : ''}
            </span>
            <Lamp lit={active} className="hidden sm:block" />
            {rtl ? (
              <FlapWords
                text={label}
                deck={t.deck}
                {...run}
                tileClassName={cn(tile, 'h-9 px-1.5 text-[15px] font-bold sm:h-10 sm:px-2 sm:text-base')}
              />
            ) : (
              <FlapLetters
                text={label.toUpperCase()}
                {...run}
                tileClassName={cn(tile, 'h-9 w-[0.95rem] text-sm font-bold sm:h-10 sm:w-[1.15rem] sm:text-base')}
              />
            )}
            <span className="flex items-center gap-2">
              <Lamp lit={active} className="sm:hidden" />
              {value === 'unread' && (
                <FlapCounter
                  value={unread}
                  startFrom={0}
                  delay={700}
                  tileClassName={cn(
                    'h-7 w-[0.95rem] text-sm font-bold sm:h-8 sm:w-[1.1rem]',
                    unread > 0 ? 'text-(--lamp)' : 'text-(--flap-ink-muted)',
                  )}
                />
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}
