/**
 * Context only, not part of this version's scope: the header as the cleaned-up navigation of the journey audit
 * (section 4: Flights, Manage booking, Help; currency, language as text, theme, Sign in), drawn flat on the same navy
 * as the block under it, so header and hero read as one surface. Not wired.
 */
import { Menu, Moon } from 'lucide-react';
import { cn } from '@lab/utils';
import type { Messages } from '../i18n';
import { focusRing } from './field';

const link = cn(
  'inline-flex min-h-11 items-center rounded-md px-3 text-sm font-semibold text-(--on-brand) hover:bg-(--line-on-brand)',
  focusRing,
  'focus-visible:outline-(--on-brand)',
);

export function SiteHeader({ t, sandbox }: { t: Messages['header']; sandbox: string | null }) {
  return (
    <header className="relative">
      {sandbox && (
        <p className="bg-(--warning-soft) px-4 py-1.5 text-center text-xs font-semibold text-(--warning-ink)">{sandbox}</p>
      )}
      <div className="mx-auto flex h-16 w-full max-w-[80rem] items-center gap-4 px-4 sm:px-6 lg:h-[72px] lg:px-8">
        <a href="#top" aria-label={t.home} className={cn('rounded-md text-2xl leading-none font-bold text-(--on-brand)', focusRing, 'focus-visible:outline-(--on-brand)')} translate="no" dir="ltr">
          go<span className="text-(--action)">t</span>eav
        </a>
        <nav aria-label={t.nav} className="ms-6 hidden md:block">
          <ul className="flex items-center gap-1">
            <li>
              <a href="#flight-search" aria-current="page" className={cn(link, 'underline decoration-(--highlight) decoration-2 underline-offset-[10px]')}>
                {t.flights}
              </a>
            </li>
            <li>
              <a href="#manage-booking" className={link}>
                {t.manageBooking}
              </a>
            </li>
            <li>
              <a href="#help" className={link}>
                {t.help}
              </a>
            </li>
          </ul>
        </nav>
        <div className="ms-auto flex items-center gap-1">
          <span className="hidden min-h-11 items-center px-2 text-sm font-semibold text-(--on-brand-muted) lg:inline-flex" title={t.currency} translate="no">
            USD
          </span>
          <button type="button" className={cn(link, 'hidden sm:inline-flex')} aria-label={t.languageAria}>
            {t.language}
          </button>
          <button type="button" className={cn(link, 'hidden w-11 justify-center px-0 sm:inline-flex')} aria-label={t.theme}>
            <Moon className="size-5" aria-hidden />
          </button>
          <a
            href="#sign-in"
            className={cn(
              'ms-1 hidden min-h-11 items-center rounded-md border border-(--line-on-brand) px-4 text-sm font-bold text-(--on-brand) hover:bg-(--line-on-brand) sm:inline-flex',
              focusRing,
              'focus-visible:outline-(--on-brand)',
            )}
          >
            {t.signIn}
          </a>
          <button type="button" aria-label={t.menu} className={cn(link, 'w-11 justify-center px-0 md:hidden')}>
            <Menu className="size-6" aria-hidden />
          </button>
        </div>
      </div>
    </header>
  );
}
