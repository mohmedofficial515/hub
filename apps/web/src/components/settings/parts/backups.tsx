'use client';

/**
 * @file backups.tsx
 * @description Settings › Backups (docs/16 D61 to D63), the owner's alone: Back up now, the history with each backup's time, size, status and its Keep and Delete,
 * the low-space warning, then the nightly time, how many to keep, the folder, and how to restore. Built from its neighbours: one neutral card for the history,
 * a word and an icon for each state, the queue tab's save bar. There is no restore button: restoring is `pnpm hub:restore`, with Hub stopped.
 */
import type { BackupDto, BackupsDto } from '@hub/contracts';
import { BACKUP_LIMITS } from '@hub/contracts';
import {
  ArchiveRestore,
  CircleCheck,
  CircleX,
  DatabaseBackup,
  FolderX,
  LoaderCircle,
  Pin,
  PinOff,
  Trash2,
  TriangleAlert,
} from 'lucide-react';
import { useEffect, useId, useState } from 'react';

import {
  Button,
  cn,
  CommandBlock,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  Field,
  fill,
  fmt,
  kitMessages,
  Ltr,
  Pill,
  plural,
  RelativeTime,
  SectionHeader,
  showToast,
  SkeletonRows,
  TextInput,
  useLocale,
  useSession,
  useT,
  when,
} from '@/components/kit';
import {
  useBackUpNow,
  useBackups,
  useDeleteBackup,
  usePinBackup,
  useSaveBackupSettings,
} from '@/features/backups/queries';
import type { SettingsMessages } from '@/features/settings/messages';
import { isHubError } from '@/lib/api/errors';

import { FormSection } from './shared';
import { Bytes } from './system';

type Words = SettingsMessages['backups'];

function useFailureToast() {
  const t = useT<SettingsMessages>('settings');
  return (error: unknown) =>
    showToast({ tone: 'error', message: isHubError(error) ? error.message : t.errorThing });
}

/** One word and one icon per state; a deleted or missing folder outranks "done". */
function StateOf({ backup, words }: { backup: BackupDto; words: Words }) {
  if (backup.deletedAt) return <Pill tone="muted">{words.status.deleted}</Pill>;
  if (backup.status === 'running')
    return (
      <Pill tone="info" icon={LoaderCircle}>
        {words.status.running}
      </Pill>
    );
  if (backup.status === 'failed')
    return (
      <Pill tone="danger" icon={CircleX}>
        {words.status.failed}
      </Pill>
    );
  if (backup.missing)
    return (
      <Pill tone="warning" icon={FolderX}>
        {words.status.missing}
      </Pill>
    );
  return (
    <Pill tone="success" icon={CircleCheck}>
      {words.status.done}
    </Pill>
  );
}

function BackupRow({ backup, onDelete }: { backup: BackupDto; onDelete: () => void }) {
  const words = useT<SettingsMessages>('settings').backups;
  const locale = useLocale();
  const pin = usePinBackup();
  const failed = useFailureToast();
  const usable = backup.status === 'done' && !backup.deletedAt;
  const removable = backup.status !== 'running' && !backup.deletedAt;
  const startedAt = when(backup.startedAt, locale);
  return (
    <li
      className={cn(
        'flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-3',
        backup.deletedAt && 'opacity-75',
      )}
      data-backup={backup.id}
    >
      <DatabaseBackup aria-hidden className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.75} />
      <div className="min-w-0 flex-1 basis-56">
        <p className="flex flex-wrap items-center gap-2 text-body font-medium text-foreground">
          <span>{startedAt}</span>
          <StateOf backup={backup} words={words} />
          {backup.pinned && (
            <Pill tone="muted" icon={Pin}>
              {words.kept}
            </Pill>
          )}
        </p>
        <p className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-body-sm text-muted-foreground">
          <span>{words.trigger[backup.trigger]}</span>
          {backup.sizeBytes !== null && <Bytes value={backup.sizeBytes} />}
          {backup.docs !== null && <span>{plural(backup.docs, locale, words.docs)}</span>}
          {backup.deletedAt && (
            <span>
              {fill(backup.deletedBy === 'retention' ? words.deletedByRetention : words.deletedByOwner, {
                when: <RelativeTime iso={backup.deletedAt} />,
              })}
            </span>
          )}
        </p>
        {backup.failure && (
          <p className="mt-0.5 text-body-sm wrap-anywhere text-destructive-soft-foreground">
            <Ltr mono>{backup.failure}</Ltr>
          </p>
        )}
        {backup.missing && <p className="mt-0.5 text-body-sm text-muted-foreground">{words.missingNote}</p>}
        {usable && backup.path && (
          <p className="mt-0.5 text-body-sm wrap-anywhere text-muted-foreground">
            <span className="sr-only">{words.openFolder}: </span>
            <Ltr mono>{backup.path}</Ltr>
          </p>
        )}
      </div>
      {(usable || removable) && (
        <div className="flex items-center gap-2">
          {usable && (
            <Button
              size="sm"
              busy={pin.isPending}
              aria-pressed={backup.pinned}
              aria-label={`${backup.pinned ? words.unkeep : words.keep}: ${startedAt}`}
              title={words.keepHint}
              onClick={() =>
                pin.mutate(
                  { id: backup.id, pinned: !backup.pinned },
                  {
                    onSuccess: () =>
                      showToast({ message: backup.pinned ? words.unkeptToast : words.keptToast }),
                    onError: failed,
                  },
                )
              }
            >
              {backup.pinned ? (
                <PinOff aria-hidden className="size-3.5" strokeWidth={1.75} />
              ) : (
                <Pin aria-hidden className="size-3.5" strokeWidth={1.75} />
              )}
              {backup.pinned ? words.unkeep : words.keep}
            </Button>
          )}
          {removable && (
            <Button size="sm" aria-label={`${words.delete}: ${startedAt}`} onClick={onDelete}>
              <Trash2 aria-hidden className="size-3.5" strokeWidth={1.75} />
              {words.delete}
            </Button>
          )}
        </div>
      )}
    </li>
  );
}

function History({ data }: { data: BackupsDto }) {
  const t = useT<SettingsMessages>('settings');
  const words = t.backups;
  const locale = useLocale();
  const remove = useDeleteBackup();
  const failed = useFailureToast();
  const [deleting, setDeleting] = useState<string | null>(null);
  const target = data.items.find((item) => item.id === deleting);
  return (
    <section aria-labelledby="backups-history" className="flex flex-col gap-3">
      <SectionHeader
        id="backups-history"
        icon={ArchiveRestore}
        level={3}
        title={words.historyTitle}
        count={data.items.length || undefined}
      />
      {data.disk?.low && (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-md bg-warning-soft px-3 py-2 text-body-sm font-medium text-warning-soft-foreground"
          data-backups-low-disk
        >
          <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} />
          <span>
            {fill(words.lowDisk, {
              free: <Bytes value={data.disk.freeBytes} />,
              total: <Bytes value={data.disk.totalBytes} />,
            })}
          </span>
        </p>
      )}
      {data.items.length === 0 ? (
        <EmptyState icon={DatabaseBackup} title={words.emptyTitle}>
          {words.emptyBody}
        </EmptyState>
      ) : (
        <ul
          data-hub-list
          className="flex flex-col divide-y divide-border overflow-hidden rounded-lg border border-border bg-card"
        >
          {data.items.map((backup) => (
            <BackupRow key={backup.id} backup={backup} onDelete={() => setDeleting(backup.id)} />
          ))}
        </ul>
      )}
      {data.disk && !data.disk.low && (
        <p className="text-body-sm text-muted-foreground">
          {fill(words.disk, {
            free: <Bytes value={data.disk.freeBytes} />,
            total: <Bytes value={data.disk.totalBytes} />,
          })}
        </p>
      )}
      <ConfirmDialog
        open={!!target}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={target ? fmt(words.deleteTitle, { when: when(target.startedAt, locale) }) : ''}
        description={target?.pinned ? words.deleteKeptBody : words.deleteBody}
        confirmLabel={words.delete}
        onConfirm={() =>
          target &&
          remove.mutate(target.id, {
            onSuccess: () => showToast({ message: words.deleted }),
            onError: failed,
          })
        }
      />
    </section>
  );
}

function SettingsForm({ data }: { data: BackupsDto }) {
  const t = useT<SettingsMessages>('settings');
  const words = t.backups;
  const general = t.general;
  const locale = useLocale();
  const id = useId();
  const save = useSaveBackupSettings();
  const failed = useFailureToast();
  const settings = data.settings;
  const [enabled, setEnabled] = useState(settings.enabled);
  const [time, setTime] = useState(settings.time);
  const [keepText, setKeepText] = useState(String(settings.keep));
  const [folder, setFolder] = useState(settings.folderSource === 'setting' ? settings.folder : '');

  const reset = () => {
    setEnabled(settings.enabled);
    setTime(settings.time);
    setKeepText(String(settings.keep));
    setFolder(settings.folderSource === 'setting' ? settings.folder : '');
  };
  useEffect(reset, [settings]);

  const keep = Math.max(
    BACKUP_LIMITS.keepMin,
    Math.min(BACKUP_LIMITS.keepMax, Math.round(Number(keepText)) || 1),
  );
  const chosenFolder = folder.trim() === '' ? null : folder.trim();
  const savedFolder = settings.folderSource === 'setting' ? settings.folder : null;
  const changes = {
    ...(enabled !== settings.enabled ? { enabled } : {}),
    ...(time !== settings.time ? { time } : {}),
    ...(keep !== settings.keep ? { keep } : {}),
    ...(chosenFolder !== savedFolder ? { folder: chosenFolder } : {}),
  };
  const changed = Object.keys(changes).length;
  const restoreCommand = `pnpm hub:restore "${data.items.find((item) => item.status === 'done' && !item.deletedAt && !item.missing)?.path ?? `${settings.folder}${settings.folder.includes('\\') ? '\\' : '/'}hub-…`}"`;

  return (
    <>
      <FormSection
        title={words.scheduleTitle}
        description={fmt(words.scheduleHint, { zone: settings.timezone })}
      >
        <label className="flex min-h-11 items-center gap-2 text-body text-foreground md:min-h-0">
          <input
            type="checkbox"
            className="size-4 accent-(--primary)"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            data-backups-enabled
          />
          {words.enabled}
        </label>
        <Field id={`${id}-time`} label={words.time}>
          <TextInput
            id={`${id}-time`}
            type="time"
            dir="ltr"
            className="max-w-40"
            value={time}
            disabled={!enabled}
            onChange={(e) => setTime(e.target.value)}
          />
        </Field>
        <p className="text-body-sm text-muted-foreground">
          {data.nextAt ? fill(words.next, { when: when(data.nextAt, locale) }) : words.off}
        </p>
      </FormSection>
      <FormSection title={words.keepTitle} description={words.keepHelp}>
        <Field id={`${id}-keep`} label={words.keepCount}>
          <TextInput
            id={`${id}-keep`}
            type="number"
            inputMode="numeric"
            dir="ltr"
            min={BACKUP_LIMITS.keepMin}
            max={BACKUP_LIMITS.keepMax}
            className="max-w-32"
            value={keepText}
            onChange={(e) => setKeepText(e.target.value)}
            onBlur={() => setKeepText(String(keep))}
            data-backups-keep
          />
        </Field>
      </FormSection>
      <FormSection title={words.folderTitle} description={words.folderHint}>
        <Field id={`${id}-folder`} label={words.folder}>
          <TextInput
            id={`${id}-folder`}
            dir="ltr"
            className="text-start"
            placeholder={settings.defaultFolder}
            value={folder}
            onChange={(e) => setFolder(e.target.value)}
          />
        </Field>
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-body-sm text-muted-foreground">
          <span>{fill(words.folderDefault, { folder: <Ltr mono>{settings.defaultFolder}</Ltr> })}</span>
          {folder !== '' && (
            <Button size="sm" variant="ghost" onClick={() => setFolder('')}>
              {words.useDefault}
            </Button>
          )}
        </p>
      </FormSection>
      <FormSection title={words.restoreTitle} description={words.restoreBody}>
        <CommandBlock value={restoreCommand} copyLabel={t.devices.copyCommand} label={words.restoreLabel} />
      </FormSection>
      <div
        className={cn(
          'sticky bottom-4 z-20 flex flex-wrap items-center gap-3 rounded-lg border border-border bg-popover p-3 shadow-md',
          changed === 0 && 'hidden',
        )}
      >
        <p role="status" className="min-w-0 flex-1 basis-40 text-body-sm font-medium text-foreground">
          {changed > 0 && plural(changed, locale, general.unsaved)}
        </p>
        <Button variant="ghost" onClick={reset}>
          {general.discard}
        </Button>
        <Button
          variant="primary"
          busy={save.isPending}
          onClick={() =>
            save.mutate(changes, { onSuccess: () => showToast({ message: words.saved }), onError: failed })
          }
          data-backups-save
        >
          {words.save}
        </Button>
      </div>
    </>
  );
}

export function BackupsTab() {
  const t = useT<SettingsMessages>('settings');
  const words = t.backups;
  const kit = useT(kitMessages);
  const { isOwner, loading } = useSession();
  const query = useBackups(isOwner);
  const now = useBackUpNow();
  const failed = useFailureToast();

  const header = (running: boolean) => (
    <>
      <SectionHeader
        id="backups-title"
        icon={DatabaseBackup}
        title={words.title}
        aside={
          isOwner ? (
            <Button
              variant="primary"
              busy={now.isPending || running}
              disabled={running}
              onClick={() =>
                now.mutate(undefined, {
                  onSuccess: () => showToast({ message: words.started }),
                  onError: failed,
                })
              }
              data-backups-now
            >
              <DatabaseBackup aria-hidden className="size-4" strokeWidth={1.75} />
              {words.now}
            </Button>
          ) : undefined
        }
      />
      <p className="max-w-prose text-body-sm text-muted-foreground">{words.intro}</p>
      {running && (
        <p role="status" className="flex items-center gap-2 text-body-sm text-muted-foreground">
          <LoaderCircle aria-hidden className="size-4 motion-safe:animate-spin" strokeWidth={1.75} />
          {words.runningNote}
        </p>
      )}
    </>
  );

  if (loading) return <SkeletonRows count={4} withAction />;
  if (!isOwner) {
    return (
      <section aria-labelledby="backups-title" className="flex flex-col gap-3">
        {header(false)}
        <ErrorState forbiddenRole={kit.roles.owner} />
      </section>
    );
  }
  if (query.isPending) return <SkeletonRows count={4} withAction />;
  if (query.isError) {
    const { error } = query;
    return (
      <ErrorState
        thing={t.errorThing}
        code={isHubError(error) ? error.code : undefined}
        requestId={isHubError(error) ? error.requestId : undefined}
        onRetry={() => void query.refetch()}
      />
    );
  }
  return (
    <>
      <section aria-labelledby="backups-title" className="flex flex-col gap-3" data-settings-backups>
        {header(query.data.running)}
      </section>
      <History data={query.data} />
      <SettingsForm data={query.data} />
    </>
  );
}
