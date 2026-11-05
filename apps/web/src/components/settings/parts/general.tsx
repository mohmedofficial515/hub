'use client';

/**
 * @file general.tsx
 * @description Project details (docs/15 §5), close and reopen, and the project's settings (docs/09 §18.1). Ported from the approved
 * design. The draft holds only what the member has changed, so a field they have not touched follows an outside change live.
 */
import { type Role, ROLES } from '@hub/contracts';
import { ArrowDown, ArrowUp, Lock, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';

import {
  Bidi,
  Button,
  CardChip,
  cn,
  detectSecret,
  ErrorState,
  Field,
  fill,
  fmt,
  IconButton,
  kitMessages,
  Ltr,
  Modal,
  plural,
  RoleChecks,
  SecretFilterError,
  Select,
  showToast,
  SkeletonRows,
  Textarea,
  TextInput,
  Tooltip,
  useLocale,
  useSession,
  useT,
} from '@/components/kit';
import type { SettingsMessages } from '@/features/settings/messages';
import {
  type ProjectChanges,
  useProject,
  useSaveSettings,
  useSetProjectClosed,
  useSettingDefaults,
  useSettings,
  useUpdateProject,
} from '@/features/settings/queries';
import { isHubError } from '@/lib/api/errors';
import { useUnsavedGuard } from '@/lib/hooks';

import { FormSection, Segmented } from './shared';

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const ABSOLUTE = /^([A-Za-z]:[\\/]|\/)/;
const ltr = 'key text-start';
const DAYS = ['SAT', 'SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI'] as const;
type Day = (typeof DAYS)[number];

interface OnboardingItem {
  id: string;
  kind: 'doc' | 'card' | 'url' | 'action';
  title: string;
  ref: string;
}
type OnboardingPaths = Partial<Record<Role, OnboardingItem[]>>;

/** Everything the form edits, as the form holds it. */
interface Fields {
  name: string;
  timezone: string;
  defaultLocale: 'ar' | 'en';
  status: 'active' | 'paused';
  description: string;
  goals: string;
  links: { label: string; url: string }[];
  repoPaths: string;
  reminderOffsets: string;
  escalationHours: string;
  defaultDueDays: string;
  handoffStaleHours: string;
  needStaleDays: string;
  morningTime: string;
  weeklyDay: Day;
  weeklyTime: string;
  quietFrom: string;
  quietTo: string;
  totpRoles: Role[];
  onboarding: OnboardingPaths;
}

const positive = (v: string) => /^\d+$/.test(v.trim()) && Number(v) > 0;
const pathsOf = (text: string) =>
  text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

function timezones(current: string): string[] {
  const all = Intl.supportedValuesOf?.('timeZone') ?? [];
  return all.includes(current) ? all : [current, ...all];
}

function RoRow({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div>
      <p className="text-body-sm font-medium text-foreground">{label}</p>
      <p className="mt-1 flex items-center gap-1.5 text-body text-foreground">
        <Lock aria-hidden className="size-3.5 text-muted-foreground" strokeWidth={1.75} />
        <Ltr mono>{value}</Ltr>
      </p>
      <p className="mt-0.5 text-body-sm text-muted-foreground">{hint}</p>
    </div>
  );
}

/** Reading paths per role (09 §18.1): an ordered list you can reorder, trim and add to. */
function OnboardingEditor({
  value,
  onChange,
}: {
  value: OnboardingPaths;
  onChange: (next: OnboardingPaths) => void;
}) {
  const t = useT<SettingsMessages>('settings');
  const kit = useT(kitMessages);
  const s = t.general.onboarding;
  const [role, setRole] = useState<Role>('frontend');
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<OnboardingItem['kind']>('doc');
  const [ref, setRef] = useState('');
  const [tried, setTried] = useState(false);
  const items = value[role] ?? [];
  const secret = detectSecret(`${title} ${ref}`);
  const titleError = tried && !title.trim() ? s.titleRequired : undefined;
  const refError = tried && !ref.trim() ? s.refRequired : undefined;

  const write = (next: OnboardingItem[]) => onChange({ ...value, [role]: next });
  const move = (index: number, by: -1 | 1) => {
    const next = [...items];
    const [item] = next.splice(index, 1);
    if (item) next.splice(index + by, 0, item);
    write(next);
  };
  const add = () => {
    setTried(true);
    if (!title.trim() || !ref.trim() || secret) return;
    write([
      ...items,
      { id: `${role}-${Date.now().toString(36)}`, kind, title: title.trim(), ref: ref.trim() },
    ]);
    setTitle('');
    setRef('');
    setTried(false);
  };

  return (
    <>
      <Field id="onboarding-role" label={s.role}>
        <Select
          id="onboarding-role"
          className="sm:max-w-60"
          value={role}
          onChange={(e) => setRole(e.target.value as Role)}
        >
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {kit.roles[r]}
            </option>
          ))}
        </Select>
      </Field>
      {items.length > 0 && (
        <ol className="flex flex-col divide-y divide-border rounded-lg border border-border bg-card">
          {items.map((item, i) => (
            <li key={item.id} className="flex items-center gap-2 py-1.5 ps-3 pe-1.5">
              <span className="w-5 shrink-0 text-body-sm text-muted-foreground tabular-nums">
                <Ltr>{i + 1}</Ltr>
              </span>
              <div className="min-w-0 flex-1 py-1">
                <p className="text-body-sm text-foreground">
                  <Bidi>{item.title}</Bidi>
                </p>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-caption text-muted-foreground">
                  <span>{s.kinds[item.kind]}</span>
                  {item.kind === 'card' ? (
                    <CardChip k={item.ref} />
                  ) : (
                    <code dir="ltr" translate="no" className="key break-all">
                      {item.ref}
                    </code>
                  )}
                </div>
              </div>
              <span className="flex shrink-0 items-center">
                <IconButton
                  label={fmt(s.moveUp, { title: item.title })}
                  disabled={i === 0}
                  onClick={() => move(i, -1)}
                >
                  <ArrowUp aria-hidden className="size-4" strokeWidth={1.75} />
                </IconButton>
                <IconButton
                  label={fmt(s.moveDown, { title: item.title })}
                  disabled={i === items.length - 1}
                  onClick={() => move(i, 1)}
                >
                  <ArrowDown aria-hidden className="size-4" strokeWidth={1.75} />
                </IconButton>
                <IconButton
                  label={fmt(s.remove, { title: item.title })}
                  onClick={() => write(items.filter((x) => x.id !== item.id))}
                >
                  <Trash2 aria-hidden className="size-4" strokeWidth={1.75} />
                </IconButton>
              </span>
            </li>
          ))}
        </ol>
      )}
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_8rem]">
        <Field id="onboarding-title" label={s.itemTitle} error={titleError}>
          <TextInput
            id="onboarding-title"
            dir="auto"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            aria-invalid={!!titleError}
          />
        </Field>
        <Field id="onboarding-kind" label={s.kind}>
          <Select
            id="onboarding-kind"
            value={kind}
            onChange={(e) => setKind(e.target.value as OnboardingItem['kind'])}
          >
            {(['doc', 'card', 'url', 'action'] as const).map((k) => (
              <option key={k} value={k}>
                {s.kinds[k]}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Field id="onboarding-ref" label={s.ref} hint={s.refHint} error={refError}>
        <TextInput
          id="onboarding-ref"
          dir="ltr"
          className={ltr}
          value={ref}
          onChange={(e) => setRef(e.target.value)}
          aria-invalid={!!refError}
        />
      </Field>
      {secret && <SecretFilterError pattern={secret} />}
      <Button className="self-start" onClick={add}>
        {s.add}
      </Button>
    </>
  );
}

function CloseDialog({
  open,
  onOpenChange,
  slug,
  busy,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  slug: string;
  busy: boolean;
  onConfirm: () => void;
}) {
  const t = useT<SettingsMessages>('settings');
  const kit = useT(kitMessages);
  const s = t.general.close;
  const [typed, setTyped] = useState('');
  return (
    <Modal
      open={open}
      onOpenChange={(next) => {
        if (!next) setTyped('');
        onOpenChange(next);
      }}
      title={s.title}
      description={s.body}
      footer={
        <>
          <Button onClick={() => onOpenChange(false)}>{kit.cancel}</Button>
          <Button variant="destructive" busy={busy} disabled={typed !== slug} onClick={onConfirm}>
            {s.action}
          </Button>
        </>
      }
    >
      <Field id="close-slug" label={fill(s.typeSlug, { slug: <Ltr mono>{slug}</Ltr> })}>
        <TextInput
          id="close-slug"
          dir="ltr"
          className={ltr}
          autoComplete="off"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          autoFocus
        />
      </Field>
    </Modal>
  );
}

export function GeneralTab() {
  const t = useT<SettingsMessages>('settings');
  const locale = useLocale();
  const { isOwner } = useSession();
  const project = useProject();
  const settings = useSettings();
  const defaults = useSettingDefaults();
  const saveProject = useUpdateProject();
  const saveSettings = useSaveSettings();
  const setClosed = useSetProjectClosed();
  const s = t.general;
  const [overrides, setOverrides] = useState<Partial<Fields>>({});
  useUnsavedGuard(Object.keys(overrides).length > 0);
  const [closing, setClosing] = useState(false);

  const saved = useMemo<Fields | null>(() => {
    const p = project.data;
    const v = settings.data;
    if (!p || !v) return null;
    const quiet = v['notifications.quiet_hours'] as { from: string; to: string };
    const [day, at] = String(v['digest.weekly_day_time']).split(' ');
    return {
      name: p.name,
      timezone: p.timezone,
      defaultLocale: p.defaultLocale === 'en' ? 'en' : 'ar',
      status: p.status === 'paused' ? 'paused' : 'active',
      description: p.description ?? '',
      goals: p.goals ?? '',
      links: p.links,
      repoPaths: p.repoPaths.join('\n'),
      reminderOffsets: (v['decisions.reminder_offsets_hours'] as number[]).join(', '),
      escalationHours: String(v['decisions.escalation_hours']),
      defaultDueDays: String(v['decisions.default_due_days']),
      handoffStaleHours: String(v['handoffs.stale_hours']),
      needStaleDays: String(v['needs.stale_days']),
      morningTime: String(v['digest.morning_time']),
      weeklyDay: (day ?? 'SUN') as Day,
      weeklyTime: at ?? '08:00',
      quietFrom: quiet.from,
      quietTo: quiet.to,
      totpRoles: v['security.totp_required_roles'] as Role[],
      onboarding: v['onboarding.paths'] as OnboardingPaths,
    };
  }, [project.data, settings.data]);

  if (project.isError || settings.isError) {
    const error = project.error ?? settings.error;
    return (
      <ErrorState
        thing={t.errorThing}
        code={isHubError(error) ? error.code : undefined}
        requestId={isHubError(error) ? error.requestId : undefined}
        onRetry={() => {
          void project.refetch();
          void settings.refetch();
        }}
      />
    );
  }
  if (!saved || !project.data) return <SkeletonRows count={6} withAction={false} />;

  const draft: Fields = { ...saved, ...overrides };
  const set = <K extends keyof Fields>(key: K, value: Fields[K]) =>
    setOverrides((current) => ({ ...current, [key]: value }));
  const closed = project.data.status === 'closed';
  const slug = project.data.slug;

  const errors = {
    name: !draft.name.trim() ? s.nameRequired : undefined,
    links: draft.links.some((l) => !l.label.trim() || !URL.canParse(l.url)) ? s.urlInvalid : undefined,
    repoPaths: pathsOf(draft.repoPaths).some((p) => !ABSOLUTE.test(p) || p.includes('..'))
      ? s.pathInvalid
      : undefined,
    reminderOffsets: !draft.reminderOffsets.split(',').every((v) => positive(v))
      ? s.offsetsInvalid
      : undefined,
    escalationHours: !positive(draft.escalationHours) ? s.numberInvalid : undefined,
    defaultDueDays: !positive(draft.defaultDueDays) ? s.numberInvalid : undefined,
    handoffStaleHours: !positive(draft.handoffStaleHours) ? s.numberInvalid : undefined,
    needStaleDays: !positive(draft.needStaleDays) ? s.numberInvalid : undefined,
    morningTime: !TIME.test(draft.morningTime) ? s.timeInvalid : undefined,
    weeklyTime: !TIME.test(draft.weeklyTime) ? s.timeInvalid : undefined,
    quietFrom: !TIME.test(draft.quietFrom) ? s.timeInvalid : undefined,
    quietTo: !TIME.test(draft.quietTo) ? s.timeInvalid : undefined,
  };
  const changedKeys = (Object.keys(overrides) as (keyof Fields)[]).filter(
    (k) => JSON.stringify(draft[k]) !== JSON.stringify(saved[k]),
  );
  const changed = (k: keyof Fields) => changedKeys.includes(k);
  const hasError = Object.values(errors).some(Boolean);
  const secret = detectSecret(`${draft.description} ${draft.goals}`);
  const busy = saveProject.isPending || saveSettings.isPending;

  const save = async () => {
    if (hasError || secret) {
      const first = Object.entries(errors).find(([, e]) => e)?.[0];
      document.getElementById(`general-${first}`)?.focus();
      return;
    }
    const projectChanges: ProjectChanges = {
      ...(changed('name') ? { name: draft.name.trim() } : {}),
      ...(changed('timezone') ? { timezone: draft.timezone } : {}),
      ...(changed('defaultLocale') ? { defaultLocale: draft.defaultLocale } : {}),
      ...(changed('status') ? { status: draft.status } : {}),
      ...(changed('description') ? { description: draft.description || null } : {}),
      ...(changed('goals') ? { goals: draft.goals || null } : {}),
      ...(changed('links') ? { links: draft.links } : {}),
      ...(changed('repoPaths') ? { repoPaths: pathsOf(draft.repoPaths) } : {}),
    };
    const values: Record<string, unknown> = {
      ...(changed('reminderOffsets')
        ? { 'decisions.reminder_offsets_hours': draft.reminderOffsets.split(',').map(Number) }
        : {}),
      ...(changed('escalationHours') ? { 'decisions.escalation_hours': Number(draft.escalationHours) } : {}),
      ...(changed('defaultDueDays') ? { 'decisions.default_due_days': Number(draft.defaultDueDays) } : {}),
      ...(changed('handoffStaleHours') ? { 'handoffs.stale_hours': Number(draft.handoffStaleHours) } : {}),
      ...(changed('needStaleDays') ? { 'needs.stale_days': Number(draft.needStaleDays) } : {}),
      ...(changed('morningTime') ? { 'digest.morning_time': draft.morningTime } : {}),
      ...(changed('weeklyDay') || changed('weeklyTime')
        ? { 'digest.weekly_day_time': `${draft.weeklyDay} ${draft.weeklyTime}` }
        : {}),
      ...(changed('quietFrom') || changed('quietTo')
        ? { 'notifications.quiet_hours': { from: draft.quietFrom, to: draft.quietTo } }
        : {}),
      ...(changed('totpRoles') ? { 'security.totp_required_roles': draft.totpRoles } : {}),
      ...(changed('onboarding') ? { 'onboarding.paths': draft.onboarding } : {}),
    };
    try {
      if (Object.keys(projectChanges).length) await saveProject.mutateAsync(projectChanges);
      if (Object.keys(values).length) await saveSettings.mutateAsync(values);
      showToast({ message: plural(changedKeys.length, locale, s.savedForms) });
      setOverrides({});
    } catch (error) {
      showToast({ tone: 'error', message: isHubError(error) ? error.message : t.errorThing });
    }
  };

  /** The value stays one LTR run, so "24, 2" and "22:00" do not reorder inside an Arabic sentence. */
  const byDefault = (key: string, show: (value: unknown) => string = String) =>
    defaults[key] === undefined
      ? undefined
      : fill(s.defaultValue, { value: <Ltr className="tabular-nums">{show(defaults[key])}</Ltr> });

  /** Binds one text field to the draft and its error. */
  const bind = (key: keyof typeof errors & keyof Fields) => ({
    id: `general-${key}`,
    value: draft[key] as string,
    onChange: (e: { target: { value: string } }) => set(key, e.target.value as never),
    'aria-invalid': !!errors[key],
    dir: 'ltr' as const,
    className: ltr,
  });

  const defaultQuiet = defaults['notifications.quiet_hours'] as { from: string; to: string } | undefined;

  return (
    <>
      {closed && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card p-4">
          <Lock aria-hidden className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.75} />
          <p role="status" className="min-w-0 flex-1 basis-56 text-body-sm font-medium text-foreground">
            {s.project.closedBanner}
          </p>
          {isOwner && (
            <Button
              variant="primary"
              busy={setClosed.isPending}
              onClick={() =>
                setClosed.mutate(false, {
                  onSuccess: () => showToast({ message: s.project.reopened }),
                  onError: (error) =>
                    showToast({ tone: 'error', message: isHubError(error) ? error.message : t.errorThing }),
                })
              }
            >
              {s.project.reopen}
            </Button>
          )}
        </div>
      )}

      <FormSection title={s.project.title} description={s.project.body} className="border-t-0 pt-0">
        <Field id="general-name" label={s.project.name} error={errors.name} required>
          <TextInput
            id="general-name"
            dir="auto"
            value={draft.name}
            onChange={(e) => set('name', e.target.value)}
            aria-invalid={!!errors.name}
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <RoRow label={s.project.slug} value={slug} hint={s.project.slugHint} />
          <RoRow label={s.project.prefix} value={project.data.keyPrefix} hint={s.project.prefixHint} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="general-timezone" label={s.project.timezone}>
            <Select
              id="general-timezone"
              dir="ltr"
              value={draft.timezone}
              onChange={(e) => set('timezone', e.target.value)}
            >
              {timezones(draft.timezone).map((z) => (
                <option key={z} value={z}>
                  {z}
                </option>
              ))}
            </Select>
          </Field>
          <Field id="general-locale" label={s.project.locale}>
            <Select
              id="general-locale"
              value={draft.defaultLocale}
              onChange={(e) => set('defaultLocale', e.target.value as Fields['defaultLocale'])}
            >
              <option value="ar">{s.project.arabic}</option>
              <option value="en">{s.project.english}</option>
            </Select>
          </Field>
        </div>
        {!closed && (
          <div className="flex flex-col gap-1.5">
            <p className="text-body-sm font-medium text-foreground">{s.project.status}</p>
            <Segmented
              legend={s.project.status}
              value={draft.status}
              onChange={(next) => set('status', next)}
              options={[
                { value: 'active', label: s.project.statusLabel.active },
                { value: 'paused', label: s.project.statusLabel.paused },
              ]}
            />
            <p className="text-body-sm text-muted-foreground">{s.project.statusHint}</p>
          </div>
        )}
      </FormSection>

      <FormSection title={s.project.detailsTitle} description={s.project.detailsBody}>
        <Field id="general-description" label={s.project.description} hint={s.project.descriptionHint}>
          <Textarea
            id="general-description"
            dir="auto"
            rows={4}
            value={draft.description}
            onChange={(e) => set('description', e.target.value)}
          />
        </Field>
        <Field id="general-goals" label={s.project.goals} hint={s.project.goalsHint}>
          <Textarea
            id="general-goals"
            dir="auto"
            rows={3}
            value={draft.goals}
            onChange={(e) => set('goals', e.target.value)}
          />
        </Field>
        {secret && <SecretFilterError pattern={secret} />}
        <div className="flex flex-col gap-2">
          <p
            id="general-links"
            tabIndex={-1}
            className="text-body-sm font-medium text-foreground outline-none"
          >
            {s.project.links}
          </p>
          {draft.links.map((link, i) => (
            <div key={i} className="grid items-end gap-2 sm:grid-cols-[10rem_minmax(0,1fr)_auto]">
              <Field id={`general-link-label-${i}`} label={s.project.linkLabel}>
                <TextInput
                  id={`general-link-label-${i}`}
                  dir="auto"
                  value={link.label}
                  onChange={(e) =>
                    set(
                      'links',
                      draft.links.map((l, j) => (j === i ? { ...l, label: e.target.value } : l)),
                    )
                  }
                />
              </Field>
              <Field id={`general-link-url-${i}`} label={s.project.linkUrl}>
                <TextInput
                  id={`general-link-url-${i}`}
                  type="url"
                  dir="ltr"
                  className={ltr}
                  value={link.url}
                  onChange={(e) =>
                    set(
                      'links',
                      draft.links.map((l, j) => (j === i ? { ...l, url: e.target.value } : l)),
                    )
                  }
                />
              </Field>
              <IconButton
                label={fmt(s.project.removeLink, { label: link.label })}
                onClick={() =>
                  set(
                    'links',
                    draft.links.filter((_, j) => j !== i),
                  )
                }
              >
                <Trash2 aria-hidden className="size-4" strokeWidth={1.75} />
              </IconButton>
            </div>
          ))}
          {errors.links && (
            <p role="alert" className="text-body-sm font-medium text-destructive-soft-foreground">
              {errors.links}
            </p>
          )}
          <Button
            size="sm"
            className="self-start"
            onClick={() => set('links', [...draft.links, { label: '', url: '' }])}
          >
            {s.project.addLink}
          </Button>
        </div>
        <Field
          id="general-repoPaths"
          label={s.project.repoPaths}
          hint={s.project.repoPathsHint}
          error={errors.repoPaths}
        >
          <Textarea
            id="general-repoPaths"
            dir="ltr"
            rows={3}
            className={ltr}
            spellCheck={false}
            value={draft.repoPaths}
            onChange={(e) => set('repoPaths', e.target.value)}
            aria-invalid={!!errors.repoPaths}
          />
        </Field>
      </FormSection>

      <FormSection title={s.security.title} description={s.security.body}>
        <RoleChecks
          legend={s.security.roles}
          hint={s.security.hint}
          value={draft.totpRoles}
          onChange={(next) => set('totpRoles', next)}
        />
      </FormSection>

      <FormSection title={s.decisions.title} description={s.decisions.body}>
        <Field
          id="general-reminderOffsets"
          label={s.decisions.reminders}
          hint={byDefault('decisions.reminder_offsets_hours', (v) => (v as number[]).join(', '))}
          error={errors.reminderOffsets}
        >
          <TextInput {...bind('reminderOffsets')} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            id="general-escalationHours"
            label={s.decisions.escalation}
            hint={byDefault('decisions.escalation_hours')}
            error={errors.escalationHours}
          >
            <TextInput inputMode="numeric" {...bind('escalationHours')} />
          </Field>
          <Field
            id="general-defaultDueDays"
            label={s.decisions.dueDays}
            hint={byDefault('decisions.default_due_days')}
            error={errors.defaultDueDays}
          >
            <TextInput inputMode="numeric" {...bind('defaultDueDays')} />
          </Field>
        </div>
      </FormSection>

      <FormSection title={s.staleness.title} description={s.staleness.body}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            id="general-handoffStaleHours"
            label={s.staleness.handoff}
            hint={byDefault('handoffs.stale_hours')}
            error={errors.handoffStaleHours}
          >
            <TextInput inputMode="numeric" {...bind('handoffStaleHours')} />
          </Field>
          <Field
            id="general-needStaleDays"
            label={s.staleness.need}
            hint={byDefault('needs.stale_days')}
            error={errors.needStaleDays}
          >
            <TextInput inputMode="numeric" {...bind('needStaleDays')} />
          </Field>
        </div>
      </FormSection>

      <FormSection title={s.digests.title} description={s.digests.body}>
        <Field
          id="general-morningTime"
          label={s.digests.morning}
          hint={byDefault('digest.morning_time')}
          error={errors.morningTime}
          className="sm:max-w-[calc(50%-0.5rem)]"
        >
          <TextInput {...bind('morningTime')} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            id="general-weeklyDay"
            label={s.digests.weeklyDay}
            hint={byDefault('digest.weekly_day_time')}
          >
            <Select
              id="general-weeklyDay"
              value={draft.weeklyDay}
              onChange={(e) => set('weeklyDay', e.target.value as Day)}
            >
              {DAYS.map((d) => (
                <option key={d} value={d}>
                  {s.digests.days[d]}
                </option>
              ))}
            </Select>
          </Field>
          <Field id="general-weeklyTime" label={s.digests.weeklyTime} error={errors.weeklyTime}>
            <TextInput {...bind('weeklyTime')} />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            id="general-quietFrom"
            label={s.digests.quietFrom}
            hint={
              defaultQuiet &&
              byDefault('notifications.quiet_hours', () => `${defaultQuiet.from} – ${defaultQuiet.to}`)
            }
            error={errors.quietFrom}
          >
            <TextInput {...bind('quietFrom')} />
          </Field>
          <Field id="general-quietTo" label={s.digests.quietTo} error={errors.quietTo}>
            <TextInput {...bind('quietTo')} />
          </Field>
        </div>
      </FormSection>

      <FormSection title={s.onboarding.title} description={s.onboarding.body}>
        <OnboardingEditor value={draft.onboarding} onChange={(next) => set('onboarding', next)} />
      </FormSection>

      {!closed && (
        <FormSection title={s.close.sectionTitle} description={s.close.sectionBody}>
          <div>
            {isOwner ? (
              <Button variant="destructive" onClick={() => setClosing(true)}>
                {s.close.action}
              </Button>
            ) : (
              <Tooltip content={s.close.ownerOnly}>
                <span
                  tabIndex={0}
                  aria-label={s.close.ownerOnly}
                  className="inline-flex rounded-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  <Button variant="destructive" disabled tabIndex={-1}>
                    {s.close.action}
                  </Button>
                </span>
              </Tooltip>
            )}
          </div>
        </FormSection>
      )}

      <CloseDialog
        open={closing}
        onOpenChange={setClosing}
        slug={slug}
        busy={setClosed.isPending}
        onConfirm={() =>
          setClosed.mutate(true, {
            onSuccess: () => {
              setClosing(false);
              showToast({ message: s.close.done });
            },
            onError: (error) =>
              showToast({ tone: 'error', message: isHubError(error) ? error.message : t.errorThing }),
          })
        }
      />

      <div
        className={cn(
          'sticky bottom-4 z-20 flex flex-wrap items-center gap-3 rounded-lg border border-border bg-popover p-3 shadow-md',
          changedKeys.length === 0 && 'hidden',
        )}
      >
        <p role="status" className="min-w-0 flex-1 basis-40 text-body-sm font-medium text-foreground">
          {changedKeys.length > 0 && plural(changedKeys.length, locale, s.unsaved)}
        </p>
        <Button variant="ghost" onClick={() => setOverrides({})}>
          {s.discard}
        </Button>
        <Button variant="primary" busy={busy} onClick={() => void save()}>
          {s.save}
        </Button>
      </div>
    </>
  );
}
