import './tokens.css';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, MotionConfig, motion } from 'framer-motion';
import { ArrowLeft, Loader2, Lock, RefreshCw, Users } from 'lucide-react';
import { useLocale, useT } from '@lab/i18n';
import { messages } from './i18n';
import {
  CHECKOUT,
  COUNTRY_METHODS,
  ITINERARY,
  SAVED_TRAVELLERS,
  SIGNED_IN_EMAIL,
  TOTALS,
  WALLET,
  chargeFor,
  fits,
  fromUsd,
  usdMinus,
  type CheckoutCurrency,
  type Country,
  type SavedTraveller,
} from './parts/data';
import { contactMissing, emptyPax, fromSaved, missingCount, ticketName, type ContactValues, type PaxValues } from './parts/form';
import { money, shortDate } from './parts/money';
import { ContactCard } from './parts/contact-card';
import { MobileBar, Sheet } from './parts/mobile-bar';
import { PassengerCard } from './parts/passenger-card';
import { PaymentStep, methodKey, methodLabel, type MethodKey } from './parts/payment';
import { SavedTravellers } from './parts/saved-travellers';
import { ErrorState, LabPanel, LoadingState, type Scenario } from './parts/states';
import { Stepper } from './parts/stepper';
import { Ticket } from './parts/ticket';
import { Button, Notice, Num } from './parts/ui';

type Step = 0 | 3;

/** `#/web/flights-checkout/v2-live-ticket?step=payment&state=guest` opens a given state (for review captures). */
function readHashParams() {
  const q = new URLSearchParams(location.hash.split('?')[1] ?? '');
  const state = q.get('state') as Scenario | null;
  return {
    step: (q.get('step') === 'payment' ? 3 : 0) as Step,
    scenario: (['signed-in', 'guest', 'loading', 'error', 'no-methods'] as Scenario[]).includes(state as Scenario)
      ? (state as Scenario)
      : 'signed-in',
  };
}

/** Signed in: passenger 1 comes from the saved travellers. Opened on payment: every passenger is already filled. */
const initialPax = (guest: boolean, complete = false): Record<string, PaxValues> =>
  Object.fromEntries(
    CHECKOUT.passengerSlots.map((s, i) => [
      s.slotId,
      (!guest && i === 0) || complete
        ? { ...fromSaved(SAVED_TRAVELLERS[i]), ...(guest && { savedId: null, savedMasked: null, passportNumber: 'U4471902' }) }
        : emptyPax(),
    ]),
  );

export default function Page() {
  const t = useT(messages);
  const lang = useLocale();
  const boot = useMemo(readHashParams, []);

  const [scenario, setScenario] = useState<Scenario>(boot.scenario);
  const guest = scenario === 'guest';
  const [step, setStep] = useState<Step>(boot.step);
  const [forward, setForward] = useState(true);
  const [pax, setPax] = useState(() => initialPax(boot.scenario === 'guest', boot.step === 3));
  const [contact, setContact] = useState<ContactValues>({
    email: SIGNED_IN_EMAIL,
    phoneCode: '+966',
    phone: boot.scenario === 'guest' && boot.step === 0 ? '' : '55 214 7730',
  });
  const [currency, setCurrency] = useState<CheckoutCurrency>('SAR');
  const [switching, setSwitching] = useState<CheckoutCurrency | null>(null);
  const [country, setCountry] = useState<Country>('SA');
  const [selected, setSelected] = useState<MethodKey>(methodKey(COUNTRY_METHODS.SA[0]));
  const [split, setSplit] = useState(false);
  const [lock, setLock] = useState(CHECKOUT.priceLockSeconds);
  const [sheet, setSheet] = useState(false);
  const [busy, setBusy] = useState<null | 'pay' | 'reprice'>(null);
  const [nudge, setNudge] = useState(false);

  useEffect(() => {
    const id = window.setInterval(() => setLock((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => window.clearInterval(id);
  }, []);

  const changeScenario = (s: Scenario) => {
    setScenario(s);
    if (s === 'guest' || s === 'signed-in') {
      setPax(initialPax(s === 'guest'));
      setContact((c) => ({ ...c, phone: s === 'guest' ? '' : '55 214 7730' }));
      if (s === 'guest') setSplit(false);
    }
  };

  // ── passengers ────────────────────────────────────────────────────────────────────────────────
  const slots = CHECKOUT.passengerSlots;
  const patchPax = (slotId: string, patch: Partial<PaxValues>) => setPax((all) => ({ ...all, [slotId]: { ...all[slotId], ...patch } }));
  const isAdded = (id: string) => slots.some((s) => pax[s.slotId].savedId === id);
  const freeSlotFor = (tr: SavedTraveller) =>
    slots.find((s) => fits(tr, s) && !pax[s.slotId].savedId && !pax[s.slotId].givenName && !pax[s.slotId].familyName) ??
    slots.find((s) => fits(tr, s) && !pax[s.slotId].savedId);
  const toggleSaved = (tr: SavedTraveller) => {
    const holder = slots.find((s) => pax[s.slotId].savedId === tr.id);
    if (holder) return patchPax(holder.slotId, emptyPax());
    const slot = freeSlotFor(tr);
    if (slot) setPax((all) => ({ ...all, [slot.slotId]: fromSaved(tr) }));
  };

  const missing = slots.reduce((n, s) => n + missingCount(pax[s.slotId]), 0) + contactMissing(contact);
  const ticketPax = slots.map((slot) => ({ slot, name: ticketName(pax[slot.slotId], slot) }));

  // ── payment ───────────────────────────────────────────────────────────────────────────────────
  const methods = scenario === 'no-methods' ? [] : COUNTRY_METHODS[country];
  const seed = methods.find((m) => methodKey(m) === selected) ?? methods[0];
  const useSplit = split && !guest;
  const usdToPay = useSplit ? usdMinus(CHECKOUT.dueUsd, WALLET.maxApplicable) : CHECKOUT.dueUsd;
  const totals = TOTALS[currency];
  const charge = seed ? chargeFor(seed, currency, usdToPay) : null;
  const label = seed ? methodLabel(t, seed, methods) : '';
  const walletMoney = money(WALLET.maxApplicable, WALLET.currency);
  const chargeMoney = charge ? money(charge.amount, charge.currency) : '';

  const sentence = !charge
    ? ''
    : useSplit
      ? t.pay.sentenceSplit(walletMoney, chargeMoney, label)
      : charge.converted
        ? t.pay.sentenceConverted(label, chargeMoney, money(fromUsd(usdToPay, currency), currency), charge.currency)
        : t.pay.sentenceSame(chargeMoney, label);

  const chargeRows =
    step === 3 && charge
      ? [
          { label: t.ticket.chargedVia(label), amount: chargeMoney },
          ...(useSplit ? [{ label: t.ticket.walletPart, amount: walletMoney }] : []),
        ]
      : null;

  const switchCurrency = (c: CheckoutCurrency) => {
    if (c === currency) return;
    setSwitching(c);
    window.setTimeout(() => {
      setCurrency(c);
      setSwitching(null);
    }, 900);
  };

  const changeCountry = (c: Country) => {
    setCountry(c);
    setSelected(methodKey(COUNTRY_METHODS[c][0]));
  };

  // ── navigation and the one primary action ─────────────────────────────────────────────────────
  const go = (next: Step) => {
    setForward(next > step);
    setStep(next);
    setSheet(false);
    window.scrollTo({ top: 0 });
  };

  const onContinue = () => {
    if (missing === 0) return go(3);
    setNudge(true);
    const first = slots.find((s) => missingCount(pax[s.slotId]) > 0);
    document.getElementById(first ? `pax-${first.slotId}` : 'contact-email')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const onPay = () => {
    if (busy) return;
    if (lock === 0) {
      setBusy('reprice');
      window.setTimeout(() => {
        setLock(15 * 60);
        setBusy(null);
      }, 1200);
      return;
    }
    setBusy('pay');
    window.setTimeout(() => setBusy(null), 1800);
  };

  const ended = step === 3 && lock === 0;
  const ctaText =
    step === 0
      ? t.buttons.continue
      : busy === 'pay'
        ? t.buttons.redirecting
        : busy === 'reprice' || ended
          ? t.buttons.updatePrice
          : t.buttons.pay(chargeMoney);

  const cta = (where: 'ticket' | 'bar') => (
    <Button
      variant="action"
      size="lg"
      aria-disabled={busy !== null || (step === 3 && !charge) || undefined}
      onClick={step === 0 ? onContinue : onPay}
      className={where === 'ticket' ? 'w-full' : 'max-w-[58vw] px-4'}
    >
      {busy ? (
        <Loader2 aria-hidden className="size-4 motion-safe:animate-spin" />
      ) : ended ? (
        <RefreshCw aria-hidden className="size-4" />
      ) : step === 3 ? (
        <Lock aria-hidden className="size-4" />
      ) : null}
      <span className="truncate">
        {step === 3 && !busy && !ended ? (
          <>
            {t.buttons.pay('')}
            <Num>{chargeMoney}</Num>
          </>
        ) : (
          ctaText
        )}
      </span>
    </Button>
  );

  const helper =
    step === 0 && missing > 0 ? (
      <p aria-live="polite" className={nudge ? 'mt-2 text-sm text-(--danger-ink)' : 'mt-2 text-sm text-(--ink-muted)'}>
        {t.buttons.missing(missing)}
      </p>
    ) : null;

  const ticket = (withCta: boolean) => (
    <Ticket
      t={t}
      currency={currency}
      onCurrency={switchCurrency}
      switching={switching}
      passengers={ticketPax}
      lockSeconds={step === 3 ? lock : null}
      charge={chargeRows}
      cta={
        withCta ? (
          <>
            {cta('ticket')}
            {helper}
          </>
        ) : undefined
      }
    />
  );

  const out = ITINERARY[0].segments[0];
  const back = ITINERARY[1].segments[0];
  const loadingOrError = scenario === 'loading' || scenario === 'error';

  return (
    <MotionConfig reducedMotion="user">
      <div className="fc-v2 min-h-dvh bg-(--background) text-(--foreground)">
        <main className="mx-auto w-full max-w-[80rem] px-4 pt-8 pb-36 sm:px-6 lg:px-8 lg:pb-16">
          <header className="max-w-3xl">
            <h1 className="text-3xl leading-tight font-bold text-(--brand-ink)">{t.page.title}</h1>
            <p className="mt-1 text-base text-(--ink-muted)">{t.page.subtitle}</p>
            <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-(--ink) lg:hidden">
              <Users aria-hidden className="size-4 text-(--brand-ink)" />
              <Num className="font-mono font-semibold">
                {out.from.iata} → {out.to.iata}
              </Num>
              <span>·</span>
              <span>
                {shortDate(out.departAt, lang)} – {shortDate(back.departAt, lang)}
              </span>
              <span>·</span>
              <span>{t.ticket.tripLine(slots.length)}</span>
            </p>
            <div className="mt-6">
              <Stepper t={t} current={step} />
            </div>
          </header>

          <div className="mt-8">
            {scenario === 'loading' ? (
              <LoadingState t={t} />
            ) : scenario === 'error' ? (
              <ErrorState t={t} onRetry={() => changeScenario('signed-in')} />
            ) : (
              <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
                <div className="min-w-0">
                  <AnimatePresence mode="wait" initial={false} custom={forward}>
                    <motion.div
                      key={step}
                      initial={{ opacity: 0, x: (forward ? 1 : -1) * (lang === 'ar' ? -24 : 24) }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.26, ease: [0.2, 0.8, 0.2, 1] }}
                    >
                      {step === 0 ? (
                        <div className="space-y-6">
                          {guest ? (
                            <Notice>
                              {t.guest.line(contact.email)}{' '}
                              <a href="#sign-in" className="font-semibold text-(--brand-ink) underline underline-offset-4">
                                {t.guest.signIn}
                              </a>
                            </Notice>
                          ) : (
                            <SavedTravellers
                              t={t}
                              travellers={SAVED_TRAVELLERS}
                              isAdded={isAdded}
                              canAdd={(tr) => !!freeSlotFor(tr)}
                              onToggle={toggleSaved}
                            />
                          )}

                          <section aria-labelledby="pax-heading" className="space-y-4">
                            <div>
                              <h2 id="pax-heading" className="text-xl font-bold text-(--brand-ink)">
                                {t.pax.sectionTitle}
                              </h2>
                              <p className="mt-1 max-w-2xl text-sm leading-6 text-(--ink-muted)">{t.pax.sectionHint}</p>
                            </div>
                            {slots.map((slot, i) => (
                              <PassengerCard
                                key={`${scenario}-${slot.slotId}`}
                                t={t}
                                slot={slot}
                                index={i}
                                values={pax[slot.slotId]}
                                onChange={(patch) => patchPax(slot.slotId, patch)}
                                onClear={() => patchPax(slot.slotId, emptyPax())}
                                guest={guest}
                              />
                            ))}
                          </section>

                          <ContactCard t={t} value={contact} onChange={(patch) => setContact((c) => ({ ...c, ...patch }))} />
                          <p className="text-sm text-(--ink-muted)">{t.steps.labNote}</p>
                        </div>
                      ) : (
                        <div className="space-y-6">
                          <PaymentStep
                            t={t}
                            country={country}
                            onCountry={changeCountry}
                            methods={methods}
                            selected={seed ? methodKey(seed) : ''}
                            onSelect={setSelected}
                            chargeOf={(m) => chargeFor(m, currency, usdToPay)}
                            sentence={sentence}
                            serviceFee={money(totals.serviceFee, currency)}
                            split={useSplit}
                            onSplit={setSplit}
                            guest={guest}
                            noMethods={methods.length === 0}
                          />
                          <Button variant="outline" onClick={() => go(0)}>
                            <ArrowLeft aria-hidden className="size-4 rtl:-scale-x-100" />
                            {t.buttons.back}
                          </Button>
                        </div>
                      )}
                    </motion.div>
                  </AnimatePresence>
                </div>

                <aside className="hidden lg:block lg:sticky lg:top-6" aria-label={t.ticket.title}>
                  {ticket(true)}
                </aside>
              </div>
            )}
          </div>

          <LabPanel t={t} scenario={scenario} onScenario={changeScenario} onLockEnd={() => setLock(3)} />
        </main>

        {!loadingOrError && (
          <>
            <MobileBar t={t} total={money(totals.total, currency)} open={sheet} onOpen={() => setSheet(true)} cta={cta('bar')} />
            <Sheet t={t} open={sheet} onClose={() => setSheet(false)}>
              {ticket(false)}
            </Sheet>
          </>
        )}
      </div>
    </MotionConfig>
  );
}
