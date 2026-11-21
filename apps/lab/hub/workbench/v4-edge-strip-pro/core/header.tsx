import { ChevronRight, Menu, Plus, Search } from 'lucide-react';
import { useLocale, useT } from '@lab/i18n';
import { workspace } from '@lab/mocks/hub-app';
import { AppLink, Avatar, cn, focusRing, IconButton, Kbd, Ltr, useRoute, useSession, useMedia } from '../../../today/v5-peacock-app/kit';
import { messages } from '../../../today/v5-peacock-app/i18n';
import { MemberMenu } from '../../../today/v5-peacock-app/shell/sidebar';

function LiveIndicator() {
  const t = useT(messages);
  const { query } = useRoute();
  // 08 §5.6: `?live=off` shows the reconnecting state; the real one comes from the SSE connection.
  const off = query.get('live') === 'off';
  const label = off ? t.header.reconnecting : t.header.live;
  return (
    <span role="status" title={label} className={cn('inline-flex h-7 items-center gap-1.5 rounded-full px-2 text-body-sm font-medium', off ? 'text-warning-strong' : 'text-muted-foreground')}>
      <span aria-hidden className={cn('size-2 rounded-full', off ? 'bg-warning' : 'bg-success')} />
      <span className="max-md:sr-only">{label}</span>
    </span>
  );
}

function Breadcrumb({ compact }: { compact?: boolean }) {
  const t = useT(messages);
  const locale = useLocale();
  const { view, cardKey } = useRoute();
  const crumbs = [
    // With the sheet open beside a narrow page, the sheet already names the card and the workspace does not change, so the page's name is what stays.
    ...(compact ? [] : [{ key: 'ws', node: <span className="max-md:hidden">{workspace.name[locale]}</span> }]),
    { key: 'view', node: cardKey ? <AppLink view={view} className={cn('rounded-sm underline-offset-4 hover:underline', focusRing)}>{t.nav[view]}</AppLink> : <span aria-current="page" className="font-semibold text-foreground">{t.nav[view]}</span> },
    ...(cardKey && !compact ? [{ key: 'card', node: <Ltr mono className="text-body-sm font-medium text-foreground">{cardKey}</Ltr> }] : []),
  ];
  return (
    <nav aria-label={t.header.breadcrumb} className="min-w-0">
      <ol className="flex min-w-0 items-center gap-1.5 text-body text-muted-foreground">
        {crumbs.map((crumb, i) => (
          <li key={crumb.key} className={cn('flex min-w-0 items-center gap-1.5', i === 0 && 'max-md:hidden')}>
            {i > 0 && <ChevronRight aria-hidden className="size-3.5 shrink-0 rtl:-scale-x-100 max-md:first:hidden" strokeWidth={1.75} />}
            <span className="truncate">{crumb.node}</span>
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function Header({ onOpenNav, onOpenPalette, onNewCard, onShortcuts, extra, compact }: { onOpenNav: () => void; onOpenPalette: () => void; onNewCard: () => void; onShortcuts: () => void; extra?: React.ReactNode; compact?: boolean }) {
  const t = useT(messages);
  const { me } = useSession();
  const mac = useMedia('(pointer: fine)') && /Mac/i.test(navigator.platform);
  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b border-border bg-background px-2 md:gap-3 md:px-4">
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
        className={cn('hidden h-9 min-w-0 flex-1 items-center gap-2 rounded-md border border-input bg-card px-3 text-body-sm text-muted-foreground transition-colors duration-120 hover:bg-accent md:max-w-md', !compact && 'md:flex', focusRing)}
      >
        <Search aria-hidden className="size-4 shrink-0" strokeWidth={1.75} />
        <span className="min-w-0 flex-1 truncate text-start">{t.header.search}</span>
        <Kbd className="shrink-0">{mac ? '⌘K' : 'Ctrl K'}</Kbd>
      </button>
      <IconButton label={t.header.search} aria-haspopup="dialog" className={compact ? undefined : 'md:hidden'} onClick={onOpenPalette}>
        <Search aria-hidden className="size-5" strokeWidth={1.75} />
      </IconButton>

      <div className="flex shrink-0 items-center gap-1 md:ms-auto md:gap-2">
        <IconButton label={t.header.newCard} variant="outline" aria-haspopup="dialog" aria-keyshortcuts="n" onClick={onNewCard}>
          <Plus aria-hidden className="size-5" strokeWidth={1.75} />
        </IconButton>
        {extra}
        <LiveIndicator />
        <MemberMenu
          side="bottom"
          onShortcuts={onShortcuts}
          trigger={
            <button type="button" aria-label={t.header.me} className={cn('flex size-11 shrink-0 items-center justify-center rounded-full md:size-9', focusRing)}>
              <Avatar member={me} size="md" />
            </button>
          }
        />
      </div>
    </header>
  );
}
