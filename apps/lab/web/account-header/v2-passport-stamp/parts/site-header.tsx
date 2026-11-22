import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  Award,
  Bell,
  Briefcase,
  ChevronDown,
  Globe,
  Heart,
  History,
  LogOut,
  Menu,
  User as UserIcon,
  Wallet,
  X,
} from 'lucide-react';
import { cn } from '@lab/utils';

import { AccountAvatar, LevelMark } from './account-avatar';
import logoUrl from './logo-on-brand.svg';
import { useAccount } from './model';

const focusRing =
  'outline-none focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:ring-offset-2 focus-visible:ring-offset-(--surface-brand)';

/** Name, e-mail and level: the identity row shared by the header menu and the mobile menu. */
function Identity({ compact = false }: { compact?: boolean }) {
  const m = useAccount();
  if (m.state === 'loading')
    return (
      <span aria-hidden className="flex min-w-0 flex-1 flex-col gap-2">
        <span className="h-4 w-32 rounded bg-(--surface-3) motion-safe:animate-pulse" />
        <span className="h-3.5 w-40 rounded bg-(--surface-3) motion-safe:animate-pulse" />
      </span>
    );
  return (
    <span className="flex min-w-0 flex-1 flex-col items-start gap-0.5">
      <span dir="auto" className="max-w-full truncate text-base leading-snug font-bold text-(--brand-ink)">
        {m.customer.name}
      </span>
      {!compact && (
        <bdi dir="ltr" className="max-w-full truncate text-sm text-(--ink-muted)">
          {m.customer.email}
        </bdi>
      )}
      {m.levelName && (
        <span className="mt-0.5 inline-flex items-center gap-1.5 text-sm font-semibold text-(--ink)">
          <LevelMark level={m.frame} className="size-4" />
          {m.t.card.level(m.levelName)}
        </span>
      )}
    </span>
  );
}

const MENU = [
  { key: 'personalDetails', icon: UserIcon },
  { key: 'myBookings', icon: Briefcase },
  { key: 'loyaltyProgram', icon: Award },
  { key: 'wallet', icon: Wallet },
  { key: 'previousSearches', icon: History },
  { key: 'favorites', icon: Heart },
] as const;

/** The header dropdown's content: identity at 64 px, the six account links, sign-out. */
export function AccountDropdownPanel({ onNavigate }: { onNavigate?: () => void }) {
  const m = useAccount();
  return (
    <div className="w-[300px] max-w-full overflow-hidden rounded-2xl border border-(--border) bg-(--popover)">
      <div className="flex items-center gap-3 border-b border-(--border) p-4">
        <AccountAvatar size={64} />
        <Identity />
      </div>
      <ul className="p-2">
        {MENU.map(({ key, icon: Icon }) => (
          <li key={key}>
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                onNavigate?.();
              }}
              className="flex h-11 items-center gap-3 rounded-lg px-3 text-sm font-semibold text-(--ink) outline-none hover:bg-(--surface-2) focus-visible:bg-(--surface-2) focus-visible:ring-2 focus-visible:ring-(--ring)"
            >
              <Icon aria-hidden className="size-[18px] text-(--ink-muted)" strokeWidth={1.75} />
              {m.t.userMenu[key]}
            </a>
          </li>
        ))}
      </ul>
      <div className="border-t border-(--border) p-2">
        <button
          type="button"
          className="flex h-11 w-full items-center gap-3 rounded-lg px-3 text-sm font-semibold text-(--danger-ink) outline-none hover:bg-(--danger-soft) focus-visible:ring-2 focus-visible:ring-(--ring)"
        >
          <LogOut aria-hidden className="size-[18px] rtl:rotate-180" strokeWidth={1.75} />
          {m.t.userMenu.logout}
        </button>
      </div>
    </div>
  );
}

/** The mobile menu's account row: 64 px avatar, name, e-mail, level, sign-out. */
export function MobileAccountRow() {
  const m = useAccount();
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-(--border) bg-(--card) p-3">
      <a href="#" onClick={(e) => e.preventDefault()} className="flex min-w-0 flex-1 items-center gap-3 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-(--ring)">
        <AccountAvatar size={64} />
        <Identity />
      </a>
      <button
        type="button"
        aria-label={m.t.userMenu.logout}
        title={m.t.userMenu.logout}
        className="flex size-11 shrink-0 items-center justify-center rounded-lg text-(--ink-muted) outline-none hover:bg-(--danger-soft) hover:text-(--danger-ink) focus-visible:ring-2 focus-visible:ring-(--ring)"
      >
        <LogOut aria-hidden className="size-5 rtl:rotate-180" strokeWidth={1.75} />
      </button>
    </div>
  );
}

function NavLinks({ vertical = false }: { vertical?: boolean }) {
  const m = useAccount();
  const links = [
    { key: 'hotels', soon: true },
    { key: 'flights', soon: false },
    { key: 'packages', soon: true },
    { key: 'about', soon: false },
    { key: 'contact', soon: false },
    { key: 'manageBooking', soon: false },
  ] as const;
  return (
    <ul className={cn(vertical ? 'flex flex-col' : 'flex items-center gap-1')}>
      {links.map(({ key, soon }) => (
        <li key={key}>
          <a
            href="#"
            onClick={(e) => e.preventDefault()}
            className={cn(
              'flex items-center gap-2 rounded-lg font-semibold outline-none',
              vertical
                ? 'h-12 px-3 text-base text-(--brand-ink) hover:bg-(--surface-2) focus-visible:ring-2 focus-visible:ring-(--ring)'
                : cn('h-11 px-3 text-sm text-(--ah-on-brand-muted) hover:bg-(--ah-on-brand-hover) hover:text-(--ah-on-brand)', focusRing),
            )}
          >
            {m.t.nav[key]}
            {soon && (
              <span
                className={cn(
                  'rounded-full border px-2 text-xs leading-5 font-semibold',
                  vertical
                    ? 'border-(--border) text-(--ink-muted)'
                    : 'border-(--ah-on-brand-line) text-(--ah-on-brand-muted)',
                )}
              >
                {m.t.soon}
              </span>
            )}
          </a>
        </li>
      ))}
    </ul>
  );
}

/**
 * The site header on account pages: flat navy, the same surface as the hero beneath it, so the two read as one
 * passport cover. The 32 px Postmark sits in the account button (desktop) and in the menu button (phones).
 */
export function SiteHeader() {
  const m = useAccount();
  const reduce = useReducedMotion();
  const [menuOpen, setMenuOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const drawerClose = useRef<HTMLButtonElement>(null);
  const drawerOpener = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenuOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  useEffect(() => {
    if (!drawerOpen) return;
    drawerClose.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setDrawerOpen(false);
        drawerOpener.current?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [drawerOpen]);

  const loading = m.state === 'loading';

  return (
    <header className="relative z-40 bg-(--surface-brand) text-(--ah-on-brand)">
      <div className="mx-auto flex h-16 max-w-[1280px] items-center gap-3 px-4 sm:px-6 lg:px-8">
        <a href="#" onClick={(e) => e.preventDefault()} className={cn('shrink-0 rounded-md', focusRing)}>
          <img src={logoUrl} alt="Goteav" width={110} height={40} className="h-10 w-auto" />
        </a>

        <nav aria-label="primary" className="ms-4 hidden xl:block">
          <NavLinks />
        </nav>

        <div className="ms-auto flex items-center gap-1">
          <button
            type="button"
            className={cn(
              'hidden h-11 items-center rounded-lg px-3 text-sm font-semibold text-(--ah-on-brand-muted) hover:bg-(--ah-on-brand-hover) sm:flex',
              focusRing,
            )}
          >
            {m.t.currency}
          </button>
          <button
            type="button"
            className={cn(
              'hidden h-11 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold text-(--ah-on-brand-muted) hover:bg-(--ah-on-brand-hover) sm:flex',
              focusRing,
            )}
          >
            <Globe aria-hidden className="size-4" strokeWidth={1.75} />
            {m.t.otherLanguage}
          </button>
          <button
            type="button"
            aria-label={m.t.notifications}
            className={cn(
              'flex size-11 items-center justify-center rounded-lg text-(--ah-on-brand-muted) hover:bg-(--ah-on-brand-hover) hover:text-(--ah-on-brand)',
              focusRing,
            )}
          >
            <Bell aria-hidden className="size-5" strokeWidth={1.75} />
          </button>

          <span aria-hidden className="mx-1 hidden h-6 w-px bg-(--ah-on-brand-line) lg:block" />

          {/* Desktop: the account button */}
          <div ref={menuRef} className="relative hidden lg:block">
            <button
              type="button"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              aria-label={`${m.t.accountMenuButton}: ${m.a11yName}`}
              onClick={() => setMenuOpen((o) => !o)}
              className={cn(
                'flex h-11 items-center gap-2.5 rounded-lg ps-1.5 pe-2 hover:bg-(--ah-on-brand-hover)',
                focusRing,
              )}
            >
              <AccountAvatar size={32} tone="brand" />
              <span className="hidden max-w-[160px] min-w-0 flex-col items-start xl:flex">
                {loading ? (
                  <span className="h-3.5 w-24 rounded bg-(--ah-on-brand-line)" />
                ) : (
                  <>
                    <span dir="auto" className="max-w-full truncate text-sm leading-tight font-bold">
                      {m.customer.name}
                    </span>
                    {m.levelName && (
                      <span className="text-xs leading-tight font-semibold text-(--ah-on-brand-muted)">
                        {m.t.card.level(m.levelName)}
                      </span>
                    )}
                  </>
                )}
              </span>
              <ChevronDown
                aria-hidden
                className={cn('size-4 text-(--ah-on-brand-muted) transition-transform', menuOpen && 'rotate-180')}
              />
            </button>
            <AnimatePresence>
              {menuOpen && (
                <motion.div
                  role="menu"
                  initial={reduce ? false : { opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reduce ? { opacity: 0 } : { opacity: 0, y: -4 }}
                  transition={{ duration: 0.16 }}
                  className="absolute end-0 top-[calc(100%+8px)]"
                >
                  <AccountDropdownPanel onNavigate={() => setMenuOpen(false)} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Phones and tablets: the menu button carries the 32 px avatar */}
          <button
            ref={drawerOpener}
            type="button"
            aria-label={m.t.openMenu}
            aria-expanded={drawerOpen}
            onClick={() => setDrawerOpen(true)}
            className={cn(
              'flex h-11 items-center gap-1.5 rounded-lg ps-1.5 pe-2.5 hover:bg-(--ah-on-brand-hover) lg:hidden',
              focusRing,
            )}
          >
            <AccountAvatar size={32} tone="brand" />
            <Menu aria-hidden className="size-5 text-(--ah-on-brand-muted)" strokeWidth={1.75} />
          </button>
        </div>
      </div>

      <AnimatePresence>
        {drawerOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <motion.button
              type="button"
              aria-label={m.t.closeMenu}
              tabIndex={-1}
              onClick={() => setDrawerOpen(false)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-(--navy-950)/50"
            />
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label={m.t.accountMenuButton}
              initial={reduce ? { opacity: 0 } : { x: m.locale === 'ar' ? '-100%' : '100%' }}
              animate={reduce ? { opacity: 1 } : { x: 0 }}
              exit={reduce ? { opacity: 0 } : { x: m.locale === 'ar' ? '-100%' : '100%' }}
              transition={{ type: 'tween', duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
              className="absolute inset-y-0 end-0 flex w-[min(360px,100%)] flex-col border-s border-(--border) bg-(--background)"
            >
              <div className="flex h-16 items-center justify-between border-b border-(--border) px-4">
                <span className="text-base font-bold text-(--brand-ink)">{m.t.accountMenuButton}</span>
                <button
                  ref={drawerClose}
                  type="button"
                  aria-label={m.t.closeMenu}
                  onClick={() => {
                    setDrawerOpen(false);
                    drawerOpener.current?.focus();
                  }}
                  className="flex size-11 items-center justify-center rounded-lg text-(--ink) outline-none hover:bg-(--surface-2) focus-visible:ring-2 focus-visible:ring-(--ring)"
                >
                  <X aria-hidden className="size-5" />
                </button>
              </div>
              <nav aria-label="primary" className="flex-1 overflow-y-auto p-3">
                <NavLinks vertical />
              </nav>
              <div className="border-t border-(--border) bg-(--surface-2) p-4">
                <MobileAccountRow />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </header>
  );
}
