/**
 * @file Root layout. An empty shell until H0-07 ports the design; tokens and fonts arrive with it.
 */
import type { ReactNode } from 'react';

export const metadata = { title: 'Hub' };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <body>{children}</body>
    </html>
  );
}
