'use client';

/**
 * @file The locale layout itself crashed, so no provider, font or message catalog is there. It brings its own `<html>`, reads the language from the
 * address and the theme from the cookie, and takes its words straight from the catalogs (review M9).
 */
import './globals.css';

import { TriangleAlert } from 'lucide-react';

import arShell from '../../messages/ar/shell.json';
import enShell from '../../messages/en/shell.json';

/** React does not run a script it inserts itself, and no layout is left to set the theme, so it is read here. */
function isDark() {
  if (typeof window === 'undefined') return false;
  const saved = /(?:^|; )hub-theme=(dark|light)/.exec(document.cookie)?.[1];
  return saved ? saved === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const locale =
    typeof window !== 'undefined' && window.location.pathname.split('/')[1] === 'en' ? 'en' : 'ar';
  const t = (locale === 'en' ? enShell : arShell).boundary;
  const dark = isDark();
  return (
    <html
      lang={locale}
      dir={locale === 'ar' ? 'rtl' : 'ltr'}
      className={dark ? 'dark' : undefined}
      style={{ colorScheme: dark ? 'dark' : 'light' }}
      suppressHydrationWarning
    >
      <head>
        <title>{`${t.crashTitle} · Hub`}</title>
      </head>
      <body>
        <main
          role="alert"
          className="flex min-h-dvh flex-col items-center justify-center bg-background p-4 text-center text-foreground"
        >
          <span className="flex size-12 items-center justify-center rounded-full bg-destructive-soft">
            <TriangleAlert
              aria-hidden
              className="size-6 text-destructive-soft-foreground"
              strokeWidth={1.75}
            />
          </span>
          <h1 className="mt-4 text-title-sm font-semibold">{t.crashTitle}</h1>
          <p className="mt-1.5 max-w-md text-body text-muted-foreground">{t.crashBody}</p>
          <button
            type="button"
            onClick={reset}
            className="mt-5 inline-flex h-11 items-center justify-center rounded-md border border-border bg-card px-4 text-body font-medium text-foreground hover:bg-accent md:h-9"
          >
            {t.retry}
          </button>
        </main>
      </body>
    </html>
  );
}
