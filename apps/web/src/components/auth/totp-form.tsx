'use client';

/**
 * @file totp-form.tsx
 * @description docs/09 §1.2. Two flows on one page. With a sign-in challenge it verifies a code or a recovery code. With `?setup=1`, reached when
 * a role requires TOTP, it enrols and shows the recovery codes once.
 */
import { useRouter, useSearchParams } from 'next/navigation';
import { QRCodeSVG } from 'qrcode.react';
import { type FormEvent, useEffect, useId, useState } from 'react';

import { Button, CommandBlock, CopyButton, Field, TextInput } from '@/components/kit';
import {
  clearChallenge,
  confirmTotp,
  landingFor,
  readChallenge,
  recoverTotp,
  setupTotp,
  verifyTotp,
} from '@/features/session/auth';
import { fetchMe } from '@/features/session/session';
import { isHubError } from '@/lib/api/errors';
import { useLocale, useT } from '@/lib/i18n';
import type { AuthDict } from '@/lib/i18n/page-dicts';

import { AuthFrame, authLink, FormError } from './auth-frame';

function CodeField({
  id,
  label,
  value,
  onChange,
  error,
  recovery,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string | undefined;
  recovery?: boolean;
}) {
  return (
    <Field id={id} label={label} required error={error}>
      <TextInput
        name="code"
        id={id}
        dir="ltr"
        autoFocus
        autoComplete="one-time-code"
        inputMode={recovery ? 'text' : 'numeric'}
        maxLength={recovery ? 32 : 6}
        value={value}
        onChange={(e) => onChange(recovery ? e.target.value : e.target.value.replace(/\D/g, ''))}
        className="key text-center tracking-widest"
      />
    </Field>
  );
}

function VerifyStep({ challenge }: { challenge: string }) {
  const t = useT<AuthDict>('auth');
  const locale = useLocale();
  const router = useRouter();
  const params = useSearchParams();
  const id = useId();
  const [code, setCode] = useState('');
  const [recovery, setRecovery] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!code) return setFailure(t.totp.required);
    setFailure(null);
    setBusy(true);
    try {
      const { user } = await (recovery ? recoverTotp : verifyTotp)(challenge, code);
      clearChallenge();
      router.push(landingFor(user, locale, params.get('next')));
    } catch (error) {
      setFailure(
        isHubError(error, 'hub.identity.totp_invalid') ? t.errors.totpInvalid : t.errors.unavailable,
      );
      setBusy(false);
    }
  };

  return (
    <AuthFrame
      title={t.totp.title}
      subtitle={recovery ? t.totp.recoveryBody : t.totp.body}
      foot={
        <button
          type="button"
          className={authLink}
          onClick={() => {
            setRecovery((v) => !v);
            setCode('');
            setFailure(null);
          }}
        >
          {recovery ? t.totp.useCode : t.totp.useRecovery}
        </button>
      }
    >
      <form noValidate onSubmit={(e) => void submit(e)} className="flex flex-col gap-4">
        <CodeField
          id={`${id}-code`}
          label={recovery ? t.totp.recoveryLabel : t.totp.codeLabel}
          value={code}
          onChange={setCode}
          recovery={recovery}
        />
        <FormError>{failure}</FormError>
        <Button type="submit" variant="primary" busy={busy} className="w-full">
          {t.totp.submit}
        </Button>
      </form>
    </AuthFrame>
  );
}

function SetupStep() {
  const t = useT<AuthDict>('auth');
  const locale = useLocale();
  const router = useRouter();
  const params = useSearchParams();
  const id = useId();
  const [setup, setSetup] = useState<{ secret: string; otpauthUrl: string } | null>(null);
  const [codes, setCodes] = useState<string[] | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  useEffect(() => {
    setupTotp()
      .then(setSetup)
      .catch(() => setFailure(t.errors.unavailable));
  }, [t.errors.unavailable]);

  const confirm = async (e: FormEvent) => {
    e.preventDefault();
    if (!code) return setFailure(t.totp.required);
    setBusy(true);
    setFailure(null);
    try {
      setCodes((await confirmTotp(code)).recoveryCodes);
    } catch (error) {
      setFailure(
        isHubError(error, 'hub.identity.totp_invalid') ? t.errors.totpInvalid : t.errors.unavailable,
      );
    } finally {
      setBusy(false);
    }
  };

  const proceed = async () => {
    const me = await fetchMe();
    router.push(landingFor(me, locale, params.get('next')));
  };

  if (codes) {
    return (
      <AuthFrame title={t.totp.savedTitle} subtitle={t.totp.savedBody} wide>
        <ul dir="ltr" className="grid grid-cols-2 gap-2">
          {codes.map((c) => (
            <li
              key={c}
              translate="no"
              className="key rounded-md border border-border bg-muted px-2 py-1 text-center text-body-sm text-foreground"
            >
              {c}
            </li>
          ))}
        </ul>
        <CopyButton text={codes.join('\n')} label={t.totp.copyCodes} className="self-start" />
        <Button variant="primary" className="w-full" onClick={() => void proceed()}>
          {t.totp.saved}
        </Button>
      </AuthFrame>
    );
  }

  return (
    <AuthFrame title={t.totp.setupTitle} subtitle={t.totp.setupBody} wide>
      {setup && (
        <div className="flex flex-col items-center gap-3">
          {/* The QR is black on white in both themes: a phone's camera needs that contrast. */}
          <div className="rounded-lg border border-border bg-card p-3" data-qr>
            <QRCodeSVG value={setup.otpauthUrl} size={168} marginSize={1} title={t.totp.qr} />
          </div>
          <CommandBlock label={t.totp.manual} value={setup.secret} copyLabel={t.totp.copySecret} />
        </div>
      )}
      <form noValidate onSubmit={(e) => void confirm(e)} className="flex flex-col gap-4">
        <CodeField id={`${id}-code`} label={t.totp.codeLabel} value={code} onChange={setCode} />
        <FormError>{failure}</FormError>
        <Button type="submit" variant="primary" busy={busy} disabled={!setup} className="w-full">
          {t.totp.confirm}
        </Button>
      </form>
    </AuthFrame>
  );
}

export function TotpForm() {
  const t = useT<AuthDict>('auth');
  const locale = useLocale();
  const params = useSearchParams();
  const router = useRouter();
  const setup = params.get('setup') === '1';
  const [challenge, setChallenge] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    setChallenge(readChallenge());
  }, []);

  useEffect(() => {
    if (!setup && challenge === null) router.replace(`/${locale}/sign-in`);
  }, [setup, challenge, router, locale]);

  if (setup) return <SetupStep />;
  if (!challenge) return <AuthFrame title={t.totp.title}>{null}</AuthFrame>;
  return <VerifyStep challenge={challenge} />;
}
