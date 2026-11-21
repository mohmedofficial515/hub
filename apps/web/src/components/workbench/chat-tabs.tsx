'use client';

/**
 * @file chat-tabs.tsx
 * @description The panel's chats as tabs: every running chat, then the pinned and the most recent, so several chats can work at once and the owner moves
 * between them in one press. A running chat breathes; one waiting on the owner says so. The full list stays in History.
 */
import { Hand, Plus } from 'lucide-react';

import { Bidi, cn, focusRing, IconButton, useT } from '@/components/kit';

import { newChat, openChat, useWb } from './store';
import type { ChatMessages } from './words';

const MAX_TABS = 6;

export function ChatTabs({ onOpen }: { onOpen?: () => void }) {
  const t = useT<ChatMessages>('chat').panel;
  const wb = useWb();
  const waiting = new Set(wb.waiting.map((w) => w.id));
  const live = wb.chats.filter((c) => !c.deletedAt);
  const ordered = [
    ...live.filter((c) => c.running),
    ...live.filter((c) => !c.running && c.pinned),
    ...live.filter((c) => !c.running && !c.pinned).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
  ];
  const active = wb.activeId;
  const shown = ordered.slice(0, MAX_TABS);
  if (active && !shown.some((c) => c.id === active)) {
    const current = live.find((c) => c.id === active);
    if (current) shown.splice(MAX_TABS - 1, 1, current);
  }
  if (shown.length < 2 && !shown.some((c) => c.running)) return null;
  return (
    <div
      role="tablist"
      aria-label={t.historyPanel.title}
      data-wb-chat-tabs
      className="flex min-w-0 items-center gap-1 overflow-x-auto px-1 scrollbar-none"
    >
      {shown.map((chat) => {
        const on = chat.id === active;
        const asks = waiting.has(chat.id);
        return (
          <button
            key={chat.id}
            type="button"
            role="tab"
            aria-selected={on}
            title={chat.title}
            onClick={() => {
              openChat(chat.id);
              onOpen?.();
            }}
            className={cn(
              'relative flex h-8 max-w-44 shrink-0 items-center gap-1.5 rounded-full border px-2.5 text-caption transition-[background-color,border-color] duration-150 max-md:h-11',
              on
                ? 'border-primary/40 bg-primary/10 font-semibold text-primary-text'
                : 'border-transparent bg-muted text-muted-foreground hover:bg-accent hover:text-foreground',
              focusRing,
            )}
          >
            {asks ? (
              <Hand aria-hidden className="size-3 shrink-0 text-warning-strong" strokeWidth={2} />
            ) : (
              <span aria-hidden className="relative flex size-1.5 shrink-0">
                {chat.running && (
                  <span className="absolute inline-flex size-full rounded-full bg-success opacity-70 motion-safe:animate-ping" />
                )}
                <span
                  className={cn(
                    'relative inline-flex size-1.5 rounded-full',
                    chat.running ? 'bg-success' : 'bg-muted-foreground/40',
                  )}
                />
              </span>
            )}
            <span className="truncate">
              <Bidi>{chat.title || t.newChat}</Bidi>
            </span>
          </button>
        );
      })}
      <IconButton
        label={t.newChat}
        className="size-8 shrink-0 rounded-full max-md:size-11"
        onClick={() => {
          newChat();
          onOpen?.();
        }}
      >
        <Plus aria-hidden className="size-3.5" strokeWidth={2} />
      </IconButton>
    </div>
  );
}
