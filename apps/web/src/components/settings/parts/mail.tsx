'use client';

/**
 * @file mail.tsx
 * @description Settings › System › Mail (docs/16 D68), the owner's alone: where Hub's mail goes, real email through a server such as
 * smtp.gmail.com, the local test inbox (Mailpit), or none, and Send test email to the owner's own address with the result in plain words.
 * Hub reads the server from `.env`; the page never shows or asks for the password.
 */
import type { MailTestResultDto } from '@hub/contracts';
import { CircleCheck, Inbox, Mail, Send, TriangleAlert, Unplug } from 'lucide-react';

import {
  Button,
  ErrorState,
  fill,
  Ltr,
  Pill,
  SectionHeader,
  SkeletonRows,
  useMe,
  useT,
} from '@/components/kit';
import type { SettingsMessages } from '@/features/settings/messages';
import { useMailStatus, useSendTestMail } from '@/features/settings/queries';
import { isHubError } from '@/lib/api/errors';

const env = (name: string) => <Ltr mono>{name}</Ltr>;
/** The `.env` names a sentence may mention, each an LTR isolate inside Arabic. */
const ENV_SLOTS = {
  envFile: env('.env'),
  SMTP_USER: env('SMTP_USER'),
  SMTP_HOST: env('SMTP_HOST'),
  SMTP_PORT: env('SMTP_PORT'),
  MAIL_FROM: env('MAIL_FROM'),
  secureOn: env('SMTP_SECURE=true'),
  secureOff: env('SMTP_SECURE=false'),
};

function Result({ result, host, port }: { result: MailTestResultDto; host: string; port: number | null }) {
  const s = useT<SettingsMessages>('settings').mail;
  const slots = {
    ...ENV_SLOTS,
    to: <Ltr>{result.to}</Ltr>,
    host: <Ltr>{host}</Ltr>,
    port: <Ltr>{String(port ?? '')}</Ltr>,
    code: result.responseCode ? fill(s.code, { code: <Ltr>{String(result.responseCode)}</Ltr> }) : '',
  };
  if (result.sent) {
    return (
      <p
        role="status"
        className="flex items-start gap-2 text-body-sm font-medium text-success-soft-foreground"
      >
        <CircleCheck aria-hidden className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} />
        <span>{fill(result.mode === 'local' ? s.result.sentLocal : s.result.sent, slots)}</span>
      </p>
    );
  }
  return (
    <p
      role="alert"
      data-failure={result.failure}
      className="flex items-start gap-2 rounded-md bg-destructive-soft px-3 py-2 text-body-sm font-medium text-destructive-soft-foreground"
    >
      <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} />
      <span>{fill(s.result[result.failure ?? 'unknown'], slots)}</span>
    </p>
  );
}

export function MailSection() {
  const s = useT<SettingsMessages>('settings').mail;
  const status = useMailStatus(true);
  const send = useSendTestMail();
  const email = useMe().data?.email ?? '';

  const header = <SectionHeader id="mail-title" icon={Mail} title={s.title} level={3} />;
  if (status.isPending) {
    return (
      <section aria-labelledby="mail-title" className="flex flex-col gap-3">
        {header}
        <SkeletonRows count={2} withAction={false} />
      </section>
    );
  }
  if (status.isError) {
    return (
      <section aria-labelledby="mail-title" className="flex flex-col gap-3">
        {header}
        <ErrorState
          thing={s.title}
          code={isHubError(status.error) ? status.error.code : undefined}
          requestId={isHubError(status.error) ? status.error.requestId : undefined}
          onRetry={() => void status.refetch()}
        />
      </section>
    );
  }

  const mail = status.data;
  const where = { host: <Ltr>{mail.host ?? ''}</Ltr>, port: <Ltr>{String(mail.port ?? '')}</Ltr> };
  return (
    <section aria-labelledby="mail-title" className="flex flex-col gap-3" data-mail-mode={mail.mode}>
      {header}
      <p className="max-w-prose text-body-sm text-muted-foreground">{fill(s.intro, ENV_SLOTS)}</p>
      <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
        <div className="flex flex-wrap items-start gap-x-3 gap-y-2">
          {mail.mode === 'real' ? (
            <Pill tone="success" icon={CircleCheck}>
              {s.mode.real}
            </Pill>
          ) : mail.mode === 'local' ? (
            <Pill tone="warning" icon={Inbox}>
              {s.mode.local}
            </Pill>
          ) : (
            <Pill tone="muted" icon={Unplug}>
              {s.mode.off}
            </Pill>
          )}
          <p className="min-w-0 flex-1 basis-64 text-body-sm text-foreground">
            {mail.mode === 'real'
              ? fill(s.real, { ...where, from: <Ltr>{mail.from ?? ''}</Ltr> })
              : mail.mode === 'local'
                ? fill(s.local, where)
                : s.off}
            {mail.mode === 'real' && mail.authenticated ? <> {fill(s.login, ENV_SLOTS)}</> : null}
          </p>
        </div>
        {mail.mode !== 'real' && (
          <p className="text-body-sm text-muted-foreground">{fill(s.howTo, ENV_SLOTS)}</p>
        )}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-border pt-3">
          <Button
            size="sm"
            busy={send.isPending}
            disabled={mail.mode === 'off'}
            onClick={() => send.mutate()}
          >
            <Send aria-hidden className="size-4" strokeWidth={1.75} />
            {s.test}
          </Button>
          <span className="text-body-sm text-muted-foreground">
            {fill(s.testHint, { email: <Ltr>{email}</Ltr> })}
          </span>
        </div>
        {send.data && <Result result={send.data} host={mail.host ?? ''} port={mail.port} />}
        {send.isError && (
          <p role="alert" className="text-body-sm font-medium text-destructive-soft-foreground">
            {isHubError(send.error) ? send.error.message : s.result.unknown.replace('{code}', '')}
          </p>
        )}
      </div>
    </section>
  );
}
