'use client';

/**
 * @file source-dialog.tsx
 * @description Add or edit one source (docs/09 §18.2, docs/15 §3). The token field is a password field held only while this dialog is open:
 * the API keeps it encrypted and answers `hasSecret`, so nothing can show it again. "Replace token" is the only way to touch it later.
 */
import { type Role, ROLES, type SourceKind } from '@hub/contracts';
import { KeyRound, Lock } from 'lucide-react';
import { useState } from 'react';

import {
  Button,
  detectSecret,
  Field,
  fill,
  fmt,
  kitMessages,
  Ltr,
  Modal,
  SecretFilterError,
  Select,
  showToast,
  TextInput,
  useT,
} from '@/components/kit';
import type { SettingsMessages } from '@/features/settings/messages';
import { type Source, useCreateSource, useUpdateSource } from '@/features/settings/queries';
import { isHubError } from '@/lib/api/errors';

const NAME = /^[a-z0-9-]{2,32}$/;
const ABSOLUTE = /^([A-Za-z]:[\\/]|\/)/;
const mono = 'key text-start';
const list = (text: string) =>
  text
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);

/** `adr/* → adr, status/* → status` to the API's record. */
const parseKinds = (text: string): Record<string, string> =>
  Object.fromEntries(
    list(text).flatMap((pair) => {
      const [glob, kind] = pair.split('→').map((part) => part.trim());
      return glob && kind ? [[glob, kind]] : [];
    }),
  );
const showKinds = (kinds: unknown) =>
  Object.entries((kinds ?? {}) as Record<string, string>)
    .map(([glob, kind]) => `${glob} → ${kind}`)
    .join(', ');

export function SourceDialog({
  open,
  onClose,
  kind,
  source,
  sources,
}: {
  open: boolean;
  onClose: () => void;
  kind: SourceKind;
  source?: Source;
  sources: Source[];
}) {
  const t = useT<SettingsMessages>('settings');
  const kit = useT(kitMessages);
  const s = t.sources.form;
  const editing = !!source;
  const c = source?.config ?? {};
  const text = (key: string, fallback = '') => (typeof c[key] === 'string' ? c[key] : fallback);
  const joined = (key: string, fallback = '') =>
    Array.isArray(c[key]) ? (c[key] as string[]).join(', ') : fallback;
  const repos = sources.filter((x) => x.kind === 'github_repo');
  const create = useCreateSource();
  const update = useUpdateSource();

  const [name, setName] = useState(source?.name ?? '');
  const [repo, setRepo] = useState(c['owner'] ? `${text('owner')}/${text('repo')}` : '');
  const [branch, setBranch] = useState(text('defaultBranch', 'main'));
  const [app, setApp] = useState(text('app', 'backend'));
  const [token, setToken] = useState('');
  const [replacing, setReplacing] = useState(false);
  const [repoSource, setRepoSource] = useState(text('repoSourceId', repos[0]?.id ?? ''));
  const [path, setPath] = useState(
    text('path', kind === 'openapi' ? 'openapi/openapi.json' : kind === 'docs_folder' ? 'docs' : ''),
  );
  const [purpose, setPurpose] = useState<'docs' | 'lab'>(c['purpose'] === 'lab' ? 'lab' : 'docs');
  const [fromRole, setFromRole] = useState<Role>(text('fromRole', 'backend') as Role);
  const [toRole, setToRole] = useState<Role>(text('toRole', 'frontend') as Role);
  const [include, setInclude] = useState(joined('include', kind === 'local_path' ? '' : '**/*.md'));
  const [exclude, setExclude] = useState(joined('exclude'));
  const [kinds, setKinds] = useState(showKinds(c['kinds']));
  const [root, setRoot] = useState(text('root'));
  const [apps, setApps] = useState(joined('apps', 'web, dashboard'));
  const [tried, setTried] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const nameError =
    !editing && !NAME.test(name)
      ? s.nameInvalid
      : !editing && sources.some((x) => x.name === name)
        ? s.nameTaken
        : undefined;
  const repoError = kind === 'github_repo' && !/^[\w.-]+\/[\w.-]+$/.test(repo) ? s.repoInvalid : undefined;
  const pathError =
    kind === 'local_path' && (!ABSOLUTE.test(path) || path.includes('..')) ? s.pathInvalid : undefined;
  const rootError = kind === 'lab' && !root.trim() ? s.rootRequired : undefined;
  const parentError = (kind === 'openapi' || kind === 'docs_folder') && !repoSource ? s.needsRepo : undefined;
  // The token goes in its own field, so only the other fields pass through the secret filter here.
  const secret = detectSecret([name, repo, path, root, include, exclude, kinds, apps].join(' '));
  const valid = !nameError && !repoError && !pathError && !rootError && !parentError && !secret;
  const busy = create.isPending || update.isPending;

  const optional = (key: string, value: string) => (list(value).length ? { [key]: list(value) } : {});
  const configOf = (): Record<string, unknown> => {
    if (kind === 'github_repo') {
      const [owner, repoName] = repo.split('/');
      return { ...c, owner, repo: repoName, defaultBranch: branch || 'main', app };
    }
    if (kind === 'openapi') return { repoSourceId: repoSource, path, fromRole, toRole };
    const parsedKinds = parseKinds(kinds);
    const filters = {
      ...optional('include', include),
      ...optional('exclude', exclude),
      ...(Object.keys(parsedKinds).length ? { kinds: parsedKinds } : {}),
    };
    if (kind === 'docs_folder') return { repoSourceId: repoSource, path, ...filters };
    if (kind === 'lab') return { root: root.trim(), apps: list(apps) };
    return { path: path.trim(), purpose, ...filters };
  };

  const fail = (cause: unknown) => setServerError(isHubError(cause) ? cause.message : t.errorThing);

  const save = () => {
    setTried(true);
    setServerError(null);
    if (!valid) return;
    const nameNode = <Ltr mono>{source?.name ?? name}</Ltr>;
    if (source) {
      update.mutate(
        { id: source.id, config: configOf(), ...(token ? { secret: token } : {}) },
        {
          onSuccess: () => {
            showToast({ message: fill(s.saved, { name: nameNode }) });
            onClose();
          },
          onError: fail,
        },
      );
    } else {
      create.mutate(
        { kind, name, config: configOf(), ...(token ? { secret: token } : {}) },
        {
          onSuccess: () => {
            showToast({ message: fill(s.added, { name: nameNode }) });
            onClose();
          },
          onError: fail,
        },
      );
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={(next) => !next && onClose()}
      className="md:max-w-xl"
      title={
        source
          ? fill(s.editTitle, { name: <Ltr mono>{source.name}</Ltr> })
          : fmt(s.addTitle, { kind: t.sources.kinds[kind] })
      }
      footer={
        <>
          <Button onClick={onClose}>{kit.cancel}</Button>
          <Button variant="primary" busy={busy} onClick={save}>
            {editing ? s.save : s.add}
          </Button>
        </>
      }
    >
      <form
        className="flex flex-col gap-4"
        autoComplete="off"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        {editing ? (
          <p className="flex items-center gap-1.5 text-body-sm text-muted-foreground">
            <Lock aria-hidden className="size-3.5" strokeWidth={1.75} />
            {s.nameLocked}
          </p>
        ) : (
          <Field
            id="source-name"
            label={s.name}
            hint={s.nameHint}
            error={tried ? nameError : undefined}
            required
          >
            <TextInput
              id="source-name"
              dir="ltr"
              className={mono}
              value={name}
              onChange={(e) => setName(e.target.value)}
              aria-invalid={tried && !!nameError}
              autoFocus
            />
          </Field>
        )}

        {kind === 'local_path' && (
          <>
            <Field
              id="source-path"
              label={s.localPath}
              hint={s.localPathHint}
              error={tried ? pathError : undefined}
              required
            >
              <TextInput
                id="source-path"
                dir="ltr"
                className={mono}
                spellCheck={false}
                value={path}
                onChange={(e) => setPath(e.target.value)}
                aria-invalid={tried && !!pathError}
              />
            </Field>
            <Field id="source-purpose" label={s.purpose}>
              <Select
                id="source-purpose"
                value={purpose}
                onChange={(e) => setPurpose(e.target.value as 'docs' | 'lab')}
              >
                <option value="docs">{s.purposes.docs}</option>
                <option value="lab">{s.purposes.lab}</option>
              </Select>
            </Field>
          </>
        )}

        {kind === 'github_repo' && (
          <>
            <Field id="source-repo" label={s.repo} error={tried ? repoError : undefined} required>
              <TextInput
                id="source-repo"
                dir="ltr"
                className={mono}
                placeholder="owner/repo"
                value={repo}
                onChange={(e) => setRepo(e.target.value)}
                aria-invalid={tried && !!repoError}
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="source-branch" label={s.branch}>
                <TextInput
                  id="source-branch"
                  dir="ltr"
                  className={mono}
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                />
              </Field>
              <Field id="source-app" label={s.app}>
                <Select id="source-app" value={app} onChange={(e) => setApp(e.target.value)}>
                  {['backend', 'web', 'dashboard', 'hub'].map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            {source?.hasSecret && !replacing ? (
              <div className="flex flex-wrap items-center gap-3 rounded-md border border-border p-3">
                <KeyRound aria-hidden className="size-4 text-muted-foreground" strokeWidth={1.75} />
                <p className="min-w-0 flex-1 basis-40 text-body-sm text-foreground">{s.tokenStored}</p>
                <Button size="sm" onClick={() => setReplacing(true)}>
                  {s.replaceToken}
                </Button>
              </div>
            ) : (
              <Field id="source-token" label={s.token} hint={s.tokenHint}>
                <TextInput
                  id="source-token"
                  type="password"
                  dir="ltr"
                  className={mono}
                  autoComplete="new-password"
                  spellCheck={false}
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                />
              </Field>
            )}
          </>
        )}

        {(kind === 'openapi' || kind === 'docs_folder') && (
          <>
            <Field id="source-parent" label={s.repoSource} error={tried ? parentError : undefined}>
              <Select id="source-parent" value={repoSource} onChange={(e) => setRepoSource(e.target.value)}>
                {repos.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field id="source-path" label={s.path}>
              <TextInput
                id="source-path"
                dir="ltr"
                className={mono}
                value={path}
                onChange={(e) => setPath(e.target.value)}
              />
            </Field>
          </>
        )}

        {kind === 'openapi' && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="source-from" label={s.fromRole}>
              <Select id="source-from" value={fromRole} onChange={(e) => setFromRole(e.target.value as Role)}>
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {kit.roles[r]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field id="source-to" label={s.toRole}>
              <Select id="source-to" value={toRole} onChange={(e) => setToRole(e.target.value as Role)}>
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {kit.roles[r]}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        )}

        {(kind === 'docs_folder' || (kind === 'local_path' && purpose === 'docs')) && (
          <>
            <Field id="source-include" label={s.include} hint={s.listHint}>
              <TextInput
                id="source-include"
                dir="ltr"
                className={mono}
                value={include}
                onChange={(e) => setInclude(e.target.value)}
              />
            </Field>
            <Field id="source-exclude" label={s.exclude} hint={s.listHint}>
              <TextInput
                id="source-exclude"
                dir="ltr"
                className={mono}
                value={exclude}
                onChange={(e) => setExclude(e.target.value)}
              />
            </Field>
            <Field id="source-kinds" label={s.kinds}>
              <TextInput
                id="source-kinds"
                dir="ltr"
                className={mono}
                placeholder="adr/* → adr, status/* → status"
                value={kinds}
                onChange={(e) => setKinds(e.target.value)}
              />
            </Field>
          </>
        )}

        {kind === 'lab' && (
          <>
            <Field
              id="source-root"
              label={s.root}
              hint={s.rootHint}
              error={tried ? rootError : undefined}
              required
            >
              <TextInput
                id="source-root"
                dir="ltr"
                className={mono}
                value={root}
                onChange={(e) => setRoot(e.target.value)}
                aria-invalid={tried && !!rootError}
              />
            </Field>
            <Field id="source-apps" label={s.apps} hint={s.listHint}>
              <TextInput
                id="source-apps"
                dir="ltr"
                className={mono}
                value={apps}
                onChange={(e) => setApps(e.target.value)}
              />
            </Field>
          </>
        )}

        {secret && <SecretFilterError pattern={secret} />}
        {serverError && (
          <p
            role="alert"
            className="rounded-md bg-destructive-soft px-3 py-2 text-body-sm text-destructive-soft-foreground"
          >
            {serverError}
          </p>
        )}
        <button type="submit" hidden aria-hidden tabIndex={-1} />
      </form>
    </Modal>
  );
}
