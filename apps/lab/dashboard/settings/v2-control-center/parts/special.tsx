/**
 * The two pages that are not settings documents but live in the same frame and save the same way:
 * payment gateway keys (owner only, one card per provider, masked secrets, the on/off state from Payment methods)
 * and the WhatsApp provider (status, switch, Cartat account, delivery receipts and a test message).
 */
import { useState, type ReactNode } from 'react';
import { CircleCheck, KeyRound, Lock, Send, Server } from 'lucide-react';
import { cn } from '@lab/utils';
import { getGroup, type SettingsGroup, type Subsection } from '@lab/mocks/settings';
import { FieldRow, useFocusField } from './field-row';
import { dateTime, fill, relative, valueText } from './format';
import { fieldIndex, repeatedHelp } from './model';
import { useStore } from './store';
import { Btn, IconTile, Pill, Segmented } from './ui';

function FieldsCard({ group, sub, title, children, highlight }: { group: SettingsGroup; sub: Subsection; title?: ReactNode; children?: ReactNode; highlight: { key: string; nonce: number } | null }) {
  const { locale } = useStore();
  const hidden = repeatedHelp(group, sub, locale);
  return (
    <section id={`sub-${group.key}-${sub.id}`} data-sub={sub.id} className="scroll-mt-6 rounded-3xl border border-border bg-card">
      <header className="px-4 pb-1 pt-5 sm:px-5">
        {title ?? <h2 className="text-17 font-extrabold">{sub.title[locale]}</h2>}
        <p className="mt-0.5 max-w-[68ch] text-13 leading-relaxed text-muted-foreground">{sub.description[locale]}</p>
        {children}
      </header>
      <div className="divide-y divide-border/70">
        {sub.fields.map((field) => (
          <FieldRow key={field.key} group={group} field={field} hideHelp={hidden.has(field.key)} highlight={highlight?.key === field.key ? highlight.nonce : 0} />
        ))}
      </div>
    </section>
  );
}

// ─── Payment gateways ───────────────────────────────────────────────────────

export function GatewaysBody({ group }: { group: SettingsGroup }) {
  const { t, locale, saved, go } = useStore();
  const methods = getGroup('payment_methods');
  const index = fieldIndex(group);
  const highlight = useFocusField(group.key);
  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-start gap-3 rounded-2xl bg-muted/60 p-4">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-card text-foreground/70">
          <KeyRound className="size-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1 basis-64">
          <p className="text-14 font-bold">{t.gateways.ownerTitle}</p>
          <p className="mt-0.5 text-13 leading-relaxed text-muted-foreground">{group.permission?.[locale]}</p>
        </div>
      </div>
      <div className="grid items-start gap-5 xl:grid-cols-2">
        {group.subsections.map((sub, i) => {
          const id = sub.id.toUpperCase();
          const source = saved[group.key][`${id}.source`];
          const mode = saved[group.key][`${id}.mode`];
          const connected = source !== 'none';
          const enabledThere = saved.payment_methods?.[`gateways.${i}.enabled`] === true;
          const editable = { ...sub, fields: sub.fields.filter((f) => !f.readOnly) };
          return (
            <FieldsCard
              key={sub.id}
              group={group}
              sub={editable}
              highlight={highlight}
              title={
                <div className="flex flex-wrap items-center gap-2">
                  {methods ? <IconTile name="CreditCard" section="payments" size="sm" /> : null}
                  <h2 className="text-17 font-extrabold">{sub.title[locale]}</h2>
                  <Pill tone={connected ? 'success' : 'neutral'} dot>
                    {connected ? t.gateways.connected : t.gateways.notConnected}
                  </Pill>
                  {connected ? <Pill tone={mode === 'live' ? 'primary' : 'warning'}>{valueText(locale, t, index.get(`${id}.mode`)?.field, mode)}</Pill> : null}
                </div>
              }
            >
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-13">
                <span className="text-muted-foreground">
                  {t.gateways.source}: <span className="font-semibold text-foreground">{valueText(locale, t, index.get(`${id}.source`)?.field, source)}</span>
                </span>
                <button
                  type="button"
                  onClick={() => go({ view: 'group', group: 'payment_methods', field: `gateways.${i}.enabled` })}
                  className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-1 font-semibold text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span aria-hidden className={cn('size-1.5 rounded-full', enabledThere ? 'bg-success' : 'bg-muted-foreground/60')} />
                  {fill(t.gateways.inPaymentMethods, { state: enabledThere ? t.gateways.enabledThere : t.gateways.disabledThere })}
                </button>
              </div>
              {source === 'environment' ? (
                <p className="mt-2 inline-flex items-center gap-1.5 text-12 text-muted-foreground">
                  <Server className="size-3.5" aria-hidden />
                  {t.gateways.envNote}
                </p>
              ) : null}
            </FieldsCard>
          );
        })}
      </div>
    </div>
  );
}

// ─── WhatsApp provider ──────────────────────────────────────────────────────

export function WhatsAppBody({ group }: { group: SettingsGroup }) {
  const { t, locale, saved, viewer } = useStore();
  const values = saved[group.key];
  const index = fieldIndex(group);
  const highlight = useFocusField(group.key);
  const byId = (id: string) => group.subsections.find((s) => s.id === id)!;
  const status = String(values.status);
  const ok = status === 'working';
  const [phone, setPhone] = useState('');
  const [lang, setLang] = useState<'ar' | 'en' | 'tr'>('ar');
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'invalid'>('idle');

  const send = () => {
    if (!/^\+\d{8,15}$/.test(phone.replace(/\s/g, ''))) {
      setState('invalid');
      return;
    }
    setState('sending');
    window.setTimeout(() => setState('sent'), 900);
  };

  return (
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="grid min-w-0 gap-5">
        <FieldsCard group={group} sub={byId('switch')} highlight={highlight} />
        {viewer === 'owner' ? (
          <FieldsCard group={group} sub={byId('credentials')} highlight={highlight} />
        ) : (
          <div className="flex items-start gap-3 rounded-3xl border border-border bg-card p-5">
            <Lock className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden />
            <div>
              <p className="text-15 font-bold">{byId('credentials').title[locale]}</p>
              <p className="mt-0.5 text-13 text-muted-foreground">{t.wa.accountOwner}</p>
            </div>
          </div>
        )}
        <FieldsCard group={group} sub={byId('webhook')} highlight={highlight} />
      </div>
      <aside className="grid gap-5 lg:sticky lg:top-6">
        <section aria-labelledby="wa-status" className="rounded-3xl border border-border bg-card p-5">
          <h2 id="wa-status" className="text-15 font-extrabold">
            {t.wa.statusTitle}
          </h2>
          <div className="mt-3 flex items-center gap-3">
            <span className={cn('grid size-11 place-items-center rounded-2xl', ok ? 'bg-success/12 text-success-soft-foreground' : 'bg-warning/18 text-warning-strong')}>
              <CircleCheck className="size-6" aria-hidden />
            </span>
            <div>
              <p className="text-18 font-extrabold">{valueText(locale, t, index.get('status')?.field, values.status)}</p>
              <p className="text-13 text-muted-foreground">{valueText(locale, t, index.get('provider')?.field, values.provider)}</p>
            </div>
          </div>
          <dl className="mt-4 grid gap-2 text-13">
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">{t.wa.lastSuccess}</dt>
              <dd className="text-end font-semibold">{values.lastSuccessAt ? `${relative(locale, String(values.lastSuccessAt))} · ${dateTime(locale, String(values.lastSuccessAt))}` : t.wa.never}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">{t.wa.lastError}</dt>
              <dd className="text-end font-semibold">{values.lastErrorAt ? dateTime(locale, String(values.lastErrorAt)) : t.wa.never}</dd>
            </div>
          </dl>
        </section>
        <section aria-labelledby="wa-test" className="rounded-3xl border border-border bg-card p-5">
          <h2 id="wa-test" className="text-15 font-extrabold">
            {t.wa.testTitle}
          </h2>
          <p className="mt-1 text-13 leading-relaxed text-muted-foreground">{t.wa.testLead}</p>
          <div className="mt-4 grid gap-3">
            <label className="grid gap-1.5 text-13 font-bold" htmlFor="wa-phone">
              {index.get('test.phone')?.field.label[locale]}
              <input
                id="wa-phone"
                dir="ltr"
                type="tel"
                inputMode="tel"
                placeholder="+90 532 123 45 67"
                value={phone}
                aria-invalid={state === 'invalid' || undefined}
                onChange={(e) => {
                  setPhone(e.target.value);
                  if (state !== 'sending') setState('idle');
                }}
                className="min-h-11 rounded-xl border border-input bg-background px-3 text-14 font-medium outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40 aria-[invalid=true]:border-destructive"
              />
            </label>
            <div className="grid gap-1.5">
              <span className="text-13 font-bold">{index.get('test.locale')?.field.label[locale]}</span>
              <Segmented
                label={index.get('test.locale')?.field.label[locale] ?? ''}
                value={lang}
                onChange={setLang}
                stretch
                options={(index.get('test.locale')?.field.options ?? []).map((o) => ({ value: o.value as 'ar' | 'en' | 'tr', label: o.label[locale] }))}
              />
            </div>
            <Btn variant="primary" onClick={send} disabled={state === 'sending'}>
              <Send className="rtl:-scale-x-100" />
              {state === 'sending' ? t.wa.sending : t.wa.send}
            </Btn>
            <p aria-live="polite" className={cn('text-13 font-semibold', state === 'invalid' ? 'text-destructive-soft-foreground' : 'text-success-soft-foreground')}>
              {state === 'sent' ? fill(t.wa.sent, { phone }) : state === 'invalid' ? t.wa.needPhone : ''}
            </p>
          </div>
        </section>
      </aside>
    </div>
  );
}
