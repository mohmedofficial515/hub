'use client';

/**
 * @file source-setup.tsx
 * @description Where the design is read from (docs/17 §3): one of the project's folders and the schema folder inside it, read on Hub's machine or through a paired device. Shown when nothing is set yet, and from the header to change it.
 */
import { SCHEMA_DEFAULT_DIR, type SchemaSourceDto } from '@hub/contracts';
import { Database } from 'lucide-react';
import { useId, useState } from 'react';

import { Button, Field, Modal, Select, showToast, TextInput, useWorkspace } from '@/components/kit';
import { useDevices } from '@/features/devices/queries';
import { useSetSchemaSource } from '@/features/schema/queries';
import { isHubError } from '@/lib/api/errors';

import { useSchemaWords } from './studio';

function SourceForm({ current, onDone }: { current: SchemaSourceDto | null; onDone?: () => void }) {
  const t = useSchemaWords();
  const id = useId();
  const workspace = useWorkspace();
  const devices = useDevices();
  const save = useSetSchemaSource();
  const folders = (workspace.data as { repoPaths?: string[] } | undefined)?.repoPaths ?? [];
  const suggested = current?.path ?? folders.find((folder) => /backend/i.test(folder)) ?? folders[0] ?? '';
  const [name, setName] = useState(current?.name ?? 'backend');
  const [path, setPath] = useState(suggested);
  const [schemaDir, setSchemaDir] = useState(current?.schemaDir ?? SCHEMA_DEFAULT_DIR);
  const [deviceId, setDeviceId] = useState(current?.deviceId ?? '');

  const submit = () => {
    save.mutate(
      { name, path, schemaDir, deviceId: deviceId || null },
      {
        onSuccess: () => {
          showToast({ message: t.toasts.sourceSaved, tone: 'success' });
          onDone?.();
        },
        onError: (error) =>
          showToast({ message: isHubError(error) ? error.message : t.states.error, tone: 'error' }),
      },
    );
  };

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <Field id={`${id}-name`} label={t.setup.name}>
        <TextInput
          id={`${id}-name`}
          dir="ltr"
          value={name}
          pattern="[a-z0-9-]{2,32}"
          onChange={(event) => setName(event.target.value)}
          required
        />
      </Field>
      <Field id={`${id}-path`} label={t.setup.path} hint={t.setup.pathHint}>
        {folders.length > 0 ? (
          <Select id={`${id}-path`} dir="ltr" value={path} onChange={(event) => setPath(event.target.value)}>
            {folders.map((folder) => (
              <option key={folder} value={folder}>
                {folder}
              </option>
            ))}
          </Select>
        ) : (
          <TextInput
            id={`${id}-path`}
            dir="ltr"
            value={path}
            onChange={(event) => setPath(event.target.value)}
            required
          />
        )}
      </Field>
      <Field id={`${id}-dir`} label={t.setup.schemaDir} hint={t.setup.schemaDirHint}>
        <TextInput
          id={`${id}-dir`}
          dir="ltr"
          value={schemaDir}
          onChange={(event) => setSchemaDir(event.target.value)}
          required
        />
      </Field>
      <Field id={`${id}-device`} label={t.setup.device} hint={t.setup.deviceHint}>
        <Select id={`${id}-device`} value={deviceId} onChange={(event) => setDeviceId(event.target.value)}>
          <option value="">{t.setup.deviceApi}</option>
          {(devices.data ?? []).map((device) => (
            <option key={device.id} value={device.id}>
              {device.name}
            </option>
          ))}
        </Select>
      </Field>
      <div>
        <Button type="submit" variant="primary" busy={save.isPending} disabled={!path || !schemaDir}>
          {t.setup.save}
        </Button>
      </div>
    </form>
  );
}

export function SourceSetup({ canManage }: { canManage: boolean }) {
  const t = useSchemaWords();
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6 px-4 py-12 md:py-20">
      <div className="flex flex-col items-center gap-3 text-center">
        <span className="schema-hero-icon">
          <Database aria-hidden className="size-7" strokeWidth={1.5} />
        </span>
        <h1 className="text-headline font-semibold text-foreground">{t.setup.title}</h1>
        <p className="max-w-prose text-body text-muted-foreground">
          {canManage ? t.setup.body : t.setup.readOnly}
        </p>
      </div>
      {canManage && (
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <SourceForm current={null} />
        </div>
      )}
    </div>
  );
}

export function SourceDialog({
  open,
  onOpenChange,
  current,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  current: SchemaSourceDto | null;
}) {
  const t = useSchemaWords();
  return (
    <Modal open={open} onOpenChange={onOpenChange} title={t.setup.change} description={t.setup.body}>
      <SourceForm current={current} onDone={() => onOpenChange(false)} />
    </Modal>
  );
}
