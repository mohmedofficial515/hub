// The two pages that are not settings groups: payment gateway keys (owner only, masked secrets, status per gateway)
// and the WhatsApp provider (connection status and a test message).

import { useState } from 'react';
import { CheckCircle2, CircleAlert, KeyRound, Loader2, Lock, Send } from 'lucide-react';
import type { SettingsGroup, Subsection } from '@lab/mocks/settings';
import { useLocale, useT } from '@lab/i18n';
import { cn } from '@lab/utils';
import { messages } from '../i18n';
import { fmtDateTime, fmtRelative, loc, optionLabel } from './format';
import { useStore } from './store';
import { Badge, Btn, NativeSelect, focusRing } from './ui';

export function OwnerNote({ group }: { group: SettingsGroup }) {
  const t = useT(messages);
  const locale = useLocale();
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-border bg-card p-4">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-muted">
        <KeyRound aria-hidden className="size-5 text-primary dark:text-foreground" />
      </span>
      <div className="min-w-0 text-13 leading-relaxed">
        <p className="text-14 font-bold">{t.special.ownerTitle}</p>
        <p className="mt-0.5 text-muted-foreground">{loc(group.permission, locale)}</p>
        <p className="mt-1 text-muted-foreground">{t.special.ownerNote}</p>
      </div>
    </div>
  );
}

/** Status chips in a gateway sub-section header, from its read-only `source` and `mode` fields. */
export function GatewayStatus({ sub }: { sub: Subsection }) {
  const t = useT(messages);
  const locale = useLocale();
  const source = sub.fields.find((f) => f.key.endsWith('.source'));
  const mode = sub.fields.find((f) => f.key.endsWith('.mode'));
  const sv = String(source?.value ?? 'none');
  const mv = String(mode?.value ?? 'unknown');
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      {source && (
        <Badge tone={sv === 'none' ? 'neutral' : 'success'} icon={sv === 'none' ? <CircleAlert aria-hidden /> : <CheckCircle2 aria-hidden />}>
          {optionLabel(source, sv, locale)}
        </Badge>
      )}
      {mode && mv !== 'unknown' && (
        <Badge tone={mv === 'live' ? 'primary' : 'warning'}>{t.special.mode(optionLabel(mode, mv, locale))}</Badge>
      )}
    </span>
  );
}

export const isGatewayStatusField = (key: string) => key.endsWith('.source') || key.endsWith('.mode');

export function WhatsAppStatus({ group }: { group: SettingsGroup }) {
  const t = useT(messages);
  const locale = useLocale();
  const store = useStore();
  const status = group.subsections.find((s) => s.id === 'status');
  if (!status) return null;
  const get = (key: string) => status.fields.find((f) => f.key === key);
  const conn = get('status');
  const v = String(conn?.value ?? 'notConfigured');
  const ok = v === 'working';
  const enabled = !!store.value(group.key, 'providers.whatsapp.enabled');
  const last = get('lastSuccessAt')?.value;
  const provider = get('provider');
  return (
    <section aria-labelledby="wa-status" className="rounded-2xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-center gap-4">
        <span className={cn('grid size-12 place-items-center rounded-2xl bg-muted', ok ? 'text-success' : 'text-destructive')}>
          {ok ? <CheckCircle2 aria-hidden className="size-6" /> : <CircleAlert aria-hidden className="size-6" />}
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="wa-status" className="text-12 font-semibold text-muted-foreground">
            {loc(status.title, locale)}
          </h2>
          <p className="text-22 font-extrabold leading-tight">{conn ? optionLabel(conn, v, locale) : '—'}</p>
          <p className="mt-0.5 text-13 text-muted-foreground">
            {provider && `${optionLabel(provider, String(provider.value), locale)} · `}
            {typeof last === 'string' ? t.special.lastSent(fmtRelative(last, locale), fmtDateTime(last, locale)) : t.special.nothingSent}
          </p>
        </div>
        <Badge tone={enabled ? 'success' : 'neutral'}>{enabled ? t.special.sending : t.special.paused}</Badge>
      </div>
      {!ok && conn && <p className="mt-3 text-13 text-muted-foreground">{loc(conn.help, locale)}</p>}
    </section>
  );
}

export function WhatsAppTest({ group }: { group: SettingsGroup }) {
  const t = useT(messages);
  const locale = useLocale();
  const store = useStore();
  const sub = group.subsections.find((s) => s.id === 'test');
  const [phone, setPhone] = useState('');
  const [lang, setLang] = useState('ar');
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'invalid'>('idle');
  if (!sub) return null;
  const langField = sub.fields.find((f) => f.key === 'test.locale');
  const enabled = !!store.value(group.key, 'providers.whatsapp.enabled');
  const send = () => {
    if (!/^\+\d{8,15}$/.test(phone.trim())) {
      setState('invalid');
      return;
    }
    setState('sending');
    window.setTimeout(() => {
      setState('sent');
      store.toast(t.special.testSent(phone.trim()));
    }, 1100);
  };
  return (
    <section aria-labelledby="wa-test" className="rounded-2xl border border-border bg-card p-5">
      <h2 id="wa-test" className="text-16 font-bold">
        {loc(sub.title, locale)}
      </h2>
      <p className="mt-1 text-13 leading-relaxed text-muted-foreground">{loc(sub.description, locale)}</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_10rem_auto] sm:items-end">
        <div>
          <label htmlFor="wa-phone" className="text-13 font-semibold">
            {t.special.testPhone}
          </label>
          <input
            id="wa-phone"
            dir="ltr"
            type="tel"
            inputMode="tel"
            value={phone}
            placeholder="+905321234567"
            aria-invalid={state === 'invalid' || undefined}
            aria-describedby="wa-phone-err"
            onChange={(e) => {
              setPhone(e.target.value);
              if (state !== 'sending') setState('idle');
            }}
            className={cn('mt-1.5 h-11 w-full rounded-xl border bg-background px-3 text-start text-14', state === 'invalid' ? 'border-destructive' : 'border-muted-foreground/85', focusRing)}
          />
        </div>
        <div>
          <label htmlFor="wa-lang" className="text-13 font-semibold">
            {langField ? loc(langField.label, locale) : t.special.testLang}
          </label>
          <NativeSelect
            id="wa-lang"
            className="mt-1.5"
            value={lang}
            onChange={setLang}
            options={(langField?.options ?? []).map((o) => ({ value: o.value, label: o.label[locale] }))}
          />
        </div>
        <Btn variant="primary" onClick={send} disabled={state === 'sending' || !enabled}>
          {state === 'sending' ? <Loader2 aria-hidden className="size-4 animate-spin motion-reduce:animate-none" /> : <Send aria-hidden className="size-4 rtl:-scale-x-100" />}
          {state === 'sending' ? t.special.sendingTest : t.special.sendTest}
        </Btn>
      </div>
      <p id="wa-phone-err" role="status" className="mt-2 min-h-5 text-13">
        {state === 'invalid' && <span className="font-semibold text-destructive">{t.errors.phone}</span>}
        {state === 'sent' && (
          <span className="inline-flex items-center gap-1.5 font-semibold text-success-soft-foreground">
            <CheckCircle2 aria-hidden className="size-4" />
            {t.special.testSent(phone.trim())}
          </span>
        )}
        {!enabled && <span className="text-muted-foreground">{t.special.testNeedsOn}</span>}
      </p>
    </section>
  );
}

export function ForbiddenState({ title, body, onBack, backLabel }: { title: string; body: string; onBack: () => void; backLabel: string }) {
  return (
    <div className="mx-auto mt-10 flex max-w-lg flex-col items-center rounded-2xl border border-border bg-card px-6 py-10 text-center">
      <span className="grid size-12 place-items-center rounded-2xl bg-muted">
        <Lock aria-hidden className="size-6 text-muted-foreground" />
      </span>
      <h1 className="mt-4 text-20 font-bold">{title}</h1>
      <p className="mt-2 text-14 leading-relaxed text-muted-foreground">{body}</p>
      <Btn variant="primary" className="mt-5" onClick={onBack}>
        {backLabel}
      </Btn>
    </div>
  );
}
