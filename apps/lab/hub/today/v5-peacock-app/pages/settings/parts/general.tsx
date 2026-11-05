import { useState } from 'react';
import { ArrowDown, ArrowUp, Lock, Trash2 } from 'lucide-react';
import { useLocale, useT } from '@lab/i18n';
import type { Role } from '@lab/mocks/hub-app';
import { ROLES, settingDefaults, timezones, type GeneralSettings, type OnboardingItem } from '@lab/mocks/hub-app/settings';
import { Bidi, Button, CardChip, cn, detectSecret, Field, fill, fmt, IconButton, kitMessages, Ltr, Modal, plural, SecretFilterError, Select, showToast, TextInput, Tooltip, updateAdmin, useAdmin, useSession, writeAudit } from '../../../kit';
import { messages } from '../i18n';
import { FormSection } from './shared';

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const ltr = 'key text-start';

interface Draft extends Omit<GeneralSettings, 'reminderOffsets' | 'escalationHours' | 'defaultDueDays' | 'handoffStaleHours' | 'needStaleDays'> {
  reminderOffsets: string;
  escalationHours: string;
  defaultDueDays: string;
  handoffStaleHours: string;
  needStaleDays: string;
}

const toDraft = (g: GeneralSettings): Draft => ({
  ...g,
  reminderOffsets: g.reminderOffsets.join(', '),
  escalationHours: String(g.escalationHours),
  defaultDueDays: String(g.defaultDueDays),
  handoffStaleHours: String(g.handoffStaleHours),
  needStaleDays: String(g.needStaleDays),
});

const positive = (v: string) => /^\d+$/.test(v.trim()) && Number(v) > 0;

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
function OnboardingEditor({ value, onChange }: { value: Record<Role, OnboardingItem[]>; onChange: (next: Record<Role, OnboardingItem[]>) => void }) {
  const t = useT(messages);
  const kit = useT(kitMessages);
  const locale = useLocale();
  const s = t.general.onboarding;
  const [role, setRole] = useState<Role>('frontend');
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<OnboardingItem['kind']>('doc');
  const [ref, setRef] = useState('');
  const [tried, setTried] = useState(false);
  const items = value[role];
  const secret = detectSecret(`${title} ${ref}`);
  const titleError = tried && !title.trim() ? s.titleRequired : undefined;
  const refError = tried && !ref.trim() ? s.refRequired : undefined;

  const write = (next: OnboardingItem[]) => onChange({ ...value, [role]: next });
  const move = (index: number, by: -1 | 1) => {
    const next = [...items];
    const [item] = next.splice(index, 1);
    next.splice(index + by, 0, item);
    write(next);
  };
  const add = () => {
    setTried(true);
    if (!title.trim() || !ref.trim() || secret) return;
    write([...items, { id: `o-new-${items.length}-${ref.trim()}`, kind, title: { ar: title.trim(), en: title.trim() }, ref: ref.trim() }]);
    setTitle('');
    setRef('');
    setTried(false);
  };

  return (
    <>
      <Field id="onboarding-role" label={s.role}>
        <Select id="onboarding-role" className="sm:max-w-60" value={role} onChange={(e) => setRole(e.target.value as Role)}>
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {kit.roles[r]}
            </option>
          ))}
        </Select>
      </Field>
      <ol className="flex flex-col divide-y divide-border rounded-lg border border-border bg-card">
        {items.map((item, i) => (
          <li key={item.id} className="flex items-center gap-2 py-1.5 ps-3 pe-1.5">
            <span className="w-5 shrink-0 text-body-sm text-muted-foreground tabular-nums">
              <Ltr>{i + 1}</Ltr>
            </span>
            <div className="min-w-0 flex-1 py-1">
              <p className="text-body-sm text-foreground">
                <Bidi>{item.title[locale]}</Bidi>
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
              <IconButton label={fmt(s.moveUp, { title: item.title[locale] })} disabled={i === 0} onClick={() => move(i, -1)}>
                <ArrowUp aria-hidden className="size-4" strokeWidth={1.75} />
              </IconButton>
              <IconButton label={fmt(s.moveDown, { title: item.title[locale] })} disabled={i === items.length - 1} onClick={() => move(i, 1)}>
                <ArrowDown aria-hidden className="size-4" strokeWidth={1.75} />
              </IconButton>
              <IconButton label={fmt(s.remove, { title: item.title[locale] })} onClick={() => write(items.filter((x) => x.id !== item.id))}>
                <Trash2 aria-hidden className="size-4" strokeWidth={1.75} />
              </IconButton>
            </span>
          </li>
        ))}
      </ol>
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_8rem]">
        <Field id="onboarding-title" label={s.itemTitle} error={titleError}>
          <TextInput id="onboarding-title" dir="auto" value={title} onChange={(e) => setTitle(e.target.value)} aria-invalid={!!titleError} />
        </Field>
        <Field id="onboarding-kind" label={s.kind}>
          <Select id="onboarding-kind" value={kind} onChange={(e) => setKind(e.target.value as OnboardingItem['kind'])}>
            {(['doc', 'card', 'url', 'action'] as const).map((k) => (
              <option key={k} value={k}>
                {s.kinds[k]}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Field id="onboarding-ref" label={s.ref} hint={s.refHint} error={refError}>
        <TextInput id="onboarding-ref" dir="ltr" className={ltr} value={ref} onChange={(e) => setRef(e.target.value)} aria-invalid={!!refError} />
      </Field>
      {secret && <SecretFilterError pattern={secret} />}
      <Button className="self-start" onClick={add}>
        {s.add}
      </Button>
    </>
  );
}

function ArchiveDialog({ open, onOpenChange, slug, onConfirm }: { open: boolean; onOpenChange: (open: boolean) => void; slug: string; onConfirm: () => void }) {
  const t = useT(messages);
  const kit = useT(kitMessages);
  const [typed, setTyped] = useState('');
  return (
    <Modal
      open={open}
      onOpenChange={(next) => {
        if (!next) setTyped('');
        onOpenChange(next);
      }}
      title={t.general.archive.title}
      description={t.general.archive.body}
      footer={
        <>
          <Button onClick={() => onOpenChange(false)}>{kit.cancel}</Button>
          <Button variant="destructive" disabled={typed !== slug} onClick={onConfirm}>
            {t.general.archive.action}
          </Button>
        </>
      }
    >
      <Field id="archive-slug" label={fill(t.general.archive.typeSlug, { slug: <Ltr mono>{slug}</Ltr> })}>
        <TextInput id="archive-slug" dir="ltr" className={ltr} autoComplete="off" value={typed} onChange={(e) => setTyped(e.target.value)} autoFocus />
      </Field>
    </Modal>
  );
}

export function GeneralTab() {
  const t = useT(messages);
  const locale = useLocale();
  const { scenario, me, isOwner } = useSession();
  const { general } = useAdmin(scenario);
  const s = t.general;
  const [draft, setDraft] = useState<Draft>(() => toDraft(general));
  const [archiving, setArchiving] = useState(false);
  const saved = toDraft(general);
  /** The value stays one LTR run, so "24, 2" and "22:00 – 07:00" do not reorder inside an Arabic sentence. */
  const byDefault = (value: string | number) => fill(s.defaultValue, { value: <Ltr className="tabular-nums">{value}</Ltr> });
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value }));

  const errors = {
    name: !draft.name[locale].trim() ? s.nameRequired : undefined,
    reminderOffsets: !draft.reminderOffsets.split(',').every((v) => positive(v)) ? s.offsetsInvalid : undefined,
    escalationHours: !positive(draft.escalationHours) ? s.numberInvalid : undefined,
    defaultDueDays: !positive(draft.defaultDueDays) ? s.numberInvalid : undefined,
    handoffStaleHours: !positive(draft.handoffStaleHours) ? s.numberInvalid : undefined,
    needStaleDays: !positive(draft.needStaleDays) ? s.numberInvalid : undefined,
    morningTime: !TIME.test(draft.morningTime) ? s.timeInvalid : undefined,
    weeklyTime: !TIME.test(draft.weeklyTime) ? s.timeInvalid : undefined,
    quietFrom: !TIME.test(draft.quietFrom) ? s.timeInvalid : undefined,
    quietTo: !TIME.test(draft.quietTo) ? s.timeInvalid : undefined,
  };
  const changed = (Object.keys(draft) as (keyof Draft)[]).filter((k) => JSON.stringify(draft[k]) !== JSON.stringify(saved[k]));
  const hasError = Object.values(errors).some(Boolean);

  const save = () => {
    if (hasError) {
      const first = Object.entries(errors).find(([, e]) => e)?.[0];
      document.getElementById(`general-${first}`)?.focus();
      return;
    }
    const next: GeneralSettings = {
      ...draft,
      reminderOffsets: draft.reminderOffsets.split(',').map((v) => Number(v)),
      escalationHours: Number(draft.escalationHours),
      defaultDueDays: Number(draft.defaultDueDays),
      handoffStaleHours: Number(draft.handoffStaleHours),
      needStaleDays: Number(draft.needStaleDays),
    };
    updateAdmin((state) => ({ ...state, general: next }));
    writeAudit({ action: 'settings.update', targetType: 'setting', targetId: changed.join(', '), actorId: me.id, summary: { ar: 'عدّل إعدادات مساحة العمل', en: 'Updated workspace settings' } });
    showToast({ message: plural(changed.length, locale, s.savedForms) });
  };

  /** Binds one text field to the draft, its error and its hint. */
  const bind = (key: keyof typeof errors & keyof Draft, extra?: { ltr?: boolean }) => ({
    id: `general-${key}`,
    value: draft[key] as string,
    onChange: (e: { target: { value: string } }) => set(key, e.target.value as never),
    'aria-invalid': !!errors[key],
    'aria-describedby': errors[key] ? `general-${key}-error` : undefined,
    dir: extra?.ltr ? ('ltr' as const) : undefined,
    className: extra?.ltr ? ltr : undefined,
  });

  return (
    <>
      <FormSection title={s.workspace.title} description={s.workspace.body} className="border-t-0 pt-0">
        <Field id="general-name" label={s.workspace.name} error={errors.name} required>
          <TextInput
            id="general-name"
            dir="auto"
            value={draft.name[locale]}
            onChange={(e) => set('name', { ...draft.name, [locale]: e.target.value })}
            aria-invalid={!!errors.name}
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <RoRow label={s.workspace.slug} value={draft.slug} hint={s.workspace.slugHint} />
          <RoRow label={s.workspace.prefix} value={draft.keyPrefix} hint={s.workspace.prefixHint} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="general-timezone" label={s.workspace.timezone}>
            <Select id="general-timezone" dir="ltr" value={draft.timezone} onChange={(e) => set('timezone', e.target.value)}>
              {timezones.map((z) => (
                <option key={z} value={z}>
                  {z}
                </option>
              ))}
            </Select>
          </Field>
          <Field id="general-locale" label={s.workspace.locale}>
            <Select id="general-locale" value={draft.defaultLocale} onChange={(e) => set('defaultLocale', e.target.value as Draft['defaultLocale'])}>
              <option value="ar">{s.workspace.arabic}</option>
              <option value="en">{s.workspace.english}</option>
            </Select>
          </Field>
        </div>
      </FormSection>

      <FormSection title={s.decisions.title} description={s.decisions.body}>
        <Field id="general-reminderOffsets" label={s.decisions.reminders} hint={byDefault(settingDefaults.reminderOffsets)} error={errors.reminderOffsets}>
          <TextInput {...bind('reminderOffsets', { ltr: true })} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="general-escalationHours" label={s.decisions.escalation} hint={byDefault(settingDefaults.escalationHours)} error={errors.escalationHours}>
            <TextInput inputMode="numeric" {...bind('escalationHours', { ltr: true })} />
          </Field>
          <Field id="general-defaultDueDays" label={s.decisions.dueDays} hint={byDefault(settingDefaults.defaultDueDays)} error={errors.defaultDueDays}>
            <TextInput inputMode="numeric" {...bind('defaultDueDays', { ltr: true })} />
          </Field>
        </div>
      </FormSection>

      <FormSection title={s.staleness.title} description={s.staleness.body}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="general-handoffStaleHours" label={s.staleness.handoff} hint={byDefault(settingDefaults.handoffStaleHours)} error={errors.handoffStaleHours}>
            <TextInput inputMode="numeric" {...bind('handoffStaleHours', { ltr: true })} />
          </Field>
          <Field id="general-needStaleDays" label={s.staleness.need} hint={byDefault(settingDefaults.needStaleDays)} error={errors.needStaleDays}>
            <TextInput inputMode="numeric" {...bind('needStaleDays', { ltr: true })} />
          </Field>
        </div>
      </FormSection>

      <FormSection title={s.digests.title} description={s.digests.body}>
        <Field id="general-morningTime" label={s.digests.morning} hint={byDefault(settingDefaults.morningTime)} error={errors.morningTime} className="sm:max-w-[calc(50%-0.5rem)]">
          <TextInput {...bind('morningTime', { ltr: true })} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="general-weeklyDay" label={s.digests.weeklyDay} hint={byDefault(`${s.digests.days.SUN} 08:00`)}>
            <Select id="general-weeklyDay" value={draft.weeklyDay} onChange={(e) => set('weeklyDay', e.target.value as Draft['weeklyDay'])}>
              {(['SAT', 'SUN', 'MON'] as const).map((d) => (
                <option key={d} value={d}>
                  {s.digests.days[d]}
                </option>
              ))}
            </Select>
          </Field>
          <Field id="general-weeklyTime" label={s.digests.weeklyTime} error={errors.weeklyTime}>
            <TextInput {...bind('weeklyTime', { ltr: true })} />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="general-quietFrom" label={s.digests.quietFrom} hint={byDefault(settingDefaults.quietHours)} error={errors.quietFrom}>
            <TextInput {...bind('quietFrom', { ltr: true })} />
          </Field>
          <Field id="general-quietTo" label={s.digests.quietTo} error={errors.quietTo}>
            <TextInput {...bind('quietTo', { ltr: true })} />
          </Field>
        </div>
      </FormSection>

      <FormSection title={s.onboarding.title} description={s.onboarding.body}>
        <OnboardingEditor value={draft.onboarding} onChange={(next) => set('onboarding', next)} />
      </FormSection>

      <FormSection title={s.archive.sectionTitle} description={s.archive.sectionBody}>
        <div>
          {isOwner ? (
            <Button variant="destructive" onClick={() => setArchiving(true)}>
              {s.archive.action}
            </Button>
          ) : (
            <Tooltip content={s.archive.ownerOnly}>
              <span tabIndex={0} aria-label={s.archive.ownerOnly} className="inline-flex rounded-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
                <Button variant="destructive" disabled>
                  {s.archive.action}
                </Button>
              </span>
            </Tooltip>
          )}
        </div>
      </FormSection>

      <ArchiveDialog
        open={archiving}
        onOpenChange={setArchiving}
        slug={draft.slug}
        onConfirm={() => {
          setArchiving(false);
          writeAudit({ action: 'workspace.archive', targetType: 'workspace', targetId: draft.slug, actorId: me.id, summary: { ar: 'طلب أرشفة مساحة العمل', en: 'Asked to archive the workspace' } });
          showToast({ message: s.archive.labDone });
        }}
      />

      <div className={cn('sticky bottom-4 z-20 flex flex-wrap items-center gap-3 rounded-lg border border-border bg-popover p-3 shadow-md', changed.length === 0 && 'hidden')}>
        <p role="status" className="min-w-0 flex-1 basis-40 text-body-sm font-medium text-foreground">
          {changed.length > 0 && plural(changed.length, locale, s.unsaved)}
        </p>
        <Button variant="ghost" onClick={() => setDraft(saved)}>
          {s.discard}
        </Button>
        <Button variant="primary" onClick={save}>
          {s.save}
        </Button>
      </div>
    </>
  );
}
