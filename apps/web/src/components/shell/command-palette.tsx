'use client';

/**
 * @file command-palette.tsx
 * @description Ported from apps/lab/hub/today/v5-peacock-app/shell/command-palette.tsx. Contract: apps/web/README.md.
 */
import { CircleDot, Copy, FilePlus2, Keyboard, Languages, Replace, Search, SunMoon } from 'lucide-react';
import { Dialog } from 'radix-ui';
import { type ReactNode, useEffect, useMemo, useState } from 'react';

import {
  cn,
  copyText,
  fmt,
  getCard,
  Kbd,
  Ltr,
  navigate,
  openCard,
  showToast,
  TypeDot,
  useCardSearch,
} from '@/components/kit';
import type { NewCardType } from '@/components/shell/new-card-dialog';
import { goTo } from '@/components/shell/router';
import { views } from '@/components/shell/views';
import type { CardListItem } from '@/features/cards/types';
import { portalRoot, useFocusReturn } from '@/lib/hooks';
import { useLocale, useT } from '@/lib/i18n';
import { messages } from '@/lib/i18n';
import { matchKey } from '@/lib/keys';
import { readRecentCards } from '@/lib/preferences';
import { setLocaleEverywhere, toggleTheme } from '@/lib/theme';

type Item = {
  id: string;
  label: ReactNode;
  text: string;
  icon: ReactNode;
  trailing?: ReactNode | undefined;
  run: () => void;
};
type Group = { id: string; title: string; items: Item[] };

/** A key that matches 08 §5.5: `GTV-123` jumps straight to the card. */
const KEY_RE = /^[a-z]+-\d+$/i;

export function CommandPalette({
  open,
  onOpenChange,
  onNewCard,
  onShortcuts,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNewCard: (type: NewCardType) => void;
  onShortcuts: () => void;
}) {
  const t = useT(messages);
  const locale = useLocale();
  const [query, setText] = useState('');
  const [active, setActive] = useState(0);
  const onCloseAutoFocus = useFocusReturn(open);
  const found = useCardSearch(query);

  useEffect(() => {
    if (open) {
      setText('');
      setActive(0);
    }
  }, [open]);

  const groups = useMemo<Group[]>(() => {
    const q = query.trim().toLowerCase();
    const close = () => onOpenChange(false);
    const openFromPalette = (key: string) => {
      close();
      openCard(key, { opener: document.getElementById('main') });
    };
    const cardItem = (key: string): Item | null => {
      const card = getCard(key);
      if (!card) return null;
      return cardRow(card);
    };
    const cardRow = (card: CardListItem): Item => {
      const { key } = card;
      return {
        id: `card-${key}`,
        text: `${key} ${card.title}`,
        icon: <TypeDot type={card.type} />,
        label: (
          <span className="flex min-w-0 items-center gap-2">
            <Ltr mono className="shrink-0 text-body-sm text-muted-foreground">
              {key}
            </Ltr>
            <span className="min-w-0 truncate">{card.title}</span>
          </span>
        ),
        run: () => openFromPalette(key),
      };
    };
    const matches = (text: string) => !q || text.toLowerCase().includes(q);

    const pages: Item[] = views
      .map((view) => {
        const Icon = view.icon;
        return {
          id: `page-${view.id}`,
          text: t.nav[view.id],
          icon: <Icon aria-hidden className="size-4" strokeWidth={1.75} />,
          label: t.nav[view.id],
          trailing: view.goKey ? <Kbd>{`g ${view.goKey}`}</Kbd> : undefined,
          run: () => {
            close();
            navigate(view.id);
          },
        };
      })
      .filter((item) => matches(`${item.text} ${item.id}`));

    const newCard = (type: NewCardType, label: string): Item => ({
      id: `new-${type}`,
      text: label,
      icon: <FilePlus2 aria-hidden className="size-4" strokeWidth={1.75} />,
      label,
      run: () => {
        close();
        onNewCard(type);
      },
    });

    const actions: Item[] = [
      newCard('task', t.palette.act.newTask),
      newCard('decision', t.palette.act.newDecision),
      newCard('need', t.palette.act.newNeed),
      newCard('handoff', t.palette.act.newHandoff),
      {
        id: 'theme',
        text: t.palette.act.toggleTheme,
        icon: <SunMoon aria-hidden className="size-4" strokeWidth={1.75} />,
        label: t.palette.act.toggleTheme,
        run: () => {
          close();
          toggleTheme();
        },
      },
      {
        id: 'lang',
        text: t.palette.act.toggleLanguage,
        icon: <Languages aria-hidden className="size-4" strokeWidth={1.75} />,
        label: t.palette.act.toggleLanguage,
        run: () => {
          close();
          setLocaleEverywhere(locale === 'ar' ? 'en' : 'ar');
        },
      },
      {
        id: 'workspace',
        text: t.palette.act.switchWorkspace,
        icon: <Replace aria-hidden className="size-4" strokeWidth={1.75} />,
        label: t.palette.act.switchWorkspace,
        run: () => {
          close();
          goTo(`/${locale}/workspaces`);
        },
      },
      {
        id: 'mcp',
        text: t.palette.act.copyMcp,
        icon: <Copy aria-hidden className="size-4" strokeWidth={1.75} />,
        label: t.palette.act.copyMcp,
        run: () => {
          close();
          void copyText(
            `claude mcp add hub --transport http ${window.location.protocol}//${window.location.hostname}:7310/mcp`,
          ).then(() => showToast({ message: t.palette.mcpCopied }));
        },
      },
      {
        id: 'shortcuts',
        text: t.palette.act.showShortcuts,
        icon: <Keyboard aria-hidden className="size-4" strokeWidth={1.75} />,
        label: t.palette.act.showShortcuts,
        run: () => {
          close();
          onShortcuts();
        },
      },
    ].filter((item) => matches(item.text));

    const out: Group[] = [];
    if (q) {
      const cards = (found.data ?? []).map(cardRow);
      // An exact key that is not in the catalogue still jumps, and the sheet says it does not exist (09 §14).
      if (KEY_RE.test(q) && !cards.some((c) => c.id === `card-${q.toUpperCase()}`)) {
        const key = q.toUpperCase();
        cards.unshift({
          id: `card-${key}`,
          text: key,
          icon: <CircleDot aria-hidden className="size-4" strokeWidth={1.75} />,
          label: fmt(t.palette.jump, { key }),
          run: () => openFromPalette(key),
        });
      }
      if (cards.length) out.push({ id: 'cards', title: t.palette.cards, items: cards });
    } else {
      const recent = readRecentCards()
        .slice(0, 6)
        .map(cardItem)
        .filter((i): i is Item => !!i);
      if (recent.length) out.push({ id: 'recent', title: t.palette.recent, items: recent });
    }
    if (pages.length) out.push({ id: 'pages', title: t.palette.pages, items: pages });
    if (actions.length) out.push({ id: 'actions', title: t.palette.actions, items: actions });
    return out;
  }, [query, locale, t, onOpenChange, onNewCard, onShortcuts, found.data]);

  const flat = groups.flatMap((g) => g.items);
  const safeActive = Math.min(active, Math.max(0, flat.length - 1));
  const activeId = flat[safeActive] ? `palette-${flat[safeActive].id}` : undefined;

  useEffect(() => {
    if (activeId) document.getElementById(activeId)?.scrollIntoView({ block: 'nearest' });
  }, [activeId]);

  const onKey = (e: React.KeyboardEvent) => {
    if (matchKey(e, 'ArrowDown') || matchKey(e, 'ArrowUp')) {
      e.preventDefault();
      if (!flat.length) return;
      setActive((safeActive + (matchKey(e, 'ArrowDown') ? 1 : -1) + flat.length) % flat.length);
    } else if (matchKey(e, 'Home') || matchKey(e, 'End')) {
      e.preventDefault();
      setActive(matchKey(e, 'Home') ? 0 : flat.length - 1);
    } else if (matchKey(e, 'Enter')) {
      e.preventDefault();
      flat[safeActive]?.run();
    }
  };

  let index = -1;
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal container={portalRoot()}>
        <Dialog.Overlay className="fixed inset-0 z-[70] bg-(--scrim) motion-safe:animate-in motion-safe:fade-in motion-safe:duration-150" />
        <Dialog.Content
          aria-describedby={undefined}
          onKeyDown={onKey}
          onCloseAutoFocus={onCloseAutoFocus}
          className="fixed inset-x-0 top-0 z-[70] flex max-h-dvh flex-col overflow-hidden border-b border-border bg-popover text-popover-foreground shadow-md outline-none motion-safe:animate-in motion-safe:fade-in motion-safe:duration-150 md:inset-x-auto md:start-1/2 md:top-[12vh] md:max-h-[70vh] md:w-full md:max-w-xl md:rounded-2xl md:border md:ltr:-translate-x-1/2 md:rtl:translate-x-1/2"
        >
          <Dialog.Title className="sr-only">{t.palette.label}</Dialog.Title>
          <div className="flex shrink-0 items-center gap-2 border-b border-border px-4">
            <Search aria-hidden className="size-5 shrink-0 text-muted-foreground" strokeWidth={1.75} />
            <input
              autoFocus
              dir="auto"
              value={query}
              onChange={(e) => {
                setText(e.target.value);
                setActive(0);
              }}
              role="combobox"
              aria-expanded
              aria-controls="palette-list"
              aria-activedescendant={activeId}
              aria-autocomplete="list"
              aria-label={t.palette.label}
              placeholder={t.palette.placeholder}
              className="h-13 min-w-0 flex-1 bg-transparent text-body-lg text-foreground outline-none placeholder:text-muted-foreground"
            />
          </div>
          <div
            id="palette-list"
            role="listbox"
            aria-label={t.palette.label}
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2"
          >
            {flat.length === 0 && (
              <p className="px-3 py-6 text-center text-body text-muted-foreground">{t.palette.empty}</p>
            )}
            {groups.map((group) => (
              <div key={group.id} role="group" aria-labelledby={`palette-group-${group.id}`} className="pb-1">
                <p
                  id={`palette-group-${group.id}`}
                  role="presentation"
                  className="px-3 pt-2 pb-1 text-caption font-medium text-muted-foreground"
                >
                  {group.title}
                </p>
                {group.items.map((item) => {
                  index += 1;
                  const i = index;
                  const on = i === safeActive;
                  return (
                    <div
                      key={item.id}
                      id={`palette-${item.id}`}
                      role="option"
                      aria-selected={on}
                      onMouseMove={() => setActive(i)}
                      onClick={item.run}
                      className={cn(
                        'flex min-h-11 cursor-pointer items-center gap-2.5 rounded-md px-3 text-body text-foreground md:min-h-10',
                        on && 'bg-accent',
                      )}
                    >
                      <span
                        aria-hidden
                        className="flex size-4 shrink-0 items-center justify-center text-muted-foreground"
                      >
                        {item.icon}
                      </span>
                      <span className="min-w-0 flex-1 truncate">{item.label}</span>
                      {item.trailing}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
          <p className="hidden shrink-0 border-t border-border px-4 py-2 text-caption text-muted-foreground md:block">
            {t.palette.hint}
          </p>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
