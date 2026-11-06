'use client';

/**
 * @file roles.tsx
 * @description Ported from the approved design, pages/settings/parts/roles.tsx, on the real API. Contract: apps/web/README.md.
 */
import {
  type Grant,
  grantFor,
  type PermissionAction,
  type Role,
  ROLES,
  SPECIALTIES,
  SPECIALTY_ROLES,
  surfaceOf,
} from '@hub/contracts';
import { Bot, Check, Minus, ShieldCheck } from 'lucide-react';
import { Fragment, useState } from 'react';

import {
  Avatar,
  cn,
  Field,
  kitMessages,
  roleIcon,
  SectionHeader,
  Select,
  useLocale,
  useMedia,
  useT,
} from '@/components/kit';
import { useDirectory } from '@/features/members/queries';
import type { SettingsMessages } from '@/features/settings/messages';

type Group = keyof SettingsMessages['roles']['groups'];

/** The rows of the matrix. The grants come from `@hub/contracts`, the table the API enforces, so the page cannot disagree with it. */
const MATRIX_ROWS: Record<Group, PermissionAction[]> = {
  create: [
    'task.create',
    'decision.create',
    'need.create',
    'handoff.create',
    'release.create',
    'idea.create',
    'plan.create',
  ],
  edit: ['card.edit_content', 'card.edit_routing'],
  tasks: ['task.claim', 'task.start', 'task.cancel', 'task.edit_detail'],
  decisions: [
    'decision.edit_options',
    'decision.decide',
    'decision.withdraw',
    'decision.supersede',
    'decision.draft_adr',
  ],
  needs: ['need.start', 'need.verify', 'need.cancel'],
  handoffs: ['handoff.acknowledge', 'handoff.apply'],
  redesign: [
    'redesign.send_to_review',
    'redesign.approve',
    'redesign.request_changes',
    'redesign.mark_ported',
  ],
  planning: ['plan.approve'],
  cards: [
    'release.release',
    'card.delete',
    'card.comment',
    'card.report_work',
    'card.comment_redact',
    'card.read',
    'card.read_deleted',
  ],
  workspace: [
    'member.invite',
    'project.update',
    'project.close',
    'settings.write',
    'source.manage',
    'audit.read',
    'token.manage',
  ],
};
const GROUPS = Object.keys(MATRIX_ROWS) as Group[];
type RowId = keyof SettingsMessages['roles']['rows'];

/** The catalog's words for a grant. */
const CELL: Record<Grant, keyof SettingsMessages['roles']['cells']> = {
  Y: 'y',
  N: 'n',
  R: 'R',
  S: 'S',
  A: 'A',
  C: 'C',
  V: 'V',
};

/** Never colour alone: ✓ and – are shapes, and each condition is its letter with the meaning in `title` and for screen readers. */
function Cell({ cell, wide = false }: { cell: keyof SettingsMessages['roles']['cells']; wide?: boolean }) {
  const t = useT<SettingsMessages>('settings');
  const word = t.roles.cells[cell];
  if (cell === 'y')
    return (
      <span title={word} className="inline-flex items-center gap-1.5 text-foreground">
        <Check aria-hidden className="size-4" strokeWidth={2.25} />
        <span className={wide ? 'text-body-sm' : 'sr-only'}>{word}</span>
      </span>
    );
  if (cell === 'n')
    return (
      <span title={word} className="inline-flex items-center gap-1.5 text-muted-foreground">
        <Minus aria-hidden className="size-4" strokeWidth={1.75} />
        <span className={wide ? 'text-body-sm' : 'sr-only'}>{word}</span>
      </span>
    );
  return (
    <span title={word} className="inline-flex items-center gap-1.5 text-foreground">
      <span
        aria-hidden
        translate="no"
        className="key inline-flex size-5 items-center justify-center rounded-sm border border-border bg-muted text-caption font-medium"
      >
        {cell}
      </span>
      <span className={wide ? 'text-body-sm' : 'sr-only'}>{word}</span>
    </span>
  );
}

function Legend() {
  const t = useT<SettingsMessages>('settings');
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-body-sm text-muted-foreground">
      {(['y', 'R', 'S', 'A', 'C', 'V', 'n'] as const).map((cell) => (
        <li key={cell}>
          <Cell cell={cell} wide />
        </li>
      ))}
      <li className="inline-flex items-center gap-1.5">
        <Bot aria-hidden className="size-4" strokeWidth={1.75} />
        {t.roles.viaMcp}
      </li>
    </ul>
  );
}

function FullMatrix() {
  const t = useT<SettingsMessages>('settings');
  const kit = useT(kitMessages);
  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card">
      <table className="w-full min-w-180 text-body-sm">
        <thead>
          <tr className="text-muted-foreground">
            <th
              scope="col"
              className="sticky start-0 z-10 border-b border-border bg-card px-3 py-2 text-start font-medium"
            >
              {t.roles.action}
            </th>
            {ROLES.map((role) => (
              <th
                key={role}
                scope="col"
                className="border-b border-border px-2 py-2 text-center font-medium whitespace-nowrap"
              >
                {kit.roles[role]}
              </th>
            ))}
            <th scope="col" className="border-b border-border px-2 py-2 text-center font-medium">
              <span className="sr-only">{t.roles.viaMcp}</span>
              <Bot aria-hidden className="mx-auto size-4" strokeWidth={1.75} />
            </th>
          </tr>
        </thead>
        <tbody>
          {GROUPS.map((group) => (
            <Fragment key={group}>
              <tr>
                <th
                  colSpan={ROLES.length + 2}
                  scope="colgroup"
                  className="border-b border-border bg-muted px-3 py-1 text-start font-medium text-foreground"
                >
                  {t.roles.groups[group]}
                </th>
              </tr>
              {MATRIX_ROWS[group].map((action) => (
                <tr key={action} className="border-b border-border last:border-b-0">
                  <th
                    scope="row"
                    className="sticky start-0 z-10 bg-card px-3 py-1.5 text-start font-normal text-foreground"
                  >
                    {t.roles.rows[action.replace('.', '_') as RowId]}
                  </th>
                  {ROLES.map((role) => (
                    <td key={role} className="px-2 py-1.5 text-center">
                      <Cell cell={CELL[grantFor(action, role)]} />
                    </td>
                  ))}
                  <td className="px-2 py-1.5 text-center">
                    {surfaceOf(action) === 'any' ? (
                      <Check
                        aria-label={t.roles.viaMcp}
                        className="mx-auto size-4 text-foreground"
                        strokeWidth={2.25}
                      />
                    ) : (
                      <span className="sr-only">-</span>
                    )}
                  </td>
                </tr>
              ))}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** A 9-column matrix cannot be read on a phone, so a phone asks one question at a time: what can this role do? */
function OneRoleMatrix() {
  const t = useT<SettingsMessages>('settings');
  const kit = useT(kitMessages);
  const [role, setRole] = useState<Role>('frontend');
  return (
    <div className="flex flex-col gap-3">
      <Field id="roles-pick" label={t.roles.pickRole}>
        <Select id="roles-pick" value={role} onChange={(e) => setRole(e.target.value as Role)}>
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {kit.roles[r]}
            </option>
          ))}
        </Select>
      </Field>
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        {GROUPS.map((group) => (
          <section key={group} aria-label={t.roles.groups[group]}>
            <h4 className="border-b border-border bg-muted px-3 py-1 text-body-sm font-medium text-foreground">
              {t.roles.groups[group]}
            </h4>
            <ul className="flex flex-col divide-y divide-border">
              {MATRIX_ROWS[group].map((action) => (
                <li
                  key={action}
                  className="flex items-center gap-3 border-b border-border px-3 py-2 last:border-b-0"
                >
                  <span className="min-w-0 flex-1 text-body-sm text-foreground">
                    {t.roles.rows[action.replace('.', '_') as RowId]}
                  </span>
                  <span className="shrink-0 text-body-sm">
                    <Cell cell={CELL[grantFor(action, role)]} />
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}

/** The fixed mapping from `@hub/contracts`. It is read-only: the catalogue has no such setting in this release. */
function SpecialtyMap() {
  const t = useT<SettingsMessages>('settings');
  const kit = useT(kitMessages);
  const locale = useLocale();
  return (
    <section aria-labelledby="specialty-title" className="flex flex-col gap-3 border-t border-border pt-6">
      <SectionHeader id="specialty-title" title={t.roles.specialtyTitle} />
      <p className="max-w-prose text-body-sm text-muted-foreground">{t.roles.specialtyBody}</p>
      <ul className="flex flex-col divide-y divide-border rounded-lg border border-border bg-card">
        {SPECIALTIES.map((specialty) => (
          <li key={specialty} className="flex flex-wrap items-center gap-x-4 gap-y-1 p-3">
            <p className="w-28 text-body-sm font-medium text-foreground">
              {kit.sheet.task.specialties[specialty]}
            </p>
            <p className="min-w-0 flex-1 text-body-sm text-muted-foreground">
              {SPECIALTY_ROLES[specialty].map((r) => kit.roles[r]).join(locale === 'ar' ? '، ' : ', ')}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function RolesTab() {
  const t = useT<SettingsMessages>('settings');
  const kit = useT(kitMessages);
  const locale = useLocale();
  const directory = useDirectory().data ?? [];
  const wide = useMedia('(min-width: 768px)');
  const active = directory.filter((d) => d.status === 'active');
  return (
    <>
      <section aria-labelledby="roles-title" className="flex flex-col gap-3">
        <SectionHeader id="roles-title" icon={ShieldCheck} title={t.roles.title} />
        <ul className="grid gap-x-8 sm:grid-cols-2">
          {ROLES.map((role) => {
            const Icon = roleIcon[role];
            const holders = active.filter((d) => d.roles.includes(role));
            return (
              <li key={role} className="flex gap-3 border-b border-border py-3">
                <Icon
                  aria-hidden
                  className="mt-0.5 size-4.5 shrink-0 text-muted-foreground"
                  strokeWidth={1.75}
                />
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                    <span className="text-body font-semibold text-foreground">{kit.roles[role]}</span>
                    <span
                      className="flex items-center gap-1"
                      aria-label={
                        holders.length
                          ? holders.map((h) => h.member.name).join(locale === 'ar' ? '، ' : ', ')
                          : t.roles.noHolders
                      }
                    >
                      {holders.map((h) => (
                        <span key={h.member.id} title={h.member.name}>
                          <Avatar member={h.member} size="xs" />
                        </span>
                      ))}
                      {holders.length === 0 && (
                        <span className="text-body-sm text-muted-foreground">{t.roles.noHolders}</span>
                      )}
                    </span>
                  </p>
                  <p className="mt-0.5 text-body-sm text-muted-foreground">{t.roles.notes[role]}</p>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-labelledby="matrix-title" className={cn('flex flex-col gap-3')}>
        <SectionHeader id="matrix-title" title={t.roles.matrixTitle} level={3} />
        <p className="max-w-prose text-body-sm text-muted-foreground">{t.roles.matrixBody}</p>
        <Legend />
        {wide ? <FullMatrix /> : <OneRoleMatrix />}
      </section>

      <SpecialtyMap />
    </>
  );
}
