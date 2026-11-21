import { createContext, useContext } from 'react';
import type { Lang } from './money-core';
import { CATALOG, hasOfficialSign, type CurrencyMeta } from './data';

/** The five open design questions of the owner, as live switches (plan section 15, research section 8). */
export interface Decisions {
  /** (a) Arabic negative: "SAR -1,250.00" (leading) or "SAR 1,250.00-" (SAMA's Arabic sample). */
  arNegative: 'leading' | 'trailing';
  /** (b) Chart time axis in Arabic. */
  axis: 'ltr' | 'rtl';
  /** (c) "$" or "USD" in multi-currency tables. */
  multiSign: 'auto' | 'sign' | 'code';
  /** (d) "≈" before converted equivalents. */
  approx: boolean;
  /** (e) Sign box height in em of the figure font. */
  box: 0.725 | 0.8;
}
export const DEFAULT_DECISIONS: Decisions = { arNegative: 'leading', axis: 'ltr', multiSign: 'auto', approx: true, box: 0.725 };

export type CatalogState = 'ready' | 'loading' | 'error';

export interface Env {
  lang: Lang;
  dec: Decisions;
  /** The page display currency (what the header switcher sets). */
  display: string;
  setDisplay: (code: string) => void;
  catalog: CurrencyMeta[];
  catalogState: CatalogState;
  /** Feature flag `dashboard.displayCurrencySwitcherEnabled`. */
  switcherEnabled: boolean;
  openReceipt: (currency?: string) => void;
}

export const EnvContext = createContext<Env>({
  lang: 'en',
  dec: DEFAULT_DECISIONS,
  display: 'SAR',
  setDisplay: () => {},
  catalog: CATALOG,
  catalogState: 'ready',
  switcherEnabled: true,
  openReceipt: () => {},
});
export const useEnv = () => useContext(EnvContext);

export const metaOf = (env: Env, code: string): CurrencyMeta | undefined => env.catalog.find((c) => c.code === code);
export const nameOf = (env: Env, code: string): string => metaOf(env, code)?.names[env.lang] ?? code;

/** Plan 5.4: official SVG sign if the currency has one AND (for "$"-like glyphs in mixed views) it is unique. */
export function showsSign(env: Env, code: string, multi: boolean): boolean {
  if (env.catalogState === 'loading' || !hasOfficialSign(code)) return false;
  if (!multi) return true;
  const glyph = metaOf(env, code)?.glyph;
  const shared = glyph ? env.catalog.filter((c) => c.enabled && c.glyph === glyph).length > 1 : false;
  if (env.dec.multiSign === 'sign') return true;
  if (env.dec.multiSign === 'code') return false;
  return !shared;
}
