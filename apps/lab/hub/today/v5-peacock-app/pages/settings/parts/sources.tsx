import { useRef, useState } from 'react';
import { ChevronDown, CircleCheck, CircleSlash, Clock, FileSearch, FolderGit2, History, Loader2, Pencil, PlugZap, Play, Plus, Power, TriangleAlert, Unplug } from 'lucide-react';
import { DropdownMenu } from 'radix-ui';
import { useLocale, useT } from '@lab/i18n';
import { lastImport, type CaptureRun, type SourceKind, type SourceRow } from '@lab/mocks/hub-app/settings';
import {
  absolute,
  Bidi,
  Button,
  cn,
  ConfirmDialog,
  fill,
  fmt,
  isSourceProblem,
  kitMessages,
  Ltr,
  markSourceRead,
  Modal,
  num,
  Pill,
  plural,
  portalRoot,
  rel,
  RowMenu,
  SectionHeader,
  showToast,
  time,
  updateAdmin,
  useAdmin,
  useKeyboardList,
  useSession,
  when,
  writeAudit,
} from '../../../kit';
import { nowMs } from '../../../kit/format';
import { messages } from '../i18n';
import { RunStrip, useFakeRequest } from './shared';
import { SourceDialog } from './source-dialog';

const KIND_ORDER: SourceKind[] = ['github_repo', 'openapi', 'lab', 'docs_folder'];

const NOW_ISO = () => new Date(nowMs()).toISOString();

function patchSource(id: string, update: (s: SourceRow) => SourceRow) {
  updateAdmin((state) => ({ ...state, sources: state.sources.map((s) => (s.id === id ? update(s) : s)) }));
}

function freshRun(s: SourceRow, created: number): CaptureRun {
  return { id: `${s.id}-run-${s.runs.length}`, kind: s.runs[0]?.kind ?? 'github_poll', startedAt: NOW_ISO(), durationSec: 4, status: 'ok', created, updated: 0 };
}

function StatusPill({ source, running = false }: { source: SourceRow; running?: boolean }) {
  const t = useT(messages);
  const kit = useT(kitMessages);
  // The run takes a moment, so the status says so rather than jumping from failing to fine.
  if (running)
    return (
      <Pill tone="info">
        <Loader2 aria-hidden className="size-3 motion-safe:animate-spin" strokeWidth={2} />
        {t.sources.running}
      </Pill>
    );
  if (!source.enabled)
    return (
      <Pill tone="muted" icon={CircleSlash}>
        {kit.sourceStatus.disabled}
      </Pill>
    );
  if (source.status === 'failing')
    return (
      <Pill tone="danger" icon={TriangleAlert}>
        {kit.sourceStatus.failing}
      </Pill>
    );
  if (source.status === 'lagging')
    return (
      <Pill tone="warning" icon={Clock}>
        {kit.sourceStatus.lagging}
      </Pill>
    );
  return (
    <Pill tone="success" icon={CircleCheck}>
      {kit.sourceStatus.ok}
    </Pill>
  );
}

/** Failing or late source: what happened on the start side, what to do on the end side. */
function ProblemPanel({ source, primary, busy, onFix, onEdit, onRuns }: { source: SourceRow; primary: boolean; busy: boolean; onFix: () => void; onEdit: () => void; onRuns: () => void }) {
  const t = useT(messages);
  const locale = useLocale();
  const d = source.diagnosis;
  const failing = source.status === 'failing';
  const fix = d?.fix;
  return (
    <article aria-labelledby={`problem-${source.id}`} className={cn('rounded-lg border bg-card p-4 md:p-5', failing ? 'border-destructive/70' : 'border-border')}>
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <h3 id={`problem-${source.id}`} className="text-title-sm font-semibold text-foreground">
          <Ltr mono>{source.name}</Ltr>
        </h3>
        <span className="text-body-sm text-muted-foreground">{t.sources.kinds[source.kind]}</span>
        <StatusPill source={source} running={busy} />
      </header>
      <p className="mt-1 text-body-sm text-muted-foreground">
        {d ? fmt(t.sources.since, { when: when(d.since, locale), runs: plural(d.failedRuns, locale, t.sources.failedRuns) }) : null}
      </p>

      <RunStrip hours={source.hours} showLegend className="mt-4 max-w-sm" />

      <div className="mt-5 grid gap-5 lg:grid-cols-2 lg:gap-8">
        <div className="min-w-0">
          <h4 className="text-body font-semibold text-foreground">{t.sources.why}</h4>
          {d && <p className="mt-1 text-body text-foreground">{d.meaning[locale]}</p>}
          {source.lastError && (
            <div className="mt-3 rounded-md border border-border bg-muted px-3 py-2">
              <p className="text-body-sm text-foreground">
                <Bidi>{source.lastError[locale]}</Bidi>
              </p>
              {d && (
                <p className="mt-1 text-caption text-muted-foreground">
                  {t.sources.errorCode} <Ltr mono>{d.code}</Ltr>
                </p>
              )}
            </div>
          )}
        </div>
        <div className="min-w-0">
          <h4 className="text-body font-semibold text-foreground">{t.sources.toDo}</h4>
          {d && (
            <p className="mt-1 text-body text-foreground">
              {fill(d.remedy[locale], {
                glob: <Ltr mono>{fix?.kind === 'exclude' ? fix.glob : ''}</Ltr>,
                time: <Ltr className="tabular-nums">{fix?.kind === 'wait' ? time(fix.retryAt, locale) : ''}</Ltr>,
              })}
            </p>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {fix?.kind === 'exclude' && (
              <Button variant={primary ? 'primary' : 'outline'} busy={busy} onClick={onFix}>
                {fill(t.sources.fixExclude, { glob: <Ltr mono>{fix.glob}</Ltr> })}
              </Button>
            )}
            <Button onClick={onEdit} variant={fix?.kind === 'exclude' ? 'ghost' : 'outline'}>
              <Pencil aria-hidden className="size-4" strokeWidth={1.75} />
              {t.sources.edit}
            </Button>
            <Button variant="ghost" onClick={onRuns}>
              <History aria-hidden className="size-4" strokeWidth={1.75} />
              {t.sources.viewRuns}
            </Button>
          </div>
        </div>
      </div>
    </article>
  );
}

function SourceListRow({ source, rowProps, busy, onRun, onTest, onEdit, onRuns, onToggle }: { source: SourceRow; rowProps: object; busy: boolean; onRun: () => void; onTest: () => void; onEdit: () => void; onRuns: () => void; onToggle: () => void }) {
  const t = useT(messages);
  const locale = useLocale();
  return (
    <li {...rowProps} className="grid gap-x-5 gap-y-3 p-4 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_auto] md:items-center">
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <Ltr mono className="text-body font-medium text-foreground">
            {source.name}
          </Ltr>
          <span className="text-body-sm text-muted-foreground">{t.sources.kinds[source.kind]}</span>
        </p>
        <p dir="ltr" translate="no" title={source.target} className="key mt-1 truncate text-start text-caption text-muted-foreground rtl:text-end">
          {source.target}
        </p>
      </div>
      <div className="min-w-0">
        <RunStrip hours={source.hours} />
        <p className="mt-1 text-body-sm text-muted-foreground">
          {fmt(t.sources.lastRun, { when: rel(source.lastRunAt, locale) })}
          {source.cards24h > 0 && <> {plural(source.cards24h, locale, t.sources.cardsToday)}</>}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <StatusPill source={source} running={busy} />
        <span className="ms-auto flex items-center gap-1 md:ms-3">
          <Button size="sm" busy={busy} disabled={!source.enabled} onClick={onRun}>
            <Play aria-hidden className="size-3.5" strokeWidth={1.75} />
            {t.sources.runNow}
          </Button>
          <RowMenu
            label={fmt(t.sources.menu, { name: source.name })}
            items={[
              { label: t.sources.test, icon: PlugZap, onSelect: onTest, disabled: !source.enabled },
              { label: t.sources.edit, icon: Pencil, onSelect: onEdit },
              { label: t.sources.viewRuns, icon: History, onSelect: onRuns },
              source.enabled
                ? { label: t.sources.disable, icon: Unplug, onSelect: onToggle, separated: true, destructive: true }
                : { label: t.sources.enable, icon: Power, onSelect: onToggle, separated: true },
            ]}
          />
        </span>
      </div>
    </li>
  );
}

function RunsDialog({ source, onClose }: { source: SourceRow | null; onClose: () => void }) {
  const t = useT(messages);
  const locale = useLocale();
  const sameRun = source?.runs.filter((r) => r.status === 'failed') ?? [];
  return (
    <Modal open={!!source} onOpenChange={(open) => !open && onClose()} className="md:max-w-2xl" title={source ? fill(t.sources.runsTitle, { name: <Ltr mono>{source.name}</Ltr> }) : ''} description={source ? fmt(t.sources.lastSuccess, { when: when(source.lastSuccessAt, locale) }) : undefined}>
      {source && (
        <ol className="flex flex-col divide-y divide-border">
          {source.runs.map((run) => (
            <li key={run.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5">
              <Ltr className="w-32 shrink-0 text-body-sm text-foreground tabular-nums">{absolute(run.startedAt, locale)}</Ltr>
              {run.status === 'ok' ? (
                <Pill tone="success" icon={CircleCheck}>
                  {t.sources.runStatus.ok}
                </Pill>
              ) : (
                <Pill tone="danger" icon={TriangleAlert}>
                  {t.sources.runStatus.failed}
                </Pill>
              )}
              {run.status === 'ok' && <span className="text-body-sm text-muted-foreground">{fmt(t.sources.runCounts, { created: num(run.created, locale), updated: num(run.updated, locale) })}</span>}
              <span className="ms-auto text-body-sm text-muted-foreground tabular-nums">
                <Ltr>{`${num(run.durationSec, locale)} s`}</Ltr>
              </span>
              {run.error && (
                <p className="w-full text-body-sm text-muted-foreground">
                  <Bidi>{run.error[locale]}</Bidi>
                </p>
              )}
            </li>
          ))}
        </ol>
      )}
      {sameRun.length > 1 && <p className="mt-3 text-body-sm text-muted-foreground">{t.sources.sameError}</p>}
    </Modal>
  );
}

function AddSourceMenu({ primary, onPick }: { primary: boolean; onPick: (kind: SourceKind) => void }) {
  const t = useT(messages);
  const locale = useLocale();
  return (
    <DropdownMenu.Root dir={locale === 'ar' ? 'rtl' : 'ltr'}>
      <DropdownMenu.Trigger asChild>
        <Button variant={primary ? 'primary' : 'outline'}>
          <Plus aria-hidden className="size-4" strokeWidth={1.75} />
          {t.sources.add}
          <ChevronDown aria-hidden className="size-4" strokeWidth={1.75} />
        </Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal container={portalRoot()}>
        <DropdownMenu.Content align="end" sideOffset={4} collisionPadding={12} className="z-[75] min-w-56 rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-md">
          {KIND_ORDER.map((kind) => (
            <DropdownMenu.Item key={kind} onSelect={() => onPick(kind)} className="flex min-h-11 cursor-pointer items-center rounded-md px-2.5 text-body-sm text-foreground outline-none select-none data-[highlighted]:bg-accent lg:min-h-9">
              {t.sources.kinds[kind]}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

function ImportBlock() {
  const t = useT(messages);
  const locale = useLocale();
  const { me } = useSession();
  const [confirm, setConfirm] = useState(false);
  const [lastAt, setLastAt] = useState(lastImport.at);
  const [rerun, setRerun] = useState(false);
  const { busy, run } = useFakeRequest();
  const figures = [
    { label: t.sources.importBlock.decisions, value: rerun ? 0 : lastImport.decisions },
    { label: t.sources.importBlock.tasks, value: rerun ? 0 : lastImport.tasks },
    { label: t.sources.importBlock.statusNotes, value: rerun ? 0 : lastImport.statusNotes },
    { label: t.sources.importBlock.contractChanges, value: rerun ? 0 : lastImport.contractChanges },
    { label: t.sources.importBlock.skipped, value: rerun ? lastImport.decisions + lastImport.tasks + lastImport.statusNotes + lastImport.contractChanges : lastImport.skipped },
  ];
  return (
    <section aria-labelledby="import-title" className="flex flex-col gap-3 border-t border-border pt-6">
      <SectionHeader id="import-title" icon={FolderGit2} title={t.sources.importBlock.title} aside={<Button busy={busy === 'import'} onClick={() => setConfirm(true)}>{t.sources.importBlock.action}</Button>} />
      <p className="max-w-prose text-body-sm text-muted-foreground">
        {fill(t.sources.importBlock.body, { path: <Ltr mono>{lastImport.clonePath}</Ltr> })}
      </p>
      <p className="text-body-sm text-foreground">{fmt(t.sources.importBlock.last, { when: absolute(lastAt, locale) })}</p>
      <dl className="flex flex-wrap gap-x-6 gap-y-2">
        {figures.map((f) => (
          <div key={f.label} className="flex items-baseline gap-1.5">
            <dd className="text-body font-semibold text-foreground tabular-nums">
              <Ltr>{num(f.value, locale)}</Ltr>
            </dd>
            <dt className="text-body-sm text-muted-foreground">{f.label}</dt>
          </div>
        ))}
      </dl>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        destructive={false}
        title={t.sources.importBlock.confirmTitle}
        description={t.sources.importBlock.confirmBody}
        confirmLabel={t.sources.importBlock.action}
        onConfirm={() =>
          run('import', () => {
            setRerun(true);
            setLastAt(NOW_ISO());
            writeAudit({ action: 'capture.import.goteav', targetType: 'workspace', targetId: null, actorId: me.id, summary: { ar: 'إعادة استيراد تاريخ جوتيف: لا عناصر جديدة', en: 'Re-imported Goteav history: nothing new' } });
            showToast({ message: t.sources.importBlock.done });
          })
        }
      />
    </section>
  );
}

export function SourcesTab() {
  const t = useT(messages);
  const locale = useLocale();
  const { scenario, me } = useSession();
  const { sources } = useAdmin(scenario);
  const [dialog, setDialog] = useState<{ mode: 'add'; kind: SourceKind } | { mode: 'edit'; id: string } | null>(null);
  const [runsId, setRunsId] = useState<string | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);
  const { busy, run } = useFakeRequest();
  const listHeading = useRef<HTMLHeadingElement>(null);

  const order = { failing: 0, lagging: 1, ok: 2 } as const;
  const problems = sources.filter(isSourceProblem).sort((a, b) => order[a.status] - order[b.status]);
  const rest = sources.filter((s) => !isSourceProblem(s));
  const hasFix = problems.some((p) => p.diagnosis?.fix.kind === 'exclude');
  const list = useKeyboardList({ ids: rest.map((s) => s.id), onOpen: setRunsId, emptyFocusRef: listHeading });

  const say = (ar: string, en: string) => ({ ar, en });

  const applyFix = (source: SourceRow) => {
    const fix = source.diagnosis?.fix;
    if (fix?.kind !== 'exclude') return;
    run(source.id, () => {
      const before = source;
      patchSource(source.id, (s) => ({
        ...s,
        status: 'ok',
        lastError: undefined,
        diagnosis: undefined,
        lagSec: 0,
        lastRunAt: NOW_ISO(),
        lastSuccessAt: NOW_ISO(),
        config: { ...s.config, exclude: [...(s.config.exclude ?? []), fix.glob] },
        hours: [...s.hours.slice(0, -1), 'partial'],
        runs: [freshRun(s, 3), ...s.runs],
      }));
      writeAudit({ action: 'sources.update', targetType: 'source', targetId: source.name, actorId: me.id, summary: say(`إضافة ${fix.glob} إلى الاستثناءات وتشغيل المصدر: نجح التشغيل`, `Added ${fix.glob} to the exclude list and ran the source; the run passed`) });
      // The notification about this failure has been answered, as with a card (review M4).
      const undoRead = markSourceRead(source.id);
      listHeading.current?.focus({ preventScroll: true });
      showToast({
        message: fill(t.sources.fixed, { name: <Ltr mono>{source.name}</Ltr> }),
        onUndo: () => {
          patchSource(source.id, () => before);
          undoRead();
        },
      });
    });
  };

  const runNow = (source: SourceRow) => {
    run(source.id, () => {
      const created = source.cards24h > 0 ? 1 : 0;
      patchSource(source.id, (s) => ({ ...s, lastRunAt: NOW_ISO(), lastSuccessAt: NOW_ISO(), lagSec: 0, runs: [freshRun(s, created), ...s.runs], cards24h: s.cards24h + created }));
      writeAudit({ action: 'sources.run', targetType: 'source', targetId: source.name, actorId: me.id, summary: say('تشغيل المصدر يدويًا', 'Ran the source by hand') });
      showToast({ message: fill(plural(created, locale, t.sources.ranForms), { name: <Ltr mono>{source.name}</Ltr> }) });
    });
  };

  const test = (source: SourceRow) => {
    run(source.id, () => {
      const c = source.config;
      const details =
        source.kind === 'github_repo'
          ? fmt(t.sources.testGithub, { repo: `${c.owner}/${c.repo}`, branch: c.defaultBranch ?? '' })
          : source.kind === 'docs_folder'
            ? t.sources.testDocs
            : source.kind === 'lab'
              ? t.sources.testLab
              : fmt(t.sources.testOpenapi, { path: c.path ?? '' });
      writeAudit({ action: 'sources.test', targetType: 'source', targetId: source.name, actorId: me.id, summary: say('فحص الاتصال نجح', 'Connection test passed') });
      showToast({ message: <Bidi>{details}</Bidi> });
    });
  };

  const setEnabled = (source: SourceRow, enabled: boolean) => {
    patchSource(source.id, (s) => ({ ...s, enabled }));
    writeAudit({ action: enabled ? 'sources.enable' : 'sources.disable', targetType: 'source', targetId: source.name, actorId: me.id, summary: enabled ? say('تفعيل المصدر', 'Enabled the source') : say('تعطيل المصدر', 'Disabled the source') });
    showToast({
      message: fill(enabled ? t.sources.enabled : t.sources.disabled, { name: <Ltr mono>{source.name}</Ltr> }),
      onUndo: () => patchSource(source.id, (s) => ({ ...s, enabled: !enabled })),
    });
  };

  const toggled = sources.find((s) => s.id === toggling);
  const editing = dialog?.mode === 'edit' ? sources.find((s) => s.id === dialog.id) : undefined;

  return (
    <>
      {problems.length > 0 ? (
        <section aria-labelledby="problems-title" className="flex flex-col gap-3">
          <SectionHeader
            id="problems-title"
            icon={TriangleAlert}
            title={plural(problems.length, locale, t.sources.needAttention)}
            aside={<AddSourceMenu primary={!hasFix} onPick={(kind) => setDialog({ mode: 'add', kind })} />}
          />
          <div className="flex flex-col gap-3">
            {problems.map((source) => (
              <ProblemPanel key={source.id} source={source} primary={source === problems.find((p) => p.diagnosis?.fix.kind === 'exclude')} busy={busy === source.id} onFix={() => applyFix(source)} onEdit={() => setDialog({ mode: 'edit', id: source.id })} onRuns={() => setRunsId(source.id)} />
            ))}
          </div>
        </section>
      ) : null}

      <section aria-labelledby="sources-title" className="flex flex-col gap-3">
        <SectionHeader
          ref={listHeading}
          id="sources-title"
          icon={FileSearch}
          title={problems.length ? t.sources.others : fmt(t.sources.allHealthy, { n: num(rest.filter((s) => s.enabled).length, locale) })}
          count={problems.length ? rest.length : undefined}
          aside={problems.length === 0 ? <AddSourceMenu primary onPick={(kind) => setDialog({ mode: 'add', kind })} /> : undefined}
        />
        <ul data-hub-list className="flex flex-col divide-y divide-border rounded-lg border border-border bg-card">
          {rest.map((source) => (
            <SourceListRow
              key={source.id}
              source={source}
              rowProps={list.rowProps(source.id)}
              busy={busy === source.id}
              onRun={() => runNow(source)}
              onTest={() => test(source)}
              onEdit={() => setDialog({ mode: 'edit', id: source.id })}
              onRuns={() => setRunsId(source.id)}
              onToggle={() => (source.enabled ? setToggling(source.id) : setEnabled(source, true))}
            />
          ))}
        </ul>
      </section>

      <ImportBlock />

      <RunsDialog source={sources.find((s) => s.id === runsId) ?? null} onClose={() => setRunsId(null)} />
      <SourceDialog key={dialog?.mode === 'edit' ? dialog.id : (dialog?.kind ?? 'none')} open={!!dialog} onClose={() => setDialog(null)} kind={dialog?.mode === 'add' ? dialog.kind : (editing?.kind ?? 'github_repo')} source={editing} sources={sources} />
      <ConfirmDialog
        open={!!toggled}
        onOpenChange={(open) => !open && setToggling(null)}
        title={toggled ? fill(t.sources.disableTitle, { name: <Ltr mono>{toggled.name}</Ltr> }) : ''}
        description={t.sources.disableBody}
        confirmLabel={t.sources.disable}
        onConfirm={() => toggled && setEnabled(toggled, false)}
      />
    </>
  );
}
