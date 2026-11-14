/**
 * Faithful replica of the dashboard topbar (`components/layout/dashboard-header.tsx`) with the new switcher inserted
 * between the theme and fullscreen buttons. Same wrapper (pb-2 px-3 lg:px-8 pt-3), header (h-14 rounded-xl border bg-card/95 px-2)
 * and end group (rounded-lg border bg-muted/80 p-1 gap-0.5 sm:gap-1). Language and theme really switch the lab frame.
 */
import { useState, useSyncExternalStore } from 'react';
import { Bell, ChevronDown, Globe, LogOut, Maximize, Menu, Moon, Search, Settings, Sun, User, X, Zap } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import { cn } from '@lab/utils';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@dash/components/ui/dropdown-menu';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@dash/components/ui/sheet';
import { setHashParam, useLab } from './env';
import { CurrencyMenuSub, CurrencySwitcher, DrawerCurrencyEntry } from './switcher';

function useDark() {
  return useSyncExternalStore(
    (cb) => {
      const o = new MutationObserver(cb);
      o.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
      return () => o.disconnect();
    },
    () => document.documentElement.classList.contains('dark'),
    () => false,
  );
}

const ICON_BTN =
  'relative flex size-8 items-center justify-center rounded-full text-muted-foreground outline-none transition-colors hover:bg-card hover:text-primary focus-visible:ring-2 focus-visible:ring-ring';

function LanguagePill() {
  const { locale, t } = useLab();
  const isAr = locale === 'ar';
  return (
    <button
      type="button"
      onClick={() => setHashParam('lang', isAr ? 'en' : 'ar')}
      title={isAr ? t.header.toEnglish : t.header.toArabic}
      aria-label={isAr ? t.header.toEnglish : t.header.toArabic}
      className="relative inline-flex h-8 w-[78px] shrink-0 items-center rounded-full border border-border bg-muted outline-none transition-all duration-300 active:scale-95 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
    >
      <span className="absolute z-0 text-11 font-bold text-muted-foreground/55" style={isAr ? { insetInlineEnd: '0.7rem' } : { insetInlineStart: '0.85rem' }}>
        {isAr ? 'EN' : 'ع'}
      </span>
      <span
        className="absolute top-1 z-10 flex h-6 items-center justify-center gap-1 rounded-full bg-background text-primary shadow-sm"
        style={{ width: '42px', insetInlineStart: isAr ? '0.25rem' : 'calc(100% - 42px - 0.25rem)' }}
      >
        <Globe className="h-3.5 w-3.5" aria-hidden />
        <span className="text-11 font-extrabold leading-none">{isAr ? 'ع' : 'EN'}</span>
      </span>
    </button>
  );
}

function ThemeButton() {
  const { t } = useLab();
  const dark = useDark();
  return (
    <button
      type="button"
      onClick={() => setHashParam('theme', dark ? 'light' : 'dark')}
      title={dark ? t.header.toLight : t.header.toDark}
      aria-label={dark ? t.header.toLight : t.header.toDark}
      className={cn(ICON_BTN, 'hover:bg-muted')}
    >
      {dark ? <Sun className="size-[18px]" /> : <Moon className="size-[18px]" />}
    </button>
  );
}

function HintChip() {
  const { t, hint, dismissHint } = useLab();
  const reduce = useReducedMotion();
  if (!hint) return null;
  return (
    <motion.div
      role="status"
      initial={reduce ? false : { opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      className="absolute end-3 top-full z-40 mt-1 flex max-w-[calc(100vw-1.5rem)] items-center gap-2 rounded-full border bg-popover py-1 ps-3 pe-1 text-12 font-medium text-popover-foreground shadow-lg lg:end-8"
    >
      {t.header.hint}
      <button type="button" aria-label={t.header.dismiss} onClick={dismissHint} className="flex size-8 items-center justify-center rounded-full text-muted-foreground outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring">
        <X className="size-3.5" aria-hidden />
      </button>
    </motion.div>
  );
}

function Drawer({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { t, locale } = useLab();
  const items = [t.header.nav.home, t.header.nav.flights, t.header.nav.finance, t.header.nav.settings];
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side={locale === 'ar' ? 'right' : 'left'} className="w-[min(20rem,88vw)] gap-3 p-4">
        <SheetHeader className="p-0 pe-8">
          <SheetTitle className="text-16 font-extrabold text-primary">Goteav</SheetTitle>
          <SheetDescription className="sr-only">{t.header.menu}</SheetDescription>
        </SheetHeader>
        <nav aria-label={t.header.menu} className="grid gap-1">
          {items.map((label, i) => (
            <button
              key={label}
              type="button"
              className={cn('flex min-h-11 items-center rounded-lg px-3 text-start text-14 font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring', i === 2 ? 'bg-primary/10 text-primary' : 'text-foreground hover:bg-muted')}
            >
              {label}
            </button>
          ))}
        </nav>
        <div className="mt-auto grid gap-2">
          <p className="px-1 text-11 font-semibold text-muted-foreground">{t.header.drawerSection}</p>
          <DrawerCurrencyEntry />
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function HeaderReplica({ className }: { className?: string }) {
  const { t } = useLab();
  const [drawer, setDrawer] = useState(false);
  return (
    <div className={cn('relative z-30 px-3 pb-2 pt-3 lg:px-8', className)}>
      <header className="flex h-14 items-center justify-between gap-3 rounded-xl border bg-card/95 px-2 backdrop-blur-sm">
        <div className="flex min-w-0 items-center gap-2">
          <button
            type="button"
            onClick={() => setDrawer(true)}
            aria-label={t.header.menu}
            className="flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-primary focus-visible:ring-2 focus-visible:ring-ring lg:hidden"
          >
            <Menu className="size-5" />
          </button>
          <span className="hidden truncate text-13 font-bold text-foreground xl:block">
            {t.header.crumbHome} <span className="text-muted-foreground">/</span> {t.header.crumbHere}
          </span>
        </div>

        <div className="hidden h-9 min-w-0 max-w-sm flex-1 items-center gap-2 rounded-full border bg-muted/60 px-3 text-13 text-muted-foreground md:flex">
          <Search className="size-4 shrink-0" aria-hidden />
          <span className="truncate">{t.header.search}</span>
        </div>

        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          <div className="flex items-center gap-0.5 rounded-lg border border-border bg-muted/80 p-1 sm:gap-1">
            <LanguagePill />
            <ThemeButton />
            <CurrencySwitcher />
            <button type="button" tabIndex={-1} aria-label={t.header.fullscreen} className={cn(ICON_BTN, 'hidden sm:flex')}>
              <Maximize className="size-[18px]" />
            </button>
            <span aria-hidden className="mx-0.5 h-5 w-px bg-border" />
            <button type="button" aria-label={t.header.quick} className={ICON_BTN}>
              <Zap className="size-[18px]" />
            </button>
            <button type="button" aria-label={t.header.notifications} className={ICON_BTN}>
              <Bell className="size-[18px]" />
              <span className="absolute -end-1 -top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-accent-rose px-1 text-10 font-semibold tabular-nums leading-none text-white">3</span>
            </button>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label={t.header.account}
                className="group flex max-w-[140px] items-center gap-2 rounded-lg border bg-muted px-1.5 py-1 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring data-[state=open]:bg-muted sm:max-w-[200px] sm:px-2"
              >
                <span aria-hidden className="relative flex size-8 shrink-0 items-center justify-center rounded-full bg-white text-12 font-bold text-primary ring-2 ring-primary/15 dark:bg-primary/30">
                  {t.header.initials}
                  <span className="absolute bottom-0 start-0 size-2 rounded-full bg-success ring-[1.5px] ring-background" />
                </span>
                <span className="hidden min-w-0 flex-col text-start leading-tight sm:flex">
                  <span className="truncate text-13 font-bold text-foreground">{t.header.name}</span>
                  <span className="truncate text-11 font-medium text-muted-foreground" dir="ltr">
                    staff@goteav.com
                  </span>
                </span>
                <ChevronDown className="hidden size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180 sm:block" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[calc(100vw-32px)] rounded-xl border-border/60 p-2 shadow-2xl sm:w-60" collisionPadding={16}>
              <DropdownMenuLabel className="px-2 py-2.5 text-sm font-semibold text-foreground">{t.header.greeting}</DropdownMenuLabel>
              <DropdownMenuSeparator className="-mx-2 my-1 bg-border/50" />
              <DropdownMenuItem className="min-h-11 cursor-pointer gap-2.5 rounded-lg px-2 py-2 sm:min-h-0">
                <User className="size-4.5" />
                <span className="text-13">{t.header.profile}</span>
              </DropdownMenuItem>
              <DropdownMenuItem className="min-h-11 cursor-pointer gap-2.5 rounded-lg px-2 py-2 sm:min-h-0">
                <Settings className="size-4.5" />
                <span className="text-13">{t.header.settings}</span>
              </DropdownMenuItem>
              {/* New: below sm the header has no room for the switcher, so it lives here (and in the drawer) */}
              <div className="sm:hidden">
                <CurrencyMenuSub />
              </div>
              <DropdownMenuSeparator className="-mx-2 my-1 bg-border/50" />
              <DropdownMenuItem className="min-h-11 cursor-pointer gap-2.5 rounded-lg px-2 py-2 sm:min-h-0">
                <LogOut className="size-4.5 rtl:-scale-x-100" />
                <span className="text-13">{t.header.logout}</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>
      <HintChip />
      <Drawer open={drawer} onOpenChange={setDrawer} />
    </div>
  );
}
