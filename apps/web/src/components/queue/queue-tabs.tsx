'use client';

/**
 * @file queue-tabs.tsx
 * @description The queue's two views (owner's decision, 2026-11-19): the queue itself, and "Running now", which is the Live page that used
 * to have its own sidebar item. The view lives in `?show=live`, not `?tab=`, because the card sheet owns `tab` and clears it on close.
 * They are links, so each view has an address to share and open in a new tab; the current one carries `aria-current="page"`.
 */
import { AppLink, cn, Ltr, num, plural, tabTriggerClass, useLocale } from '@/components/kit';
import { useChats } from '@/features/chat/queries';

import { useQueueWords } from './run-bits';

export type QueueView = 'queue' | 'live';

export const queueViewOf = (value: string | null): QueueView => (value === 'live' ? 'live' : 'queue');

export function QueueTabs({ current }: { current: QueueView }) {
  const t = useQueueWords();
  const locale = useLocale();
  const running = (useChats().data ?? []).filter((chat) => chat.running).length;
  const tab = (view: QueueView, label: string, extra?: React.ReactNode) => (
    <AppLink
      view="queue"
      // The Live view's own parameters stay behind when going back to the queue.
      query={view === 'live' ? { show: 'live' } : { show: null, chat: null, pane: null }}
      aria-current={current === view ? 'page' : undefined}
      data-state={current === view ? 'active' : 'inactive'}
      data-queue-tab={view}
      className={cn(tabTriggerClass, 'shrink-0 whitespace-nowrap')}
    >
      {label}
      {extra}
    </AppLink>
  );
  return (
    <nav
      aria-label={t.tabs.label}
      className="-mx-4 flex gap-1 overflow-x-auto border-b border-border px-4 [scrollbar-width:none] md:mx-0 md:px-0"
    >
      {tab('queue', t.tabs.queue)}
      {tab(
        'live',
        t.tabs.live,
        running > 0 && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-success-soft px-1.5 text-caption font-medium text-success-soft-foreground tabular-nums">
            <span aria-hidden className="relative flex size-1.5">
              <span className="absolute inline-flex size-full rounded-full bg-success opacity-60 motion-safe:animate-ping" />
              <span className="relative inline-flex size-1.5 rounded-full bg-success" />
            </span>
            <Ltr aria-hidden>{num(running, locale)}</Ltr>
            <span className="sr-only">{plural(running, locale, t.tabs.running)}</span>
          </span>
        ),
      )}
    </nav>
  );
}
