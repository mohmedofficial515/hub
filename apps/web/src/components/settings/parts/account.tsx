'use client';

/**
 * @file account.tsx
 * @description Settings › Account, for every member (owner's decision, 2026-11-19): the profile that used to be a dialog on Members (display
 * name, language, password, two-step sign-in, docs/09 §17) and the notifications that used to be a tab of their own (§18.4). Only what the
 * member changes is held, so a name that arrives after the page opens still shows; the bar at the foot appears once something changed.
 */
import { useState } from 'react';

import {
  Button,
  cn,
  Field,
  fmt,
  type Role,
  Select,
  showToast,
  TextInput,
  useLocale,
  useSession,
  useT,
} from '@/components/kit';
import type { MembersMessages } from '@/features/members/messages';
import { useProfileWrites } from '@/features/members/queries';
import { useMe } from '@/features/session/session';
import { useDraft, useLeaveWithDraft } from '@/features/settings/drafts';
import type { SettingsMessages } from '@/features/settings/messages';
import { useSettings } from '@/features/settings/queries';
import { totpSetupPath } from '@/lib/api/client';
import { isHubError } from '@/lib/api/errors';
import { useUnsavedGuard } from '@/lib/hooks';
import { setLocaleEverywhere } from '@/lib/theme';

import { NotificationsSection } from './notifications';
import { FormSection } from './shared';

const ltr = 'key text-start';

function TwoStep() {
  const p = useT<MembersMessages>('members').profile;
  const a = useT<SettingsMessages>('settings').account;
  const t = useT<MembersMessages>('members');
  const locale = useLocale();
  const { roles } = useSession();
  const account = useMe().data;
  const totpRoles = useSettings().data?.['security.totp_required_roles'] as Role[] | undefined;
  const writes = useProfileWrites();
  const [turningOff, setTurningOff] = useState(false);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const required = roles.some((r) => (totpRoles ?? []).includes(r));
  const on = !!account?.totpEnabled;

  const disable = () =>
    writes.disableTotp.mutate(code, {
      onSuccess: () => {
        setTurningOff(false);
        setCode('');
        setError(null);
      },
      onError: (cause) => setError(isHubError(cause) ? cause.message : t.errorThing),
    });

  return (
    <FormSection title={p.totpTitle} description={a.totpBody}>
      <div className="flex flex-wrap items-center gap-3">
        <p role="status" className="min-w-0 flex-1 basis-48 text-body-sm text-foreground">
          {on ? p.totpOn : p.totpOff} {required && on ? p.totpRequired : ''}
        </p>
        {on ? (
          !required &&
          (turningOff ? (
            <span className="flex flex-wrap items-end gap-2">
              <Field id="account-totp-code" label={p.totpCode}>
                <TextInput
                  id="account-totp-code"
                  dir="ltr"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  className={`${ltr} w-28`}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  autoFocus
                />
              </Field>
              <Button busy={writes.disableTotp.isPending} onClick={disable}>
                {p.totpDisable}
              </Button>
            </span>
          ) : (
            <Button onClick={() => setTurningOff(true)}>{p.totpDisable}</Button>
          ))
        ) : (
          <Button
            onClick={() => {
              const { pathname, search } = window.location;
              window.location.assign(totpSetupPath(locale, pathname, search));
            }}
          >
            {p.totpEnable}
          </Button>
        )}
      </div>
      {error && (
        <p role="alert" className="text-body-sm font-medium text-destructive-soft-foreground">
          {error}
        </p>
      )}
    </FormSection>
  );
}

type AccountEdits = { name?: string; locale?: 'ar' | 'en' };
const NO_EDITS: AccountEdits = {};

export function AccountTab() {
  const t = useT<MembersMessages>('members');
  const p = t.profile;
  const st = useT<SettingsMessages>('settings');
  const a = st.account;
  const locale = useLocale();
  const { me } = useSession();
  const writes = useProfileWrites();
  // Only the member's own edits are held, so a saved value that arrives after mount still shows. The name and language are kept
  // outside the tab (docs/08 §5.7), so a tab switch or a move to another page keeps them; the passwords stay here, never kept.
  const [edits, setEdits, clearEdits] = useDraft<AccountEdits>('account', NO_EDITS);
  useLeaveWithDraft('account', () => showToast({ message: fmt(st.unsavedKept, { tab: st.tabs.account }) }));
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [tried, setTried] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  // A field put back to its saved value is no edit, so the dot on the tab goes with it.
  const edit = <K extends keyof AccountEdits>(key: K, value: NonNullable<AccountEdits[K]>, saved: string) =>
    setEdits((d) => {
      const rest = { ...d };
      delete rest[key];
      return value === saved ? rest : { ...rest, [key]: value };
    });
  const name = edits.name ?? me.name;
  const lang = edits.locale ?? locale;
  const dirty = name !== me.name || lang !== locale || !!current || !!next;
  useUnsavedGuard(dirty);

  const nameError = !name.trim() ? p.nameRequired : undefined;
  const nextError = next && next.length < 12 ? p.tooShort : undefined;
  const currentError = next && !current ? p.needCurrent : undefined;

  const discard = () => {
    clearEdits();
    setCurrent('');
    setNext('');
    setTried(false);
    setServerError(null);
  };

  const save = () => {
    setTried(true);
    if (nameError || nextError || currentError) return;
    writes.save.mutate(
      {
        ...(name.trim() !== me.name ? { displayName: name.trim() } : {}),
        ...(lang !== locale ? { locale: lang } : {}),
        ...(next ? { password: { current, next } } : {}),
      },
      {
        onSuccess: () => {
          showToast({ message: p.saved });
          discard();
          if (lang !== locale) setLocaleEverywhere(lang, { signedIn: true });
        },
        onError: (cause) => setServerError(isHubError(cause) ? cause.message : t.errorThing),
      },
    );
  };

  return (
    <>
      <form
        className="flex flex-col gap-6"
        autoComplete="off"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <FormSection title={p.title} description={a.profileBody} className="border-t-0 pt-0">
          <div className="grid gap-4 sm:@page-sm:grid-cols-2">
            <Field id="account-name" label={p.displayName} error={tried ? nameError : undefined} required>
              <TextInput
                id="account-name"
                dir="auto"
                value={name}
                onChange={(e) => edit('name', e.target.value, me.name)}
                aria-invalid={tried && !!nameError}
                autoComplete="name"
              />
            </Field>
            <Field id="account-locale" label={p.locale}>
              <Select
                id="account-locale"
                value={lang}
                onChange={(e) => edit('locale', e.target.value as 'ar' | 'en', locale)}
              >
                <option value="ar">{p.arabic}</option>
                <option value="en">{p.english}</option>
              </Select>
            </Field>
          </div>
        </FormSection>

        <FormSection title={p.passwordTitle} description={a.passwordBody}>
          <div className="grid gap-4 sm:@page-sm:grid-cols-2">
            <Field id="account-current" label={p.current} error={tried ? currentError : undefined}>
              <TextInput
                id="account-current"
                type="password"
                dir="ltr"
                className={ltr}
                autoComplete="current-password"
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
              />
            </Field>
            <Field id="account-next" label={p.next} error={tried ? nextError : undefined}>
              <TextInput
                id="account-next"
                type="password"
                dir="ltr"
                className={ltr}
                autoComplete="new-password"
                value={next}
                onChange={(e) => setNext(e.target.value)}
              />
            </Field>
          </div>
        </FormSection>
        <button type="submit" hidden aria-hidden tabIndex={-1} />
      </form>

      <TwoStep />

      <NotificationsSection />

      <div
        data-account-bar
        className={cn(
          'sticky bottom-4 z-20 flex flex-wrap items-center gap-3 rounded-lg border border-border bg-popover p-3 shadow-md',
          !dirty && !serverError && 'hidden',
        )}
      >
        <div className="min-w-0 flex-1 basis-40">
          <p role="status" className="text-body-sm font-medium text-foreground">
            {dirty ? a.unsaved : ''}
          </p>
          {serverError && (
            <p role="alert" className="text-body-sm font-medium text-destructive-soft-foreground">
              {serverError}
            </p>
          )}
        </div>
        <Button variant="ghost" onClick={discard}>
          {a.discard}
        </Button>
        <Button variant="primary" busy={writes.save.isPending} onClick={save}>
          {p.save}
        </Button>
      </div>
    </>
  );
}
