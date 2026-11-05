import { useState } from 'react';
import { CircleCheck, KeyRound, Lock } from 'lucide-react';
import { useT } from '@lab/i18n';
import { NOW, type Role } from '@lab/mocks/hub-app';
import { ROLES, type SourceConfig, type SourceKind, type SourceRow } from '@lab/mocks/hub-app/settings';
import { Button, detectSecret, Field, fill, fmt, kitMessages, Ltr, Modal, SecretFilterError, Select, showToast, TextInput, updateAdmin, useSession, writeAudit } from '../../../kit';
import { messages } from '../i18n';
import { useFakeRequest } from './shared';

const NAME = /^[a-z0-9-]{2,32}$/;
const mono = 'key text-start';
const list = (text: string) => text.split(',').map((v) => v.trim()).filter(Boolean);

/**
 * Add or edit one source (09 §18.2). The token field is a password field held only while this dialog is open: saving keeps
 * `hasSecret` and drops the value, so nothing can show it again. "Replace token" is the only way to touch it later.
 */
export function SourceDialog({ open, onClose, kind, source, sources }: { open: boolean; onClose: () => void; kind: SourceKind; source?: SourceRow; sources: SourceRow[] }) {
  const t = useT(messages);
  const kit = useT(kitMessages);
  const { me } = useSession();
  const s = t.sources.form;
  const editing = !!source;
  const c: SourceConfig = source?.config ?? {};
  const repos = sources.filter((x) => x.kind === 'github_repo');

  const [name, setName] = useState(source?.name ?? '');
  const [repo, setRepo] = useState(c.owner ? `${c.owner}/${c.repo}` : '');
  const [branch, setBranch] = useState(c.defaultBranch ?? 'main');
  const [app, setApp] = useState(c.app ?? 'backend');
  const [patterns, setPatterns] = useState((c.branchPatterns ?? ['main', 'feat/*', 'fix/*', 'chore/*']).join(', '));
  const [token, setToken] = useState('');
  const [replacing, setReplacing] = useState(false);
  const [repoSource, setRepoSource] = useState(c.repoSource ?? repos[0]?.name ?? '');
  const [path, setPath] = useState(c.path ?? (kind === 'openapi' ? 'openapi/openapi.json' : 'docs'));
  const [fromRole, setFromRole] = useState<Role>(c.fromRole ?? 'backend');
  const [toRole, setToRole] = useState<Role>(c.toRole ?? 'frontend');
  const [include, setInclude] = useState((c.include ?? ['**/*.md']).join(', '));
  const [exclude, setExclude] = useState((c.exclude ?? ['map/**', 'handover/**']).join(', '));
  const [kinds, setKinds] = useState(c.kinds ?? 'adr/* → adr, status/* → status');
  const [apps, setApps] = useState((c.apps ?? ['web', 'dashboard']).join(', '));
  const [tried, setTried] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const { busy, run } = useFakeRequest();

  const nameError = !editing && !NAME.test(name) ? s.nameInvalid : !editing && sources.some((x) => x.name === name) ? s.nameTaken : undefined;
  const repoError = kind === 'github_repo' && !/^[\w.-]+\/[\w.-]+$/.test(repo) ? s.repoInvalid : undefined;
  const tokenNeeded = kind === 'github_repo' && (!editing || replacing);
  const tokenError = tokenNeeded && !token ? s.tokenRequired : undefined;
  const secret = detectSecret([name, repo, patterns, path, include, exclude, kinds, apps].join(' '));
  const valid = !nameError && !repoError && !tokenError && !secret;

  const test = () => {
    setTestResult(null);
    run('test', () => {
      if (kind === 'github_repo' && tokenNeeded && token.length < 8) {
        setTestResult({ ok: false, message: s.testAuthFailed });
        return;
      }
      setTestResult({ ok: true, message: kind === 'github_repo' ? fmt(t.sources.testGithub, { repo, branch }) : kind === 'docs_folder' ? t.sources.testDocs : kind === 'lab' ? t.sources.testLab : fmt(t.sources.testOpenapi, { path }) });
    });
  };

  const save = () => {
    setTried(true);
    if (!valid) return;
    const [owner, repoName] = repo.split('/');
    const config: SourceConfig =
      kind === 'github_repo'
        ? { ...c, owner, repo: repoName, defaultBranch: branch, app, branchPatterns: list(patterns) }
        : kind === 'openapi'
          ? { repoSource, path, fromRole, toRole }
          : kind === 'docs_folder'
            ? { repoSource, path, include: list(include), exclude: list(exclude), kinds }
            : { ...c, root: c.root ?? 'apps/lab', apps: list(apps) };
    const target = kind === 'github_repo' ? repo : kind === 'lab' ? `hub · ${config.root}` : `${repoSource} · ${path}`;
    if (source) {
      updateAdmin((state) => ({ ...state, sources: state.sources.map((x) => (x.id === source.id ? { ...x, config, target, hasSecret: x.hasSecret || !!token } : x)) }));
      writeAudit({ action: 'sources.update', targetType: 'source', targetId: source.name, actorId: me.id, summary: replacing ? { ar: 'عدّل المصدر واستبدل التوكن', en: 'Edited the source and replaced its token' } : { ar: 'عدّل إعدادات المصدر', en: 'Edited the source’s settings' } });
      showToast({ message: fill(s.saved, { name: <Ltr mono>{source.name}</Ltr> }) });
    } else {
      const row: SourceRow = {
        id: `s-new-${name}`,
        kind,
        name,
        target,
        status: 'ok',
        enabled: true,
        hasSecret: !!token,
        intervalSec: kind === 'github_repo' ? 120 : kind === 'lab' ? 60 : 300,
        lastRunAt: NOW,
        lastSuccessAt: NOW,
        lagSec: 0,
        runs24h: 0,
        cards24h: 0,
        config,
        hours: Array(24).fill('idle'),
        runs: [],
      };
      updateAdmin((state) => ({ ...state, sources: [...state.sources, row] }));
      writeAudit({ action: 'sources.create', targetType: 'source', targetId: name, actorId: me.id, summary: { ar: 'أضاف مصدرًا جديدًا', en: 'Added a new source' } });
      showToast({ message: fill(s.added, { name: <Ltr mono>{name}</Ltr> }) });
    }
    onClose();
  };

  return (
    <Modal
      open={open}
      onOpenChange={(next) => !next && onClose()}
      className="md:max-w-xl"
      title={editing ? fill(s.editTitle, { name: <Ltr mono>{source.name}</Ltr> }) : fmt(s.addTitle, { kind: t.sources.kinds[kind] })}
      footer={
        <>
          <Button busy={busy === 'test'} className="me-auto" onClick={test}>
            {s.test}
          </Button>
          <Button onClick={onClose}>{kit.cancel}</Button>
          <Button variant="primary" onClick={save}>
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
          <Field id="source-name" label={s.name} hint={s.nameHint} error={tried ? nameError : undefined} required>
            <TextInput id="source-name" dir="ltr" className={mono} value={name} onChange={(e) => setName(e.target.value)} aria-invalid={tried && !!nameError} autoFocus />
          </Field>
        )}

        {kind === 'github_repo' && (
          <>
            <Field id="source-repo" label={s.repo} error={tried ? repoError : undefined} required>
              <TextInput id="source-repo" dir="ltr" className={mono} placeholder="owner/repo" value={repo} onChange={(e) => setRepo(e.target.value)} aria-invalid={tried && !!repoError} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="source-branch" label={s.branch}>
                <TextInput id="source-branch" dir="ltr" className={mono} value={branch} onChange={(e) => setBranch(e.target.value)} />
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
            <Field id="source-patterns" label={s.patterns} hint={s.listHint}>
              <TextInput id="source-patterns" dir="ltr" className={mono} value={patterns} onChange={(e) => setPatterns(e.target.value)} />
            </Field>
            {editing && !replacing ? (
              <div className="flex flex-wrap items-center gap-3 rounded-md border border-border p-3">
                <KeyRound aria-hidden className="size-4 text-muted-foreground" strokeWidth={1.75} />
                <p className="min-w-0 flex-1 basis-40 text-body-sm text-foreground">{s.tokenStored}</p>
                <Button size="sm" onClick={() => setReplacing(true)}>
                  {s.replaceToken}
                </Button>
              </div>
            ) : (
              <Field id="source-token" label={s.token} hint={s.tokenHint} error={tried ? tokenError : undefined} required>
                <TextInput id="source-token" type="password" dir="ltr" className={mono} autoComplete="new-password" spellCheck={false} value={token} onChange={(e) => setToken(e.target.value)} aria-invalid={tried && !!tokenError} />
              </Field>
            )}
          </>
        )}

        {(kind === 'openapi' || kind === 'docs_folder') && (
          <>
            <Field id="source-parent" label={s.repoSource}>
              <Select id="source-parent" value={repoSource} onChange={(e) => setRepoSource(e.target.value)}>
                {repos.map((r) => (
                  <option key={r.id} value={r.name}>
                    {r.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field id="source-path" label={s.path}>
              <TextInput id="source-path" dir="ltr" className={mono} value={path} onChange={(e) => setPath(e.target.value)} />
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

        {kind === 'docs_folder' && (
          <>
            <Field id="source-include" label={s.include} hint={s.listHint}>
              <TextInput id="source-include" dir="ltr" className={mono} value={include} onChange={(e) => setInclude(e.target.value)} />
            </Field>
            <Field id="source-exclude" label={s.exclude} hint={s.listHint}>
              <TextInput id="source-exclude" dir="ltr" className={mono} value={exclude} onChange={(e) => setExclude(e.target.value)} />
            </Field>
            <Field id="source-kinds" label={s.kinds}>
              <TextInput id="source-kinds" dir="ltr" className={mono} value={kinds} onChange={(e) => setKinds(e.target.value)} />
            </Field>
          </>
        )}

        {kind === 'lab' && (
          <>
            <Field id="source-root" label={s.root} hint={s.rootHint}>
              <TextInput id="source-root" dir="ltr" className={mono} value={c.root ?? 'apps/lab'} readOnly />
            </Field>
            <Field id="source-apps" label={s.apps} hint={s.listHint}>
              <TextInput id="source-apps" dir="ltr" className={mono} value={apps} onChange={(e) => setApps(e.target.value)} />
            </Field>
          </>
        )}

        {secret && <SecretFilterError pattern={secret} />}
        {testResult && (
          <p role="status" className={testResult.ok ? 'flex items-start gap-2 rounded-md bg-success-soft px-3 py-2 text-body-sm text-success-soft-foreground' : 'flex items-start gap-2 rounded-md bg-destructive-soft px-3 py-2 text-body-sm text-destructive-soft-foreground'}>
            {testResult.ok && <CircleCheck aria-hidden className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} />}
            {testResult.message}
          </p>
        )}
      </form>
    </Modal>
  );
}
