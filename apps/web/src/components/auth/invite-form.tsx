'use client';

/**
 * @file invite-form.tsx
 * @description docs/09 §1.3. A new member creates an account. A signed-in member, or an email that already has one, joins with "Sign in to join".
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
import { get } from '@/lib/api/client';
import { isHubError } from '@/lib/api/errors';
import { useLocale, useT } from '@/lib/i18n';
import type { AuthDict } from '@/lib/i18n/page-dicts';

import { AuthFrame, authLink, FormError } from './auth-frame';
import { PasswordFields, passwordProblem } from './password-fields';

export function InviteForm({ token }: { token: string }) {
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
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [language, setLanguage] = useState<'ar' | 'en'>(locale);
  const [tried, setTried] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [existing, setExisting] = useState(false);
  const [busy, setBusy] = useState(false);

  if (invite.isPending) {
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
    if (expired || used || invalid) {
      return (
        <AuthFrame
          title={expired ? t.invite.expired : used ? t.invite.used : t.invite.invalid}
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

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setTried(true);
    setFailure(null);
    const problem = passwordProblem(t, password, confirm);
    if (!displayName.trim() || problem.password || problem.confirm) return;
    setBusy(true);
    try {
      const done = await acceptInvite(token, { displayName: displayName.trim(), password, locale: language });
      router.push(`/${language}/${done.workspace.slug}/onboarding`);
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
