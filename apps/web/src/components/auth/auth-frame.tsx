'use client';

/**
 * @file auth-frame.tsx
 * @description The frame of the pages outside the app (docs/09 §1): one neutral card on the plumage, the ocellus once, language and theme at
 * the foot. Portals have no shell here, so `#hub-root` is this frame.
 */
import { Languages, Moon, Sun } from 'lucide-react';
import { Direction, Tooltip as RadixTooltip } from 'radix-ui';
import type { ReactNode } from 'react';

import { IconButton } from '@/components/kit';
import { Ocellus } from '@/components/shell/ocellus';
import { useDocumentTitle } from '@/lib/hooks';
import { messages, type ShellDict, useLocale, useT } from '@/lib/i18n';
import { setLocaleEverywhere, setTheme, useTheme } from '@/lib/theme';
import { cn } from '@/lib/utils';

export function LanguageAndTheme({ signedIn = false, t }: { signedIn?: boolean; t: ShellDict }) {
  const locale = useLocale();
  const dark = useTheme() === 'dark';
  return (
    <div className="flex items-center gap-1">
      <IconButton
        label={`${t.sidebar.language}: ${locale === 'ar' ? t.sidebar.toEnglish : t.sidebar.toArabic}`}
        onClick={() => setLocaleEverywhere(locale === 'ar' ? 'en' : 'ar', { signedIn })}
      >
        <Languages aria-hidden className="size-4" strokeWidth={1.75} />
      </IconButton>
      <IconButton
        label={dark ? t.sidebar.themeToLight : t.sidebar.themeToDark}
        onClick={() => setTheme(dark ? 'light' : 'dark')}
      >
        {dark ? (
          <Sun aria-hidden className="size-4" strokeWidth={1.75} />
        ) : (
          <Moon aria-hidden className="size-4" strokeWidth={1.75} />
        )}
      </IconButton>
    </div>
  );
}

export function AuthFrame({
  title,
  subtitle,
  children,
  foot,
  wide = false,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  foot?: ReactNode;
  wide?: boolean;
}) {
  useDocumentTitle(typeof title === 'string' ? title : undefined);
  const t = useT(messages);
  const locale = useLocale();
  return (
    <Direction.Provider dir={locale === 'ar' ? 'rtl' : 'ltr'}>
      <RadixTooltip.Provider delayDuration={200}>
        <div
          id="hub-root"
          className="flex min-h-dvh flex-col items-center justify-center bg-background px-4 py-8 text-foreground"
        >
          <main className={cn('flex w-full flex-col gap-4', wide ? 'max-w-lg' : 'max-w-sm')}>
            <div className="flex items-center gap-2.5 self-center">
              <Ocellus />
              <span translate="no" className="text-title-sm font-semibold text-foreground">
                Hub
              </span>
            </div>
            <section className="flex flex-col gap-5 rounded-xl border border-border bg-card p-5 md:p-6">
              <header className="flex flex-col gap-1">
                <h1 className="hub-page-title text-headline text-balance text-foreground">{title}</h1>
                {subtitle && <div className="text-body text-muted-foreground">{subtitle}</div>}
              </header>
              {children}
            </section>
            <div className="flex min-h-11 items-center justify-between gap-2">
              <div className="min-w-0 text-body-sm text-muted-foreground">{foot}</div>
              <LanguageAndTheme t={t} />
            </div>
          </main>
        </div>
      </RadixTooltip.Provider>
    </Direction.Provider>
  );
}

/** A form-level failure: the API's own words, in one place, announced. */
export function FormError({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <p
      role="alert"
      className="rounded-md bg-destructive-soft px-3 py-2 text-body-sm text-destructive-soft-foreground"
    >
      {children}
    </p>
  );
}

export const authLink =
  'hit-44 rounded-sm font-medium text-primary underline-offset-4 hover:underline outline-none focus-visible:ring-2 focus-visible:ring-ring';
