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
  /** (c) USD: `auto` = `$` only while no other dollar currency is enabled, else the code; one decision for the whole page. */
  dollar: 'auto' | 'sign' | 'code';
  /** Demo switch: CAD is an enabled display currency (makes `$` ambiguous, so `auto` falls back to `USD`). */
  cadEnabled: boolean;
  /** (d) `≈` before converted equivalents. */
  approx: boolean;
  /** (e) Sign box height in em. */
  signBox: 0.725 | 0.8;
}

export const DEFAULT_DECISIONS: Decisions = { negative: 'sign-first', axis: 'ltr', dollar: 'auto', cadEnabled: false, approx: true, signBox: 0.725 };

/** What the dollar prints as on the whole page: the sign, or the ISO code when `$` is ambiguous (CAD enabled) or the owner picked the code. */
export const dollarMark = (d: Decisions): 'sign' | 'code' => (d.dollar === 'code' || (d.dollar === 'auto' && d.cadEnabled) ? 'code' : 'sign');

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
  /** One-time toast "Figures now in X, converted at each transaction's day rate". */
  hint: boolean;
  dismissHint: () => void;
  /** The conversion receipt (sheet). `figure` names the figure it was opened from, if any. */
  receipt: { open: boolean; figure?: string };
  openReceipt: (figure?: string) => void;
  closeReceipt: () => void;
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
  const [receipt, setReceipt] = useState<{ open: boolean; figure?: string }>({ open: false });
  const openReceipt = useCallback((figure?: string) => setReceipt({ open: true, figure }), []);
  const closeReceipt = useCallback(() => setReceipt((r) => ({ ...r, open: false })), []);

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
      receipt,
      openReceipt,
      closeReceipt,
      signScale: decisions.signBox / SIGN_BASE,
    }),
    [t, locale, decisions, setDecision, resetDecisions, display, setDisplay, catalogReady, switcherEnabled, hint, dismissHint, receipt, openReceipt, closeReceipt],
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
