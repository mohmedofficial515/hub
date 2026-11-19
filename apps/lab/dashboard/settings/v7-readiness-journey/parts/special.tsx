// The two pages that are not settings groups: payment gateway keys (owner only, one form per gateway, applies at
// once) and the WhatsApp provider (status, switch, Cartat account, delivery receipts, test message).
import { useState, type ReactNode } from 'react';
import { CheckCircle2, Copy, KeyRound, Lock, PlugZap, RefreshCw, Send, ShieldCheck } from 'lucide-react';
import type { Field, FieldValue, SettingsGroup, Subsection } from '@lab/mocks/settings';
import { cn } from '@lab/utils';
import { formatDateTime, formatRelative, GATEWAY_INDEX, L, sameValue } from './data';
import { FieldControl } from './controls';
import { useNav } from './nav';
import { useSettings } from './store';
import { Btn, Card, IconTile, Pill, Segmented, Toggle, type Tone } from './ui';

function FormRow({ field, value, onChange, idBase }: { field: Field; value: FieldValue | undefined; onChange: (v: FieldValue) => void; idBase: string }) {
  const { lang } = useSettings();
  const id = `${idBase}-${field.key}`.replace(/[^a-zA-Z0-9_-]/g, '_');
  return (
    <div className="grid grid-cols-1 gap-2 py-3 md:grid-cols-[minmax(0,14rem)_minmax(0,1fr)] md:items-center md:gap-6">
      <div>
        <label id={`${id}-l`} htmlFor={id} className="text-14 font-semibold">
          {L(field.label, lang)}
        </label>
        <p id={`${id}-h`} className="text-12 leading-relaxed text-muted-foreground">
          {L(field.help, lang)}
        </p>
      </div>
      <FieldControl field={field} value={value} onChange={onChange} id={id} labelId={`${id}-l`} describedBy={`${id}-h`} />
    </div>
  );
}

const SOURCE_TONE: Record<string, Tone> = { dashboard: 'success', environment: 'info', none: 'neutral' };
const MODE_TONE: Record<string, Tone> = { live: 'success', test: 'warning', unknown: 'neutral' };

export function GatewaysPage({ group }: { group: SettingsGroup }) {
  const { t } = useSettings();
  return (
    <div className="space-y-4 pb-6">
      <p className="flex max-w-[80ch] gap-3 rounded-xl border border-border bg-card px-4 py-3 text-13 leading-relaxed">
        <Lock className="mt-0.5 size-4 shrink-0 text-primary dark:text-[color:var(--primary)]" aria-hidden />
        {t.gateways.ownerNote}
      </p>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2 [&>*]:min-w-0">
        {group.subsections.map((sub) => (
          <GatewayCard key={sub.id} group={group} sub={sub} />
        ))}
      </div>
    </div>
  );
}

function GatewayCard({ group, sub }: { group: SettingsGroup; sub: Subsection }) {
  const { state, dispatch, t, lang } = useSettings();
  const nav = useNav();
  const saved = state.saved[group.key] ?? {};
  const [draft, setDraft] = useState<Record<string, FieldValue>>({});
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState('');
  const [confirmRemove, setConfirmRemove] = useState(false);
  const code = sub.fields[0].key.split('.')[0];
  const sourceField = sub.fields.find((f) => f.key.endsWith('.source'))!;
  const modeField = sub.fields.find((f) => f.key.endsWith('.mode'))!;
  const source = String(saved[sourceField.key]);
  const mode = String(saved[modeField.key]);
  const index = GATEWAY_INDEX[sub.id];
  const offered = state.saved.payment_methods?.[`gateways.${index}.enabled`] === true;
  const editable = sub.fields.filter((f) => !f.readOnly);
  const value = (k: string) => (k in draft ? draft[k] : saved[k]);
  const dirty = Object.keys(draft).some((k) => !sameValue(draft[k], saved[k]));
  const label = (f: Field, v: string) => f.options?.find((o) => o.value === v)?.label[lang] ?? v;
  const name = L(sub.title, lang);

  const test = () => {
    setBusy(true);
    setResult('');
    window.setTimeout(() => {
      setBusy(false);
      setResult(source === 'none' ? t.gateways.testNone : t.gateways.testOk(label(modeField, mode)));
    }, 900);
  };

  return (
    <Card className="flex flex-col">
      <div className="flex items-start gap-3 p-4 pb-2">
        <IconTile name="KeyRound" size="sm" tone={source === 'none' ? 'neutral' : 'primary'} />
        <div className="min-w-0 flex-1">
          <h2 className="text-16 font-bold">{name}</h2>
          <p className="text-13 text-muted-foreground">{L(sub.description, lang)}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Pill tone={SOURCE_TONE[source] ?? 'neutral'}>
              {t.gateways.source}: {label(sourceField, source)}
            </Pill>
            <Pill tone={MODE_TONE[mode] ?? 'neutral'}>
              {t.gateways.mode}: {label(modeField, mode)}
            </Pill>
          </div>
        </div>
      </div>
      <div className="mx-4 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-muted/60 px-3 py-1.5">
        <span className="text-13">
          <span className="text-muted-foreground">{t.gateways.inMethods}: </span>
          <span className={cn('font-semibold', offered ? 'text-success-soft-foreground' : 'text-muted-foreground')}>
            {offered ? t.gateways.methodsOn : t.gateways.methodsOff}
          </span>
        </span>
        <Btn variant="link" className="min-h-11 text-13" onClick={() => nav.group('payment_methods', `gateways.${index}.enabled`)}>
          {t.gateways.openMethods}
        </Btn>
      </div>
      <div className="divide-y divide-border px-4">
        {editable.map((f) => (
          <FormRow key={f.key} field={f} idBase={`gw-${code}`} value={value(f.key)} onChange={(v) => setDraft((d) => ({ ...d, [f.key]: v }))} />
        ))}
      </div>
      <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-border p-4">
        <Btn variant="outline" busy={busy} onClick={test}>
          {!busy ? <PlugZap aria-hidden /> : null}
          {busy ? t.gateways.testing : t.gateways.test}
        </Btn>
        <Btn
          disabled={!dirty}
          onClick={() => {
            dispatch({ type: 'saveDirect', group: group.key, values: { ...draft, [sourceField.key]: 'dashboard' } });
            dispatch({ type: 'toast', text: t.gateways.keysSaved(name) });
            setDraft({});
          }}
        >
          <KeyRound aria-hidden />
          {t.gateways.saveKeys}
        </Btn>
        {!dirty ? <span className="text-12 text-muted-foreground">{t.gateways.noChanges}</span> : null}
        {source === 'dashboard' ? (
          confirmRemove ? (
            <span className="flex flex-wrap items-center gap-2">
              <span className="text-13 font-semibold">{t.gateways.confirmRemove(name)}</span>
              <Btn
                variant="destructive"
                className="dark:!text-white"
                onClick={() => {
                  const cleared = Object.fromEntries(sub.fields.filter((f) => f.type === 'secret').map((f) => [f.key, null]));
                  dispatch({ type: 'saveDirect', group: group.key, values: { ...cleared, [sourceField.key]: 'none', [modeField.key]: 'unknown' } });
                  dispatch({ type: 'toast', text: t.gateways.removed(name) });
                  setConfirmRemove(false);
                }}
              >
                {t.gateways.confirm}
              </Btn>
              <Btn variant="ghost" onClick={() => setConfirmRemove(false)}>
                {t.control.cancel}
              </Btn>
            </span>
          ) : (
            <Btn variant="ghost" className="text-destructive dark:!text-destructive" onClick={() => setConfirmRemove(true)}>
              {t.gateways.remove}
            </Btn>
          )
        ) : null}
        <p className="w-full text-12 text-muted-foreground" role="status" aria-live="polite">
          {result}
        </p>
      </div>
    </Card>
  );
}

function Section({ title, icon, children, aside }: { title: string; icon: ReactNode; children: ReactNode; aside?: ReactNode }) {
  return (
    <Card className="p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-16 font-bold [&_svg]:size-[18px] [&_svg]:text-muted-foreground">
          {icon}
          {title}
        </h2>
        {aside}
      </div>
      <div className="mt-2">{children}</div>
    </Card>
  );
}

export function WhatsAppPage({ group }: { group: SettingsGroup }) {
  const { state, dispatch, t, lang } = useSettings();
  const nav = useNav();
  const saved = state.saved[group.key] ?? {};
  const owner = state.role === 'owner';
  const field = (k: string) => group.subsections.flatMap((s) => s.fields).find((f) => f.key === k)!;
  const sub = (id: string) => group.subsections.find((s) => s.id === id)!;
  const statusField = field('status');
  const status = String(saved.status);
  const statusLabel = statusField.options?.find((o) => o.value === status)?.label[lang] ?? status;
  const enabled = saved['providers.whatsapp.enabled'] === true;
  const [askOff, setAskOff] = useState(false);
  const [checking, setChecking] = useState(false);
  const [account, setAccount] = useState<Record<string, FieldValue>>({});
  const [phone, setPhone] = useState('');
  const [locale, setLocale] = useState(String(saved['test.locale'] ?? 'ar'));
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState('');
  const accountDirty = Object.keys(account).some((k) => !sameValue(account[k], saved[k]));

  const setEnabled = (v: boolean) => {
    dispatch({ type: 'saveDirect', group: group.key, values: { 'providers.whatsapp.enabled': v } });
    dispatch({ type: 'saveDirect', group: 'notifications', values: { 'providers.whatsapp.enabled': v } });
    dispatch({ type: 'toast', text: v ? t.whatsapp.switchedOn : t.whatsapp.switchedOff });
    setAskOff(false);
  };

  return (
    <div className="grid grid-cols-1 gap-4 pb-6 lg:grid-cols-2 [&>*]:min-w-0">
      <Section title={t.whatsapp.status} icon={<ShieldCheck />}>
        <div className="flex flex-wrap items-center gap-4 py-2">
          <span className={cn('grid size-14 place-items-center rounded-2xl border border-border bg-background', status === 'working' ? 'text-success' : 'text-warning-strong')}>
            <CheckCircle2 className="size-7" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-22 font-extrabold leading-tight">{statusLabel}</p>
            <p className="text-13 text-muted-foreground">
              {L(field('provider').label, lang)}: {field('provider').options?.find((o) => o.value === saved.provider)?.label[lang]}
            </p>
          </div>
          <Btn
            variant="outline"
            busy={checking}
            onClick={() => {
              setChecking(true);
              window.setTimeout(() => {
                setChecking(false);
                dispatch({ type: 'toast', text: t.whatsapp.checked });
              }, 900);
            }}
          >
            {!checking ? <RefreshCw aria-hidden /> : null}
            {checking ? t.whatsapp.checking : t.whatsapp.check}
          </Btn>
        </div>
        <dl className="mt-2 grid grid-cols-1 gap-3 border-t border-border pt-3 sm:grid-cols-2 [&>*]:min-w-0">
          <div>
            <dt className="text-12 text-muted-foreground">{t.whatsapp.lastOk}</dt>
            <dd className="text-14 font-semibold">
              {saved.lastSuccessAt ? `${formatRelative(String(saved.lastSuccessAt), lang)}` : t.whatsapp.never}
              {saved.lastSuccessAt ? <span className="block text-12 font-normal text-muted-foreground">{formatDateTime(String(saved.lastSuccessAt), lang)}</span> : null}
            </dd>
          </div>
          <div>
            <dt className="text-12 text-muted-foreground">{t.whatsapp.lastFail}</dt>
            <dd className="text-14 font-semibold">{saved.lastErrorAt ? formatRelative(String(saved.lastErrorAt), lang) : t.whatsapp.never}</dd>
          </div>
        </dl>
      </Section>

      <Section title={t.whatsapp.switchTitle} icon={<Send />}>
        <p className="text-13 leading-relaxed text-muted-foreground">{L(sub('switch').description, lang)}</p>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-muted/60 px-3 py-1">
          <span id="wa-switch-l" className="text-14 font-semibold">
            {L(field('providers.whatsapp.enabled').label, lang)}
          </span>
          <Toggle checked={enabled} label={L(field('providers.whatsapp.enabled').label, lang)} onChange={(v) => (v ? setEnabled(true) : setAskOff(true))} />
        </div>
        {askOff ? (
          <div role="alertdialog" aria-labelledby="wa-off-q" className="mt-3 rounded-xl border border-border p-3">
            <p id="wa-off-q" className="text-13 font-semibold leading-relaxed">
              {t.whatsapp.switchOffConfirm}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Btn variant="destructive" className="dark:!text-white" onClick={() => setEnabled(false)}>
                {t.whatsapp.yesOff}
              </Btn>
              <Btn variant="ghost" onClick={() => setAskOff(false)}>
                {t.control.cancel}
              </Btn>
            </div>
          </div>
        ) : null}
        <p className="mt-3 flex flex-wrap items-center gap-x-2 text-13">
          <span>{t.whatsapp.pacing(Number(saved['providers.whatsapp.pacing.perMinute'] ?? 0))}</span>
          <Btn variant="link" className="min-h-11 text-13" onClick={() => nav.group('notifications', 'providers.whatsapp.pacing.perMinute')}>
            {t.whatsapp.pacingLink}
          </Btn>
        </p>
      </Section>

      <Section title={t.whatsapp.credentials} icon={<KeyRound />} aside={<Pill>{t.badge.ownerOnly}</Pill>}>
        {owner ? (
          <>
            <p className="text-13 text-muted-foreground">{L(sub('credentials').description, lang)}</p>
            <div className="divide-y divide-border">
              {sub('credentials').fields.map((f) => (
                <FormRow key={f.key} field={f} idBase="wa" value={f.key in account ? account[f.key] : saved[f.key]} onChange={(v) => setAccount((a) => ({ ...a, [f.key]: v }))} />
              ))}
            </div>
            <div className="mt-2 flex flex-wrap items-center justify-end gap-3">
              {!accountDirty ? <span className="text-12 text-muted-foreground">{t.gateways.noChanges}</span> : null}
              <Btn
                disabled={!accountDirty}
                onClick={() => {
                  dispatch({ type: 'saveDirect', group: group.key, values: account });
                  dispatch({ type: 'toast', text: t.whatsapp.accountSaved });
                  setAccount({});
                }}
              >
                {t.whatsapp.saveAccount}
              </Btn>
            </div>
          </>
        ) : (
          <p className="flex items-center gap-2 py-2 text-13 text-muted-foreground">
            <Lock className="size-4" aria-hidden />
            {t.whatsapp.credentialsOwner}
          </p>
        )}
      </Section>

      <Section title={t.whatsapp.webhook} icon={<RefreshCw />}>
        <p className="text-13 leading-relaxed text-muted-foreground">{L(sub('webhook').description, lang)}</p>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-muted/60 px-3 py-1">
          <span className="text-14 font-semibold">{L(field('webhook.enabled').label, lang)}</span>
          <Toggle
            checked={saved['webhook.enabled'] === true}
            label={L(field('webhook.enabled').label, lang)}
            onChange={(v) => dispatch({ type: 'saveDirect', group: group.key, values: { 'webhook.enabled': v } })}
          />
        </div>
        <div className="mt-3 flex min-w-0 items-center gap-2">
          <code className="min-w-0 flex-1 truncate rounded-lg bg-muted px-3 py-3 text-12" dir="ltr">
            {String(saved['webhook.url'])}
          </code>
          <Btn
            variant="outline"
            onClick={() => {
              void navigator.clipboard?.writeText(String(saved['webhook.url'])).catch(() => undefined);
              dispatch({ type: 'toast', text: t.whatsapp.copied });
            }}
          >
            <Copy aria-hidden />
            {t.whatsapp.copy}
          </Btn>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <span className="text-13">
            <span className="text-muted-foreground">{L(field('webhook.secret').label, lang)}: </span>
            <span className="font-mono" dir="ltr">
              {String(saved['webhook.secret'] ?? '—')}
            </span>
          </span>
          <Btn
            variant="outline"
            onClick={() => {
              dispatch({ type: 'saveDirect', group: group.key, values: { 'webhook.secret': `••••${Math.random().toString(16).slice(2, 6)}` } });
              dispatch({ type: 'toast', text: t.whatsapp.rotated });
            }}
          >
            {t.whatsapp.rotate}
          </Btn>
        </div>
      </Section>

      <Section title={t.whatsapp.test} icon={<Send />}>
        <p className="text-13 text-muted-foreground">{L(sub('test').description, lang)}</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
          <div>
            <label htmlFor="wa-phone" className="text-13 font-semibold">
              {L(field('test.phone').label, lang)}
            </label>
            <input
              id="wa-phone"
              type="tel"
              dir="ltr"
              value={phone}
              placeholder="+90 5xx xxx xx xx"
              onChange={(e) => setPhone(e.target.value)}
              className="mt-1.5 h-11 w-full rounded-lg border border-input bg-background px-3 text-14 outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30"
            />
          </div>
          <Segmented
            label={L(field('test.locale').label, lang)}
            value={locale}
            onChange={setLocale}
            options={(field('test.locale').options ?? []).map((o) => ({ value: o.value, label: o.label[lang] }))}
          />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Btn
            busy={sending}
            onClick={() => {
              if (!phone.trim()) {
                setSent(t.whatsapp.phoneNeeded);
                return;
              }
              setSending(true);
              setSent('');
              window.setTimeout(() => {
                setSending(false);
                setSent(t.whatsapp.sent(phone.trim()));
              }, 900);
            }}
          >
            {!sending ? <Send aria-hidden /> : null}
            {sending ? t.whatsapp.sending : t.whatsapp.send}
          </Btn>
          <span className="text-12 text-muted-foreground">{t.whatsapp.limit}</span>
        </div>
        <p role="status" aria-live="polite" className="mt-2 text-13 font-semibold">
          <bdi>{sent}</bdi>
        </p>
      </Section>
    </div>
  );
}
