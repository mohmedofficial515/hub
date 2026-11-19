'use client';

/**
 * @file shared.tsx
 * @description What the Idea Studio and the Plan Studio share: the way back, the session's frame (the report beside the conversation, or tabs where there is
 * no room for both), the conversation's remembered width, and sending a request that waits in line while Claude is still working.
 */
import {
  ArrowLeft,
  ArrowRight,
  ListOrdered,
  type LucideIcon,
  MessagesSquare,
  PenLine,
  Plus,
} from 'lucide-react';
import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';

import {
  AppLink,
  Button,
  cn,
  EmptyState,
  focusRing,
  PageContainer,
  setQuery,
  useLocale,
  useRoving,
} from '@/components/kit';
import { activeChatId, openChat, type PanelChat, send, type Wb } from '@/components/workbench/store';

import type { ConversationWidth } from './conversation';

/**
 * Where a jump inside a studio's report lands: below the app's header, the studio's tabs and the report's contents, which all stay in view. Narrower
 * pages stack more of them, so the room is larger there.
 */
export const STUDIO_ANCHOR = 'scroll-mt-28 @max-page-xl:scroll-mt-44';

/** How many times the studio opens the chat in its address before it says the chat is not there. */
const OPEN_TRIES = 2;

/**
 * The chat a studio's address names, opened in the panel's store. A chat that is not there (deleted, another member's, another browser's) is tried at
 * most twice, then reads as missing, so a stale link never loops on the API. While the chat is open and the owner opens another one in the panel, the
 * studio brings its own back, as it always did.
 */
export function useStudioChat(
  wb: Pick<Wb, 'activeId' | 'chat' | 'chats'> | null | undefined,
  chatId: string | null,
): { chat: PanelChat | null; missing: boolean } {
  const tries = useRef<{ id: string | null; n: number }>({ id: null, n: 0 });
  const [missing, setMissing] = useState<string | null>(null);
  const activeId = wb?.activeId ?? null;
  const loaded = !!chatId && wb?.chat?.id === chatId;
  const listed = !!chatId && !!wb?.chats.some((c) => c.id === chatId);
  const present = !!wb;

  useEffect(() => {
    if (!present || !chatId) return;
    if (tries.current.id !== chatId) tries.current = { id: chatId, n: 0 };
    const t = tries.current;
    // Once the chat has opened, a later switch in the panel is the owner's, and the studio may bring its chat back again.
    if (loaded) {
      t.n = 0;
      return;
    }
    if (missing === chatId || activeId === chatId) return;
    // The store opened the chat and gave up on it (the API did not find it), or it was tried enough.
    if ((activeId === null && t.n > 0 && !listed) || t.n >= OPEN_TRIES) {
      setMissing(chatId);
      return;
    }
    t.n += 1;
    openChat(chatId);
  }, [present, chatId, activeId, loaded, listed, missing]);

  const chat = loaded ? (wb?.chat ?? null) : null;
  return { chat, missing: !!chatId && missing === chatId && !loaded };
}

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

/** A chat the address names that is not there: said plainly, with the way to a new session. */
export function StudioMissing({
  icon,
  back,
  words,
}: {
  icon: LucideIcon;
  back: string;
  words: { title: string; body: string; new: string };
}) {
  return (
    <PageContainer>
      <StudioBack label={back} />
      <EmptyState
        icon={icon}
        title={words.title}
        size="page"
        action={
          <Button variant="primary" onClick={() => setQuery({ chat: null }, { replace: true })}>
            <Plus aria-hidden className="size-4" strokeWidth={1.75} />
            {words.new}
          </Button>
        }
      >
        {words.body}
      </EmptyState>
    </PageContainer>
  );
}

/** The way round the research: writing the card by hand, offered as one quiet line. */
export function ManualWay({ hint, label, onOpen }: { hint: string; label: string; onOpen: () => void }) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-2 rounded-2xl border border-dashed border-border px-4 py-3 text-center">
      <span className="text-body-sm text-muted-foreground">{hint}</span>
      <Button variant="ghost" size="sm" onClick={onOpen}>
        <PenLine aria-hidden className="size-4" strokeWidth={1.75} />
        {label}
      </Button>
    </div>
  );
}

/** Focus a box on arrival only with a fine pointer: on a touch screen it would raise the keyboard before the owner asked. */
export function wantsAutoFocus() {
  try {
    return window.matchMedia('(pointer: fine)').matches;
  } catch {
    return true;
  }
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
      <div
        id={STUDIO_PANELS.report}
        className={cn('flex min-w-0 flex-col gap-4', tab === 'chat' && '@max-page-xl:hidden')}
      >
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
  // One Tab stop for the pair, the arrows move between them in the reading direction (kit: useRoving).
  const { root, groupProps, itemProps } = useRoving(tabs.findIndex((t) => t.id === tab));
  return (
    <div
      ref={root}
      role="toolbar"
      aria-label={label}
      {...groupProps}
      className="sticky top-16 z-10 grid grid-cols-2 gap-1 rounded-xl border border-border bg-card/90 p-1 shadow-sm backdrop-blur @page-xl:hidden"
    >
      {tabs.map(({ id, label: name, icon: Icon }, i) => (
        <button
          key={id}
          type="button"
          {...itemProps(i)}
          aria-pressed={tab === id}
          aria-controls={STUDIO_PANELS[id]}
          onClick={() => onTab(id)}
          className={cn(
            'relative inline-flex h-10 items-center justify-center gap-1.5 rounded-lg text-body-sm font-medium transition-colors max-md:h-11',
            tab === id ? 'bg-foreground text-background' : 'text-muted-foreground hover:bg-accent',
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

/** The two halves the tabs switch between, by id, so each button names what it shows. */
export const STUDIO_PANELS: Record<StudioTab, string> = {
  report: 'studio-panel-report',
  chat: 'studio-panel-chat',
};

// ── Sending, with a line for one request ────────────────────────────────────────────────────────

/**
 * Sends a request in the studio's chat. While Claude works, the request waits in line, one at a time, and goes the moment the turn ends, so the owner never
 * has to watch for the end to type the next thing. A device or folder changed since the studio began starts a new chat: the page follows it.
 */
/** The line, per chat, outside any component: a page that re-renders, or a studio left and opened again, keeps the request that waits. */
const lines = new Map<string, string>();

export function useStudioSend(chat: PanelChat, busy: boolean) {
  const [queued, setQueuedState] = useState<string | null>(() => lines.get(chat.id) ?? null);
  /** The request on its way: starting a turn takes some seconds, and the page says so at once. */
  const [sending, setSending] = useState<string | null>(null);
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
      setSending(text);
      try {
        const sent = await send({ text, mode: 'plan' });
        const id = activeChatId();
        if (sent && id && id !== chatId) setQuery({ chat: id }, { replace: true });
        return sent;
      } finally {
        setSending(null);
      }
    },
    [chatId],
  );

  /** Sends now, or puts the request in line. The line holds one request: a second one while it waits is refused (false), never swapped in silently. */
  const onSend = useCallback(
    async (text: string) => {
      if (busy) {
        if (lines.has(chatId)) return false;
        setQueued(text);
        return true;
      }
      return sendNow(text);
    },
    [busy, chatId, sendNow, setQueued],
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

  return {
    queued,
    sending,
    onSend,
    cancelQueued: () => setQueued(null),
    /** A request already waits: the report's own buttons hold back until it goes or is cancelled. */
    blocked: busy && !!queued,
  };
}
