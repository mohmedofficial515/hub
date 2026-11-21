import { Fragment, useState } from 'react';
import { Bot, Check, ChevronDown, Minus, ShieldCheck, UserRound } from 'lucide-react';
import { useLocale, useT } from '@lab/i18n';
import type { Role } from '@lab/mocks/hub-app';
import { permissionMatrix, ROLES, roleNotes, specialtyMapSeed, type PermissionCell, type PermissionRow, type Specialty } from '@lab/mocks/hub-app/settings';
import { Avatar, Button, cn, Field, fmt, focusRingInset, kitMessages, roleIcon, RoleChecks, SectionHeader, Select, showToast, updateAdmin, useAdmin, useMedia, useSession, writeAudit } from '../../../kit';
import { messages } from '../i18n';

const GROUPS: PermissionRow['group'][] = ['create', 'edit', 'tasks', 'decisions', 'needs', 'handoffs', 'redesign', 'cards', 'workspace'];
const SPECIALTIES: Specialty[] = ['backend', 'frontend', 'design', 'qa', 'ops', 'docs'];

/** Never colour alone: ✓ and – are shapes, and each condition is its letter with the meaning in `title` and for screen readers. */
function Cell({ cell, wide = false }: { cell: PermissionCell; wide?: boolean }) {
  const t = useT(messages);
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
      <span aria-hidden translate="no" className="key inline-flex size-5 items-center justify-center rounded-sm border border-border bg-muted text-caption font-medium">
        {cell}
      </span>
      <span className={wide ? 'text-body-sm' : 'sr-only'}>{word}</span>
    </span>
  );
}

function Legend() {
  const t = useT(messages);
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-body-sm text-muted-foreground">
      {(['y', 'R', 'S', 'A', 'C', 'T', 'n'] as const).map((cell) => (
        <li key={cell}>
          <Cell cell={cell} wide />
        </li>
      ))}
      <li className="inline-flex items-center gap-1.5">
        <UserRound aria-hidden className="size-4" strokeWidth={1.75} />
        {t.roles.humanOnly}
      </li>
      <li className="inline-flex items-center gap-1.5">
        <Bot aria-hidden className="size-4" strokeWidth={1.75} />
        {t.roles.viaMcp}
      </li>
    </ul>
  );
}

function FullMatrix() {
  const t = useT(messages);
  const kit = useT(kitMessages);
  const locale = useLocale();
  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card">
      <table className="w-full min-w-180 text-body-sm">
        <thead>
          <tr className="text-muted-foreground">
            <th scope="col" className="sticky start-0 z-10 border-b border-border bg-card px-3 py-2 text-start font-medium">
              {t.roles.action}
            </th>
            {ROLES.map((role) => (
              <th key={role} scope="col" className="border-b border-border px-2 py-2 text-center font-medium whitespace-nowrap">
                {kit.roles[role]}
              </th>
            ))}
            <th scope="col" className="border-b border-border px-2 py-2 text-center font-medium">
              <span className="sr-only">{t.roles.humanOnly}</span>
              <UserRound aria-hidden className="mx-auto size-4" strokeWidth={1.75} />
            </th>
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
                <th colSpan={ROLES.length + 3} scope="colgroup" className="border-b border-border bg-muted px-3 py-1 text-start font-medium text-foreground">
                  {t.roles.groups[group]}
                </th>
              </tr>
              {permissionMatrix
                .filter((row) => row.group === group)
                .map((row) => (
                  <tr key={row.label.en} className="border-b border-border last:border-b-0">
                    <th scope="row" className="sticky start-0 z-10 bg-card px-3 py-1.5 text-start font-normal text-foreground">
                      {row.label[locale]}
                    </th>
                    {row.cells.map((cell, i) => (
                      <td key={ROLES[i]} className="px-2 py-1.5 text-center">
                        <Cell cell={cell} />
                      </td>
                    ))}
                    <td className="px-2 py-1.5 text-center">
                      {row.humanOnly ? <Check aria-label={t.roles.humanOnly} className="mx-auto size-4 text-foreground" strokeWidth={2.25} /> : <span className="sr-only">-</span>}
                    </td>
                    <td className="px-2 py-1.5 text-center">
                      {row.mcp ? <Check aria-label={t.roles.viaMcp} className="mx-auto size-4 text-foreground" strokeWidth={2.25} /> : <span className="sr-only">-</span>}
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
  const t = useT(messages);
  const kit = useT(kitMessages);
  const locale = useLocale();
  const [role, setRole] = useState<Role>('frontend');
  const index = ROLES.indexOf(role);
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
            <h4 className="border-b border-border bg-muted px-3 py-1 text-body-sm font-medium text-foreground">{t.roles.groups[group]}</h4>
            <ul className="flex flex-col divide-y divide-border">
              {permissionMatrix
                .filter((row) => row.group === group)
                .map((row) => (
                  <li key={row.label.en} className="flex items-center gap-3 border-b border-border px-3 py-2 last:border-b-0">
                    <span className="min-w-0 flex-1 text-body-sm text-foreground">
                      {row.label[locale]}
                      {row.humanOnly && <UserRound aria-label={t.roles.humanOnly} className="ms-1.5 inline size-3.5 text-muted-foreground" strokeWidth={1.75} />}
                    </span>
                    <span className="shrink-0 text-body-sm">
                      <Cell cell={row.cells[index]} />
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

function SpecialtyMap() {
  const t = useT(messages);
  const kit = useT(kitMessages);
  const { scenario, me } = useSession();
  const { specialtyMap } = useAdmin(scenario);
  const locale = useLocale();
  const wide = useMedia('(min-width: 768px)');
  const [draft, setDraft] = useState(specialtyMap);
  const dirty = JSON.stringify(draft) !== JSON.stringify(specialtyMap);
  const empty = SPECIALTIES.some((s) => draft[s].length === 0);
  return (
    <section aria-labelledby="specialty-title" className="flex flex-col gap-3 border-t border-border pt-6">
      <SectionHeader id="specialty-title" title={t.roles.specialtyTitle} />
      <p className="max-w-prose text-body-sm text-muted-foreground">{t.roles.specialtyBody}</p>
      <ul className="flex flex-col divide-y divide-border rounded-lg border border-border bg-card">
        {SPECIALTIES.map((specialty) => {
          const label = kit.sheet.task.specialties[specialty];
          const checks = <RoleChecks compact legend={fmt(t.roles.specialtyLegend, { specialty: label })} value={draft[specialty]} onChange={(next) => setDraft((d) => ({ ...d, [specialty]: next }))} error={draft[specialty].length === 0 ? t.roles.specialtyEmpty : undefined} />;
          return wide ? (
            <li key={specialty} className="grid grid-cols-[7rem_minmax(0,1fr)] items-center gap-x-4 p-3">
              <p className="text-body-sm font-medium text-foreground">{label}</p>
              {checks}
            </li>
          ) : (
            // Seven checkboxes times six rows is four screens on a phone, so each row states its roles and opens to change them.
            <li key={specialty}>
              <details className="group">
                <summary className={cn('flex min-h-11 cursor-pointer list-none items-center gap-3 px-3 py-2 [&::-webkit-details-marker]:hidden', focusRingInset)}>
                  <span className="text-body-sm font-medium text-foreground">{label}</span>
                  <span className="min-w-0 flex-1 text-body-sm text-muted-foreground">{draft[specialty].map((r) => kit.roles[r]).join(locale === 'ar' ? '، ' : ', ') || t.roles.noHolders}</span>
                  <ChevronDown aria-hidden className="size-4 shrink-0 text-muted-foreground transition-transform duration-150 group-open:rotate-180 motion-reduce:transition-none" strokeWidth={1.75} />
                </summary>
                <div className="px-3 pb-3">{checks}</div>
              </details>
            </li>
          );
        })}
      </ul>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="primary"
          disabled={!dirty || empty}
          onClick={() => {
            updateAdmin((state) => ({ ...state, specialtyMap: draft }));
            writeAudit({ action: 'settings.update', targetType: 'setting', targetId: 'tasks.specialty_roles', actorId: me.id, summary: { ar: 'عدّل ربط التخصصات بالأدوار', en: 'Changed the specialty to role mapping' } });
            showToast({ message: t.roles.specialtySaved });
          }}
        >
          {t.roles.specialtySave}
        </Button>
        <Button variant="ghost" disabled={JSON.stringify(draft) === JSON.stringify(specialtyMapSeed)} onClick={() => setDraft(specialtyMapSeed)}>
          {t.roles.specialtyReset}
        </Button>
      </div>
    </section>
  );
}

export function RolesTab() {
  const t = useT(messages);
  const kit = useT(kitMessages);
  const locale = useLocale();
  const { scenario } = useSession();
  const { directory } = useAdmin(scenario);
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
                <Icon aria-hidden className="mt-0.5 size-4.5 shrink-0 text-muted-foreground" strokeWidth={1.75} />
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                    <span className="text-body font-semibold text-foreground">{kit.roles[role]}</span>
                    <span className="flex items-center gap-1" aria-label={holders.length ? holders.map((h) => h.member.name[locale]).join(locale === 'ar' ? '، ' : ', ') : t.roles.noHolders}>
                      {holders.map((h) => (
                        <span key={h.member.id} title={h.member.name[locale]}>
                          <Avatar member={h.member} size="xs" />
                        </span>
                      ))}
                      {holders.length === 0 && <span className="text-body-sm text-muted-foreground">{t.roles.noHolders}</span>}
                    </span>
                  </p>
                  <p className="mt-0.5 text-body-sm text-muted-foreground">{roleNotes[role][locale]}</p>
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
