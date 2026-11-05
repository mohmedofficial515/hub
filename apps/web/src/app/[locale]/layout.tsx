/**
 * @file Locale layout: language, direction, fonts, theme and the providers every page needs.
 * @description Arabic is Cairo everywhere, English Inter, keys JetBrains Mono (docs/15 D31). The theme comes from a cookie, so the
 * first paint is right. With no cookie the inline script follows the system before anything paints.
 */
import '../globals.css';

import type { Metadata, Viewport } from 'next';
import { Cairo, Inter, JetBrains_Mono } from 'next/font/google';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import { hasLocale, NextIntlClientProvider } from 'next-intl';
import { getMessages, setRequestLocale } from 'next-intl/server';
import type { ReactNode } from 'react';

import { Providers } from '@/components/shell/providers';
import { routing } from '@/i18n/routing';

const cairo = Cairo({
  subsets: ['arabic', 'latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-cairo',
  display: 'swap',
});
const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-inter',
  display: 'swap',
  // Its metric fallback matches Arabic with a local Arial before Cairo is reached in the stack (review R4).
  adjustFontFallback: false,
});
const jetbrains = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-jetbrains',
  display: 'swap',
});

// No title here: Next would keep writing it over the page's own (review m1). Each page sets it with `useDocumentTitle`.
export const metadata: Metadata = { robots: { index: false } };

/** The browser's own bar follows the theme: the cookie's when there is one, else the system's. */
const SURFACE = { light: '#f4f8f3', dark: '#0b100c' };
export async function generateViewport(): Promise<Viewport> {
  const theme = (await cookies()).get('hub-theme')?.value;
  if (theme === 'dark' || theme === 'light') return { themeColor: SURFACE[theme] };
  return {
    themeColor: [
      { media: '(prefers-color-scheme: light)', color: SURFACE.light },
      { media: '(prefers-color-scheme: dark)', color: SURFACE.dark },
    ],
  };
}

const FOLLOW_SYSTEM = `(function(){try{var d=window.matchMedia('(prefers-color-scheme: dark)').matches;var r=document.documentElement;r.classList.toggle('dark',d);r.style.colorScheme=d?'dark':'light';}catch(e){}})();`;

export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const messages = await getMessages();
  const theme = (await cookies()).get('hub-theme')?.value;
  const known = theme === 'dark' || theme === 'light' ? theme : null;
  const fonts = `${cairo.variable} ${inter.variable} ${jetbrains.variable}`;

  return (
    <html
      lang={locale}
      dir={locale === 'ar' ? 'rtl' : 'ltr'}
      className={known === 'dark' ? `dark ${fonts}` : fonts}
      style={known ? { colorScheme: known } : undefined}
      suppressHydrationWarning
    >
      <head>{known ? null : <script dangerouslySetInnerHTML={{ __html: FOLLOW_SYSTEM }} />}</head>
      <body>
        <NextIntlClientProvider locale={locale} messages={messages} timeZone="Europe/Istanbul">
          <Providers>{children}</Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
