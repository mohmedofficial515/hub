'use client';

/**
 * @file skills-page.tsx
 * @description The Skills page (docs/16 §11, D64 to D66), in Hub's own style. Hub's skills first: each with when Claude uses it, how a person types it, and the devices that have
 * its current text; the owner creates and edits them, and Hub's own protocols are marked and read only. Then the owner's personal skills, read only, each with Move to Hub. The plugin
 * each device took is one neutral card at the top, with Sync now. Neutral cards throughout, with the state in an icon and a word, never a coloured edge.
 */
import type { PluginDevice, SkillSource, SkillSummary } from '@hub/contracts';
import { isAllowed } from '@hub/contracts';
import {
  AlertTriangle,
  CheckCircle2,
  CircleDashed,
  Copy,
  FolderLock,
  Laptop,
  Pencil,
  Plus,
  RefreshCw,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  Button,
  cn,
  EmptyState,
  ErrorState,
  fill,
  fmt,
  LoadingRegion,
  Ltr,
  PageContainer,
  PageHeader,
  Pill,
  plural,
  RelativeTime,
  SectionHeader,
  setQuery,
  showToast,
  Skeleton,
  SkeletonRows,
  Tip,
  useLocale,
  useRoute,
  useSession,
  useT,
} from '@/components/kit';
import { useSkill, useSkills, useSyncSkills } from '@/features/skills/queries';
import { isHubError } from '@/lib/api/errors';

import { MoveDialog } from './move-dialog';
import { SkillEditor } from './skill-editor';
import { SkillView } from './skill-view';
import type { SkillsMessages } from './words';

/** Names joined the way the language joins them: «أ، ب و ج», "a, b and c". */
const listOf = (names: string[], locale: 'ar' | 'en') =>
  new Intl.ListFormat(locale, { style: 'long', type: 'conjunction' }).format(names);

const counted = (n: number, locale: 'ar' | 'en', forms: Parameters<typeof plural>[2]) =>
  fmt(plural(n, locale, forms), { n });

/** The plugin each device took, as one card. */
function DevicesCard({
  devices,
  version,
  mode,
}: {
  devices: readonly PluginDevice[];
  version: string;
  mode: 'auto' | 'manual';
}) {
  const t = useT<SkillsMessages>('skills').devices;
  return (
    <section
      aria-labelledby="skills-devices"
      data-skills-devices
      className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4"
    >
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <h2 id="skills-devices" className="text-body font-semibold text-foreground">
          {t.title}
        </h2>
        <p className="min-w-0 text-body-sm text-muted-foreground wrap-anywhere">
          {fill(t.version, {
            version: (
              <span className="inline-block">
                <Ltr mono>{version}</Ltr>
              </span>
            ),
          })}
        </p>
      </div>
      <p className="text-body-sm text-muted-foreground">{mode === 'manual' ? t.manual : t.auto}</p>
      {devices.length === 0 ? (
        <p className="text-body-sm text-foreground">{t.none}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {devices.map((device) => {
            const state = device.error
              ? 'failed'
              : device.current
                ? 'current'
                : device.version
                  ? 'behind'
                  : 'never';
            const Icon =
              state === 'current' ? CheckCircle2 : state === 'failed' ? AlertTriangle : CircleDashed;
            const tone =
              state === 'current'
                ? 'text-success-soft-foreground'
                : state === 'failed'
                  ? 'text-destructive-soft-foreground'
                  : 'text-warning-strong';
            return (
              <li
                key={device.id}
                data-skills-device={device.id}
                data-skills-device-state={state}
                className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1 py-2"
              >
                <Laptop aria-hidden className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.75} />
                <span className="min-w-0 text-body font-medium text-foreground">{device.name}</span>
                <span className="text-body-sm text-muted-foreground">
                  {device.online ? t.online : t.offline}
                </span>
                <span className={cn('inline-flex min-w-0 items-center gap-1 text-body-sm', tone)}>
                  <Icon aria-hidden className="size-4 shrink-0" strokeWidth={2} />
                  <span className="min-w-0 wrap-anywhere">
                    {state === 'failed' ? fmt(t.failed, { error: device.error ?? '' }) : t[state]}
                  </span>
                </span>
                {device.syncedAt && (
                  <span className="text-body-sm text-muted-foreground">
                    {fill(t.syncedAt, { when: <RelativeTime iso={device.syncedAt} /> })}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <p className="text-body-sm text-muted-foreground">{t.restart}</p>
    </section>
  );
}

function HubSkillRow({
  skill,
  owner,
  onRead,
  onEdit,
  busy = false,
}: {
  skill: SkillSummary;
  owner: boolean;
  onRead: () => void;
  onEdit: () => void;
  /** Its full text is on the way for the editor. */
  busy?: boolean | undefined;
}) {
  const t = useT<SkillsMessages>('skills').hub;
  const locale = useLocale();
  const synced = skill.devices.filter((device) => device.synced);
  const total = skill.devices.length;
  const reach =
    total === 0
      ? t.noDevices
      : synced.length === total
        ? t.onAll
        : synced.length === 0
          ? t.onNone
          : fmt(plural(total, locale, t.on), { n: synced.length, total });
  const command = `/hub:${skill.name}`;
  return (
    <li
      data-skill={skill.name}
      data-skill-core={skill.core || undefined}
      className="flex h-full min-w-0 flex-col gap-3 rounded-lg border border-border bg-card p-4"
    >
      <div className="flex min-w-0 flex-1 items-start gap-2.5">
        {skill.core ? (
          <ShieldCheck
            aria-hidden
            className="mt-0.5 size-5 shrink-0 text-muted-foreground"
            strokeWidth={1.75}
          />
        ) : (
          <Sparkles aria-hidden className="mt-0.5 size-5 shrink-0 text-primary" strokeWidth={1.75} />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-body font-medium text-foreground">
              <Ltr mono>{skill.name}</Ltr>
            </span>
            {skill.core && (
              <Tip content={{ what: t.coreTip }} align="start">
                <span tabIndex={0} className="rounded-full">
                  <Pill icon={ShieldCheck}>{t.core}</Pill>
                </span>
              </Tip>
            )}
          </div>
          <p dir="auto" className="mt-0.5 line-clamp-3 text-body-sm text-foreground">
            {skill.description}
          </p>
          <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-body-sm text-muted-foreground">
            <span>
              {skill.userInvocable ? fill(t.typed, { command: <Ltr mono>{command}</Ltr> }) : t.background}
            </span>
            <Tip
              content={{
                what: reach,
                ...(synced.length > 0
                  ? {
                      detail: fmt(t.onTip, {
                        names: listOf(
                          synced.map((d) => d.name),
                          locale,
                        ),
                      }),
                    }
                  : {}),
              }}
              align="start"
            >
              <span
                tabIndex={0}
                data-skill-reach={`${synced.length}/${total}`}
                className="inline-flex items-center gap-1 rounded-sm"
              >
                <Laptop aria-hidden className="size-3.5" strokeWidth={1.75} />
                {reach}
              </span>
            </Tip>
            {skill.files > 1 && <span>{counted(skill.files, locale, t.files)}</span>}
            {skill.updatedAt && <RelativeTime iso={skill.updatedAt} />}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5 border-t border-border pt-3">
        <Button size="sm" variant="ghost" data-skill-read onClick={onRead}>
          {t.view}
        </Button>
        {owner && !skill.core && (
          <Button size="sm" variant="ghost" busy={busy} data-skill-edit onClick={onEdit}>
            <Pencil aria-hidden className="size-3.5" strokeWidth={1.75} />
            {t.edit}
          </Button>
        )}
      </div>
    </li>
  );
}

function PersonalSkillRow({
  skill,
  onRead,
  onMove,
}: {
  skill: SkillSummary;
  onRead: () => void;
  onMove: () => void;
}) {
  const t = useT<SkillsMessages>('skills').personal;
  const hub = useT<SkillsMessages>('skills').hub;
  const locale = useLocale();
  return (
    <li
      data-personal-skill={skill.name}
      className="flex h-full min-w-0 flex-col gap-3 rounded-lg border border-border bg-card p-4"
    >
      <div className="flex min-w-0 flex-1 items-start gap-2.5">
        <FolderLock aria-hidden className="mt-0.5 size-5 shrink-0 text-muted-foreground" strokeWidth={1.75} />
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-body font-medium text-foreground">
              <Ltr mono>{skill.name}</Ltr>
            </span>
            {skill.nameInHub && <Pill tone="warning">{t.inHub}</Pill>}
          </div>
          {skill.description && (
            <p dir="auto" className="mt-0.5 line-clamp-3 text-body-sm text-foreground">
              {skill.description}
            </p>
          )}
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-body-sm text-muted-foreground">
            {skill.declaredName && (
              <span>{fill(t.declared, { name: <Ltr mono>{skill.declaredName}</Ltr> })}</span>
            )}
            {skill.files > 1 && <span>{counted(skill.files, locale, hub.files)}</span>}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5 border-t border-border pt-3">
        <Button size="sm" variant="ghost" data-personal-read onClick={onRead}>
          {hub.view}
        </Button>
        <Tip content={{ what: t.moveTip }} label={t.move}>
          <Button size="sm" data-skill-move onClick={onMove}>
            <Copy aria-hidden className="size-3.5" strokeWidth={1.75} />
            {t.move}
          </Button>
        </Tip>
      </div>
    </li>
  );
}

/** The editor for a Hub skill, once its full text is read. */
function EditHubSkill({ name, onClose }: { name: string | null; onClose: () => void }) {
  const t = useT<SkillsMessages>('skills');
  const detail = useSkill('hub', name);
  // A text that cannot be read says so and lets go, so Edit never looks stuck (knowledge-13).
  const failed = !!name && detail.isError;
  useEffect(() => {
    if (!failed) return;
    showToast({
      tone: 'error',
      message: isHubError(detail.error) ? detail.error.message : t.errorThing,
    });
    onClose();
  }, [failed, detail.error, onClose, t.errorThing]);
  return (
    <SkillEditor
      open={!!name && !!detail.data}
      onOpenChange={(open) => !open && onClose()}
      skill={detail.data}
    />
  );
}

export function SkillsPage() {
  const t = useT<SkillsMessages>('skills');
  const locale = useLocale();
  const { roles } = useSession();
  const { query: search } = useRoute();
  const owner = isAllowed('skill.manage', roles);
  const query = useSkills();
  const sync = useSyncSkills();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const editDetail = useSkill('hub', editing);
  const stopEditing = useCallback(() => setEditing(null), []);
  const [moving, setMoving] = useState<SkillSummary | null>(null);
  const [reading, setReading] = useState<{ source: SkillSource; name: string } | null>(null);
  const data = query.data;
  const hubNames = useMemo(() => (data?.hub ?? []).map((skill) => skill.name), [data?.hub]);
  // `?skill=` opens one of Hub's skills, as an accepted proposal links here.
  const linked = search.get('skill');
  const open = reading ?? (linked ? { source: 'hub' as const, name: linked } : null);
  const closeRead = () => {
    setReading(null);
    if (linked) setQuery({ skill: null });
  };

  const syncNow = () =>
    sync.mutate(undefined, {
      onSuccess: (answer) => {
        const online = answer.devices.filter((device) => device.online).length;
        showToast({ message: counted(online, locale, t.synced) });
      },
      onError: (error) =>
        showToast({ tone: 'error', message: isHubError(error) ? error.message : t.errorThing }),
    });

  const header = (
    <PageHeader
      title={t.title}
      meta={t.meta}
      actions={
        owner && data ? (
          <>
            <Button busy={sync.isPending} data-skills-sync onClick={syncNow}>
              <RefreshCw aria-hidden className="size-4" strokeWidth={1.75} />
              {t.syncNow}
            </Button>
            <Button data-skills-new onClick={() => setCreating(true)}>
              <Plus aria-hidden className="size-4" strokeWidth={1.75} />
              {t.newSkill}
            </Button>
          </>
        ) : undefined
      }
    />
  );

  if (query.isError && !data) {
    return (
      <PageContainer>
        {header}
        <ErrorState
          thing={t.errorThing}
          code={isHubError(query.error) ? query.error.code : undefined}
          requestId={isHubError(query.error) ? query.error.requestId : undefined}
          onRetry={() => void query.refetch()}
        />
      </PageContainer>
    );
  }
  if (!data) {
    return (
      <PageContainer>
        {header}
        <LoadingRegion label={t.loading}>
          <div className="flex flex-col gap-3">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-5 w-32" />
            <SkeletonRows count={5} withAction={false} />
          </div>
        </LoadingRegion>
      </PageContainer>
    );
  }

  const ownMade = data.hub.filter((skill) => !skill.core);
  const core = data.hub.filter((skill) => skill.core);
  return (
    <PageContainer>
      {header}
      <div className="grid min-w-0 items-start gap-5 md:gap-6 lg:@page-lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="flex min-w-0 flex-col gap-6">
          <section aria-labelledby="skills-hub" data-skills-section="hub" className="flex flex-col gap-3">
            <SectionHeader id="skills-hub" icon={Sparkles} title={t.hub.title} count={data.hub.length} />
            <p className="text-body-sm text-muted-foreground">{t.hub.hint}</p>
            {data.hub.length === 0 ? (
              <p className="text-body-sm text-muted-foreground">{t.hub.empty}</p>
            ) : (
              <ul className="grid gap-3 sm:grid-cols-2">
                {[...ownMade, ...core].map((skill) => (
                  <HubSkillRow
                    key={skill.name}
                    skill={skill}
                    owner={owner}
                    onRead={() => setReading({ source: 'hub', name: skill.name })}
                    onEdit={() => setEditing(skill.name)}
                    busy={editing === skill.name && editDetail.isPending}
                  />
                ))}
              </ul>
            )}
          </section>

          {owner && (
            <section
              aria-labelledby="skills-personal"
              data-skills-section="personal"
              className="flex flex-col gap-3"
            >
              <SectionHeader
                id="skills-personal"
                icon={FolderLock}
                title={t.personal.title}
                count={data.personal.length}
              />
              {data.personalFolder && (
                <p className="text-body-sm text-muted-foreground">
                  {fill(t.personal.hint, { folder: <Ltr mono>{data.personalFolder}</Ltr> })}
                </p>
              )}
              {data.personal.length === 0 ? (
                <EmptyState icon={FolderLock} title={t.personal.emptyTitle}>
                  {t.personal.empty}
                </EmptyState>
              ) : (
                <ul className="grid gap-3 sm:grid-cols-2">
                  {data.personal.map((skill) => (
                    <PersonalSkillRow
                      key={skill.name}
                      skill={skill}
                      onRead={() => setReading({ source: 'personal', name: skill.name })}
                      onMove={() => setMoving(skill)}
                    />
                  ))}
                </ul>
              )}
            </section>
          )}
        </div>
        <aside className="min-w-0 lg:@page-lg:sticky lg:@page-lg:top-18">
          <DevicesCard devices={data.sync.devices} version={data.sync.version} mode={data.sync.mode} />
        </aside>
      </div>

      <SkillEditor open={creating} onOpenChange={setCreating} />
      <EditHubSkill name={editing} onClose={stopEditing} />
      <MoveDialog skill={moving} hubNames={hubNames} onOpenChange={(value) => !value && setMoving(null)} />
      <SkillView
        source={open?.source ?? 'hub'}
        name={open?.name ?? null}
        onOpenChange={(value) => !value && closeRead()}
        canWrite={owner}
      />
    </PageContainer>
  );
}
