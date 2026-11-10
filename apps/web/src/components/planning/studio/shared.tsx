'use client';

/**
 * @file shared.tsx
 * @description What the Idea Studio and the Plan Studio share: the way back, the session's frame (the report beside the conversation, or tabs where there is
 * no room for both), the conversation's remembered width, and sending a request that waits in line while Claude is still working.
 */
import { ArrowLeft, ArrowRight, ListOrdered, type LucideIcon, MessagesSquare } from 'lucide-react';
import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';

import { AppLink, cn, focusRing, setQuery, useLocale } from '@/components/kit';
import { activeChatId, type PanelChat, send } from '@/components/workbench/store';

import type { ConversationWidth } from './conversation';

export function StudioBack({ label }: { label: string }) {
  const locale = useLocale();
  const Arrow = locale === 'ar' ? ArrowRight : ArrowLeft;
  return (
    <AppLink
      view="planning"
      query={{ studio: null, chat: null }}
      className={cn(
        'inline-flex h-9 items-center gap-1.5 self-start rounded-lg px-2 text-body-sm font-medium text-muted-foreground transition-colors duration-150 hover:bg-accent hover:text-foreground max-md:h-11',
        focusRing,
      )}
    >
      <Arrow aria-hidden className="size-4" strokeWidth={1.75} />
      {label}
    </AppLink>
  );
}

/** A studio's mark: one tile in its card type's colour. */
export function StudioMark({
  icon: Icon,
  tone,
  size = 'md',
}: {
  icon: LucideIcon;
  tone: 'idea' | 'plan';
  size?: 'md' | 'lg';
}) {
  return (
    <span
      aria-hidden
      className={cn(
        'flex shrink-0 items-center justify-center',
        tone === 'idea' ? 'bg-type-idea-soft text-type-idea-fg' : 'bg-type-plan-soft text-type-plan-fg',
        size === 'lg' ? 'size-14 rounded-2xl' : 'size-9 rounded-xl',
      )}
    >
      <Icon className={size === 'lg' ? 'size-7' : 'size-4.5'} strokeWidth={1.75} />
    </span>
  );
}

// ── Flexible layout ──────────────────────────────────────────────────────────────────────────────

export type StudioTab = 'report' | 'chat';
const WIDTH_KEY = 'hub:idea-studio:width';

/** The conversation's width, remembered in this browser for both studios. Storage that is blocked only means the choice is forgotten. */
export function useConversationWidth(): [ConversationWidth, (w: ConversationWidth) => void] {
  const [width, setWidthState] = useState<ConversationWidth>(() => {
    try {
      return window.localStorage.getItem(WIDTH_KEY) === 'wide' ? 'wide' : 'normal';
    } catch {
      return 'normal';
    }
  });
  const setWidth = (next: ConversationWidth) => {
    setWidthState(next);
    try {
      window.localStorage.setItem(WIDTH_KEY, next);
    } catch {
      // Private window: the choice lasts until reload.
    }
  };
  return [width, setWidth];
}

/**
 * The session's frame: the report and the conversation side by side on a wide page, and one at a time below that, with tabs. The conversation stays in view
 * while the report scrolls, below the app's own sticky header.
 */
export function StudioFrame({
  tab,
  width,
  report,
  conversation,
}: {
  tab: StudioTab;
  width: ConversationWidth;
  report: ReactNode;
  conversation: (className: string) => ReactNode;
}) {
  return (
    <div
      className={cn(
        'grid items-start gap-5',
        width === 'wide'
          ? '@page-xl:grid-cols-[minmax(0,1fr)_34rem]'
          : '@page-xl:grid-cols-[minmax(0,1fr)_24rem]',
      )}
    >
      <div className={cn('flex min-w-0 flex-col gap-4', tab === 'chat' && '@max-page-xl:hidden')}>
        {report}
      </div>
      {conversation(
        cn(
          'h-[calc(100dvh-11rem)] min-h-120 @page-xl:sticky @page-xl:top-18 @page-xl:h-[calc(100dvh-6rem)]',
          tab === 'report' && '@max-page-xl:hidden',
        ),
      )}
    </div>
  );
}

/** Below the width where the report and the conversation sit side by side, one shows at a time. A dot on the conversation says Claude is at work there. */
export function StudioTabs({
  tab,
  onTab,
  busy,
  label,
  words,
}: {
  tab: StudioTab;
  onTab: (t: StudioTab) => void;
  busy: boolean;
  label: string;
  words: { tabReport: string; tabChat: string };
}) {
  const tabs: { id: StudioTab; label: string; icon: LucideIcon }[] = [
    { id: 'report', label: words.tabReport, icon: ListOrdered },
    { id: 'chat', label: words.tabChat, icon: MessagesSquare },
  ];
  return (
    <div
      role="tablist"
      aria-label={label}
      className="sticky top-16 z-10 grid grid-cols-2 gap-1 rounded-xl border border-border bg-card/90 p-1 shadow-sm backdrop-blur @page-xl:hidden"
    >
      {tabs.map(({ id, label: name, icon: Icon }) => (
        <button
          key={id}
          type="button"
          role="tab"
          aria-selected={tab === id}
          onClick={() => onTab(id)}
          className={cn(
            'relative inline-flex h-10 items-center justify-center gap-1.5 rounded-lg text-body-sm font-medium transition-colors',
            tab === id
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-muted-foreground hover:bg-accent',
            focusRing,
          )}
        >
          <Icon aria-hidden className="size-4" strokeWidth={1.75} />
          {name}
          {id === 'chat' && busy && tab !== 'chat' && (
            <span aria-hidden className="relative flex size-2">
              <span className="absolute inline-flex size-full rounded-full bg-primary opacity-60 motion-safe:animate-ping" />
              <span className="relative inline-flex size-2 rounded-full bg-primary" />
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

// ── Sending, with a line for one request ────────────────────────────────────────────────────────

/**
 * Sends a request in the studio's chat. While Claude works, the request waits in line, one at a time, and goes the moment the turn ends, so the owner never
 * has to watch for the end to type the next thing. A device or folder changed since the studio began starts a new chat: the page follows it.
 */
/** The line, per chat, outside any component: a page that re-renders, or a studio left and opened again, keeps the request that waits. */
const lines = new Map<string, string>();

export function useStudioSend(chat: PanelChat, busy: boolean) {
  const [queued, setQueuedState] = useState<string | null>(() => lines.get(chat.id) ?? null);
  const sendingQueued = useRef(false);
  const chatId = chat.id;

  const setQueued = useCallback(
    (text: string | null) => {
      if (text) lines.set(chatId, text);
      else lines.delete(chatId);
      setQueuedState(text);
    },
    [chatId],
  );

  const sendNow = useCallback(
    async (text: string) => {
      const sent = await send({ text, mode: 'plan' });
      const id = activeChatId();
      if (sent && id && id !== chatId) setQuery({ chat: id }, { replace: true });
      return sent;
    },
    [chatId],
  );

  const onSend = useCallback(
    async (text: string) => {
      if (busy) {
        setQueued(text);
        return true;
      }
      return sendNow(text);
    },
    [busy, sendNow, setQueued],
  );

  useEffect(() => {
    if (busy || !queued || sendingQueued.current) return;
    sendingQueued.current = true;
    const text = queued;
    void sendNow(text).then((sent) => {
      sendingQueued.current = false;
      if (sent && lines.get(chatId) === text) setQueued(null);
    });
  }, [busy, queued, sendNow, chatId, setQueued]);

  // Another chat has its own line.
  useEffect(() => setQueuedState(lines.get(chatId) ?? null), [chatId]);

  return { queued, onSend, cancelQueued: () => setQueued(null) };
}
