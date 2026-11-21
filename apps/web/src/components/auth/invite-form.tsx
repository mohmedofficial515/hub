'use client';

/**
 * @file invite-form.tsx
 * @description docs/09 §1.3. A new member creates an account. An email that already has one joins with "Sign in to join", and the invited
 * account, signed in, joins with one press. A browser signed in as someone else, such as the owner trying the link, is told so and offered
 * to sign out first: accepting there used to answer a bare "not allowed", and could replace the owner's session with the friend's.
 */
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { type FormEvent, useId, useState } from 'react';

import { fill, fmt } from '@/components/common/text';
import {
  Button,
  ErrorState,
  Field,
  kitMessages,
  type Role,
  RoleBadge,
  Skeleton,
  TextInput,
} from '@/components/kit';
import { acceptInvite, type InviteInfo } from '@/features/session/auth';
import { fetchMe } from '@/features/session/session';
import { get, post } from '@/lib/api/client';
import { isHubError } from '@/lib/api/errors';
import { useLocale, useT } from '@/lib/i18n';
import type { AuthDict } from '@/lib/i18n/page-dicts';
import { getQueryClient } from '@/lib/query-client';

import { AuthFrame, authLink, FormError } from './auth-frame';
import { PasswordFields, passwordProblem } from './password-fields';

/** An address inside a sentence: an LTR isolate, so Arabic text around it keeps its order. */
const Address = ({ children }: { children: string }) => (
  <bdi dir="ltr" translate="no" className="font-medium text-foreground">
    {children}
  </bdi>
);

/** `maybeSignedIn`: this browser has a session cookie, so the form asks who it is before offering to create an account. */
export function InviteForm({ token, maybeSignedIn = false }: { token: string; maybeSignedIn?: boolean }) {
  const t = useT<AuthDict>('auth');
  const kit = useT(kitMessages);
  const locale = useLocale();
  const router = useRouter();
  const id = useId();
  const invite = useQuery({
    queryKey: ['invite', token],
    queryFn: () => get<InviteInfo>(`auth/invites/${token}`),
    retry: false,
  });
  const session = useQuery({
    queryKey: ['invite', token, 'session'],
    queryFn: fetchMe,
    enabled: maybeSignedIn,
    retry: false,
  });
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [language, setLanguage] = useState<'ar' | 'en'>(locale);
  const [tried, setTried] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [existing, setExisting] = useState(false);
  const [busy, setBusy] = useState(false);

  if (invite.isPending || (maybeSignedIn && session.isPending)) {
    return (
      <AuthFrame title={t.invite.loading} wide>
        <div role="status" aria-label={t.invite.loading} className="flex flex-col gap-3">
          <Skeleton className="h-6 w-2/3" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      </AuthFrame>
    );
  }
  if (invite.isError) {
    const expired = isHubError(invite.error, 'hub.identity.invite_expired');
    const used = isHubError(invite.error, 'hub.identity.invite_accepted');
    const invalid = isHubError(invite.error, 'hub.identity.invite_invalid');
    const revoked = isHubError(invite.error, 'hub.identity.invite_revoked');
    if (expired || used || invalid || revoked) {
      return (
        <AuthFrame
          title={
            expired ? t.invite.expired : used ? t.invite.used : revoked ? t.invite.revoked : t.invite.invalid
          }
          subtitle={t.invite.askOwner}
          wide
        >
          {null}
        </AuthFrame>
      );
    }
    return (
      <AuthFrame title={t.invite.loading} wide>
        <ErrorState thing={t.invite.thing} onRetry={() => void invite.refetch()} />
      </AuthFrame>
    );
  }
  const info = invite.data;
  const current = session.data ?? null;
  const sameAccount = !!current && current.email.toLowerCase() === info.email.toLowerCase();

  /** The shell starts from nothing, so it reads the new member and their projects, not what this page knew. */
  const enter = (slug: string, language: 'ar' | 'en') => {
    getQueryClient().clear();
    router.push(`/${language}/${slug}/onboarding`);
  };

  const join = async () => {
    setFailure(null);
    setBusy(true);
    try {
      const done = await acceptInvite(token, {});
      enter(done.workspace.slug, locale);
    } catch (error) {
      setBusy(false);
      setFailure(isHubError(error) && error.status < 500 ? error.message : t.errors.unavailable);
    }
  };

  /** Ends this browser's session and comes back to the same link, signed out. */
  const signOutHere = async () => {
    setBusy(true);
    try {
      await post<void>('auth/sign-out');
    } catch {
      /* An expired session is already as good as signed out. */
    }
    getQueryClient().clear();
    window.location.reload();
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setTried(true);
    setFailure(null);
    const problem = passwordProblem(t, password, confirm);
    if (!displayName.trim() || problem.password || problem.confirm) return;
    setBusy(true);
    try {
      const done = await acceptInvite(token, { displayName: displayName.trim(), password, locale: language });
      enter(done.workspace.slug, language);
    } catch (error) {
      setBusy(false);
      if (isHubError(error, 'hub.identity.email_taken')) setExisting(true);
      else if (isHubError(error, 'hub.identity.password_weak')) setFailure(t.errors.passwordWeak);
      else setFailure(isHubError(error) && error.status < 500 ? error.message : t.errors.unavailable);
    }
  };

  const roles = (
    <span className="mt-1 flex flex-wrap items-center gap-2">
      {info.roles.map((role) => (
        <RoleBadge key={role} role={role as Role} />
      ))}
    </span>
  );

  if (current && !sameAccount) {
    return (
      <AuthFrame
        wide
        title={t.invite.otherTitle}
        subtitle={fill(t.invite.otherBody, {
          invited: <Address>{info.email}</Address>,
          current: <Address>{current.email}</Address>,
        })}
      >
        <div className="flex flex-col gap-3">
          <FormError>{failure}</FormError>
          <Button variant="primary" busy={busy} className="w-full" onClick={() => void signOutHere()}>
            {t.invite.signOutContinue}
          </Button>
        </div>
      </AuthFrame>
    );
  }

  if (current && sameAccount) {
    return (
      <AuthFrame
        wide
        title={fmt(t.invite.title, { project: info.workspace.name })}
        subtitle={
          <>
            <span>{fill(t.invite.joinBody, { current: <Address>{current.email}</Address> })}</span>
            {roles}
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <FormError>{failure}</FormError>
          <Button variant="primary" busy={busy} className="w-full" onClick={() => void join()}>
            {t.invite.join}
          </Button>
        </div>
      </AuthFrame>
    );
  }

  if (existing) {
    const next = encodeURIComponent(`/${locale}/invite/${token}`);
    return (
      <AuthFrame
        title={fmt(t.invite.title, { project: info.workspace.name })}
        subtitle={t.invite.existingBody}
        wide
      >
        <a href={`/${locale}/sign-in?next=${next}`} className={authLink}>
          {t.invite.signInToJoin}
        </a>
      </AuthFrame>
    );
  }

  return (
    <AuthFrame
      wide
      title={fmt(t.invite.title, { project: info.workspace.name })}
      subtitle={
        <>
          <span>{fill(t.invite.byLine, { name: <bdi>{info.invitedBy}</bdi> })}</span>
          {roles}
        </>
      }
    >
      <form noValidate onSubmit={(e) => void submit(e)} className="flex flex-col gap-4">
        <Field id={`${id}-email`} label={t.signIn.email}>
          <TextInput
            id={`${id}-email`}
            type="email"
            dir="ltr"
            readOnly
            value={info.email}
            className="text-start text-muted-foreground"
          />
        </Field>
        <Field
          id={`${id}-name`}
          label={t.invite.name}
          required
          error={tried && !displayName.trim() ? t.errors.nameRequired : undefined}
        >
          <TextInput
            id={`${id}-name`}
            dir="auto"
            autoComplete="name"
            autoFocus
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
        </Field>
        <PasswordFields
          password={password}
          confirm={confirm}
          onPassword={setPassword}
          onConfirm={setConfirm}
          tried={tried}
        />
        <fieldset className="flex flex-col gap-1.5">
          <legend className="text-body-sm font-medium text-foreground">{t.invite.language}</legend>
          <div className="flex items-center gap-4">
            {(['ar', 'en'] as const).map((value) => (
              <label
                key={value}
                className="flex min-h-11 items-center gap-2 text-body text-foreground md:min-h-9"
              >
                <input
                  type="radio"
                  name={`${id}-language`}
                  checked={language === value}
                  onChange={() => setLanguage(value)}
                  className="size-4 accent-primary"
                />
                {kit.languages[value]}
              </label>
            ))}
          </div>
        </fieldset>
        <FormError>{failure}</FormError>
        <Button type="submit" variant="primary" busy={busy} className="w-full">
          {t.invite.submit}
        </Button>
      </form>
    </AuthFrame>
  );
}
