'use client';

/**
 * @file members-page.tsx
 * @description Ported from the approved design, pages/members. Contract: apps/web/README.md.
 */
import { ROLES } from '@hub/contracts';
import {
  CircleSlash,
  KeyRound,
  Link2,
  Search,
  ShieldAlert,
  ShieldCheck,
  Tags,
  UserPlus,
  UserRound,
  Users,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import {
  Avatar,
  Button,
  cn,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  FilterBar,
  fmt,
  focusRing,
  kitMessages,
  LoadingRegion,
  Ltr,
  PageContainer,
  PageHeader,
  Pill,
  plural,
  RelativeTime,
  type Role,
  RoleBadge,
  roleIcon,
  RowMenu,
  SectionHeader,
  setQuery,
  showToast,
  SkeletonRows,
  useFilter,
  useKeyboardList,
  useLocale,
  usePageWide,
  useRoute,
  useSession,
  useT,
} from '@/components/kit';
import type { MembersMessages } from '@/features/members/messages';
import { type DirectoryRow, useDirectory, useInvites, useMemberWrites } from '@/features/members/queries';
import { useSettings } from '@/features/settings/queries';
import { isHubError } from '@/lib/api/errors';

import { GithubDialog, InviteDialog, ProfileDialog, RolesDialog, ShownOnceDialog } from './parts/dialogs';
import { Invites } from './parts/invites';

type Dialog =
  | { kind: 'invite' }
  | { kind: 'profile' }
  | { kind: 'roles' | 'github' | 'disable'; id: string }
  | { kind: 'link'; title: string; body: string; link: string }
  | null;

function Identity({ row, mine, showEmail }: { row: DirectoryRow; mine: boolean; showEmail: boolean }) {
  const t = useT<MembersMessages>('members');
  const online = row.status === 'active' && row.member.online;
  return (
    <div className="flex min-w-0 items-center gap-3">
      <Avatar member={row.member} size="md" online={online} />
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-x-2 text-body font-medium text-foreground">
          <span className="min-w-0">{row.member.name}</span>
          {mine && <Pill tone="muted">{t.you}</Pill>}
          {online && <span className="sr-only">{t.online}</span>}
        </p>
        {showEmail && (
          <p
            dir="ltr"
            translate="no"
            className="key truncate text-start text-caption text-muted-foreground rtl:text-end"
          >
            {row.email}
          </p>
        )}
      </div>
    </div>
  );
}

function Github({ row, canEdit, onMap }: { row: DirectoryRow; canEdit: boolean; onMap: () => void }) {
  const t = useT<MembersMessages>('members');
  if (row.githubLogins.length > 0) {
    return (
      <span className="flex flex-wrap gap-x-2 gap-y-0.5">
        {row.githubLogins.map((login) => (
          <Ltr key={login} mono className="text-caption text-foreground">
            {login}
          </Ltr>
        ))}
      </span>
    );
  }
  if (!canEdit) return <span className="text-body-sm text-muted-foreground">{t.noGithub}</span>;
  return (
    <button
      type="button"
      title={t.noGithubHint}
      onClick={onMap}
      className={cn(
        'hit-44 rounded-sm text-body-sm text-primary-text underline-offset-4 hover:underline',
        focusRing,
      )}
    >
      {t.mapGithub}
    </button>
  );
}

export function MembersPage() {
  const t = useT<MembersMessages>('members');
  const kit = useT(kitMessages);
  const locale = useLocale();
  const { me, isManager } = useSession();
  const directoryQuery = useDirectory();
  const invitesQuery = useInvites(isManager);
  const directory = directoryQuery.data ?? [];
  const invites = invitesQuery.data ?? [];
  const totpRoles = useSettings().data?.['security.totp_required_roles'] as Role[] | undefined;
  const writes = useMemberWrites();
  const loading = directoryQuery.isPending;
  const error = directoryQuery.isError;
  const { query } = useRoute();
  const wide = usePageWide(768);
  const role = useFilter('role') as Role | null;
  const q = (useFilter('q') ?? '').trim().toLowerCase();
  const [dialog, setDialog] = useState<Dialog>(null);
  const heading = useRef<HTMLHeadingElement>(null);

  // The shell's "Profile" item can deep-link here: `?profile=me` (09 §17: the own row opens the profile).
  useEffect(() => {
    if (query.get('profile') === 'me') {
      setDialog({ kind: 'profile' });
      setQuery({ profile: null });
    }
  }, [query]);

  const active = directory.filter((d) => d.status === 'active');
  const disabled = directory.filter((d) => d.status === 'disabled');
  const rows = active.filter(
    (d) =>
      (!role || d.roles.includes(role)) &&
      (!q ||
        d.member.name.toLowerCase().includes(q) ||
        (isManager && d.email.toLowerCase().includes(q)) ||
        d.githubLogins.some((l) => l.toLowerCase().includes(q))),
  );

  const openRow = (id: string) => {
    if (id === me.id) setDialog({ kind: 'profile' });
    else if (isManager) setDialog({ kind: 'roles', id });
  };
  const list = useKeyboardList({
    ids: rows.map((d) => d.member.id),
    onOpen: openRow,
    emptyFocusRef: heading,
  });

  const target = dialog && 'id' in dialog ? directory.find((d) => d.member.id === dialog.id) : undefined;
  const targetName = target?.member.name ?? '';

  const refused = (cause: unknown) =>
    showToast({ tone: 'error', message: isHubError(cause) ? cause.message : t.errorThing });

  const setStatus = (row: DirectoryRow, enabled: boolean) => {
    const { name } = row.member;
    writes.setEnabled.mutate(
      { id: row.member.id, enabled },
      {
        onSuccess: () => showToast({ message: fmt(enabled ? t.enabled : t.disableDialog.done, { name }) }),
        onError: refused,
      },
    );
  };

  const menuFor = (row: DirectoryRow) => {
    const name = row.member.name;
    const mine = row.member.id === me.id;
    if (!isManager && !mine) return null;
    return (
      <RowMenu
        label={fmt(t.menu.label, { name })}
        items={[
          ...(mine
            ? [{ label: t.menu.profile, icon: UserRound, onSelect: () => setDialog({ kind: 'profile' }) }]
            : []),
          ...(isManager
            ? [
                {
                  label: t.menu.roles,
                  icon: Tags,
                  onSelect: () => setDialog({ kind: 'roles', id: row.member.id }),
                },
                {
                  label: t.menu.github,
                  icon: Link2,
                  onSelect: () => setDialog({ kind: 'github', id: row.member.id }),
                },
                {
                  label: t.menu.reset,
                  icon: KeyRound,
                  onSelect: () =>
                    writes.resetLink.mutate(row.member.id, {
                      onSuccess: ({ url }) =>
                        setDialog({
                          kind: 'link',
                          title: t.resetDialog.title,
                          body: fmt(t.resetDialog.body, { name }),
                          link: url,
                        }),
                      onError: refused,
                    }),
                },
                ...(!mine
                  ? [
                      // A disabled account also loses its sessions and tokens, which the API does on its own.
                      {
                        label: t.menu.disable,
                        icon: CircleSlash,
                        onSelect: () => setDialog({ kind: 'disable', id: row.member.id }),
                        destructive: true,
                      },
                    ]
                  : []),
              ]
            : []),
        ]}
      />
    );
  };

  const soleMember = !loading && active.length <= 1 && invites.length === 0;
  const header = (
    <PageHeader
      title={t.title}
      meta={loading || error ? undefined : plural(active.length, locale, t.meta)}
      actions={
        // On a page with nobody else, inviting is the next step, and the empty state below carries it (review M8).
        isManager && !error && !soleMember ? (
          <Button disabled={loading} onClick={() => setDialog({ kind: 'invite' })}>
            <UserPlus aria-hidden className="size-4" strokeWidth={1.75} />
            {t.invite}
          </Button>
        ) : undefined
      }
    />
  );

  if (error) {
    return (
      <PageContainer>
        {header}
        <ErrorState
          thing={t.errorThing}
          code={isHubError(directoryQuery.error) ? directoryQuery.error.code : undefined}
          requestId={isHubError(directoryQuery.error) ? directoryQuery.error.requestId : undefined}
          onRetry={() => void directoryQuery.refetch()}
        />
      </PageContainer>
    );
  }

  if (loading) {
    return (
      <PageContainer>
        {header}
        <LoadingRegion label={t.loading}>
          <SkeletonRows count={7} withAction={false} />
        </LoadingRegion>
      </PageContainer>
    );
  }

  const twoFactorGap = (row: DirectoryRow) =>
    isManager && !row.totpEnabled && row.roles.some((r) => (totpRoles ?? []).includes(r));

  return (
    <PageContainer>
      {header}

      {isManager && invites.length > 0 && (
        <Invites
          invites={invites}
          onLink={(title, body, link) => setDialog({ kind: 'link', title, body, link })}
        />
      )}

      <section aria-labelledby="roster-title" className="flex flex-col gap-3">
        <SectionHeader ref={heading} id="roster-title" icon={Users} title={t.roster} count={rows.length} />
        <FilterBar
          searchParam="q"
          searchPlaceholder={t.search}
          groups={[
            {
              param: 'role',
              label: t.rolesFilter,
              options: ROLES.map((r) => {
                const Icon = roleIcon[r];
                return {
                  value: r,
                  label: kit.roles[r],
                  icon: <Icon aria-hidden className="size-3.5" strokeWidth={1.75} />,
                };
              }),
            },
          ]}
        />
        {rows.length === 0 ? (
          <EmptyState
            icon={Search}
            title={t.noMatchTitle}
            action={<Button onClick={() => setQuery({ role: null, q: null })}>{t.noMatchAction}</Button>}
          >
            {t.noMatchBody}
          </EmptyState>
        ) : wide ? (
          <div data-hub-list className="overflow-hidden rounded-lg border border-border bg-card">
            <table className="w-full table-fixed text-body-sm">
              <thead>
                <tr className="text-muted-foreground">
                  <th scope="col" className="w-[38%] border-b border-border px-4 py-2 text-start font-medium">
                    {t.col.name}
                  </th>
                  <th scope="col" className="border-b border-border px-3 py-2 text-start font-medium">
                    {t.col.roles}
                  </th>
                  <th scope="col" className="w-[17%] border-b border-border px-3 py-2 text-start font-medium">
                    {t.col.github}
                  </th>
                  <th scope="col" className="w-28 border-b border-border px-3 py-2 text-start font-medium">
                    {t.col.lastSeen}
                  </th>
                  <th scope="col" className="w-12 border-b border-border p-0">
                    <span className="sr-only">{t.col.actions}</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((row) => (
                  <tr
                    key={row.member.id}
                    {...list.rowProps(row.member.id)}
                    className="outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
                  >
                    <td className="px-4 py-2.5">
                      <Identity row={row} mine={row.member.id === me.id} showEmail={isManager} />
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="flex flex-wrap items-center gap-1">
                        {row.roles.map((r) => (
                          <RoleBadge key={r} role={r} />
                        ))}
                        {twoFactorGap(row) && (
                          <Pill tone="warning" icon={ShieldAlert}>
                            {t.twoFactorMissing}
                          </Pill>
                        )}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <Github
                        row={row}
                        canEdit={isManager}
                        onMap={() => setDialog({ kind: 'github', id: row.member.id })}
                      />
                    </td>
                    <td className="px-3 py-2.5 text-foreground">
                      {row.member.online ? (
                        t.online
                      ) : row.lastSeenAt ? (
                        <RelativeTime iso={row.lastSeenAt} />
                      ) : (
                        <span className="text-muted-foreground">{t.neverSeen}</span>
                      )}
                    </td>
                    <td className="py-1.5 pe-1.5 text-end">{menuFor(row)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <ul
            data-hub-list
            className="flex flex-col divide-y divide-border rounded-lg border border-border bg-card"
          >
            {rows.map((row) => (
              <li
                key={row.member.id}
                {...list.rowProps(row.member.id)}
                className="flex flex-col gap-2 py-3 ps-4 pe-2 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
              >
                <div className="flex items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <Identity row={row} mine={row.member.id === me.id} showEmail={isManager} />
                  </div>
                  {menuFor(row)}
                </div>
                <span className="flex flex-wrap items-center gap-1">
                  {row.roles.map((r) => (
                    <RoleBadge key={r} role={r} />
                  ))}
                  {twoFactorGap(row) && (
                    <Pill tone="warning" icon={ShieldAlert}>
                      {t.twoFactorMissing}
                    </Pill>
                  )}
                </span>
                <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 pe-2 text-body-sm text-muted-foreground">
                  <Github
                    row={row}
                    canEdit={isManager}
                    onMap={() => setDialog({ kind: 'github', id: row.member.id })}
                  />
                  <span>
                    {row.member.online ? (
                      t.online
                    ) : row.lastSeenAt ? (
                      <RelativeTime iso={row.lastSeenAt} />
                    ) : (
                      t.neverSeen
                    )}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* With nobody waiting there is nothing to act on, so this no longer leads the page. */}
      {isManager && invites.length === 0 && (
        <EmptyState
          icon={UserPlus}
          title={t.invites.emptyTitle}
          action={
            soleMember ? (
              <Button variant="primary" onClick={() => setDialog({ kind: 'invite' })}>
                <UserPlus aria-hidden className="size-4" strokeWidth={1.75} />
                {t.invite}
              </Button>
            ) : undefined
          }
        >
          {soleMember ? t.invites.emptyBodySole : t.invites.emptyBody}
        </EmptyState>
      )}

      {isManager && disabled.length > 0 && (
        <section aria-labelledby="disabled-title" className="flex flex-col gap-2 border-t border-border pt-6">
          <SectionHeader
            id="disabled-title"
            level={3}
            icon={CircleSlash}
            title={t.disabledTitle}
            count={disabled.length}
          />
          <ul className="flex flex-col gap-2">
            {disabled.map((row) => (
              <li key={row.member.id} className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <Avatar member={row.member} size="sm" />
                <span className="text-body-sm text-foreground">{row.member.name}</span>
                {isManager && (
                  <Button size="sm" variant="ghost" className="ms-auto" onClick={() => setStatus(row, true)}>
                    <ShieldCheck aria-hidden className="size-4" strokeWidth={1.75} />
                    {t.enable}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <InviteDialog open={dialog?.kind === 'invite'} onClose={() => setDialog(null)} />
      <ProfileDialog open={dialog?.kind === 'profile'} onClose={() => setDialog(null)} />
      {target && (
        <RolesDialog
          key={`roles-${target.member.id}`}
          open={dialog?.kind === 'roles'}
          onClose={() => setDialog(null)}
          row={target}
        />
      )}
      {target && (
        <GithubDialog
          key={`github-${target.member.id}`}
          open={dialog?.kind === 'github'}
          onClose={() => setDialog(null)}
          row={target}
        />
      )}
      <ShownOnceDialog
        open={dialog?.kind === 'link'}
        onClose={() => setDialog(null)}
        title={dialog?.kind === 'link' ? dialog.title : ''}
        description={dialog?.kind === 'link' ? dialog.body : ''}
        link={dialog?.kind === 'link' ? dialog.link : ''}
      />
      <ConfirmDialog
        open={dialog?.kind === 'disable'}
        onOpenChange={(open) => !open && setDialog(null)}
        title={fmt(t.disableDialog.title, { name: targetName })}
        description={t.disableDialog.body}
        confirmLabel={t.disableDialog.action}
        onConfirm={() => target && setStatus(target, false)}
      />
    </PageContainer>
  );
}
