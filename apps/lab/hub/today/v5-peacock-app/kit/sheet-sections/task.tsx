import { useId, useState } from 'react';
import { ExternalLink, FileText, Plus } from 'lucide-react';
import { useLocale, useT } from '@lab/i18n';
import { cn } from '@lab/ui/hub-cn';
import { ActorChip } from '../avatar';
import { Pill } from '../badges';
import { Button } from '../button';
import { CardChip } from '../card-key';
import { addLink, openBlockers, updateTask } from '../card-store';
import { CopyButton } from '../copy-button';
import { Field, SecretFilterError, TextInput, Textarea, detectSecret } from '../form';
import { absolute, duration, hoursFromNow, nowMs } from '../format';
import { kitMessages } from '../i18n';
import { focusRing } from '../meta';
import { CardPicker, DocPicker } from '../pickers';
import { RelativeTime } from '../relative-time';
import { useSession } from '../session';
import { Ltr, fill, fmt } from '../text';
import { ActionPanel, Checklist, Fact, Facts, NoteActionForm, SubHeading, type SectionProps } from './shared';

/** Strings only this section needs. The shared vocabulary stays in `kit/i18n.ts`. */
const messages = {
  ar: {
    pasteHint: 'في Claude Code الصق {cmd}',
    copyPrompt: 'انسخ الأمر',
    pr: 'Pull request',
    openPr: 'افتح PR #{n}',
    prOptional: 'رابط PR (اختياري)',
    submitNote: 'ملاحظة للمراجع (اختيارية)',
    saveSubmit: 'أرسل للمراجعة',
    reopenNote: 'ما الذي يحتاج تعديلًا؟',
    reopenRequired: 'اكتب ما يحتاج تعديلًا ليعرفه من حجزها.',
    saveReopen: 'أعدها للتنفيذ',
    started: 'بدأت',
    finished: 'أُنجزت',
    bindBranch: 'اربط فرعًا',
    branchLabel: 'اسم الفرع',
    branchHint: 'يُربط تلقائيًا أيضًا حين يذكر سجل جلسة مفتاح المهمة.',
    saveBranch: 'اربط',
    addBlocker: 'أضف بطاقة توقفها',
    addDoc: 'اربط وثيقة',
    blockerTitle: 'بطاقات تتوقف عليها هذه المهمة',
    docTitle: 'وثائق مرتبطة بهذه المهمة',
    overdue: 'متأخرة {d}',
    dueSoon: 'تبقّى {d}',
  },
  en: {
    pasteHint: 'In Claude Code paste {cmd}',
    copyPrompt: 'Copy prompt',
    pr: 'Pull request',
    openPr: 'Open PR #{n}',
    prOptional: 'PR link (optional)',
    submitNote: 'Note for the reviewer (optional)',
    saveSubmit: 'Submit for review',
    reopenNote: 'What needs changing?',
    reopenRequired: 'Write what needs changing, so the claimer knows.',
    saveReopen: 'Send back',
    started: 'Started',
    finished: 'Finished',
    bindBranch: 'Bind a branch',
    branchLabel: 'Branch name',
    branchHint: 'It also binds by itself when a session log names the task key.',
    saveBranch: 'Bind',
    addBlocker: 'Add a blocker',
    addDoc: 'Link a doc',
    blockerTitle: 'Cards this task waits on',
    docTitle: 'Docs related to this task',
    overdue: '{d} overdue',
    dueSoon: '{d} left',
  },
};

function SubmitForm({ onSave, onCancel }: { onSave: (prUrl: string, note: string) => void; onCancel: () => void }) {
  const t = useT(messages);
  const kit = useT(kitMessages);
  const id = useId();
  const [pr, setPr] = useState('');
  const [note, setNote] = useState('');
  const secret = detectSecret(pr) ?? detectSecret(note);
  return (
    <ActionPanel
      onSubmit={() => {
        if (!secret) onSave(pr.trim(), note.trim());
      }}
    >
      <Field id={`${id}-pr`} label={t.prOptional}>
        <TextInput id={`${id}-pr`} dir="ltr" className="key text-start" placeholder="https://github.com/…/pull/123" value={pr} onChange={(e) => setPr(e.target.value)} />
      </Field>
      <Field id={`${id}-note`} label={t.submitNote}>
        <Textarea id={`${id}-note`} dir="auto" rows={2} value={note} onChange={(e) => setNote(e.target.value)} aria-invalid={!!secret} />
      </Field>
      {secret && <SecretFilterError pattern={secret} />}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="primary">
          {t.saveSubmit}
        </Button>
        <Button onClick={onCancel}>{kit.cancel}</Button>
      </div>
    </ActionPanel>
  );
}

function BranchBinder({ cardKey }: { cardKey: string }) {
  const t = useT(messages);
  const { me } = useSession();
  const id = useId();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState('');
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={cn('hit-44 inline-flex items-center gap-1 rounded-sm text-body-sm font-medium text-primary underline-offset-4 hover:underline', focusRing)}>
        {t.bindBranch}
      </button>
    );
  }
  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (value.trim()) updateTask(cardKey, me.id, { branch: value.trim() });
      }}
    >
      <Field id={id} label={t.branchLabel} hint={t.branchHint}>
        <div className="flex gap-2">
          <TextInput id={id} dir="ltr" autoFocus className="key min-w-0 text-start" placeholder="feat/…" value={value} onChange={(e) => setValue(e.target.value)} />
          <Button type="submit" disabled={!value.trim()}>
            {t.saveBranch}
          </Button>
        </div>
      </Field>
    </form>
  );
}

/** 08 §5.4 TaskSection: who, how big, what it waits on, what done means, and the prompt that starts the work. */
export function TaskSection({ card, action, cancelAction, perform }: SectionProps<'task'>) {
  const t = useT(messages);
  const kit = useT(kitMessages);
  const locale = useLocale();
  const { me, isManager } = useSession();
  const task = card.task;
  const s = kit.sheet.task;
  const [picker, setPicker] = useState<'blocker' | 'doc' | null>(null);

  const closed = card.status === 'done' || card.status === 'cancelled';
  const blockerKeys = card.links.filter((l) => l.kind === 'blocked_by').map((l) => l.key);
  const stillOpen = openBlockers(card);
  const canEdit = !closed && (isManager || card.createdById === me.id || task.claimedById === me.id);
  const canBind = !closed && !task.branch && (task.claimedById === me.id || isManager);
  const command = `/hub:next ${card.key}`;
  const longPrompt = task.prompt && task.prompt !== command ? task.prompt : null;
  const prNumber = task.prUrl ? /(\d+)\/?$/.exec(task.prUrl)?.[1] : undefined;
  const h = card.dueAt ? hoursFromNow(card.dueAt) : null;

  return (
    <div className="flex flex-col gap-5">
      {action === 'submit' && <SubmitForm onSave={(prUrl, note) => perform('submit', { prUrl: prUrl || undefined, note: note || undefined })} onCancel={cancelAction} />}
      {action === 'reopen' && <NoteActionForm noteLabel={t.reopenNote} required requiredMessage={t.reopenRequired} saveLabel={t.saveReopen} onSave={(note) => perform('reopen', { note })} onCancel={cancelAction} />}

      {(blockerKeys.length > 0 || canEdit) && (
        <div className="flex flex-col gap-1.5">
          {blockerKeys.length > 0 && <SubHeading>{kit.sheet.links.kinds.blocked_by}</SubHeading>}
          {blockerKeys.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {blockerKeys.map((key) => (
                <CardChip key={key} k={key} showTitle showStatus className={cn('h-auto min-h-8 py-1', !stillOpen.includes(key) && 'border-dashed')} />
              ))}
            </div>
          )}
          {canEdit && (
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              <button type="button" onClick={() => setPicker('blocker')} className={cn('hit-44 inline-flex items-center gap-1 rounded-sm text-body-sm font-medium text-primary underline-offset-4 hover:underline', focusRing)}>
                <Plus aria-hidden className="size-3.5" strokeWidth={2} />
                {t.addBlocker}
              </button>
              <button type="button" onClick={() => setPicker('doc')} className={cn('hit-44 inline-flex items-center gap-1 rounded-sm text-body-sm font-medium text-primary underline-offset-4 hover:underline', focusRing)}>
                <FileText aria-hidden className="size-3.5" strokeWidth={1.75} />
                {t.addDoc}
              </button>
            </div>
          )}
        </div>
      )}

      <Facts>
        <Fact label={s.specialty}>{s.specialties[task.specialty]}</Fact>
        {task.effort && (
          <Fact label={s.effort}>
            <Ltr mono>{task.effort}</Ltr>
          </Fact>
        )}
        {card.dueAt && (
          <Fact label={kit.sheet.fields.due}>
            <span title={absolute(card.dueAt, locale)} className="flex flex-wrap items-center gap-2">
              <RelativeTime iso={card.dueAt} />
              {!closed && h !== null && h < 0 && <Pill tone="danger">{fmt(t.overdue, { d: duration(Date.parse(card.dueAt) - nowMs(), locale) })}</Pill>}
              {!closed && h !== null && h >= 0 && h <= 24 && <Pill tone="warning">{fmt(t.dueSoon, { d: duration(Date.parse(card.dueAt) - nowMs(), locale, { nominative: true }) })}</Pill>}
            </span>
          </Fact>
        )}
        <Fact label={s.origin}>{s.origins[task.origin]}</Fact>
        <Fact label={s.claimer} wide={!!task.claimedById}>
          {task.claimedById ? (
            <span className="flex flex-wrap items-center gap-2">
              <ActorChip memberId={task.claimedById} />
              {task.claimedAt && <RelativeTime iso={task.claimedAt} className="text-muted-foreground" />}
            </span>
          ) : (
            <span className="text-muted-foreground">{s.unclaimed}</span>
          )}
        </Fact>
        {task.startedAt && (
          <Fact label={t.started}>
            <RelativeTime iso={task.startedAt} />
          </Fact>
        )}
        {task.doneAt && (
          <Fact label={t.finished}>
            <RelativeTime iso={task.doneAt} />
          </Fact>
        )}
        <Fact label={kit.sheet.fields.branch} wide>
          {task.branch ? (
            <code dir="ltr" translate="no" className="key break-all">
              {task.branch}
            </code>
          ) : canBind ? (
            <BranchBinder cardKey={card.key} />
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </Fact>
        {task.prUrl && (
          <Fact label={t.pr} wide>
            <a href={task.prUrl} target="_blank" rel="noreferrer" className={cn('inline-flex items-center gap-1 rounded-sm font-medium text-primary underline-offset-4 hover:underline', focusRing)}>
              {fmt(t.openPr, { n: prNumber ?? '' })}
              <ExternalLink aria-hidden className="size-3.5" strokeWidth={1.75} />
            </a>
          </Fact>
        )}
      </Facts>

      {task.acceptance && (
        <div className="flex flex-col gap-2">
          <SubHeading>{s.acceptance}</SubHeading>
          <Checklist markdown={task.acceptance[locale]} />
        </div>
      )}

      {!closed && (
        <div className="flex flex-col gap-2">
          <SubHeading>{s.prompt}</SubHeading>
          {longPrompt && (
            <div className="flex items-start gap-2 rounded-md border border-border bg-muted p-3">
              <pre dir="ltr" translate="no" className="key min-w-0 flex-1 text-start text-body-sm whitespace-pre-wrap text-foreground">
                {longPrompt}
              </pre>
              <CopyButton text={longPrompt} showText={false} label={t.copyPrompt} />
            </div>
          )}
          {/* 09 §6 `tasks.openInClaude`: a mono line with its copy button. */}
          <p className="flex flex-wrap items-center gap-2 text-body-sm text-muted-foreground">{fill(t.pasteHint, { cmd: <CopyButton compact text={command} /> })}</p>
        </div>
      )}

      <CardPicker
        open={picker === 'blocker'}
        onOpenChange={(open) => !open && setPicker(null)}
        title={t.blockerTitle}
        exclude={[card.key, ...blockerKeys]}
        onConfirm={(keys) => keys.forEach((key) => addLink(card.key, me.id, 'blocked_by', key))}
      />
      <DocPicker
        open={picker === 'doc'}
        onOpenChange={(open) => !open && setPicker(null)}
        title={t.docTitle}
        exclude={card.links.filter((l) => l.kind === 'relates').map((l) => l.key)}
        onConfirm={(keys) => keys.forEach((key) => addLink(card.key, me.id, 'relates', key))}
      />
    </div>
  );
}
