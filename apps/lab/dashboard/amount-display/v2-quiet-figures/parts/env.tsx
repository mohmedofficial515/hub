/**
 * Page-wide state shared by every part: locale, the strings, the five open design decisions and the display currency.
 * Nothing is persisted (the brief): a reload resets it.
 */
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { useLocale, useT, type Locale } from '@lab/i18n';
import { messages } from '../i18n';
import type { NegativeStyle } from './money-core';
import { OWNER_DEFAULT } from './data';
import { SIGN_BASE } from './currency-sign';

export type Messages = (typeof messages)['ar'];

/** The five open questions of plan section 15 / research section 8. */
export interface Decisions {
  /** (a) Arabic negative: sign first `⃁ -1,250.00` or SAMA's Arabic sample `⃁ 1,250.00-`. */
  negative: NegativeStyle;
  /** (b) Time axis of charts on the Arabic page. */
  axis: 'ltr' | 'rtl';
  /** (c) USD inside multi-currency tables: `$` or `USD`. */
  dollar: 'sign' | 'code';
  /** (d) `≈` before converted equivalents. */
  approx: boolean;
  /** (e) Sign box height in em. */
  signBox: 0.725 | 0.8;
}

export const DEFAULT_DECISIONS: Decisions = { negative: 'sign-first', axis: 'ltr', dollar: 'sign', approx: true, signBox: 0.725 };

export interface Lab {
  t: Messages;
  locale: Locale;
  decisions: Decisions;
  setDecision: <K extends keyof Decisions>(key: K, value: Decisions[K]) => void;
  resetDecisions: () => void;
  /** The staff member's display currency (header switcher). */
  display: string;
  setDisplay: (code: string) => void;
  /** Currency catalogue arrived (false = states demo: codes only). */
  catalogReady: boolean;
  setCatalogReady: (v: boolean) => void;
  /** Feature flag `dashboard.displayCurrencySwitcherEnabled`. */
  switcherEnabled: boolean;
  setSwitcherEnabled: (v: boolean) => void;
  /** One-time "at each transaction's day rate" chip. */
  hint: boolean;
  dismissHint: () => void;
  /** Scale applied to every sign from decision (e). */
  signScale: number;
}

const LabContext = createContext<Lab | null>(null);

export function useLab(): Lab {
  const lab = useContext(LabContext);
  if (!lab) throw new Error('LabProvider missing');
  return lab;
}

export function LabProvider({ children }: { children: ReactNode }) {
  const t = useT(messages);
  const locale = useLocale();
  const [decisions, setDecisions] = useState<Decisions>(DEFAULT_DECISIONS);
  const [display, setDisplayState] = useState(OWNER_DEFAULT);
  const [catalogReady, setCatalogReady] = useState(true);
  const [switcherEnabled, setSwitcherEnabled] = useState(true);
  const [hint, setHint] = useState(false);
  const [hintSeen, setHintSeen] = useState(false);

  const setDecision = useCallback(<K extends keyof Decisions>(key: K, value: Decisions[K]) => setDecisions((d) => ({ ...d, [key]: value })), []);
  const resetDecisions = useCallback(() => setDecisions(DEFAULT_DECISIONS), []);
  const setDisplay = useCallback(
    (code: string) => {
      setDisplayState(code);
      if (!hintSeen) {
        setHintSeen(true);
        setHint(true);
      }
    },
    [hintSeen],
  );
  const dismissHint = useCallback(() => setHint(false), []);

  const value = useMemo<Lab>(
    () => ({
      t,
      locale,
      decisions,
      setDecision,
      resetDecisions,
      display,
      setDisplay,
      catalogReady,
      setCatalogReady,
      switcherEnabled,
      setSwitcherEnabled,
      hint,
      dismissHint,
      signScale: decisions.signBox / SIGN_BASE,
    }),
    [t, locale, decisions, setDecision, resetDecisions, display, setDisplay, catalogReady, switcherEnabled, hint, dismissHint],
  );
  return <LabContext.Provider value={value}>{children}</LabContext.Provider>;
}

/** Replaces `{name}` placeholders of a message. */
export const fill = (text: string, vars: Record<string, string | number>) => text.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ''));

/** Sets a query parameter of the lab's hash route (`#/page/version?lang=ar&theme=dark`), which the lab frame re-reads on `hashchange`. */
export function setHashParam(key: string, value: string) {
  const [path, query = ''] = location.hash.replace(/^#/, '').split('?');
  const params = new URLSearchParams(query);
  params.set(key, value);
  location.hash = `${path}?${params.toString()}`;
}
