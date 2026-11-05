import { useState } from 'react';
import { useLocale, useT } from '@lab/i18n';
import { NOW, type Role } from '@lab/mocks/hub-app';
import { exampleLink, type DirectoryRow, type InviteRow } from '@lab/mocks/hub-app/members';
import { Button, CommandBlock, Field, fmt, kitMessages, Modal, RoleChecks, Select, setQuery, ShownOnce, showToast, TextInput, updateAdmin, useAdmin, useSession, writeAudit } from '../../../kit';
import { messages } from '../i18n';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const LOGIN = /^[A-Za-z\d](?:[A-Za-z\d-]{0,38})$/;
const WEEK_MS = 7 * 86_400_000;
const ltr = 'key text-start';

/** A link the API returns once. */
export function ShownOnceDialog({ open, onClose, title, description, link }: { open: boolean; onClose: () => void; title: string; description: string; link: string }) {
  const t = useT(messages);
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
      <ShownOnce warning={t.once.warning} exampleLabel={t.once.example}>
        <CommandBlock label={t.once.linkLabel} value={link} copyLabel={t.once.copy} />
      </ShownOnce>
    </Modal>
  );
}

export function InviteDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT(messages);
  const kit = useT(kitMessages);
  const locale = useLocale();
  const { scenario, me, isOwner } = useSession();
  const { invites, directory } = useAdmin(scenario);
  const s = t.inviteDialog;
  const [email, setEmail] = useState('');
  const [roles, setRoles] = useState<Role[]>([]);
  const [tried, setTried] = useState(false);
  const [link, setLink] = useState<string | null>(null);

  const clean = email.trim().toLowerCase();
  const emailError = !EMAIL.test(clean) ? s.emailInvalid : invites.some((i) => i.email === clean) ? s.emailTaken : directory.some((d) => d.status === 'active' && d.email === clean) ? s.emailMember : undefined;
  const rolesError = roles.length === 0 ? s.rolesRequired : undefined;

  const close = () => {
    setEmail('');
    setRoles([]);
    setTried(false);
    setLink(null);
    onClose();
  };

  const create = () => {
    setTried(true);
    if (emailError || rolesError) return;
    const invite: InviteRow = { id: `inv-${clean}`, email: clean, roles, createdById: me.id, createdAt: NOW, expiresAt: new Date(Date.parse(NOW) + WEEK_MS).toISOString() };
    updateAdmin((state) => ({ ...state, invites: [invite, ...state.invites] }));
    writeAudit({ action: 'members.invite.create', targetType: 'invite', targetId: clean, actorId: me.id, summary: { ar: `دعوة بدور: ${roles.map((r) => kitMessages.ar.roles[r]).join('، ')}`, en: `Invite with roles: ${roles.map((r) => kitMessages.en.roles[r]).join(', ')}` } });
    setLink(exampleLink('invite', locale));
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
            <Button variant="primary" onClick={create}>
              {s.send}
            </Button>
          </>
        )
      }
    >
      {link ? (
        <ShownOnce warning={t.once.warning} exampleLabel={t.once.example}>
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
          <Field id="invite-email" label={s.email} hint={s.emailHint} error={tried ? emailError : undefined} required>
            <TextInput id="invite-email" type="email" dir="ltr" className={ltr} value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={tried && !!emailError} autoFocus />
          </Field>
          <RoleChecks legend={s.roles} value={roles} onChange={setRoles} locked={isOwner ? [] : ['owner']} hint={isOwner ? undefined : s.ownerOnly} error={tried ? rolesError : undefined} />
        </form>
      )}
    </Modal>
  );
}

export function RolesDialog({ open, onClose, row }: { open: boolean; onClose: () => void; row: DirectoryRow }) {
  const t = useT(messages);
  const kit = useT(kitMessages);
  const locale = useLocale();
  const { scenario, me, isOwner } = useSession();
  const { directory } = useAdmin(scenario);
  const s = t.rolesDialog;
  const name = row.member.name[locale];
  const [roles, setRoles] = useState<Role[]>(row.roles);
  const [error, setError] = useState<string | null>(null);

  const save = () => {
    if (roles.length === 0) return setError(s.required);
    const owners = directory.filter((d) => d.status === 'active' && d.roles.includes('owner'));
    if (row.roles.includes('owner') && !roles.includes('owner') && owners.length === 1) return setError(s.lastOwner);
    const before = row.roles;
    updateAdmin((state) => ({ ...state, directory: state.directory.map((d) => (d.member.id === row.member.id ? { ...d, roles } : d)) }));
    writeAudit({
      action: 'members.roles.update',
      targetType: 'member',
      targetId: row.member.id,
      actorId: me.id,
      summary: { ar: `من ${before.map((r) => kitMessages.ar.roles[r]).join('، ')} إلى ${roles.map((r) => kitMessages.ar.roles[r]).join('، ')}`, en: `From ${before.map((r) => kitMessages.en.roles[r]).join(', ')} to ${roles.map((r) => kitMessages.en.roles[r]).join(', ')}` },
    });
    showToast({ message: fmt(s.saved, { name }) });
    onClose();
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
      <RoleChecks
        legend={t.col.roles}
        value={roles}
        onChange={(next) => {
          setRoles(next);
          setError(null);
        }}
        locked={isOwner ? [] : ['owner']}
        hint={isOwner ? s.hint : s.ownerOnly}
        error={error ? <>{error}{error === s.lastOwner && <span dir="ltr" translate="no" className="key ms-1.5 text-caption">hub.workspaces.last_owner</span>}</> : undefined}
      />
    </Modal>
  );
}

export function GithubDialog({ open, onClose, row }: { open: boolean; onClose: () => void; row: DirectoryRow }) {
  const t = useT(messages);
  const kit = useT(kitMessages);
  const locale = useLocale();
  const { me } = useSession();
  const s = t.githubDialog;
  const name = row.member.name[locale];
  const [text, setText] = useState(row.githubLogins.join(', '));
  const [tried, setTried] = useState(false);
  const logins = text.split(',').map((v) => v.trim()).filter(Boolean);
  const error = logins.some((l) => !LOGIN.test(l)) ? s.invalid : undefined;

  const save = () => {
    setTried(true);
    if (error) return;
    updateAdmin((state) => ({ ...state, directory: state.directory.map((d) => (d.member.id === row.member.id ? { ...d, githubLogins: logins } : d)) }));
    writeAudit({ action: 'members.github_logins.update', targetType: 'member', targetId: row.member.id, actorId: me.id, summary: { ar: `الحسابات: ${logins.join('، ') || 'لا شيء'}`, en: `Logins: ${logins.join(', ') || 'none'}` } });
    showToast({ message: fmt(s.saved, { name }) });
    onClose();
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
          <TextInput id="github-logins" dir="ltr" className={ltr} spellCheck={false} value={text} onChange={(e) => setText(e.target.value)} aria-invalid={tried && !!error} autoFocus />
        </Field>
      </form>
    </Modal>
  );
}

/** 09 §17: the current member's own row opens "Profile": display name, language, password, two-step sign-in. */
export function ProfileDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT(messages);
  const kit = useT(kitMessages);
  const locale = useLocale();
  const { scenario, me } = useSession();
  const { directory } = useAdmin(scenario);
  const s = t.profile;
  const row = directory.find((d) => d.member.id === me.id);
  const [name, setName] = useState(me.name[locale]);
  const [lang, setLang] = useState(locale);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [tried, setTried] = useState(false);
  const required = me.roles.some((r) => r === 'owner' || r === 'pm' || r === 'accountant');
  const nameError = !name.trim() ? s.nameRequired : undefined;
  const nextError = next && next.length < 12 ? s.tooShort : undefined;
  const currentError = next && !current ? s.needCurrent : undefined;

  const close = () => {
    setCurrent('');
    setNext('');
    setTried(false);
    onClose();
  };

  const save = () => {
    setTried(true);
    if (nameError || nextError || currentError) return;
    showToast({ message: s.saved });
    if (lang !== locale) setQuery({ lang });
    close();
  };

  const setTotp = (on: boolean) => {
    updateAdmin((state) => ({ ...state, directory: state.directory.map((d) => (d.member.id === me.id ? { ...d, totpEnabled: on } : d)) }));
    writeAudit({ action: on ? 'identity.totp.enable' : 'identity.totp.disable', targetType: 'member', targetId: me.id, actorId: me.id, summary: on ? { ar: 'فعّل التحقق بخطوتين', en: 'Turned on two-step sign-in' } : { ar: 'أوقف التحقق بخطوتين', en: 'Turned off two-step sign-in' } });
  };

  return (
    <Modal
      open={open}
      onOpenChange={(value) => !value && close()}
      title={s.title}
      footer={
        <>
          <Button onClick={close}>{kit.cancel}</Button>
          <Button variant="primary" onClick={save}>
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
            <TextInput id="profile-name" dir="auto" value={name} onChange={(e) => setName(e.target.value)} aria-invalid={tried && !!nameError} autoFocus />
          </Field>
          <Field id="profile-locale" label={s.locale}>
            <Select id="profile-locale" value={lang} onChange={(e) => setLang(e.target.value as typeof lang)}>
              <option value="ar">{s.arabic}</option>
              <option value="en">{s.english}</option>
            </Select>
          </Field>
        </div>
        <fieldset className="flex flex-col gap-3 border-t border-border pt-4">
          <legend className="float-start mb-1 text-body font-semibold text-foreground">{s.passwordTitle}</legend>
          <div className="clear-both grid gap-4 sm:grid-cols-2">
            <Field id="profile-current" label={s.current} error={tried ? currentError : undefined}>
              <TextInput id="profile-current" type="password" dir="ltr" className={ltr} autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
            </Field>
            <Field id="profile-next" label={s.next} error={tried ? nextError : undefined}>
              <TextInput id="profile-next" type="password" dir="ltr" className={ltr} autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
            </Field>
          </div>
        </fieldset>
        <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
          <div className="min-w-0 flex-1 basis-48">
            <p className="text-body font-semibold text-foreground">{s.totpTitle}</p>
            <p className="text-body-sm text-muted-foreground">
              {row?.totpEnabled ? s.totpOn : s.totpOff} {required && row?.totpEnabled ? s.totpRequired : ''}
            </p>
          </div>
          {row?.totpEnabled ? (
            !required && (
              <Button size="sm" onClick={() => setTotp(false)}>
                {s.totpDisable}
              </Button>
            )
          ) : (
            <Button size="sm" onClick={() => setTotp(true)}>
              {s.totpEnable}
            </Button>
          )}
        </div>
      </form>
    </Modal>
  );
}
