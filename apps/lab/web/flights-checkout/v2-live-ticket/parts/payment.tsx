import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Building2, CalendarClock, Check, CreditCard, Landmark, Lock, ShieldCheck, Smartphone, Wallet } from 'lucide-react';
import { cn } from '@lab/utils';
import { useLocale } from '@lab/i18n';
import type { T } from '../i18n';
import {
  CHECKOUT,
  COUNTRIES,
  PAYMENT_COUNTRIES,
  WALLET,
  type Charge,
  type Country,
  type MethodSeed,
} from './data';
import { longDateTime, money } from './money';
import { Button, Checkbox, Field, Notice, SectionCard, SelectInput, TextInput, Num } from './ui';

const GATEWAY_NAME: Record<MethodSeed['gateway'], string> = {
  MYFATOORAH: 'MyFatoorah',
  STRIPE: 'Stripe',
  IYZICO: 'iyzico',
  PAYTR: 'PayTR',
};

const ICON: Record<MethodSeed['methodKind'], typeof CreditCard> = {
  apple_pay: Smartphone,
  mada: CreditCard,
  stc_pay: Smartphone,
  card: CreditCard,
  knet: Landmark,
};

export type MethodKey = string; // `${gateway}:${methodKind}` or 'wallet'
export const methodKey = (m: MethodSeed) => `${m.gateway}:${m.methodKind}`;

/** Label rule of develop's methods.ts: PayTR and iyzico always say "via"; others only when two tiles would read the same. */
export function methodLabel(t: T, m: MethodSeed, all: MethodSeed[]) {
  const base = t.pay.kind[m.methodKind];
  const twin = all.filter((o) => o.methodKind === m.methodKind).length > 1;
  return m.gateway === 'IYZICO' || m.gateway === 'PAYTR' || twin ? `${base} ${t.pay.via(GATEWAY_NAME[m.gateway])}` : base;
}

export function PaymentStep({
  t,
  country,
  onCountry,
  methods,
  selected,
  onSelect,
  chargeOf,
  sentence,
  serviceFee,
  split,
  onSplit,
  guest,
  noMethods,
}: {
  t: T;
  country: Country;
  onCountry: (c: Country) => void;
  methods: MethodSeed[];
  selected: MethodKey;
  onSelect: (k: MethodKey) => void;
  chargeOf: (m: MethodSeed) => Charge;
  sentence: string;
  serviceFee: string;
  split: boolean;
  onSplit: (v: boolean) => void;
  guest: boolean;
  noMethods: boolean;
}) {
  const lang = useLocale();
  const p = t.pay;
  const [invoice, setInvoice] = useState(false);
  const countryName = COUNTRIES.find((c) => c.code === country)?.[lang] ?? country;
  const walletCovers = false; // USD 240.00 < USD 689.60 in this mock
  const walletBalance = money(WALLET.balance, WALLET.currency);

  return (
    <div className="space-y-6">
      <SectionCard
        title={p.title}
        hint={p.countryLine(countryName)}
        icon={<CreditCard className="size-5" />}
        aside={
          <div className="w-full sm:w-44">
            <SelectInput aria-label={p.countryLabel} value={country} onChange={(e) => onCountry(e.target.value as Country)} className="h-11 text-sm">
              {PAYMENT_COUNTRIES.map((c) => (
                <option key={c} value={c}>
                  {COUNTRIES.find((x) => x.code === c)?.[lang]}
                </option>
              ))}
            </SelectInput>
          </div>
        }
      >
        {noMethods ? (
          <Notice tone="warning">
            {p.noMethods}{' '}
            <a href="#contact" className="font-semibold text-(--brand-ink) underline underline-offset-4">
              {p.noMethodsContact}
            </a>
          </Notice>
        ) : (
          <>
            <div role="radiogroup" aria-label={p.title} className="grid gap-2.5">
              {methods.map((m, i) => {
                const key = methodKey(m);
                const on = key === selected;
                const Icon = ICON[m.methodKind];
                const c = chargeOf(m);
                return (
                  <motion.label
                    key={`${country}-${key}`}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2, delay: i * 0.04 }}
                    className={cn(
                      'flex min-h-16 cursor-pointer items-center gap-3 rounded-xl border bg-(--card) px-3.5 py-3 transition-colors duration-150',
                      on ? 'border-2 border-(--brand) px-[13px] py-[11px]' : 'border-(--border-strong) hover:bg-(--surface-2)',
                      'has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-(--ring)',
                    )}
                  >
                    <input type="radio" name="method" value={key} checked={on} onChange={() => onSelect(key)} className="sr-only" />
                    <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-lg bg-(--surface-2) text-(--brand-ink)">
                      <Icon className="size-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold text-(--foreground)">{methodLabel(t, m, methods)}</span>
                      <span className="block text-sm text-(--ink-muted)">
                        {c.converted ? (
                          <>
                            {p.chargedIn('')}
                            <Num>{money(c.amount, c.currency)}</Num>
                          </>
                        ) : (
                          <Num>{money(c.amount, c.currency)}</Num>
                        )}
                      </span>
                    </span>
                    <span
                      aria-hidden
                      className={cn(
                        'grid size-6 shrink-0 place-items-center rounded-full border transition-colors',
                        on ? 'border-(--brand) bg-(--brand) text-(--brand-foreground)' : 'border-(--input)',
                      )}
                    >
                      {on && <Check className="size-3.5" strokeWidth={3} />}
                    </span>
                  </motion.label>
                );
              })}

              {!guest && (
                <div
                  aria-disabled={!walletCovers}
                  className="flex min-h-16 items-center gap-3 rounded-xl border border-(--border) bg-(--surface-2) px-3.5 py-3"
                >
                  <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-lg bg-(--surface-2) text-(--ink-muted)">
                    <Wallet className="size-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold text-(--foreground)">{p.wallet}</span>
                    <span className="block text-sm text-(--ink-muted)">
                      {p.walletShort(walletBalance)}
                    </span>
                  </span>
                </div>
              )}
            </div>

            {!guest && WALLET.allowPartial && (
              <div className="mt-3 rounded-lg border border-(--border) px-3">
                <Checkbox checked={split} onChange={onSplit}>
                  <span className="font-semibold">
                    {p.walletSplit(walletBalance)}
                  </span>
                  <span className="block text-(--ink-muted)">{p.walletSplitHint}</span>
                </Checkbox>
              </div>
            )}

            {/* What you pay, and in which currency: one sentence, rebuilt from the chosen method. */}
            <div className="mt-5 rounded-xl bg-(--surface-2) p-4" aria-live="polite">
              <h3 className="text-sm font-bold text-(--brand-ink)">{p.youPay}</h3>
              <AnimatePresence mode="wait" initial={false}>
                <motion.p
                  key={sentence}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.16 }}
                  className="mt-1.5 text-base leading-7 text-(--foreground)"
                >
                  {sentence}
                </motion.p>
              </AnimatePresence>
              <p className="mt-1 text-sm text-(--ink-muted)">
                {p.serviceFeeNote(serviceFee)}
              </p>
            </div>

            <p className="mt-4 flex items-start gap-2 text-sm leading-6 text-(--ink-muted)">
              <Lock aria-hidden className="mt-1 size-4 shrink-0" />
              {p.secure}
            </p>
          </>
        )}
      </SectionCard>

      {CHECKOUT.holdAvailable && (
        <section aria-labelledby="hold-title" className="rounded-2xl border border-(--border) bg-(--card) px-4 py-5 sm:px-6">
          <div className="flex items-start gap-3">
            <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-lg bg-(--brand-soft) text-(--brand-ink)">
              <CalendarClock className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <h2 id="hold-title" className="text-base font-bold text-(--brand-ink)">
                {p.holdTitle}
              </h2>
              <p className="mt-1 text-sm leading-6 text-(--ink)">{p.holdText(longDateTime(CHECKOUT.paymentRequiredBy, lang))}</p>
              <p className="mt-1 text-sm leading-6 text-(--ink-muted)">{p.holdBags}</p>
              {guest ? (
                <Notice className="mt-3">{p.holdGuest}</Notice>
              ) : (
                <Button variant="outline" className="mt-3">
                  {p.holdAction}
                </Button>
              )}
            </div>
          </div>
        </section>
      )}

      <section aria-labelledby="invoice-title" className="rounded-2xl border border-(--border) bg-(--card) px-4 py-4 sm:px-6">
        <div className="flex items-start gap-3">
          <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-lg bg-(--surface-2) text-(--ink)">
            <Building2 className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="invoice-title" className="sr-only">
              {p.invoiceTitle}
            </h2>
            <Checkbox checked={invoice} onChange={setInvoice}>
              <span className="font-semibold">{p.invoiceTitle}</span>
              <span className="block text-(--ink-muted)">{p.invoiceHint}</span>
            </Checkbox>
            <AnimatePresence initial={false}>
              {invoice && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.22 }}
                  className="overflow-hidden"
                >
                  <div className="grid gap-4 pt-3 pb-1 sm:grid-cols-2">
                    <Field label={p.invoiceCompany} htmlFor="inv-title" className="sm:col-span-2">
                      <TextInput id="inv-title" name="invoiceTitle" autoComplete="organization" />
                    </Field>
                    <Field label={p.invoiceTaxId} htmlFor="inv-tax">
                      <TextInput id="inv-tax" name="taxId" dir="ltr" inputMode="numeric" maxLength={10} className="tabular-nums" />
                    </Field>
                    <Field label={p.invoiceOffice} htmlFor="inv-office">
                      <TextInput id="inv-office" name="taxOffice" />
                    </Field>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </section>

      <ul className="space-y-2 px-1 text-sm leading-6 text-(--ink)">
        <li className="flex items-start gap-2">
          <ShieldCheck aria-hidden className="mt-1 size-4 shrink-0 text-(--success-ink)" />
          {p.trustNothing}
        </li>
        <li className="flex items-start gap-2">
          <ShieldCheck aria-hidden className="mt-1 size-4 shrink-0 text-(--success-ink)" />
          {p.trustRefund}
        </li>
      </ul>
    </div>
  );
}
