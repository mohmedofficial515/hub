'use client';

/**
 * @file header.tsx
 * @description Ported from apps/lab/hub/today/v5-peacock-app/shell/header.tsx. Contract: apps/web/README.md.
 */
import { ChevronRight, Menu, Plus, Search } from 'lucide-react';
import type { ReactNode } from 'react';

import {
  AppLink,
  Avatar,
  cn,
  focusRing,
  IconButton,
  Kbd,
  Ltr,
  useMedia,
  useRoute,
  useSession,
} from '@/components/kit';
import { MemberMenu } from '@/components/shell/sidebar';
import { useLiveStatus } from '@/features/live/live-provider';
import { useT } from '@/lib/i18n';
import { messages } from '@/lib/i18n';

/** docs/15 §7: it says what the connection is doing, from the connection. */
export function LiveIndicator() {
  const t = useT(messages);
  const status = useLiveStatus();
  const label =
    status === 'live'
      ? t.header.live
      : status === 'unavailable'
        ? t.header.notLive
        : status === 'reconnecting'
          ? t.header.reconnecting
          : t.header.connecting;
  const down = status === 'reconnecting' || status === 'unavailable';
  return (
    <span
      role="status"
      data-live={status}
      title={label}
      className={cn(
        'inline-flex h-7 items-center gap-1.5 rounded-full px-2 text-body-sm font-medium',
        down ? 'text-warning-strong' : 'text-muted-foreground',
      )}
    >
      <span
        aria-hidden
        className={cn(
          'size-2 rounded-full',
          status === 'live' ? 'bg-success' : down ? 'bg-warning' : 'bg-muted-foreground',
        )}
      />
      <span className="max-md:sr-only">{label}</span>
    </span>
  );
}

export function Breadcrumb({ compact }: { compact?: boolean | undefined }) {
  const t = useT(messages);
  const { view, known, cardKey, query } = useRoute();
  const { workspace } = useSession();
  // A page of its own under a view, such as a plan on Planning or a doc on Docs, is one step below it, as a card in the sheet is.
  const sub =
    cardKey ?? (view === 'planning' ? query.get('plan') : view === 'docs' ? query.get('doc') : null);
  const crumbLink = cn('rounded-sm underline-offset-4 hover:underline', focusRing);
  const crumbs = [
    ...(compact
      ? []
      : [
          {
            key: 'ws',
            node: (
              <AppLink view="today" className={cn('max-md:hidden', crumbLink)}>
                {workspace?.name}
              </AppLink>
            ),
          },
        ]),
    {
      key: 'view',
      node: !known ? (
        <span aria-current="page" className="font-semibold text-foreground">
          {t.boundary.notFoundTitle}
        </span>
      ) : cardKey ? (
        <AppLink view={view} className={crumbLink}>
          {t.nav[view]}
        </AppLink>
      ) : sub ? (
        // Back to the lists, with their filters kept: only what opened the sub-page is cleared.
        <AppLink
          view={view}
          query={{ plan: null, doc: null, anchor: null, studio: null, draft: null, action: null, tab: null }}
          className={crumbLink}
        >
          {t.nav[view]}
        </AppLink>
      ) : (
        <span aria-current="page" className="font-semibold text-foreground">
          {t.nav[view]}
        </span>
      ),
    },
    ...(sub && known && !compact
      ? [
          {
            key: 'card',
            node: (
              <span aria-current="page">
                <Ltr mono className="text-body-sm font-medium text-foreground">
                  {sub}
                </Ltr>
              </span>
            ),
          },
        ]
      : []),
  ];
  return (
    <nav aria-label={t.header.breadcrumb} className="min-w-0">
      <ol className="flex min-w-0 items-center gap-1.5 text-body text-muted-foreground">
        {crumbs.map((crumb, i) => (
          <li key={crumb.key} className={cn('flex min-w-0 items-center gap-1.5', i === 0 && 'max-md:hidden')}>
            {i > 0 && (
              <ChevronRight
                aria-hidden
                className="size-3.5 shrink-0 rtl:-scale-x-100 max-md:first:hidden"
                strokeWidth={1.75}
              />
            )}
            <span className="truncate">{crumb.node}</span>
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function Header({
  extra,
  compact,
  onOpenNav,
  onOpenPalette,
  onNewCard,
  onShortcuts,
}: {
  /** What the workbench adds: on a phone, the way to the panel. */
  extra?: ReactNode | undefined;
  /** The page is narrow beside the panel: the search is its icon, and the page's name is what stays. */
  compact?: boolean | undefined;
  onOpenNav: () => void;
  onOpenPalette: () => void;
  onNewCard: () => void;
  onShortcuts: () => void;
}) {
  const t = useT(messages);
  const { me } = useSession();
  const mac =
    useMedia('(pointer: fine)') && typeof navigator !== 'undefined' && /Mac/i.test(navigator.platform);
  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b border-border glass-chrome px-2 md:gap-3 md:px-4">
      <IconButton id="hub-nav-button" label={t.sidebar.openMenu} className="lg:hidden" onClick={onOpenNav}>
        <Menu aria-hidden className="size-5" strokeWidth={1.75} />
      </IconButton>
      <div className={cn('min-w-0 flex-1', !compact && 'md:flex-none md:basis-56 xl:basis-72')}>
        <Breadcrumb compact={compact} />
      </div>

      {/* Looks like the search field it stands for; the palette holds the real input (08 §2). */}
      <button
        type="button"
        onClick={onOpenPalette}
        aria-keyshortcuts="Control+K Meta+K /"
        aria-haspopup="dialog"
        className={cn(
          'hidden h-9 min-w-0 flex-1 items-center gap-2 rounded-xl border border-input bg-card px-3 text-body-sm text-muted-foreground shadow-xs transition-colors duration-120 hover:bg-accent md:max-w-md',
          !compact && 'md:flex',
          focusRing,
        )}
      >
        <Search aria-hidden className="size-4 shrink-0" strokeWidth={1.75} />
        <span className="min-w-0 flex-1 truncate text-start">{t.header.search}</span>
        <Kbd className="shrink-0">{mac ? '⌘K' : 'Ctrl K'}</Kbd>
      </button>
      <IconButton
        label={t.header.search}
        aria-haspopup="dialog"
        className={compact ? undefined : 'md:hidden'}
        onClick={onOpenPalette}
      >
        <Search aria-hidden className="size-5" strokeWidth={1.75} />
      </IconButton>

      <div className="flex shrink-0 items-center gap-1 md:ms-auto md:gap-2">
        <IconButton
          label={t.header.newCard}
          variant="outline"
          aria-haspopup="dialog"
          aria-keyshortcuts="n"
          onClick={onNewCard}
        >
          <Plus aria-hidden className="size-5" strokeWidth={1.75} />
        </IconButton>
        {extra}
        <LiveIndicator />
        <MemberMenu
          side="bottom"
          onShortcuts={onShortcuts}
          trigger={
            <button
              type="button"
              aria-label={t.header.me}
              className={cn(
                'flex size-11 shrink-0 items-center justify-center rounded-full md:size-9',
                focusRing,
              )}
            >
              <Avatar member={me} size="md" />
            </button>
          }
        />
      </div>
    </header>
  );
}
