import { createContext, useContext, type ReactNode } from 'react';

export type Locale = 'ar' | 'en';

const LocaleContext = createContext<Locale>('ar');

export function LocaleProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>;
}

export function useLocale(): Locale {
  return useContext(LocaleContext);
}

/** `const t = useT(messages)` → the dictionary for the active locale. */
export function useT<M extends Record<Locale, unknown>>(messages: M): M['ar'] {
  return messages[useLocale()] as M['ar'];
}
