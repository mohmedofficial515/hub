/**
 * @file Root layout. `<html>` lives in `[locale]/layout.tsx`, which knows the language and direction.
 */
import type { ReactNode } from 'react';

export default function RootLayout({ children }: { children: ReactNode }) {
  return children;
}
