import { useMemo, useState, type ReactNode } from 'react';
import { BellRing, Inbox, Mail, MessageCircle, MoonStar, Send, type LucideIcon } from 'lucide-react';
import { useLocale, useT } from '@lab/i18n';
import { generalSeed, notificationKinds, telegramBot, telegramCodeExample, type ChannelMode, type NotificationKind, type NotificationPrefs } from '@lab/mocks/hub-app/settings';
import { Button, cn, CommandBlock, Field, fill, fmt, Ltr, Pill, SectionHeader, shortDate, showToast, TextInput, Tooltip, updateAdmin, useAdmin, useSession, writeAudit } from '../../../kit';
import { messages } from '../i18n';
import { Segmented, useFakeRequest } from './shared';

type Channel = 'push' | 'telegram' | 'email';
const CHANNELS: Channel[] = ['push', 'telegram', 'email'];
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

function patch(update: (p: NotificationPrefs) => NotificationPrefs) {
  updateAdmin((state) => ({ ...state, notifications: update(state.notifications) }));
}

/** Decorative stand-in for the link QR: fixed blocks from the code, clearly labelled as not scannable. */
function SampleQr({ seed, label }: { seed: string; label: string }) {
  const cells = useMemo(() => {
    const size = 21;
    const out: [number, number][] = [];
    let h = [...seed].reduce((acc, ch) => (acc * 31 + ch.charCodeAt(0)) >>> 0, 7);
    const corner = (x: number, y: number) => (x < 7 && y < 7) || (x >= size - 7 && y < 7) || (x < 7 && y >= size - 7);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        h = (h * 1103515245 + 12345) >>> 0;
        if (!corner(x, y) && h % 5 < 2) out.push([x, y]);
      }
    }
    return out;
  }, [seed]);
  const finder = (x: number, y: number) => (
    <g key={`${x}-${y}`}>
      <rect x={x + 0.5} y={y + 0.5} width={6} height={6} fill="none" stroke="currentColor" />
      <rect x={x + 2} y={y + 2} width={3} height={3} fill="currentColor" />
    </g>
  );
  return (
    <figure className="flex w-28 shrink-0 flex-col gap-1">
      <svg viewBox="0 0 21 21" aria-hidden className="size-28 rounded-md border border-border bg-card p-1.5 text-foreground">
        {finder(0, 0)}
        {finder(14, 0)}
        {finder(0, 14)}
        {cells.map(([x, y]) => (
          <rect key={`${x}.${y}`} x={x} y={y} width={1} height={1} fill="currentColor" />
        ))}
      </svg>
      <figcaption className="text-caption text-muted-foreground">{label}</figcaption>
    </figure>
  );
}

function ChannelRow({ icon: Icon, name, status, control, children }: { icon: LucideIcon; name: string; status: ReactNode; control?: ReactNode; children?: ReactNode }) {
  return (
    <li className="flex flex-col gap-3 p-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <div className="flex min-w-0 flex-1 basis-56 items-start gap-3">
          <Icon aria-hidden className="mt-0.5 size-4.5 shrink-0 text-muted-foreground" strokeWidth={1.75} />
          <div className="min-w-0">
            <p className="text-body font-semibold text-foreground">{name}</p>
            <div className="mt-0.5 text-body-sm text-muted-foreground">{status}</div>
          </div>
        </div>
        {control}
      </div>
      {children}
    </li>
  );
}

export function NotificationsTab() {
  const t = useT(messages);
  const locale = useLocale();
  const { scenario, me } = useSession();
  const { notifications: prefs } = useAdmin(scenario);
  const s = t.notifications;
  const [linking, setLinking] = useState(false);
  const { busy, run } = useFakeRequest(700);
  const [from, setFrom] = useState(prefs.quiet?.from ?? generalSeed.quietFrom);
  const [to, setTo] = useState(prefs.quiet?.to ?? generalSeed.quietTo);
  const usable: Record<Channel, boolean> = { push: !!prefs.push.subscription, telegram: !!prefs.telegram.linked, email: prefs.email.available };

  const modes = [
    { value: 'off' as const, label: s.modes.off },
    { value: 'immediate' as const, label: s.modes.immediate },
    { value: 'digest' as const, label: s.modes.digest },
  ];
  const setMode = (channel: Channel, mode: ChannelMode) => patch((p) => ({ ...p, [channel]: { ...p[channel], mode } }));
  const toggleKind = (channel: Channel, kind: NotificationKind) =>
    patch((p) => {
      const on = p[channel].kinds.includes(kind);
      return { ...p, [channel]: { ...p[channel], kinds: on ? p[channel].kinds.filter((k) => k !== kind) : notificationKinds.filter((k) => p[channel].kinds.includes(k) || k === kind) } };
    });

  const test = (channel: Channel) => run(`test-${channel}`, () => {
    writeAudit({ action: 'notifications.test', targetType: 'setting', targetId: channel, actorId: me.id, summary: { ar: 'أرسل إشعارًا تجريبيًا', en: 'Sent a test notification' } });
    showToast({ message: fmt(s.testSent, { channel: s.channels[channel] }) });
  });

  const testButton = (channel: Channel) =>
    usable[channel] ? (
      <Button size="sm" variant="ghost" busy={busy === `test-${channel}`} onClick={() => test(channel)}>
        <Send aria-hidden className="size-3.5 rtl:-scale-x-100" strokeWidth={1.75} />
        {s.test}
      </Button>
    ) : (
      <Tooltip content={s.testNeedsLink}>
        <span tabIndex={0} aria-label={`${s.test}: ${s.testNeedsLink}`} className="inline-flex rounded-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
          <Button size="sm" variant="ghost" disabled tabIndex={-1}>
            <Send aria-hidden className="size-3.5 rtl:-scale-x-100" strokeWidth={1.75} />
            {s.test}
          </Button>
        </span>
      </Tooltip>
    );

  const quietError = (value: string) => (TIME.test(value) ? undefined : s.timeInvalid);
  const useOwnHours = !!prefs.quiet;
  const commitQuiet = (nextFrom: string, nextTo: string) => {
    if (TIME.test(nextFrom) && TIME.test(nextTo)) patch((p) => ({ ...p, quiet: { from: nextFrom, to: nextTo } }));
  };

  return (
    <>
      <section aria-labelledby="channels-title" className="flex flex-col gap-3">
        <SectionHeader id="channels-title" icon={BellRing} title={s.title} />
        <p className="max-w-prose text-body-sm text-muted-foreground">{s.intro}</p>
        <ul className="flex flex-col divide-y divide-border rounded-lg border border-border bg-card">
          <ChannelRow icon={Inbox} name={s.channels.inApp} status={s.inAppStatus} control={<Pill tone="success">{s.alwaysOn}</Pill>} />

          <ChannelRow
            icon={BellRing}
            name={s.channels.push}
            status={
              prefs.push.subscription
                ? fmt(s.pushOn, { browser: prefs.push.subscription.browser[locale], date: shortDate(prefs.push.subscription.createdAt, locale) })
                : s.pushOff
            }
            control={
              <div className="flex flex-wrap items-center gap-2">
                {testButton('push')}
                <Segmented legend={fmt(s.modeLegend, { channel: s.channels.push })} value={prefs.push.mode} options={modes} disabled={!prefs.push.subscription} onChange={(mode) => setMode('push', mode)} />
              </div>
            }
          >
            <div>
              {prefs.push.subscription ? (
                <Button
                  size="sm"
                  onClick={() => {
                    const before = prefs.push;
                    patch((p) => ({ ...p, push: { ...p.push, subscription: null, mode: 'off' } }));
                    showToast({ message: s.pushRemoved, onUndo: () => patch((p) => ({ ...p, push: before })) });
                  }}
                >
                  {s.pushRemove}
                </Button>
              ) : (
                <Button
                  size="sm"
                  busy={busy === 'push'}
                  onClick={() =>
                    run('push', () => {
                      patch((p) => ({ ...p, push: { ...p.push, mode: 'immediate', subscription: { browser: { ar: 'هذا المتصفح', en: 'This browser' }, createdAt: new Date().toISOString() } } }));
                      showToast({ message: s.pushEnabled });
                    })
                  }
                >
                  {s.pushEnable}
                </Button>
              )}
            </div>
          </ChannelRow>

          <ChannelRow
            icon={MessageCircle}
            name={s.channels.telegram}
            status={
              prefs.telegram.linked ? (
                fill(s.telegramLinked, { name: <Ltr mono>{prefs.telegram.linked.username}</Ltr> })
              ) : (
                s.telegramOff
              )
            }
            control={
              <div className="flex flex-wrap items-center gap-2">
                {testButton('telegram')}
                <Segmented legend={fmt(s.modeLegend, { channel: s.channels.telegram })} value={prefs.telegram.mode} options={modes} disabled={!prefs.telegram.linked} onChange={(mode) => setMode('telegram', mode)} />
              </div>
            }
          >
            {prefs.telegram.linked ? (
              <div>
                <Button
                  size="sm"
                  onClick={() => {
                    const before = prefs.telegram;
                    patch((p) => ({ ...p, telegram: { ...p.telegram, linked: null, mode: 'off' } }));
                    showToast({ message: s.telegramUnlinked, onUndo: () => patch((p) => ({ ...p, telegram: before })) });
                  }}
                >
                  {s.telegramUnlink}
                </Button>
              </div>
            ) : linking ? (
              <div className="flex flex-col gap-3 rounded-md border border-border p-3 sm:flex-row">
                <SampleQr seed={telegramCodeExample} label={s.qrNote} />
                <div className="flex min-w-0 flex-1 flex-col gap-3">
                  <p className="text-body-sm text-foreground">{fill(s.telegramSteps, { bot: <Ltr mono>{telegramBot}</Ltr> })}</p>
                  <CommandBlock value={`/start ${telegramCodeExample}`} copyLabel={s.copyCode} />
                  <p className="text-body-sm text-muted-foreground">{s.telegramExpires}</p>
                  <div>
                    <Button
                      size="sm"
                      onClick={() => {
                        setLinking(false);
                        patch((p) => ({ ...p, telegram: { ...p.telegram, mode: 'immediate', linked: { username: `@${me.id.replace('u-', '')}_goteav`, linkedAt: new Date().toISOString() } } }));
                        showToast({ message: s.telegramDone });
                      }}
                    >
                      {s.telegramSimulate}
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div>
                <Button size="sm" onClick={() => setLinking(true)}>
                  {s.telegramLink}
                </Button>
              </div>
            )}
          </ChannelRow>

          <ChannelRow
            icon={Mail}
            name={s.channels.email}
            status={<Ltr mono>{prefs.email.address}</Ltr>}
            control={
              <div className="flex flex-wrap items-center gap-2">
                {testButton('email')}
                <Segmented legend={fmt(s.modeLegend, { channel: s.channels.email })} value={prefs.email.mode} options={modes} disabled={!prefs.email.available} onChange={(mode) => setMode('email', mode)} />
              </div>
            }
          />
        </ul>
      </section>

      <section aria-labelledby="kinds-title" className="flex flex-col gap-3">
        <SectionHeader id="kinds-title" title={s.kindsTitle} level={3} />
        <p className="max-w-prose text-body-sm text-muted-foreground">{s.kindsBody}</p>
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <table className="w-full text-body-sm">
            <thead>
              <tr className="text-muted-foreground">
                <th scope="col" className="border-b border-border px-3 py-2 text-start font-medium">
                  {s.kindCol}
                </th>
                {CHANNELS.map((c) => (
                  <th key={c} scope="col" className="w-14 border-b border-border px-1 py-2 text-center font-medium sm:w-24">
                    {s.channels[c]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {notificationKinds.map((kind) => (
                <tr key={kind}>
                  <th scope="row" className="px-3 py-1.5 text-start font-normal text-foreground">
                    {s.kinds[kind]}
                  </th>
                  {CHANNELS.map((c) => {
                    const off = prefs[c].mode === 'off';
                    return (
                      <td key={c} className="p-0 text-center">
                        <label className={cn('flex min-h-11 items-center justify-center md:min-h-8', off ? 'cursor-not-allowed' : 'cursor-pointer')} title={off ? fmt(s.channelOff, { channel: s.channels[c] }) : undefined}>
                          <input
                            type="checkbox"
                            aria-label={`${s.kinds[kind]}: ${s.channels[c]}`}
                            checked={prefs[c].kinds.includes(kind)}
                            disabled={off}
                            onChange={() => toggleKind(c, kind)}
                            className="size-4 accent-(--foreground) outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                          />
                        </label>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p role="status" className="text-body-sm text-muted-foreground">
          {s.autosave}
        </p>
      </section>

      <section aria-labelledby="quiet-title" className="flex flex-col gap-3 border-t border-border pt-6">
        <SectionHeader id="quiet-title" icon={MoonStar} title={s.quietTitle} level={3} />
        <p className="max-w-prose text-body-sm text-muted-foreground">{fill(s.quietBody, { from: <Ltr className="tabular-nums">{generalSeed.quietFrom}</Ltr>, to: <Ltr className="tabular-nums">{generalSeed.quietTo}</Ltr> })}</p>
        <Segmented
          legend={s.quietTitle}
          value={useOwnHours ? 'own' : 'workspace'}
          options={[
            { value: 'workspace', label: s.quietWorkspace },
            { value: 'own', label: s.quietOwn },
          ]}
          onChange={(v) => patch((p) => ({ ...p, quiet: v === 'own' ? { from, to } : null }))}
        />
        {useOwnHours && (
          <div className="grid max-w-md grid-cols-2 gap-3">
            <Field id="quiet-from" label={s.quietFrom} error={quietError(from)}>
              <TextInput
                id="quiet-from"
                dir="ltr"
                className="key text-start"
                value={from}
                aria-invalid={!!quietError(from)}
                onChange={(e) => {
                  setFrom(e.target.value);
                  commitQuiet(e.target.value, to);
                }}
              />
            </Field>
            <Field id="quiet-to" label={s.quietTo} error={quietError(to)}>
              <TextInput
                id="quiet-to"
                dir="ltr"
                className="key text-start"
                value={to}
                aria-invalid={!!quietError(to)}
                onChange={(e) => {
                  setTo(e.target.value);
                  commitQuiet(from, e.target.value);
                }}
              />
            </Field>
          </div>
        )}
      </section>
    </>
  );
}
