'use client';

/**
 * @file The locale layout itself crashed, so no provider, font or message catalog is there. It brings its own `<html>`, reads the language from the
 * address and the theme from the cookie, and takes its words straight from the catalogs (review M9).
 */
import './globals.css';

import { TriangleAlert } from 'lucide-react';

import arShell from '../../messages/ar/shell.json';
import enShell from '../../messages/en/shell.json';

/** Runs before paint, as the locale layout's does. A crash must not flash the wrong theme. */
const THEME = `(function(){try{var c=/(?:^|; )hub-theme=(dark|light)/.exec(document.cookie);var d=c?c[1]==='dark':window.matchMedia('(prefers-color-scheme: dark)').matches;var r=document.documentElement;r.classList.toggle('dark',d);r.style.colorScheme=d?'dark':'light';}catch(e){}})();`;

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const locale =
    typeof window !== 'undefined' && window.location.pathname.split('/')[1] === 'en' ? 'en' : 'ar';
  const t = (locale === 'en' ? enShell : arShell).boundary;
  return (
    <html lang={locale} dir={locale === 'ar' ? 'rtl' : 'ltr'} suppressHydrationWarning>
      <head>
        <title>{`${t.crashTitle} · Hub`}</title>
        <script dangerouslySetInnerHTML={{ __html: THEME }} />
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
