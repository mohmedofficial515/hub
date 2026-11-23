import { useCallback, useEffect, useId, useRef, useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  Award,
  Bell,
  Briefcase,
  ChevronDown,
  Globe,
  Heart,
  History,
  Hotel,
  LogOut,
  Menu,
  Moon,
  Package,
  Plane,
  Smartphone,
  Sun,
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
const onBrandButton = cn(
  'h-11 items-center rounded-lg px-3 text-sm font-semibold text-(--ah-on-brand-muted) hover:bg-(--ah-on-brand-hover) hover:text-(--ah-on-brand)',
  focusRing,
);
const surfaceFocus = 'outline-none focus-visible:ring-2 focus-visible:ring-(--ring)';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** The site's light/dark switch. In the real header this is the existing ThemeToggle; here it flips the frame. */
function useTheme() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'));
  const toggle = useCallback(() => {
    const html = document.documentElement;
    const next = !html.classList.contains('dark');
    html.classList.toggle('dark', next);
    html.style.colorScheme = next ? 'dark' : 'light';
    setDark(next);
  }, []);
  return { dark, toggle };
}

function ThemeButton({ dark, onToggle, tone }: { dark: boolean; onToggle: () => void; tone: 'brand' | 'surface' }) {
  const m = useAccount();
  const Icon = dark ? Sun : Moon;
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={dark ? m.t.themeToLight : m.t.themeToDark}
      title={dark ? m.t.themeToLight : m.t.themeToDark}
      className={cn(
        'flex size-11 shrink-0 items-center justify-center rounded-lg',
        tone === 'brand'
          ? cn('text-(--ah-on-brand-muted) hover:bg-(--ah-on-brand-hover) hover:text-(--ah-on-brand)', focusRing)
          : cn('border border-(--border) text-(--ink) hover:bg-(--surface-2)', surfaceFocus),
      )}
    >
      <Icon aria-hidden className="size-5" strokeWidth={1.75} />
    </button>
  );
}

/** Name, e-mail and level: the identity row shared by the header menu and the mobile menu. */
function Identity() {
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
      <bdi dir="ltr" className="max-w-full truncate text-sm text-(--ink-muted)">
        {m.customer.email}
      </bdi>
      {m.levelName && (
        <span className="mt-0.5 inline-flex items-center gap-1.5 text-sm font-semibold text-(--ink)">
          <LevelMark level={m.frame} className="size-4" />
          {m.t.card.level(m.levelName)}
        </span>
      )}
    </span>
  );
}

const ACCOUNT_LINKS = [
  { key: 'personalDetails', icon: UserIcon },
  { key: 'myBookings', icon: Briefcase },
  { key: 'loyaltyProgram', icon: Award },
  { key: 'wallet', icon: Wallet },
  { key: 'previousSearches', icon: History },
  { key: 'favorites', icon: Heart },
] as const;

function AccountLinks({ firstRef, onNavigate }: { firstRef?: RefObject<HTMLAnchorElement | null>; onNavigate?: () => void }) {
  const m = useAccount();
  return (
    <ul>
      {ACCOUNT_LINKS.map(({ key, icon: Icon }, i) => (
        <li key={key}>
          <a
            ref={i === 0 ? firstRef : undefined}
            href="#"
            onClick={(e) => {
              e.preventDefault();
              onNavigate?.();
            }}
            className={cn(
              'flex h-11 items-center gap-3 rounded-lg px-3 text-sm font-semibold text-(--ink) hover:bg-(--surface-2) focus-visible:bg-(--surface-2)',
              surfaceFocus,
            )}
          >
            <Icon aria-hidden className="size-[18px] text-(--ink-muted)" strokeWidth={1.75} />
            {m.t.userMenu[key]}
          </a>
        </li>
      ))}
    </ul>
  );
}

function LogoutButton() {
  const m = useAccount();
  return (
    <button
      type="button"
      className={cn(
        'flex h-11 w-full items-center gap-3 rounded-lg px-3 text-sm font-semibold text-(--danger-ink) hover:bg-(--danger-soft)',
        surfaceFocus,
      )}
    >
      <LogOut aria-hidden className="size-[18px] rtl:rotate-180" strokeWidth={1.75} />
      {m.t.userMenu.logout}
    </button>
  );
}

/** The header account panel: identity at 64 px, the six account links, sign-out. A disclosure, not an ARIA menu. */
export function AccountDropdownPanel({
  id,
  firstRef,
  onNavigate,
}: {
  id?: string;
  firstRef?: RefObject<HTMLAnchorElement | null>;
  onNavigate?: () => void;
}) {
  return (
    <div id={id} className="w-[300px] max-w-full overflow-hidden rounded-2xl border border-(--border) bg-(--popover)">
      <div className="flex items-center gap-3 border-b border-(--border) p-4">
        <AccountAvatar size={64} />
        <Identity />
      </div>
      <div className="p-2">
        <AccountLinks firstRef={firstRef} onNavigate={onNavigate} />
      </div>
      <div className="border-t border-(--border) p-2">
        <LogoutButton />
      </div>
    </div>
  );
}

/** The mobile menu's account row: 64 px avatar, name, e-mail, level, sign-out. */
export function MobileAccountRow() {
  const m = useAccount();
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-(--border) bg-(--card) p-3">
      <a href="#" onClick={(e) => e.preventDefault()} className={cn('flex min-w-0 flex-1 items-center gap-3 rounded-xl', surfaceFocus)}>
        <AccountAvatar size={64} />
        <Identity />
      </a>
      <button
        type="button"
        aria-label={m.t.userMenu.logout}
        title={m.t.userMenu.logout}
        className={cn(
          'flex size-11 shrink-0 items-center justify-center rounded-lg text-(--ink-muted) hover:bg-(--danger-soft) hover:text-(--danger-ink)',
          surfaceFocus,
        )}
      >
        <LogOut aria-hidden className="size-5 rtl:rotate-180" strokeWidth={1.75} />
      </button>
    </div>
  );
}

const NAV = [
  { key: 'hotels', soon: true },
  { key: 'flights', soon: false },
  { key: 'packages', soon: true },
  { key: 'about', soon: false },
  { key: 'contact', soon: false },
  { key: 'manageBooking', soon: false },
] as const;

function SoonBadge({ onBrand = false }: { onBrand?: boolean }) {
  const m = useAccount();
  return (
    <span
      className={cn(
        'rounded-full border px-2 text-xs leading-5 font-semibold',
        onBrand ? 'border-(--ah-on-brand-line) text-(--ah-on-brand-muted)' : 'border-(--border) text-(--ink-muted)',
      )}
    >
      {m.t.soon}
    </span>
  );
}

function DrawerSection({ title, children }: { title: string; children: React.ReactNode }) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="border-b border-(--border) px-3 py-4 last:border-b-0">
      <h3 id={id} className="px-3 pb-2 text-xs font-semibold text-(--ink-muted)">
        {title}
      </h3>
      {children}
    </section>
  );
}

/** The site drawer (below xl): modal, focus trapped, page behind inert and not scrollable. */
function SiteDrawer({
  onClose,
  dark,
  onToggleTheme,
}: {
  onClose: () => void;
  dark: boolean;
  onToggleTheme: () => void;
}) {
  const m = useAccount();
  const reduce = useReducedMotion();
  const panel = useRef<HTMLDivElement>(null);
  const closeBtn = useRef<HTMLButtonElement>(null);
  const titleId = useId();

  useEffect(() => {
    const root = document.getElementById('root');
    const html = document.documentElement;
    const before = html.style.overflow;
    root?.setAttribute('inert', '');
    html.style.overflow = 'hidden';
    closeBtn.current?.focus();
    return () => {
      root?.removeAttribute('inert');
      html.style.overflow = before;
    };
  }, []);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      onClose();
      return;
    }
    if (e.key !== 'Tab' || !panel.current) return;
    const items = [...panel.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null);
    if (items.length === 0) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  const services = [
    { key: 'hotels', icon: Hotel, label: m.t.nav.hotels, soon: true },
    { key: 'packages', icon: Package, label: m.t.nav.packages, soon: true },
    { key: 'flights', icon: Plane, label: m.t.nav.flights, soon: false },
    { key: 'esim', icon: Smartphone, label: m.t.esim, soon: true },
  ];

  return createPortal(
    <div className="ah-root fixed inset-0 z-50" onKeyDown={onKeyDown}>
      <motion.div
        aria-hidden
        onClick={onClose}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-(--navy-950)/50"
      />
      <motion.div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        initial={reduce ? { opacity: 0 } : { x: m.locale === 'ar' ? '-100%' : '100%' }}
        animate={reduce ? { opacity: 1 } : { x: 0 }}
        exit={reduce ? { opacity: 0 } : { x: m.locale === 'ar' ? '-100%' : '100%' }}
        transition={{ type: 'tween', duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
        className="absolute inset-y-0 end-0 flex w-[min(380px,100%)] flex-col border-s border-(--border) bg-(--background) text-(--ink)"
      >
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-(--border) px-4">
          <h2 id={titleId} className="text-base font-bold text-(--brand-ink)">
            {m.t.siteMenu}
          </h2>
          <button
            ref={closeBtn}
            type="button"
            aria-label={m.t.closeMenu}
            onClick={onClose}
            className={cn('flex size-11 items-center justify-center rounded-lg text-(--ink) hover:bg-(--surface-2)', surfaceFocus)}
          >
            <X aria-hidden className="size-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain">
          <DrawerSection title={m.t.navigationTitle}>
            <nav aria-label={m.t.navLabel}>
              <ul>
                {NAV.map(({ key, soon }) => (
                  <li key={key}>
                    <a
                      href="#"
                      onClick={(e) => e.preventDefault()}
                      className={cn(
                        'flex h-11 items-center gap-2 rounded-lg px-3 text-base font-semibold text-(--brand-ink) hover:bg-(--surface-2)',
                        surfaceFocus,
                      )}
                    >
                      {m.t.nav[key]}
                      {soon && <SoonBadge />}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          </DrawerSection>

          <DrawerSection title={m.t.servicesTitle}>
            <ul className="grid grid-cols-2 gap-2 px-1">
              {services.map(({ key, icon: Icon, label, soon }) => (
                <li key={key}>
                  <a
                    href="#"
                    onClick={(e) => e.preventDefault()}
                    className={cn(
                      'flex min-h-[88px] flex-col items-center justify-center gap-1.5 rounded-xl border border-(--border) p-2 text-center text-sm font-semibold text-(--ink) hover:bg-(--surface-2)',
                      surfaceFocus,
                    )}
                  >
                    <Icon aria-hidden className="size-6 text-(--brand-ink)" strokeWidth={1.5} />
                    {label}
                    {soon && <SoonBadge />}
                  </a>
                </li>
              ))}
            </ul>
          </DrawerSection>

          <DrawerSection title={m.t.trendingTitle}>
            <ul className="flex flex-wrap gap-2 px-1">
              {m.t.destinations.map((name) => (
                <li key={name}>
                  <a
                    href="#"
                    onClick={(e) => e.preventDefault()}
                    className={cn(
                      'inline-flex h-11 items-center rounded-full border border-(--border) px-4 text-sm font-semibold text-(--ink) hover:bg-(--surface-2)',
                      surfaceFocus,
                    )}
                  >
                    {name}
                  </a>
                </li>
              ))}
            </ul>
          </DrawerSection>

          <DrawerSection title={m.t.myAccountTitle}>
            <AccountLinks onNavigate={onClose} />
          </DrawerSection>

          {/* Below 640 px the header has no room for these, so they live here. */}
          <div className="sm:hidden">
            <DrawerSection title={m.t.settingsTitle}>
              <div className="flex flex-wrap items-center gap-2 px-1">
                <button
                  type="button"
                  className={cn(
                    'inline-flex h-11 items-center rounded-lg border border-(--border) px-4 text-sm font-semibold text-(--ink) hover:bg-(--surface-2)',
                    surfaceFocus,
                  )}
                >
                  {m.t.currency}
                </button>
                <button
                  type="button"
                  className={cn(
                    'inline-flex h-11 items-center gap-1.5 rounded-lg border border-(--border) px-4 text-sm font-semibold text-(--ink) hover:bg-(--surface-2)',
                    surfaceFocus,
                  )}
                >
                  <Globe aria-hidden className="size-4" strokeWidth={1.75} />
                  {m.t.otherLanguage}
                </button>
                <ThemeButton dark={dark} onToggle={onToggleTheme} tone="surface" />
              </div>
            </DrawerSection>
          </div>
        </div>

        <div className="shrink-0 border-t border-(--border) bg-(--surface-2) p-4">
          <MobileAccountRow />
        </div>
      </motion.div>
    </div>,
    document.body,
  );
}

/**
 * The site header on account pages: flat navy, the same surface as the hero beneath it, so the two read as one
 * passport cover. From xl the 32 px Postmark opens the account panel; below xl it sits in the menu button.
 */
/**
 * v5: the header has no background of its own. It sits on the cover band: v3's flat navy without a cover, the veiled
 * photo with one (the band's `.cc-on-cover` turns its quieter text white; tokens.css section 5).
 */
export function SiteHeader() {
  const m = useAccount();
  const reduce = useReducedMotion();
  const { dark, toggle } = useTheme();
  const [panelOpen, setPanelOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const panelWrap = useRef<HTMLDivElement>(null);
  const panelButton = useRef<HTMLButtonElement>(null);
  const firstLink = useRef<HTMLAnchorElement>(null);
  const drawerOpener = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  const closePanel = useCallback((returnFocus: boolean) => {
    setPanelOpen(false);
    if (returnFocus) panelButton.current?.focus();
  }, []);

  useEffect(() => {
    if (!panelOpen) return;
    // Focus moves into the panel on open.
    const raf = requestAnimationFrame(() => firstLink.current?.focus());
    const onDown = (e: MouseEvent) => {
      if (panelWrap.current?.contains(e.target as Node)) return;
      // Focus goes back to the button unless the click lands on another control, which then keeps it.
      const focusInside = panelWrap.current?.contains(document.activeElement);
      const onControl = (e.target as Element | null)?.closest?.(FOCUSABLE);
      setPanelOpen(false);
      if (focusInside && !onControl) setTimeout(() => panelButton.current?.focus(), 0);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closePanel(true);
    };
    const onFocusOut = (e: FocusEvent) => {
      const next = e.relatedTarget as Node | null;
      if (next && !panelWrap.current?.contains(next)) setPanelOpen(false);
    };
    const wrap = panelWrap.current;
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    wrap?.addEventListener('focusout', onFocusOut);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
      wrap?.removeEventListener('focusout', onFocusOut);
    };
  }, [panelOpen, closePanel]);

  const closeDrawer = useCallback(() => {
    // Lift inert now (the drawer's own cleanup runs only after its exit animation) so focus can return at once.
    document.getElementById('root')?.removeAttribute('inert');
    drawerOpener.current?.focus();
    setDrawerOpen(false);
  }, []);

  const loading = m.state === 'loading';

  return (
    <header className="relative z-40 text-(--ah-on-brand)">
      <div className="mx-auto flex h-16 max-w-[1280px] items-center gap-3 px-4 sm:px-6 lg:px-8">
        <a href="#" onClick={(e) => e.preventDefault()} className={cn('shrink-0 rounded-md', focusRing)}>
          <img src={logoUrl} alt="Goteav" width={110} height={40} className="h-10 w-auto" />
        </a>

        <nav aria-label={m.t.navLabel} className="ms-4 hidden xl:block">
          <ul className="flex items-center gap-1">
            {NAV.map(({ key, soon }) => (
              <li key={key}>
                <a href="#" onClick={(e) => e.preventDefault()} className={cn('flex gap-2', onBrandButton)}>
                  {m.t.nav[key]}
                  {soon && <SoonBadge onBrand />}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="ms-auto flex items-center gap-1">
          <button type="button" className={cn('hidden sm:flex', onBrandButton)}>
            {m.t.currency}
          </button>
          <button type="button" className={cn('hidden gap-1.5 sm:flex', onBrandButton)}>
            <Globe aria-hidden className="size-4" strokeWidth={1.75} />
            {m.t.otherLanguage}
          </button>
          <span className="hidden sm:flex">
            <ThemeButton dark={dark} onToggle={toggle} tone="brand" />
          </span>
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

          <span aria-hidden className="mx-1 hidden h-6 w-px bg-(--ah-on-brand-line) xl:block" />

          {/* From xl: the account button opens a disclosure panel */}
          <div ref={panelWrap} className="relative hidden xl:block">
            <button
              ref={panelButton}
              type="button"
              aria-expanded={panelOpen}
              aria-controls={panelId}
              aria-label={`${m.t.accountMenuButton}${m.locale === 'ar' ? '، ' : ', '}${m.a11yName}`}
              onClick={() => setPanelOpen((o) => !o)}
              className={cn('flex h-11 items-center gap-2.5 rounded-lg ps-1.5 pe-2 hover:bg-(--ah-on-brand-hover)', focusRing)}
            >
              <AccountAvatar size={32} tone="brand" />
              <span className="flex max-w-[160px] min-w-0 flex-col items-start">
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
                className={cn('size-4 text-(--ah-on-brand-muted) transition-transform', panelOpen && 'rotate-180')}
              />
            </button>
            <AnimatePresence>
              {panelOpen && (
                <motion.div
                  initial={reduce ? false : { opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reduce ? { opacity: 0 } : { opacity: 0, y: -4 }}
                  transition={{ duration: 0.16 }}
                  className="absolute end-0 top-[calc(100%+8px)]"
                >
                  <AccountDropdownPanel id={panelId} firstRef={firstLink} onNavigate={() => closePanel(true)} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Below xl: the menu button carries the 32 px avatar and opens the site drawer */}
          <button
            ref={drawerOpener}
            type="button"
            aria-label={m.t.menuButton(m.a11yName)}
            aria-haspopup="dialog"
            aria-expanded={drawerOpen}
            onClick={() => setDrawerOpen(true)}
            className={cn('flex h-11 items-center gap-1.5 rounded-lg ps-1.5 pe-2.5 hover:bg-(--ah-on-brand-hover) xl:hidden', focusRing)}
          >
            <AccountAvatar size={32} tone="brand" />
            <Menu aria-hidden className="size-5 text-(--ah-on-brand-muted)" strokeWidth={1.75} />
          </button>
        </div>
      </div>

      <AnimatePresence
        onExitComplete={() => {
          // Once the drawer is gone, make sure focus is back on the menu button (not left on <body>).
          if (!document.activeElement || document.activeElement === document.body) drawerOpener.current?.focus();
        }}
      >
        {drawerOpen && <SiteDrawer onClose={closeDrawer} dark={dark} onToggleTheme={toggle} />}
      </AnimatePresence>
    </header>
  );
}
