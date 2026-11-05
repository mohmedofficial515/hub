'use client';

/**
 * @file reset-forms.tsx
 * @description "Forgot password" and the reset link (docs/09 §1.4). Forgot always answers the same way, so it cannot be used to test emails.
 */
import { useRouter } from 'next/navigation';
import { type FormEvent, useId, useState } from 'react';

import { Button, Field, TextInput } from '@/components/kit';
import { forgotPassword, resetPassword } from '@/features/session/auth';
import { isHubError } from '@/lib/api/errors';
import { useLocale, useT } from '@/lib/i18n';
import type { AuthDict } from '@/lib/i18n/page-dicts';

import { AuthFrame, authLink, FormError } from './auth-frame';
import { PasswordFields, passwordProblem } from './password-fields';

export function ForgotForm() {
  const t = useT<AuthDict>('auth');
  const locale = useLocale();
  const id = useId();
  const [email, setEmail] = useState('');
  const [tried, setTried] = useState(false);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setTried(true);
    if (!email.trim()) return;
    setBusy(true);
    await forgotPassword(email.trim()).catch(() => undefined);
    setBusy(false);
    setSent(true);
  };

  const back = (
    <a href={`/${locale}/sign-in`} className={authLink}>
      {t.forgot.back}
    </a>
  );

  if (sent) {
    return (
      <AuthFrame title={t.forgot.sentTitle} subtitle={t.forgot.sentBody} foot={back}>
        {null}
      </AuthFrame>
    );
  }
  return (
    <AuthFrame title={t.forgot.title} subtitle={t.forgot.body} foot={back}>
      <form noValidate onSubmit={(e) => void submit(e)} className="flex flex-col gap-4">
        <Field
          id={`${id}-email`}
          label={t.signIn.email}
          required
          error={tried && !email.trim() ? t.errors.emailRequired : undefined}
        >
          <TextInput
            id={`${id}-email`}
            type="email"
            dir="ltr"
            autoComplete="username"
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="text-start"
          />
        </Field>
        <Button type="submit" variant="primary" busy={busy} className="w-full">
          {t.forgot.submit}
        </Button>
      </form>
    </AuthFrame>
  );
}

export function ResetForm({ token }: { token: string }) {
  const t = useT<AuthDict>('auth');
  const locale = useLocale();
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [tried, setTried] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setTried(true);
    setFailure(null);
    const problem = passwordProblem(t, password, confirm);
    if (problem.password || problem.confirm) return;
    setBusy(true);
    try {
      await resetPassword(token, password);
      router.push(`/${locale}/sign-in?reset=1`);
    } catch (error) {
      if (isHubError(error, 'hub.identity.reset_invalid')) setFailure(t.errors.resetInvalid);
      else if (isHubError(error, 'hub.identity.password_weak')) setFailure(t.errors.passwordWeak);
      else setFailure(t.errors.unavailable);
      setBusy(false);
    }
  };

  return (
    <AuthFrame title={t.reset.title}>
      <form noValidate onSubmit={(e) => void submit(e)} className="flex flex-col gap-4">
        <PasswordFields
          password={password}
          confirm={confirm}
          onPassword={setPassword}
          onConfirm={setConfirm}
          tried={tried}
        />
        <FormError>{failure}</FormError>
        <Button type="submit" variant="primary" busy={busy} className="w-full">
          {t.reset.submit}
        </Button>
      </form>
    </AuthFrame>
  );
}
