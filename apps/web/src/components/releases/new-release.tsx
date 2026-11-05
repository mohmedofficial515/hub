'use client';

/**
 * @file new-release.tsx
 * @description 09 §16. The include list is the picker's filter already applied: only what is finished and not yet in a release, so there is nothing to
 * search for. The API builds the notes from what was picked. Ported from the design's `pages/releases/parts/new-release.tsx`.
 */
import { useId, useState } from 'react';

import {
  Bidi,
  Button,
  type CardListItem,
  cn,
  createCard,
  detectSecret,
  Field,
  fill,
  fmt,
  focusRingInset,
  kitMessages,
  Ltr,
  Modal,
  Select,
  showToast,
  TextInput,
  TypeIcon,
  useRoute,
  useT,
} from '@/components/kit';
import { generateNotes } from '@/features/releases/queries';
import { isHubError } from '@/lib/api/errors';

import type { ReleasesMessages } from './messages';

const ORDER = ['decision', 'task', 'handoff', 'redesign'] as const;
const REPOS = ['backend', 'web', 'dashboard', 'hub'] as const;

export function NewReleaseDialog({
  open,
  onOpenChange,
  onCreated,
  eligible,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (key: string) => void;
  eligible: CardListItem[];
}) {
  const t = useT<ReleasesMessages>('releases');
  const d = t.dialog;
  const kit = useT(kitMessages);
  const { ws } = useRoute();
  const id = useId();
  const [version, setVersion] = useState('');
  const [name, setName] = useState('');
  const [repo, setRepo] = useState<(typeof REPOS)[number]>('backend');
  const [tag, setTag] = useState('');
  const [picked, setPicked] = useState<string[]>([]);
  const [tried, setTried] = useState(false);
  const [saving, setSaving] = useState(false);

  const secret = detectSecret(`${name} ${tag}`);
  const missingVersion = !version.trim();
  const missingName = !name.trim();
  const toggle = (key: string) =>
    setPicked((all) => (all.includes(key) ? all.filter((k) => k !== key) : [...all, key]));

  const create = async () => {
    setTried(true);
    if (missingVersion || missingName || secret || saving) return;
    setSaving(true);
    try {
      const { key } = await createCard({
        type: 'release',
        title: fmt(d.titleFormat, { version: version.trim(), name: name.trim() }),
        detail: {
          version: version.trim(),
          repo,
          includedKeys: picked,
          ...(tag.trim() ? { tag: tag.trim() } : {}),
        },
      });
      onOpenChange(false);
      setVersion('');
      setName('');
      setTag('');
      setPicked([]);
      setTried(false);
      onCreated(key);
      showToast({ message: fill(d.created, { key: <Ltr mono>{key}</Ltr> }) });
      if (picked.length) {
        await generateNotes(ws, key).catch((error: unknown) => {
          showToast({ message: isHubError(error) ? error.message : kit.actionFailed, tone: 'error' });
        });
      }
    } catch (error) {
      showToast({ message: isHubError(error) ? error.message : kit.actionFailed, tone: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={d.title}
      description={d.description}
      className="md:max-w-xl"
      footer={
        <>
          <Button onClick={() => onOpenChange(false)}>{kit.cancel}</Button>
          <Button variant="primary" disabled={saving} onClick={() => void create()}>
            {d.create}
          </Button>
        </>
      }
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          void create();
        }}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field
            id={`${id}-version`}
            label={d.version}
            hint={<Bidi>{d.versionHint}</Bidi>}
            required
            error={tried && missingVersion ? d.needVersion : undefined}
          >
            <TextInput
              id={`${id}-version`}
              dir="ltr"
              className="key text-start"
              value={version}
              onChange={(e) => setVersion(e.target.value)}
            />
          </Field>
          <Field id={`${id}-repo`} label={d.repo}>
            <Select
              id={`${id}-repo`}
              dir="ltr"
              className="key text-start"
              value={repo}
              onChange={(e) => setRepo(e.target.value as typeof repo)}
            >
              {REPOS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field
          id={`${id}-name`}
          label={d.name}
          hint={d.nameHint}
          required
          error={tried && missingName ? d.needName : secret ? d.secret : undefined}
        >
          <TextInput id={`${id}-name`} dir="auto" value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field id={`${id}-tag`} label={d.tag} hint={d.tagHint}>
          <TextInput
            id={`${id}-tag`}
            dir="ltr"
            className="key text-start"
            placeholder="v2026.11.17"
            value={tag}
            onChange={(e) => setTag(e.target.value)}
          />
        </Field>
        <fieldset className="flex flex-col gap-2">
          <legend className="text-body-sm font-medium text-foreground">{d.include}</legend>
          <p className="text-body-sm text-muted-foreground">
            {eligible.length ? d.includeHint : d.includeNone}
          </p>
          {ORDER.filter((type) => eligible.some((c) => c.type === type)).map((type) => (
            <div key={type} className="flex flex-col gap-1">
              <p className="mt-1 text-caption font-medium text-muted-foreground">{t.groups[type]}</p>
              <ul className="overflow-hidden rounded-lg border border-border">
                {eligible
                  .filter((c) => c.type === type)
                  .map((c) => (
                    <li key={c.key} className="border-b border-border last:border-b-0">
                      <label
                        className={cn(
                          'flex min-h-11 cursor-pointer items-center gap-2.5 bg-card px-3 py-2 hover:bg-accent has-focus-visible:ring-2 has-focus-visible:ring-ring has-focus-visible:ring-inset',
                          focusRingInset,
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={picked.includes(c.key)}
                          onChange={() => toggle(c.key)}
                          className="size-4 shrink-0 accent-primary"
                        />
                        <TypeIcon type={c.type} />
                        <span className="min-w-0 flex-1 text-body-sm text-foreground">
                          <Bidi>{c.title}</Bidi>
                        </span>
                        <Ltr mono className="shrink-0 text-caption text-muted-foreground">
                          {c.key}
                        </Ltr>
                      </label>
                    </li>
                  ))}
              </ul>
            </div>
          ))}
        </fieldset>
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}
