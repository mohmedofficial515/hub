// The two pages that are not settings documents: payment gateway keys (owner only) and the WhatsApp provider.
// Keys and provider credentials save at once outside the ticket; the switches they share with groups stage into the ticket.
import { useState } from 'react';
import { CircleCheck, Eye, EyeOff, KeyRound, Lock, Send, ShieldAlert } from 'lucide-react';
import { Switch } from '@dash/components/ui/switch';
import { cn } from '@dash/lib/utils';
import type { FieldValue, FlatField, SettingsGroup } from '@lab/mocks/settings';
import { canonicalId, FIELD_INDEX } from './data';
import { FieldRow } from './field-row';
import { formatValue, relative } from './format';
import { useDesk } from './store';
import { Badge, Btn, Card, Segmented, type Tone } from './ui';

const GATEWAY_ORDER = ['STRIPE', 'MYFATOORAH', 'PAYMOB', 'MOYASAR', 'TAP', 'PAYTR', 'IYZICO'];

export function SpecialPage({ group }: { group: SettingsGroup }) {
  return group.key === 'payment_gateways' ? <Gateways group={group} /> : <WhatsApp group={group} />;
}

export function Forbidden() {
  const { t } = useDesk();
  return (
    <Card className="grid justify-items-center gap-3 p-10 text-center">
      <span className="inline-flex size-12 items-center justify-center rounded-full bg-muted">
        <ShieldAlert aria-hidden className="size-6 text-muted-foreground" />
      </span>
      <h2 className="text-18 font-extrabold">{t.special.forbiddenTitle}</h2>
      <p className="max-w-[48ch] text-14 leading-relaxed text-muted-foreground">{t.special.forbiddenBody}</p>
    </Card>
  );
}

function Gateways({ group }: { group: SettingsGroup }) {
  const { t, role } = useDesk();
  if (role === 'staff') return <Forbidden />;
  return (
    <div className="grid gap-4">
      <p className="flex items-start gap-2 rounded-xl border bg-card p-4 text-13 leading-relaxed text-muted-foreground">
        <Lock aria-hidden className="mt-0.5 size-4 shrink-0 text-[color:var(--primary)]" />
        {t.special.gatewaysNote}
      </p>
      <div className="grid gap-4 md:grid-cols-2">
        {group.subsections.map((s) => (
          <GatewayCard key={s.id} groupKey={group.key} title={s.title.en} fields={s.fields.map((f) => FIELD_INDEX.get(`${group.key}.${f.key}`)!)} />
        ))}
      </div>
    </div>
  );
}

function GatewayCard({ title, fields }: { groupKey: string; title: string; fields: FlatField[] }) {
  const { t, l, get, stage, go, draft } = useDesk();
  const code = fields[0]?.key.split('.')[0] ?? '';
  const source = String(fields.find((f) => f.key.endsWith('.source'))?.value ?? 'none') as 'dashboard' | 'environment' | 'none';
  const mode = String(fields.find((f) => f.key.endsWith('.mode'))?.value ?? 'unknown') as 'live' | 'test' | 'unknown';
  const idx = GATEWAY_ORDER.indexOf(code);
  const onField = FIELD_INDEX.get(`payment_methods.gateways.${idx}.enabled`);
  const on = onField ? get(canonicalId(onField)) === true : false;
  const sourceTone: Tone = source === 'dashboard' ? 'success' : source === 'environment' ? 'info' : 'neutral';
  const modeTone: Tone = mode === 'live' ? 'success' : mode === 'test' ? 'warning' : 'neutral';
  const rest = fields.filter((f) => !f.key.endsWith('.source') && !f.key.endsWith('.mode'));
  return (
    <Card className="grid content-start gap-4 p-5" aria-label={title}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-16 font-extrabold">
          <KeyRound aria-hidden className="size-4 text-[color:var(--primary)]" />
          <bdi>{title}</bdi>
        </h2>
        <div className="flex flex-wrap gap-1.5">
          <Badge tone={sourceTone}>{t.special.source[source]}</Badge>
          <Badge tone={modeTone}>{t.special.mode[mode]}</Badge>
        </div>
      </div>
      {onField && (
        <div className="grid gap-1 rounded-xl bg-muted/50 p-3">
          <p className="text-12 text-muted-foreground">{t.special.onOffLives}</p>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="inline-flex min-h-11 items-center gap-3">
              <Switch checked={on} onCheckedChange={(c) => stage(onField, c, false)} aria-label={`${title}: ${onField.label[l]}`} />
              <span className="text-13 font-semibold">{on ? t.field.on : t.field.off}</span>
              {canonicalId(onField) in draft && <Badge tone="warning">{t.ticket.staged}</Badge>}
            </label>
            <Btn size="sm" variant="ghost" onClick={() => go({ v: 'group', g: 'payment_methods', f: onField.key })}>
              {t.special.openMethods}
            </Btn>
          </div>
        </div>
      )}
      <dl className="grid gap-3">
        {rest.map((f) => (
          <KeyRow key={f.id} field={f} />
        ))}
      </dl>
    </Card>
  );
}

function KeyRow({ field }: { field: FlatField }) {
  const { t, l, role, toast } = useDesk();
  const [shown, setShown] = useState(false);
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState('');
  const [value, setValue] = useState<FieldValue>(field.value);
  const secret = field.type === 'secret';
  const display = secret
    ? value
      ? shown
        ? String(value).replace('••••', `${field.key.split('.')[1].slice(0, 3).toLowerCase()}_live_51N••••••••`)
        : '••••••••••'
      : t.field.notSet
    : formatValue(field, value, l, t);
  return (
    <div className="grid gap-1.5">
      <dt className="text-12 font-semibold text-muted-foreground">{field.label[l]}</dt>
      <dd className="flex flex-wrap items-center gap-2">
        {editing ? (
          <>
            <label className="sr-only" htmlFor={`k-${field.id}`}>
              {t.special.newKey}
            </label>
            <input
              id={`k-${field.id}`}
              dir="ltr"
              type="password"
              autoComplete="off"
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="h-11 min-w-0 flex-1 rounded-lg border bg-background px-3 text-13 outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 sm:h-9"
            />
            <Btn
              size="sm"
              variant="primary"
              disabled={text.length < 8}
              onClick={() => {
                setValue(`••••${text.slice(-4)}`);
                setEditing(false);
                setText('');
                toast(t.special.keySaved);
              }}
            >
              {t.special.saveKey}
            </Btn>
            <Btn size="sm" variant="ghost" onClick={() => setEditing(false)}>
              {t.special.cancel}
            </Btn>
          </>
        ) : (
          <>
            <code dir="ltr" className={cn('inline-flex min-h-9 max-w-full items-center truncate rounded-lg bg-muted px-3 text-13', !value && 'text-muted-foreground')}>
              {display}
            </code>
            {secret && value && role === 'owner' && (
              <Btn size="sm" variant="ghost" aria-pressed={shown} title={t.field.revealOwner} onClick={() => setShown((s) => !s)}>
                {shown ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
                {shown ? t.field.hide : t.field.reveal}
              </Btn>
            )}
            {secret && (
              <Btn size="sm" variant="outline" onClick={() => setEditing(true)}>
                {t.field.replace}
              </Btn>
            )}
          </>
        )}
      </dd>
    </div>
  );
}

function WhatsApp({ group }: { group: SettingsGroup }) {
  const { t, l, role, toast } = useDesk();
  const f = (k: string) => FIELD_INDEX.get(`${group.key}.${k}`)!;
  const lastOk = String(f('lastSuccessAt').value ?? '');
  const [webhookOn, setWebhookOn] = useState(f('webhook.enabled').value === true);
  const [phone, setPhone] = useState('');
  const [locale, setLocale] = useState<'ar' | 'en'>('ar');
  const [result, setResult] = useState<string | null>(null);
  const [left, setLeft] = useState(4);
  const [err, setErr] = useState<string | null>(null);
  const send = () => {
    if (!/^\+[1-9]\d{7,14}$/.test(phone.trim())) return setErr(t.special.waPhoneBad);
    setErr(null);
    setLeft((n) => Math.max(0, n - 1));
    setResult(t.special.waSent(phone.trim(), Math.max(0, left - 1)));
  };
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="grid content-start gap-4 p-5" aria-labelledby="wa-status">
        <h2 id="wa-status" className="text-16 font-extrabold">
          {t.special.waStatus}
        </h2>
        <dl className="grid grid-cols-2 gap-3 text-13">
          <div className="grid gap-1">
            <dt className="text-12 text-muted-foreground">{t.special.waStatus}</dt>
            <dd>
              <Badge tone="success" icon={<CircleCheck aria-hidden />}>
                {t.special.waWorking}
              </Badge>
            </dd>
          </div>
          <div className="grid gap-1">
            <dt className="text-12 text-muted-foreground">{t.special.waProvider}</dt>
            <dd className="font-semibold">Cartat</dd>
          </div>
          <div className="grid gap-1">
            <dt className="text-12 text-muted-foreground">{t.special.waLastOk}</dt>
            <dd className="font-semibold">{lastOk ? relative(lastOk, l) : t.field.notSet}</dd>
          </div>
          <div className="grid gap-1">
            <dt className="text-12 text-muted-foreground">{t.special.waLastError}</dt>
            <dd className="font-semibold">{t.special.waNoError}</dd>
          </div>
        </dl>
      </Card>

      <Card className="grid content-start gap-1 overflow-hidden" aria-labelledby="wa-switch">
        <h2 id="wa-switch" className="px-5 pt-5 text-16 font-extrabold">
          {t.special.waSwitch}
        </h2>
        <p className="px-5 text-12 text-muted-foreground">{t.special.waSwitchNote}</p>
        <div className="divide-y px-2">
          <FieldRow field={f('providers.whatsapp.enabled')} />
          <FieldRow field={f('providers.whatsapp.pacing.perMinute')} />
        </div>
      </Card>

      <Card className="grid content-start gap-4 p-5" aria-labelledby="wa-account">
        <div className="grid gap-1">
          <h2 id="wa-account" className="text-16 font-extrabold">
            {t.special.waAccount}
          </h2>
          <p className="text-12 text-muted-foreground">{t.special.waAccountNote}</p>
        </div>
        <dl className="grid gap-3">
          <KeyRow field={f('apiUrl')} />
          {role === 'owner' ? <KeyRow field={f('apiToken')} /> : null}
        </dl>
        <div className="grid gap-3 border-t pt-4">
          <h3 className="text-14 font-bold">{t.special.waWebhook}</h3>
          <label className="inline-flex min-h-11 items-center gap-3">
            <Switch
              checked={webhookOn}
              onCheckedChange={(c) => {
                setWebhookOn(c);
                toast(t.special.providerSaved);
              }}
              aria-label={f('webhook.enabled').label[l]}
            />
            <span className="text-13 font-semibold">{f('webhook.enabled').label[l]}</span>
          </label>
          <dl className="grid gap-3">
            <KeyRow field={f('webhook.url')} />
            <KeyRow field={f('webhook.secret')} />
          </dl>
        </div>
      </Card>

      <Card className="grid content-start gap-4 p-5" aria-labelledby="wa-test">
        <h2 id="wa-test" className="text-16 font-extrabold">
          {t.special.waTest}
        </h2>
        <div className="grid gap-1.5">
          <label htmlFor="wa-phone" className="text-13 font-semibold">
            {t.special.waTestPhone}
          </label>
          <input
            id="wa-phone"
            dir="ltr"
            type="tel"
            value={phone}
            placeholder="+905321234567"
            aria-invalid={!!err}
            aria-describedby={err ? 'wa-err' : undefined}
            onChange={(e) => setPhone(e.target.value)}
            className="h-11 w-full rounded-lg border bg-background px-3 text-14 text-start outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive sm:h-9 sm:w-72"
          />
          {err && (
            <p id="wa-err" className="text-12 text-destructive-soft-foreground">
              {err}
            </p>
          )}
        </div>
        <div className="grid gap-1.5">
          <span className="text-13 font-semibold" id="wa-locale">
            {t.special.waTestLocale}
          </span>
          <Segmented label={t.special.waTestLocale} value={locale} onChange={setLocale} options={[{ value: 'ar', label: 'العربية' }, { value: 'en', label: 'English' }]} />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Btn variant="primary" onClick={send} disabled={left === 0}>
            <Send aria-hidden />
            {t.special.waSend}
          </Btn>
        </div>
        <p aria-live="polite" className={cn('text-13', result ? 'text-foreground' : 'sr-only')}>
          {result}
        </p>
      </Card>
    </div>
  );
}
