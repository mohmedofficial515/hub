'use client';

/**
 * @file sign-in-form.tsx
 * @description docs/09 §1.1. Wrong password keeps the email and says so inline. A TOTP challenge goes to `/totp`; success goes on to where
 * the member was heading, their one project, or the list.
 */
import { Eye, EyeOff } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { type FormEvent, useId, useState } from 'react';

import { Button, Field, focusFirstInvalid, IconButton, TextInput } from '@/components/kit';
import { landingFor, rememberChallenge, signIn } from '@/features/session/auth';
import { isHubError } from '@/lib/api/errors';
import { useLocale, useT } from '@/lib/i18n';
import type { AuthDict } from '@/lib/i18n/page-dicts';

import { AuthFrame, authLink, FormError } from './auth-frame';

export function authErrorText(t: AuthDict, error: unknown) {
  if (isHubError(error)) {
    if (error.status === 429 || error.code === 'hub.identity.locked') return t.errors.locked;
    if (error.code === 'hub.identity.invalid_credentials') return t.errors.invalid;
    if (error.code === 'hub.identity.account_disabled' || error.code === 'hub.identity.disabled')
      return t.errors.disabled;
    if (error.status < 500) return error.message;
  }
  return t.errors.unavailable;
}

export function SignInForm() {
  const t = useT<AuthDict>('auth');
  const locale = useLocale();
  const router = useRouter();
  const params = useSearchParams();
  const id = useId();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [tried, setTried] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const missingEmail = !email.trim();
  const missingPassword = !password;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setTried(true);
    setFailure(null);
    if (missingEmail || missingPassword) {
      window.setTimeout(() => focusFirstInvalid(e.target as HTMLElement), 0);
      return;
    }
    setBusy(true);
    try {
      const result = await signIn(email.trim(), password);
      const next = params.get('next');
      if (result.totpRequired) {
        rememberChallenge(result.challenge);
        router.push(`/${locale}/totp${next ? `?next=${encodeURIComponent(next)}` : ''}`);
      } else {
        router.push(landingFor(result.user, locale, next));
      }
    } catch (error) {
      setFailure(authErrorText(t, error));
      setBusy(false);
    }
  };

  return (
    <AuthFrame
      title={t.signIn.title}
      foot={
        <a href={`/${locale}/forgot`} className={authLink}>
          {t.signIn.forgot}
        </a>
      }
    >
      <form noValidate onSubmit={(e) => void submit(e)} className="flex flex-col gap-4">
        <Field
          id={`${id}-email`}
          label={t.signIn.email}
          required
          error={tried && missingEmail ? t.errors.emailRequired : undefined}
        >
          <TextInput
            name="email"
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
        <Field
          id={`${id}-password`}
          label={t.signIn.password}
          required
          error={tried && missingPassword ? t.errors.passwordRequired : undefined}
        >
          <div className="relative">
            <TextInput
              name="password"
              id={`${id}-password`}
              type={show ? 'text' : 'password'}
              dir="ltr"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pe-12 text-start"
            />
            <IconButton
              type="button"
              label={show ? t.signIn.hidePassword : t.signIn.showPassword}
              aria-pressed={show}
              onClick={() => setShow((v) => !v)}
              className="absolute inset-y-0 end-0 my-auto"
            >
              {show ? (
                <EyeOff aria-hidden className="size-4" strokeWidth={1.75} />
              ) : (
                <Eye aria-hidden className="size-4" strokeWidth={1.75} />
              )}
            </IconButton>
          </div>
        </Field>
        <FormError>{failure}</FormError>
        <Button type="submit" variant="primary" busy={busy} className="w-full">
          {t.signIn.submit}
        </Button>
      </form>
    </AuthFrame>
  );
}
