'use client';

/**
 * @file dialogs.tsx
 * @description Ported from the approved design, pages/members. Contract: apps/web/README.md.
 */
import type { MailMode } from '@hub/contracts';
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
  ShownOnce,
  showToast,
  TextInput,
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
} from '@/features/members/queries';
import { isHubError } from '@/lib/api/errors';

import { InviteLink } from './invite-link';

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

/** A new link for an invite (resend): the same sending choices as a new invite. */
export function InviteLinkDialog({
  open,
  onClose,
  email,
  url,
  mail,
}: {
  open: boolean;
  onClose: () => void;
  email: string;
  url: string;
  mail: MailMode;
}) {
  const t = useT<MembersMessages>('members');
  return (
    <Modal
      open={open}
      onOpenChange={(next) => !next && onClose()}
      title={t.invites.resendTitle}
      description={fmt(t.invites.resendBody, { email })}
      footer={
        <Button variant="primary" onClick={onClose}>
          {t.once.done}
        </Button>
      }
    >
      <InviteLink email={email} url={url} mail={mail} />
    </Modal>
  );
}

export function InviteDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT<MembersMessages>('members');
  const kit = useT(kitMessages);
  const { isOwner } = useSession();
  const invites = useInvites(open).data ?? [];
  const directory = useDirectory().data ?? [];
  const writes = useInviteWrites();
  const s = t.inviteDialog;
  const [email, setEmail] = useState('');
  const [roles, setRoles] = useState<Role[]>([]);
  const [tried, setTried] = useState(false);
  const [link, setLink] = useState<{ url: string; mail: MailMode } | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  const clean = email.trim().toLowerCase();
  const emailError = !EMAIL.test(clean)
    ? s.emailInvalid
    : invites.some((i) => i.status === 'pending' && i.email === clean)
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
        onSuccess: ({ url, mail }) => setLink({ url, mail }),
        onError: (cause) => setServerError(isHubError(cause) ? cause.message : t.errorThing),
      },
    );
  };

  return (
    <Modal
      open={open}
      onOpenChange={(next) => !next && close()}
      title={link ? s.createdTitle : s.title}
      dirty={!link && (!!email.trim() || roles.length > 0)}
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
        <InviteLink email={clean} url={link.url} mail={link.mail} />
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
