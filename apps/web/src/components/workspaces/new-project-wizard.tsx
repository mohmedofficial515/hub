'use client';

/**
 * @file new-project-wizard.tsx
 * @description docs/15 §5: name, slug, key prefix, timezone, description, optional local docs path. Three steps, so the page is not one
 * long form: what the project is called, how it starts, and (docs/16 §11) its folder on a device. Slug and prefix follow the name until edited. The API has the last word on both.
 * It creates through `POST /workspaces`, the route `create_project` stands for, then presses Link on the new project with the folder given: that press is D44's explicit one,
 * and the step says what it writes before it is made. A link that fails leaves the project made, and says so.
 */
import { keyPrefixSchema, type LinkResult, projectSlugSchema } from '@hub/contracts';
import { useEffect, useId, useState } from 'react';

import {
  Button,
  detectSecret,
  Field,
  fill,
  Ltr,
  Modal,
  SecretFilterError,
  Select,
  showToast,
  Textarea,
  TextInput,
} from '@/components/kit';
import { useDevices } from '@/features/devices/queries';
import { post } from '@/lib/api/client';
import { isHubError } from '@/lib/api/errors';
import { useLocale, useT } from '@/lib/i18n';
import type { WorkspacesDict } from '@/lib/i18n/page-dicts';

const TIMEZONES = ['Europe/Istanbul', 'Asia/Riyadh', 'Africa/Cairo', 'Asia/Dubai', 'Europe/London', 'UTC'];

/** `{name}` holes filled with plain text, for a toast. */
const fmtText = (template: string, values: Record<string, string>) =>
  template.replace(/\{(\w+)\}/g, (_, key: string) => values[key] ?? '');

export const slugFrom = (name: string) =>
  name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32);

export const prefixFrom = (name: string) => {
  const letters = name.toUpperCase().replace(/[^A-Z ]/g, '');
  const words = letters.split(/\s+/).filter(Boolean);
  const initials = words.length > 1 ? words.map((w) => w[0]).join('') : (words[0] ?? '');
  return initials.slice(0, 4);
};

interface Draft {
  name: string;
  slug: string;
  keyPrefix: string;
  timezone: string;
  description: string;
  docsPath: string;
  folder: string;
  deviceId: string;
}

/** A full path on a device, with no `..`: the same check as Settings' Link button. */
const ABSOLUTE = /^([A-Za-z]:[\\/]|\/)/;
const folderOk = (path: string) => ABSOLUTE.test(path) && !/(^|[\\/])\.\.([\\/]|$)/.test(path);

const EMPTY: Draft = {
  name: '',
  slug: '',
  keyPrefix: '',
  timezone: 'Europe/Istanbul',
  description: '',
  docsPath: '',
  folder: '',
  deviceId: '',
};

export function NewProjectWizard({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (slug: string) => void;
}) {
  const t = useT<WorkspacesDict>('workspaces');
  const locale = useLocale();
  const id = useId();
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [touched, setTouched] = useState({ slug: false, prefix: false });
  const [step, setStep] = useState<1 | 2 | 3>(1);
  // Only the link step lists devices, so a closed wizard asks nothing every few seconds.
  const devices = useDevices(undefined, open && step === 3);
  const online = (devices.data ?? []).filter((device) => device.online);
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [serverError, setServerError] = useState<{ slug?: string; prefix?: string; form?: string }>({});

  useEffect(() => {
    if (!open) return;
    setDraft(EMPTY);
    setTouched({ slug: false, prefix: false });
    setStep(1);
    setTried(false);
    setServerError({});
  }, [open]);

  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));

  const onName = (name: string) =>
    set({
      name,
      ...(touched.slug ? {} : { slug: slugFrom(name) }),
      ...(touched.prefix ? {} : { keyPrefix: prefixFrom(name) }),
    });

  const nameError = !draft.name.trim() ? t.wizard.nameRequired : undefined;
  const slugError =
    serverError.slug ?? (projectSlugSchema.safeParse(draft.slug).success ? undefined : t.wizard.slugInvalid);
  const prefixError =
    serverError.prefix ??
    (keyPrefixSchema.safeParse(draft.keyPrefix).success ? undefined : t.wizard.prefixInvalid);
  const secret = detectSecret(draft.description);
  const folder = draft.folder.trim();
  const deviceId = draft.deviceId || online[0]?.id || '';
  const folderError = tried && step === 3 && folder && !folderOk(folder) ? t.wizard.folderInvalid : undefined;

  const next = () => {
    setTried(true);
    if (nameError || slugError || prefixError) return;
    setTried(false);
    setStep(2);
  };

  /** The Link button's own call, on the new project. Answers the words to show, and whether they are good news. */
  const link = async (slug: string): Promise<{ text: string; ok: boolean }> => {
    const names = { project: slug, folder };
    try {
      const answer = await post<LinkResult>(`workspaces/${slug}/devices/${deviceId}/link`, { folder });
      if (answer.outcome === 'linked') return { text: fmtText(t.wizard.linked, names), ok: true };
      if (answer.outcome === 'already_linked')
        return { text: fmtText(t.wizard.alreadyLinked, names), ok: true };
      if (answer.outcome === 'shape_unexpected')
        return { text: fmtText(t.wizard.linkShape, names), ok: false };
      return { text: fmtText(t.wizard.linkMcp, names), ok: false };
    } catch (error) {
      return {
        text: fmtText(t.wizard.linkFailed, {
          ...names,
          reason: isHubError(error) ? error.message : t.wizard.failed,
        }),
        ok: false,
      };
    }
  };

  const create = async () => {
    if (step === 3 && folder && (!folderOk(folder) || !deviceId)) {
      setTried(true);
      return;
    }
    if (secret || busy) return;
    setBusy(true);
    setServerError({});
    try {
      const created = await post<{ slug: string }>('workspaces', {
        name: draft.name.trim(),
        slug: draft.slug,
        keyPrefix: draft.keyPrefix,
        timezone: draft.timezone,
        defaultLocale: locale,
        ...(draft.description.trim() ? { description: draft.description.trim() } : {}),
        ...(draft.docsPath.trim() ? { docsPath: draft.docsPath.trim() } : {}),
      });
      const linked = step === 3 && folder && deviceId ? await link(created.slug) : null;
      onOpenChange(false);
      onCreated(created.slug);
      if (linked) showToast({ message: linked.text, ...(linked.ok ? {} : { tone: 'error' as const }) });
    } catch (error) {
      setBusy(false);
      if (isHubError(error, 'hub.workspaces.slug_taken')) {
        setServerError({ slug: t.wizard.slugTaken });
        setStep(1);
      } else if (isHubError(error, 'hub.workspaces.key_prefix_taken')) {
        setServerError({ prefix: t.wizard.prefixTaken });
        setStep(1);
      } else {
        setServerError({ form: isHubError(error) && error.status < 500 ? error.message : t.wizard.failed });
      }
      return;
    }
    setBusy(false);
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      dirty={!!draft.name.trim() || step > 1}
      title={t.wizard.title}
      description={step === 1 ? t.wizard.stepOne : step === 2 ? t.wizard.stepTwo : t.wizard.stepThree}
      footer={
        step === 1 ? (
          <Button variant="primary" onClick={next}>
            {t.wizard.next}
          </Button>
        ) : step === 2 ? (
          <>
            <Button onClick={() => setStep(1)}>{t.wizard.back}</Button>
            <Button
              data-wizard-next
              onClick={() => {
                if (secret) return;
                setTried(false);
                setStep(3);
              }}
            >
              {t.wizard.next}
            </Button>
            <Button variant="primary" busy={busy} onClick={() => void create()}>
              {t.wizard.create}
            </Button>
          </>
        ) : (
          <>
            <Button onClick={() => setStep(2)}>{t.wizard.back}</Button>
            <Button variant="primary" busy={busy} data-wizard-create onClick={() => void create()}>
              {folder ? t.wizard.createAndLink : t.wizard.create}
            </Button>
          </>
        )
      }
    >
      {step === 1 ? (
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            next();
          }}
        >
          <Field id={`${id}-name`} label={t.wizard.name} required error={tried ? nameError : undefined}>
            <TextInput
              id={`${id}-name`}
              dir="auto"
              data-autofocus
              value={draft.name}
              onChange={(e) => onName(e.target.value)}
            />
          </Field>
          <Field
            id={`${id}-slug`}
            label={t.wizard.slug}
            hint={t.wizard.slugHint}
            required
            error={tried || serverError.slug ? slugError : undefined}
          >
            <TextInput
              id={`${id}-slug`}
              dir="ltr"
              className="key text-start"
              value={draft.slug}
              onChange={(e) => {
                setTouched((v) => ({ ...v, slug: true }));
                setServerError(({ slug: _slug, ...rest }) => rest);
                set({ slug: e.target.value });
              }}
            />
          </Field>
          <Field
            id={`${id}-prefix`}
            label={t.wizard.prefix}
            hint={t.wizard.prefixHint}
            required
            error={tried || serverError.prefix ? prefixError : undefined}
          >
            <TextInput
              id={`${id}-prefix`}
              dir="ltr"
              className="key text-start"
              maxLength={6}
              value={draft.keyPrefix}
              onChange={(e) => {
                setTouched((v) => ({ ...v, prefix: true }));
                setServerError(({ prefix: _prefix, ...rest }) => rest);
                set({ keyPrefix: e.target.value.toUpperCase() });
              }}
            />
          </Field>
          <button type="submit" hidden aria-hidden tabIndex={-1} />
        </form>
      ) : step === 2 ? (
        <div className="flex flex-col gap-4">
          <Field id={`${id}-tz`} label={t.wizard.timezone}>
            <Select
              id={`${id}-tz`}
              dir="ltr"
              value={draft.timezone}
              onChange={(e) => set({ timezone: e.target.value })}
            >
              {TIMEZONES.map((zone) => (
                <option key={zone} value={zone}>
                  {zone}
                </option>
              ))}
            </Select>
          </Field>
          <Field id={`${id}-description`} label={t.wizard.description}>
            <Textarea
              id={`${id}-description`}
              dir="auto"
              rows={3}
              value={draft.description}
              onChange={(e) => set({ description: e.target.value })}
            />
          </Field>
          {secret && <SecretFilterError pattern={secret} />}
          <Field id={`${id}-docs`} label={t.wizard.docsPath} hint={t.wizard.docsPathHint}>
            <TextInput
              id={`${id}-docs`}
              dir="ltr"
              className="key text-start"
              placeholder="F:/Projects/my-app/docs"
              value={draft.docsPath}
              onChange={(e) => set({ docsPath: e.target.value })}
            />
          </Field>
          {serverError.form && (
            <p role="alert" className="text-body-sm text-destructive-soft-foreground">
              {serverError.form}
            </p>
          )}
        </div>
      ) : (
        <div data-wizard-step="link" className="flex flex-col gap-4">
          <p className="text-body-sm text-muted-foreground">{t.wizard.linkNote}</p>
          {!devices.isPending && online.length === 0 ? (
            <p data-wizard-no-device className="text-body-sm text-foreground">
              {t.wizard.noDevice}
            </p>
          ) : (
            <>
              <Field
                id={`${id}-folder`}
                label={t.wizard.folder}
                hint={t.wizard.folderHint}
                error={folderError}
              >
                <TextInput
                  id={`${id}-folder`}
                  dir="ltr"
                  data-autofocus
                  data-wizard-folder
                  className="key text-start"
                  spellCheck={false}
                  placeholder="F:/Projects/my-app"
                  value={draft.folder}
                  onChange={(e) => set({ folder: e.target.value })}
                />
              </Field>
              <Field id={`${id}-device`} label={t.wizard.device}>
                <Select
                  id={`${id}-device`}
                  value={deviceId}
                  onChange={(e) => set({ deviceId: e.target.value })}
                >
                  {online.map((device) => (
                    <option key={device.id} value={device.id}>
                      {device.name}
                    </option>
                  ))}
                </Select>
              </Field>
              {folder && folderOk(folder) && (
                <p data-wizard-link-preview className="text-body-sm text-foreground">
                  {fill(t.wizard.linkPreview, {
                    folder: <Ltr mono>{folder}</Ltr>,
                    project: <Ltr mono>{draft.slug}</Ltr>,
                  })}
                </p>
              )}
            </>
          )}
          {serverError.form && (
            <p role="alert" className="text-body-sm text-destructive-soft-foreground">
              {serverError.form}
            </p>
          )}
        </div>
      )}
    </Modal>
  );
}
