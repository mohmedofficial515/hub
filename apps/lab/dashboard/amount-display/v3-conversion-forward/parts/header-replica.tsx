import { useState } from 'react';
import { Banknote, Bell, ChevronDown, Globe, LayoutDashboard, LogOut, Maximize2, Menu, Moon, Plane, Search, Settings, Sun, User, Wallet, Zap } from 'lucide-react';
import { useLocale, useT } from '@lab/i18n';
import { cn } from '@lab/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@dash/components/ui/dropdown-menu';
import { fill, messages } from '../i18n';
import { CurrencySign } from './currency-sign';
import { Overlay } from './overlay';
import { CurrencyAvatar, CurrencyList, CurrencySwitcher } from './switcher';
import { nameOf, showsSign, useEnv } from './env';

/** The lab frame reads language and theme from the hash; the header buttons write it. */
export function setMode(patch: { lang?: 'ar' | 'en'; theme?: 'light' | 'dark' }) {
  const [path, query = ''] = location.hash.replace(/^#\/?/, '').split('?');
  const sp = new URLSearchParams(query);
  Object.entries(patch).forEach(([k, v]) => sp.set(k, v));
  location.hash = `/${path}?${sp.toString()}`;
}

function LanguagePill() {
  const lang = useLocale();
  const t = useT(messages);
  const isAr = lang === 'ar';
  const W = '42px';
  return (
    <button
      type="button"
      onClick={() => setMode({ lang: isAr ? 'en' : 'ar' })}
      title={isAr ? t.hdrToEnglish : t.hdrToArabic}
      aria-label={isAr ? t.hdrToEnglish : t.hdrToArabic}
      className="relative inline-flex h-8 w-[78px] shrink-0 items-center rounded-full border border-border bg-muted outline-none transition-all duration-300 ease-in-out focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 active:scale-95"
    >
      <span className="absolute z-0 text-11 font-bold text-muted-foreground/55" style={isAr ? { insetInlineEnd: '0.7rem' } : { insetInlineStart: '0.85rem' }}>
        {isAr ? 'EN' : 'ع'}
      </span>
      <span
        className="absolute z-10 flex h-6 items-center justify-center gap-1 rounded-full bg-background text-11 font-bold text-primary shadow-sm transition-all duration-300"
        style={{ width: W, insetInlineStart: isAr ? '0.25rem' : `calc(100% - ${W} - 0.25rem)` }}
      >
        <Globe className="size-3" />
        {isAr ? 'ع' : 'EN'}
      </span>
    </button>
  );
}

const ICON_BTN =
  'flex size-8 items-center justify-center rounded-full text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-primary focus-visible:ring-2 focus-visible:ring-primary/40';

export function HeaderReplica() {
  const t = useT(messages);
  const env = useEnv();
  const [drawer, setDrawer] = useState(false);
  const [curOpen, setCurOpen] = useState(false);
  const dark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
  const sign = showsSign(env, env.display, false);

  return (
    <div className="pb-2 px-3 pt-3 lg:px-8">
      <header className="flex h-14 items-center justify-between gap-3 rounded-xl border bg-card/95 px-2 backdrop-blur-sm">
        {/* Start: hamburger (below lg) + brand + breadcrumb (xl) */}
        <div className="flex min-w-0 items-center gap-2">
          <button
            type="button"
            onClick={() => setDrawer(true)}
            aria-label={t.hdrMenu}
            className="flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-primary focus-visible:ring-2 focus-visible:ring-ring lg:hidden"
          >
            <Menu className="size-5" />
          </button>
          <span className="flex items-center gap-2 ps-1 text-15 font-black text-primary">
            <span aria-hidden className="grid size-7 place-items-center rounded-lg bg-primary text-13 text-primary-foreground">
              G
            </span>
            <span className="hidden sm:inline">Goteav</span>
          </span>
          <nav aria-label="breadcrumb" className="hidden items-center gap-1.5 ps-2 text-12 text-muted-foreground xl:flex">
            <span>{t.hdrNavFinance}</span>
            <span aria-hidden>/</span>
            <span className="font-bold text-foreground">{t.hdrNavOverview}</span>
          </nav>
        </div>

        <div className="hidden h-9 w-60 items-center gap-2 rounded-lg border bg-muted/50 px-3 text-12 text-muted-foreground md:flex lg:w-72">
          <Search className="size-4" />
          <span className="flex-1">{t.hdrSearch}</span>
          <kbd className="rounded border bg-background px-1.5 py-0.5 text-10" dir="ltr">
            Ctrl K
          </kbd>
        </div>

        {/* End: tool group + user */}
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          <div className="flex items-center gap-0.5 rounded-lg border border-border bg-muted/80 p-1 sm:gap-1">
            <LanguagePill />
            <CurrencySwitcher />
            <button
              type="button"
              className={ICON_BTN}
              onClick={() => setMode({ theme: dark ? 'light' : 'dark' })}
              aria-label={dark ? t.hdrLight : t.hdrDark}
              title={dark ? t.hdrLight : t.hdrDark}
            >
              {dark ? <Sun className="size-4.5" /> : <Moon className="size-4.5" />}
            </button>
            <div className="hidden sm:block">
              <button type="button" className={ICON_BTN} aria-label={t.hdrFullscreen}>
                <Maximize2 className="size-4" />
              </button>
            </div>
            <span aria-hidden className="mx-0.5 h-5 w-px bg-border" />
            <button type="button" className={ICON_BTN} aria-label={t.hdrQuick}>
              <Zap className="size-4.5" />
            </button>
            <button type="button" className={cn(ICON_BTN, 'relative')} aria-label={t.hdrNotifications}>
              <Bell className="size-4.5" />
              <span aria-hidden className="absolute end-1.5 top-1.5 size-2 rounded-full bg-destructive ring-2 ring-muted" />
            </button>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label={fill(t.hdrAccount, { name: t.hdrUserName })}
                className="group flex max-w-[140px] items-center gap-2 rounded-lg border bg-muted px-1.5 py-1 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring data-[state=open]:bg-muted sm:max-w-[200px] sm:px-2"
              >
                <span aria-hidden className="relative flex size-8 shrink-0 items-center justify-center rounded-full bg-white text-12 font-bold text-primary ring-2 ring-primary/15 dark:bg-primary/30">
                  {t.hdrInitials}
                  <span className="absolute bottom-0 start-0 size-2 rounded-full bg-success ring-[1.5px] ring-background" />
                </span>
                <span className="hidden min-w-0 flex-col text-start leading-tight sm:flex">
                  <span className="truncate text-13 font-bold text-foreground">{t.hdrUserName}</span>
                  <span className="truncate text-11 font-medium text-muted-foreground" dir="ltr">
                    ops@goteav.com
                  </span>
                </span>
                <ChevronDown className="hidden size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180 sm:block" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[calc(100vw-32px)] rounded-xl border-border/60 p-2 shadow-2xl sm:w-60" collisionPadding={16}>
              <DropdownMenuLabel className="px-2 py-1 text-sm font-semibold">{fill(t.hdrGreeting, { name: t.hdrUserName })}</DropdownMenuLabel>
              <DropdownMenuSeparator className="-mx-2 my-1 bg-border/50" />
              {/* Below sm the header has no room for the switcher: it lives here as a sub-menu (and in the drawer). */}
              <div className="sm:hidden">
                <DropdownMenuItem
                  className="min-h-11 gap-2.5 rounded-lg px-2 py-2"
                  data-testid="mobile-currency-sub"
                  onSelect={(e) => {
                    e.preventDefault();
                    setCurOpen((o) => !o);
                  }}
                  aria-expanded={curOpen}
                >
                  <CurrencyAvatar code={env.display} className="size-7" />
                  <span className="flex min-w-0 flex-1 flex-col text-start leading-tight">
                    <span className="text-13">{t.displayCurrency}</span>
                    <span className="truncate text-11 text-muted-foreground" dir="ltr">
                      {env.display} · {nameOf(env, env.display)}
                    </span>
                  </span>
                  <ChevronDown className={cn('size-4 text-muted-foreground transition-transform', curOpen && 'rotate-180')} />
                </DropdownMenuItem>
                {curOpen && (
                  <DropdownMenuRadioGroup value={env.display} onValueChange={env.setDisplay} className="max-h-60 overflow-y-auto rounded-lg bg-muted/40 p-1">
                    {env.catalog.map((c) => (
                      <DropdownMenuRadioItem key={c.code} value={c.code} disabled={!env.switcherEnabled} className="min-h-11 gap-2 rounded-lg">
                        <span dir="ltr" className="w-10 text-13 font-bold">
                          {c.code}
                        </span>
                        <span className="truncate text-12 text-muted-foreground">{c.names[env.lang]}</span>
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                )}
                <DropdownMenuSeparator className="-mx-2 my-1 bg-border/50" />
              </div>
              {[
                [User, t.hdrProfile],
                [Settings, t.hdrSettings],
              ].map(([Icon, label]) => {
                const I = Icon as typeof User;
                return (
                  <DropdownMenuItem key={label as string} className="min-h-11 rounded-lg px-2 py-2 sm:min-h-0">
                    <I className="size-4.5" />
                    <span className="text-13">{label as string}</span>
                  </DropdownMenuItem>
                );
              })}
              <DropdownMenuSeparator className="-mx-2 my-1 bg-border/50" />
              <DropdownMenuItem className="min-h-11 rounded-lg px-2 py-2 sm:min-h-0">
                <LogOut className="size-4.5 rtl:-scale-x-100" />
                <span className="text-13">{t.hdrLogout}</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <Overlay open={drawer} onClose={() => setDrawer(false)} placement="start" title={t.hdrMenu}>
        <nav className="space-y-1 p-3">
          {[
            [LayoutDashboard, t.hdrNavHome],
            [Banknote, t.hdrNavFinance],
            [Plane, t.hdrNavFlights],
            [Wallet, t.hdrNavWallets],
          ].map(([Icon, label]) => {
            const I = Icon as typeof User;
            return (
              <button key={label as string} type="button" className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-start text-13 font-medium outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring">
                <I className="size-4.5 text-muted-foreground" />
                {label as string}
              </button>
            );
          })}
        </nav>
        <div className="border-t px-3 pb-3 pt-3">
          <p className="flex items-center gap-2 px-1 pb-2 text-12 font-bold text-muted-foreground">
            <span className="inline-flex items-center" style={{ ['--sign-box' as string]: '1em' }}>
              {sign && <CurrencySign code={env.display} />}
            </span>
            {t.displayCurrency}
          </p>
          <div className="rounded-xl border">
            <CurrencyList
              onPick={(c) => {
                env.setDisplay(c);
                setDrawer(false);
              }}
            />
          </div>
        </div>
      </Overlay>
    </div>
  );
}
