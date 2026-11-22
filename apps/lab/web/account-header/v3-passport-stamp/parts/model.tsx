import { createContext, useContext } from 'react';
import { useLocale, useT } from '@lab/i18n';

import { messages, type Messages } from '../i18n';
import {
  customerFor,
  frameLevelOf,
  monogram,
  nameIn,
  SUMMARIES,
  type Customer,
  type FrameLevel,
  type LoyaltySummary,
  type Picture,
  type Script,
  type TierCode,
} from './mock';

export type LoadState = 'ready' | 'loading' | 'error';

export interface Controls {
  level: TierCode;
  picture: Picture;
  state: LoadState;
  script: Script;
}

export interface AccountModel {
  t: Messages;
  locale: 'ar' | 'en';
  state: LoadState;
  customer: Customer;
  /** null while loading or when the loyalty call failed. */
  summary: LoyaltySummary | null;
  frame: FrameLevel;
  levelName: string | null;
  initial: string;
  firstName: string;
  a11yName: string;
  money: (usd: number) => string;
  count: (n: number) => string;
  date: (iso: string) => string;
}

const Ctx = createContext<AccountModel | null>(null);

export function useAccountModelFrom(controls: Controls): AccountModel {
  const t = useT(messages);
  const locale = useLocale();
  const customer = customerFor(controls.script, controls.picture);
  const summary = controls.state === 'ready' ? SUMMARIES[controls.level] : null;
  const frame = frameLevelOf(summary?.tier.code);
  const levelName = summary ? nameIn(summary.tier.name, locale) : null;
  // Isolated (LRI … PDI) so "US$ 3,580" keeps its order inside an Arabic sentence.
  const money = (usd: number) =>
    `⁦${new Intl.NumberFormat(locale, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(usd)}⁩`;
  const count = (n: number) => new Intl.NumberFormat(locale).format(n);
  const date = (iso: string) =>
    new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(iso));

  return {
    t,
    locale,
    state: controls.state,
    customer,
    summary,
    frame,
    levelName,
    initial: monogram(customer.name, customer.email),
    firstName: customer.name.split(/\s+/)[0] ?? '',
    a11yName: levelName ? t.card.a11y(customer.name, levelName) : t.card.a11yNoLevel(customer.name),
    money,
    count,
    date,
  };
}

export const AccountProvider = Ctx.Provider;

export function useAccount(): AccountModel {
  const value = useContext(Ctx);
  if (!value) throw new Error('useAccount outside AccountProvider');
  return value;
}
