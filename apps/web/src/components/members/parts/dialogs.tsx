'use client';

/**
 * @file dialogs.tsx
 * @description Ported from the approved design, pages/members. Contract: apps/web/README.md.
 */
import { useState } from 'react';

import {
  Button,
  CommandBlock,
  Field,
  fmt,
  kitMessages,
  Modal,
  type Role,
  RoleChecks,
  Select,
  ShownOnce,
  showToast,
  TextInput,
  useLocale,
  useSession,
  useT,
} from '@/components/kit';
import type { MembersMessages } from '@/features/members/messages';
import {
  type DirectoryRow,
  useDirectory,
  useInvites,
  useInviteWrites,
  useMemberWrites,
  useProfileWrites,
} from '@/features/members/queries';
import { useMe } from '@/features/session/session';
import { useSettings } from '@/features/settings/queries';
import { totpSetupPath } from '@/lib/api/client';
import { isHubError } from '@/lib/api/errors';
import { setLocaleEverywhere } from '@/lib/theme';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const LOGIN = /^[A-Za-z\d](?:[A-Za-z\d-]{0,38})$/;
const ltr = 'key text-start';

/** A link the API returns once. */
export function ShownOnceDialog({
  open,
  onClose,
  title,
  description,
  link,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description: string;
  link: string;
}) {
  const t = useT<MembersMessages>('members');
  return (
    <Modal
      open={open}
      onOpenChange={(next) => !next && onClose()}
      title={title}
      description={description}
      footer={
        <Button variant="primary" onClick={onClose}>
          {t.once.done}
        </Button>
      }
    >
      <ShownOnce warning={t.once.warning}>
        <CommandBlock label={t.once.linkLabel} value={link} copyLabel={t.once.copy} />
      </ShownOnce>
    </Modal>
  );
}

export function InviteDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT<MembersMessages>('members');
  const kit = useT(kitMessages);
  const { isOwner } = useSession();
  const invites = useInvites(true).data ?? [];
  const directory = useDirectory().data ?? [];
  const writes = useInviteWrites();
  const s = t.inviteDialog;
  const [email, setEmail] = useState('');
  const [roles, setRoles] = useState<Role[]>([]);
  const [tried, setTried] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  const clean = email.trim().toLowerCase();
  const emailError = !EMAIL.test(clean)
    ? s.emailInvalid
    : invites.some((i) => i.email === clean)
      ? s.emailTaken
      : directory.some((d) => d.status === 'active' && d.email.toLowerCase() === clean)
        ? s.emailMember
        : undefined;
  const rolesError = roles.length === 0 ? s.rolesRequired : undefined;

  const close = () => {
    setEmail('');
    setRoles([]);
    setTried(false);
    setLink(null);
    setServerError(null);
    onClose();
  };

  const create = () => {
    setTried(true);
    if (emailError || rolesError) return;
    writes.create.mutate(
      { email: clean, roles },
      {
        onSuccess: ({ url }) => setLink(url),
        onError: (cause) => setServerError(isHubError(cause) ? cause.message : t.errorThing),
      },
    );
  };

  return (
    <Modal
      open={open}
      onOpenChange={(next) => !next && close()}
      title={link ? s.createdTitle : s.title}
      description={link ? fmt(s.createdBody, { email: clean }) : undefined}
      footer={
        link ? (
          <Button variant="primary" onClick={close}>
            {t.once.done}
          </Button>
        ) : (
          <>
            <Button onClick={close}>{kit.cancel}</Button>
            <Button variant="primary" busy={writes.create.isPending} onClick={create}>
              {s.send}
            </Button>
          </>
        )
      }
    >
      {link ? (
        <ShownOnce warning={t.once.warning}>
          <CommandBlock label={t.once.linkLabel} value={link} copyLabel={t.once.copy} />
        </ShownOnce>
      ) : (
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            create();
          }}
        >
          <Field
            id="invite-email"
            label={s.email}
            hint={s.emailHint}
            error={tried ? emailError : undefined}
            required
          >
            <TextInput
              id="invite-email"
              type="email"
              dir="ltr"
              className={ltr}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-invalid={tried && !!emailError}
              autoFocus
            />
          </Field>
          <RoleChecks
            legend={s.roles}
            value={roles}
            onChange={setRoles}
            locked={isOwner ? [] : ['owner']}
            hint={isOwner ? undefined : s.ownerOnly}
            error={tried ? rolesError : undefined}
          />
          {serverError && (
            <p role="alert" className="text-body-sm font-medium text-destructive-soft-foreground">
              {serverError}
            </p>
          )}
        </form>
      )}
    </Modal>
  );
}

export function RolesDialog({
  open,
  onClose,
  row,
}: {
  open: boolean;
  onClose: () => void;
  row: DirectoryRow;
}) {
  const t = useT<MembersMessages>('members');
  const kit = useT(kitMessages);
  const { isOwner } = useSession();
  const writes = useMemberWrites();
  const s = t.rolesDialog;
  const name = row.member.name;
  const [roles, setRoles] = useState<Role[]>(row.roles);
  const [error, setError] = useState<string | null>(null);

  const save = () => {
    if (roles.length === 0) return setError(s.required);
    writes.setRoles.mutate(
      { id: row.member.id, roles },
      {
        onSuccess: () => {
          showToast({ message: fmt(s.saved, { name }) });
          onClose();
        },
        // The API is the authority on the last owner: hub.workspaces.last_owner.
        onError: (cause) =>
          setError(
            isHubError(cause, 'hub.workspaces.last_owner')
              ? s.lastOwner
              : isHubError(cause)
                ? cause.message
                : t.errorThing,
          ),
      },
    );
  };

  return (
    <Modal
      open={open}
      onOpenChange={(next) => !next && onClose()}
      title={fmt(s.title, { name })}
      footer={
        <>
          <Button onClick={onClose}>{kit.cancel}</Button>
          <Button variant="primary" busy={writes.setRoles.isPending} onClick={save}>
            {s.save}
          </Button>
        </>
      }
    >
      <RoleChecks
        legend={t.col.roles}
        value={roles}
        onChange={(next) => {
          setRoles(next);
          setError(null);
        }}
        locked={isOwner ? [] : ['owner']}
        hint={isOwner ? s.hint : s.ownerOnly}
        error={
          error ? (
            <>
              {error}
              {error === s.lastOwner && (
                <span dir="ltr" translate="no" className="key ms-1.5 text-caption">
                  hub.workspaces.last_owner
                </span>
              )}
            </>
          ) : undefined
        }
      />
    </Modal>
  );
}

export function GithubDialog({
  open,
  onClose,
  row,
}: {
  open: boolean;
  onClose: () => void;
  row: DirectoryRow;
}) {
  const t = useT<MembersMessages>('members');
  const kit = useT(kitMessages);
  const writes = useMemberWrites();
  const s = t.githubDialog;
  const name = row.member.name;
  const [serverError, setServerError] = useState<string | null>(null);
  const [text, setText] = useState(row.githubLogins.join(', '));
  const [tried, setTried] = useState(false);
  const logins = text
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
  const error = logins.some((l) => !LOGIN.test(l)) ? s.invalid : (serverError ?? undefined);

  const save = () => {
    setTried(true);
    if (logins.some((l) => !LOGIN.test(l))) return;
    writes.setGithub.mutate(
      { id: row.member.id, logins },
      {
        onSuccess: () => {
          showToast({ message: fmt(s.saved, { name }) });
          onClose();
        },
        onError: (cause) => setServerError(isHubError(cause) ? cause.message : t.errorThing),
      },
    );
  };

  return (
    <Modal
      open={open}
      onOpenChange={(next) => !next && onClose()}
      title={fmt(s.title, { name })}
      footer={
        <>
          <Button onClick={onClose}>{kit.cancel}</Button>
          <Button variant="primary" onClick={save}>
            {s.save}
          </Button>
        </>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <Field id="github-logins" label={s.label} hint={s.hint} error={tried ? error : undefined}>
          <TextInput
            id="github-logins"
            dir="ltr"
            className={ltr}
            spellCheck={false}
            value={text}
            onChange={(e) => {
              setServerError(null);
              setText(e.target.value);
            }}
            aria-invalid={tried && !!error}
            autoFocus
          />
        </Field>
      </form>
    </Modal>
  );
}

/** 09 §17: the current member's own row opens "Profile": display name, language, password, two-step sign-in. */
export function ProfileDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT<MembersMessages>('members');
  const kit = useT(kitMessages);
  const locale = useLocale();
  const { me, roles } = useSession();
  const account = useMe().data;
  const totpRoles = useSettings().data?.['security.totp_required_roles'] as Role[] | undefined;
  const writes = useProfileWrites();
  const s = t.profile;
  const [name, setName] = useState(me.name);
  const [lang, setLang] = useState(locale);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [tried, setTried] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [turningOff, setTurningOff] = useState(false);
  const [code, setCode] = useState('');
  const required = roles.some((r) => (totpRoles ?? []).includes(r));
  const nameError = !name.trim() ? s.nameRequired : undefined;
  const nextError = next && next.length < 12 ? s.tooShort : undefined;
  const currentError = next && !current ? s.needCurrent : undefined;
  const saving = writes.save.isPending;

  const close = () => {
    setCurrent('');
    setNext('');
    setCode('');
    setTried(false);
    setServerError(null);
    setTurningOff(false);
    onClose();
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
          showToast({ message: s.saved });
          close();
          if (lang !== locale) setLocaleEverywhere(lang, { signedIn: true });
        },
        onError: (cause) => setServerError(isHubError(cause) ? cause.message : t.errorThing),
      },
    );
  };

  const disableTotp = () =>
    writes.disableTotp.mutate(code, {
      onSuccess: () => {
        setTurningOff(false);
        setCode('');
      },
      onError: (cause) => setServerError(isHubError(cause) ? cause.message : t.errorThing),
    });

  return (
    <Modal
      open={open}
      onOpenChange={(value) => !value && close()}
      title={s.title}
      footer={
        <>
          <Button onClick={close}>{kit.cancel}</Button>
          <Button variant="primary" busy={saving} onClick={save}>
            {s.save}
          </Button>
        </>
      }
    >
      <form
        className="flex flex-col gap-4"
        autoComplete="off"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="profile-name" label={s.displayName} error={tried ? nameError : undefined} required>
            <TextInput
              id="profile-name"
              dir="auto"
              value={name}
              onChange={(e) => setName(e.target.value)}
              aria-invalid={tried && !!nameError}
              autoFocus
            />
          </Field>
          <Field id="profile-locale" label={s.locale}>
            <Select id="profile-locale" value={lang} onChange={(e) => setLang(e.target.value as typeof lang)}>
              <option value="ar">{s.arabic}</option>
              <option value="en">{s.english}</option>
            </Select>
          </Field>
        </div>
        <fieldset className="flex flex-col gap-3 border-t border-border pt-4">
          <legend className="float-start mb-1 text-body font-semibold text-foreground">
            {s.passwordTitle}
          </legend>
          <div className="clear-both grid gap-4 sm:grid-cols-2">
            <Field id="profile-current" label={s.current} error={tried ? currentError : undefined}>
              <TextInput
                id="profile-current"
                type="password"
                dir="ltr"
                className={ltr}
                autoComplete="current-password"
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
              />
            </Field>
            <Field id="profile-next" label={s.next} error={tried ? nextError : undefined}>
              <TextInput
                id="profile-next"
                type="password"
                dir="ltr"
                className={ltr}
                autoComplete="new-password"
                value={next}
                onChange={(e) => setNext(e.target.value)}
              />
            </Field>
          </div>
        </fieldset>
        <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
          <div className="min-w-0 flex-1 basis-48">
            <p className="text-body font-semibold text-foreground">{s.totpTitle}</p>
            <p className="text-body-sm text-muted-foreground">
              {account?.totpEnabled ? s.totpOn : s.totpOff}{' '}
              {required && account?.totpEnabled ? s.totpRequired : ''}
            </p>
          </div>
          {account?.totpEnabled ? (
            !required &&
            (turningOff ? (
              <span className="flex flex-wrap items-end gap-2">
                <Field id="profile-totp-code" label={s.totpCode}>
                  <TextInput
                    id="profile-totp-code"
                    dir="ltr"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    className={`${ltr} w-28`}
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                  />
                </Field>
                <Button size="sm" busy={writes.disableTotp.isPending} onClick={disableTotp}>
                  {s.totpDisable}
                </Button>
              </span>
            ) : (
              <Button size="sm" onClick={() => setTurningOff(true)}>
                {s.totpDisable}
              </Button>
            ))
          ) : (
            <Button
              size="sm"
              onClick={() => {
                const { pathname, search } = window.location;
                window.location.assign(totpSetupPath(locale, pathname, search));
              }}
            >
              {s.totpEnable}
            </Button>
          )}
        </div>
        {serverError && (
          <p role="alert" className="text-body-sm font-medium text-destructive-soft-foreground">
            {serverError}
          </p>
        )}
        <button type="submit" hidden aria-hidden tabIndex={-1} />
      </form>
    </Modal>
  );
}
