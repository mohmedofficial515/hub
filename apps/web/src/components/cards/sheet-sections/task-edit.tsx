'use client';

/**
 * @file task-edit.tsx
 * @description Every field of a task, in one form (docs/15 §1). The header and the detail are two endpoints with two permission rows, and a field this member may not change
 * stays visible and disabled. `card.allowedActions` is the API's answer, so no rule is written here.
 */
import type { UpdateCardInput } from '@hub/contracts';
import { useId, useState } from 'react';

import { setQuery, useRoute } from '@/components/shell/router';
import { detectSecret, Field, SecretFilterError, Select, TextInput } from '@/components/ui/form';
import type { Priority, Role, TaskCard, TaskDetail } from '@/features/cards/types';
import { useMembers } from '@/features/session/session';
import { saveTask, type TaskDetailPatch } from '@/features/tasks/queries';
import { kitMessages, useT } from '@/lib/i18n';

import {
  FormActions,
  FormFailure,
  fromLocalInput,
  MarkdownField,
  parseTags,
  toLocalInput,
  useEditWords,
  useSaveForm,
} from './edit-bits';
import { ActionPanel } from './shared';

const SPECIALTIES: TaskDetail['specialty'][] = ['backend', 'frontend', 'design', 'qa', 'ops', 'docs'];
const EFFORTS: NonNullable<TaskDetail['effort']>[] = ['S', 'M', 'L', 'XL'];
const PRIORITIES: Priority[] = ['P0', 'P1', 'P2', 'P3'];
const ROLES: Role[] = ['owner', 'pm', 'accountant', 'backend', 'frontend', 'designer', 'qa'];

interface TaskWords {
  edit: {
    specialty: string;
    effort: string;
    noEffort: string;
    role: string;
    noRole: string;
    assignee: string;
    noAssignee: string;
    due: string;
    module: string;
    repo: string;
    branch: string;
    pr: string;
    prInvalid: string;
    acceptance: string;
    acceptanceHint: string;
    prompt: string;
    promptHint: string;
    who: string;
  };
}

const isUrl = (text: string) => {
  try {
    return !!new URL(text);
  } catch {
    return false;
  }
};

export function TaskEditForm({ card }: { card: TaskCard }) {
  const w = useEditWords();
  const e = useT<TaskWords>('tasks').edit;
  const kit = useT(kitMessages);
  const { ws } = useRoute();
  const id = useId();
  const members = useMembers().data ?? [];
  const { busy, failure, save } = useSaveForm();
  const task = card.task;

  const canContent = card.allowedActions.includes('card.edit_content');
  const canRouting = card.allowedActions.includes('card.edit_routing');
  const canDetail = card.allowedActions.includes('task.edit_detail');

  const [title, setTitle] = useState(card.title);
  const [body, setBody] = useState(card.body ?? '');
  const [specialty, setSpecialty] = useState(task.specialty);
  const [effort, setEffort] = useState<string>(task.effort ?? '');
  const [priority, setPriority] = useState(card.priority);
  const [role, setRole] = useState<string>(card.ownerRole ?? '');
  const [assignee, setAssignee] = useState(card.assigneeId ?? '');
  const [due, setDue] = useState(toLocalInput(card.dueAt));
  const [moduleName, setModuleName] = useState(card.module ?? '');
  const [tags, setTags] = useState(card.tags.join(', '));
  const [repo, setRepo] = useState(card.repo ?? '');
  const [branch, setBranch] = useState(task.branch ?? card.branch ?? '');
  const [pr, setPr] = useState(task.prUrl ?? '');
  const [acceptance, setAcceptance] = useState(task.acceptance ?? '');
  const [prompt, setPrompt] = useState(task.prompt ?? '');
  const [tried, setTried] = useState(false);

  const noTitle = !title.trim();
  const badPr = !!pr.trim() && !isUrl(pr.trim());
  const secret =
    [title, body, moduleName, tags, repo, branch, pr, acceptance, prompt].map(detectSecret).find(Boolean) ??
    null;

  const submit = () => {
    setTried(true);
    if (noTitle || badPr || secret) return;
    const header: UpdateCardInput = {};
    const detail: TaskDetailPatch = {};
    const text = (value: string) => value.trim() || null;
    if (canContent) {
      if (title.trim() !== card.title) header.title = title.trim();
      if (text(body) !== (card.body ?? null)) header.body = text(body);
      if (text(moduleName) !== (card.module ?? null)) header.module = text(moduleName);
      if (text(repo) !== (card.repo ?? null)) header.repo = text(repo);
      const nextTags = parseTags(tags);
      if (nextTags.join() !== card.tags.join()) header.tags = nextTags;
    }
    if (canRouting) {
      if (priority !== card.priority) header.priority = priority;
      if ((role || null) !== card.ownerRole) header.ownerRole = (role || null) as Role | null;
      if ((assignee || null) !== (card.assigneeId ?? null)) header.assignee = assignee || null;
      if (due !== toLocalInput(card.dueAt)) header.dueAt = fromLocalInput(due);
    }
    if (canDetail) {
      if (specialty !== task.specialty) detail.specialty = specialty;
      if ((effort || null) !== (task.effort ?? null)) {
        detail.effort = (effort || null) as TaskDetailPatch['effort'] & string;
      }
      if (text(branch) !== (task.branch ?? card.branch ?? null)) detail.branch = text(branch);
      if (text(pr) !== (task.prUrl ?? null)) detail.prUrl = text(pr);
      if (text(acceptance) !== (task.acceptance ?? null)) detail.acceptance = text(acceptance);
      if (text(prompt) !== (task.prompt ?? null)) detail.prompt = text(prompt);
    }
    void save(() => saveTask(ws, card.key, header, detail));
  };

  return (
    <ActionPanel onSubmit={submit}>
      <Field
        id={`${id}-title`}
        label={w.title}
        required
        error={tried && noTitle ? w.titleRequired : undefined}
      >
        <TextInput
          id={`${id}-title`}
          dir="auto"
          disabled={!canContent}
          value={title}
          onChange={(ev) => setTitle(ev.target.value)}
          aria-invalid={tried && noTitle}
        />
      </Field>
      <MarkdownField label={w.body} rows={4} value={body} onChange={setBody} />

      <div className="grid gap-3 sm:grid-cols-2">
        <Field id={`${id}-specialty`} label={e.specialty}>
          <Select
            id={`${id}-specialty`}
            disabled={!canDetail}
            value={specialty}
            onChange={(ev) => setSpecialty(ev.target.value as TaskDetail['specialty'])}
          >
            {SPECIALTIES.map((s) => (
              <option key={s} value={s}>
                {kit.sheet.task.specialties[s]}
              </option>
            ))}
          </Select>
        </Field>
        <Field id={`${id}-effort`} label={e.effort}>
          <Select
            id={`${id}-effort`}
            disabled={!canDetail}
            value={effort}
            onChange={(ev) => setEffort(ev.target.value)}
          >
            <option value="">{e.noEffort}</option>
            {EFFORTS.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </Select>
        </Field>
        <Field id={`${id}-priority`} label={w.priority}>
          <Select
            id={`${id}-priority`}
            disabled={!canRouting}
            value={priority}
            onChange={(ev) => setPriority(ev.target.value as Priority)}
          >
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </Select>
        </Field>
        <Field id={`${id}-role`} label={e.role}>
          <Select
            id={`${id}-role`}
            disabled={!canRouting}
            value={role}
            onChange={(ev) => setRole(ev.target.value)}
          >
            <option value="">{e.noRole}</option>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {kit.roles[r]}
              </option>
            ))}
          </Select>
        </Field>
        <Field id={`${id}-assignee`} label={e.assignee}>
          <Select
            id={`${id}-assignee`}
            disabled={!canRouting}
            value={assignee}
            onChange={(ev) => setAssignee(ev.target.value)}
          >
            <option value="">{e.noAssignee}</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field id={`${id}-due`} label={e.due}>
          <TextInput
            id={`${id}-due`}
            type="datetime-local"
            dir="ltr"
            className="text-start"
            disabled={!canRouting}
            value={due}
            onChange={(ev) => setDue(ev.target.value)}
          />
        </Field>
        <Field id={`${id}-module`} label={e.module}>
          <TextInput
            id={`${id}-module`}
            dir="ltr"
            className="text-start"
            disabled={!canContent}
            value={moduleName}
            onChange={(ev) => setModuleName(ev.target.value)}
          />
        </Field>
        <Field id={`${id}-repo`} label={e.repo}>
          <TextInput
            id={`${id}-repo`}
            dir="ltr"
            className="key text-start"
            disabled={!canContent}
            value={repo}
            onChange={(ev) => setRepo(ev.target.value)}
          />
        </Field>
      </div>

      <Field id={`${id}-tags`} label={w.tags} hint={w.tagsHint}>
        <TextInput
          id={`${id}-tags`}
          dir="auto"
          disabled={!canContent}
          value={tags}
          onChange={(ev) => setTags(ev.target.value)}
        />
      </Field>
      <Field id={`${id}-branch`} label={e.branch}>
        <TextInput
          id={`${id}-branch`}
          dir="ltr"
          className="key text-start"
          placeholder="feat/…"
          disabled={!canDetail}
          value={branch}
          onChange={(ev) => setBranch(ev.target.value)}
        />
      </Field>
      <Field id={`${id}-pr`} label={e.pr} error={tried && badPr ? e.prInvalid : undefined}>
        <TextInput
          id={`${id}-pr`}
          dir="ltr"
          className="key text-start"
          placeholder="https://github.com/…/pull/123"
          disabled={!canDetail}
          value={pr}
          onChange={(ev) => setPr(ev.target.value)}
          aria-invalid={tried && badPr}
        />
      </Field>
      <MarkdownField
        label={e.acceptance}
        hint={e.acceptanceHint}
        rows={4}
        value={acceptance}
        onChange={setAcceptance}
      />
      <MarkdownField label={e.prompt} hint={e.promptHint} rows={4} value={prompt} onChange={setPrompt} />

      {(!canContent || !canRouting || !canDetail) && (
        <p className="text-body-sm text-muted-foreground">{e.who}</p>
      )}
      {secret && <SecretFilterError pattern={secret} />}
      <FormFailure message={failure} />
      <FormActions busy={busy} onCancel={() => setQuery({ action: null })} />
    </ActionPanel>
  );
}
