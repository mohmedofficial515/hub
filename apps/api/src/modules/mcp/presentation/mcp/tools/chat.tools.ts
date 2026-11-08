/**
 * @file Handlers of the chat and document-writing tools. They call the same services as the panel and Docs.
 * @description Starting, sending to, stopping or answering a chat has no tool: those are the owner's own press (`chat.run`, `chat.answer`), so an agent cannot start agents or approve its own call.
 */
import {
  type AgentRunDto,
  type ChatDocDraftDto,
  type ChatDto,
  type SaveDocResult,
  stageFitsProtocol,
  type WorkReport,
} from '@hub/contracts';

import { AppException } from '@/shared/errors';

import type { ToolHandlers } from '../tool-context';

function renderChat(chat: ChatDto): string {
  return `${chat.title || '(no title yet)'} (\`${chat.id}\`): ${chat.mode}, ${chat.deviceName}, ${chat.folder}${chat.pinned ? ', pinned' : ''}${chat.running ? ', running' : ''}${chat.deletedAt ? ', deleted' : ''}`;
}

const MOVE_WORDS: Readonly<Record<WorkReport['move']['reason'], string>> = {
  all_verified:
    'Every check is verified against a real step, so the task moved to In review. The owner completes it.',
  no_checks: 'It stays where it is: the report has no checks.',
  check_not_passed: 'It stays where it is: not every check passed.',
  check_not_verified: 'It stays where it is: not every check matches a real step that succeeded.',
  check_dropped: 'It stays where it is: this report leaves out a check an earlier report named.',
  outside_panel: 'This chat is outside the panel, so the checks stay claimed and the task does not move.',
  not_a_task: 'It stays where it is: this card is not a task.',
  wrong_status: 'It stays where it is: only a started task moves to In review.',
  not_permitted: 'It stays where it is: your roles do not allow moving it.',
};

function renderReport(report: WorkReport): string {
  const checks = report.checks.map((check) => {
    const failed = check.runs.filter((run) => run.status === 'failed').length;
    return `- ${check.name}: ${check.outcome}, ${check.verified ? 'verified' : `not verified (${check.basis})`}${check.runs.length > 0 ? `, ${check.runs.length} real runs, ${failed} failed` : ''}`;
  });
  return [
    `${report.cardKey}: ${report.summary}`,
    ...checks,
    ...(report.notChecked.length > 0 ? [`Not checked: ${report.notChecked.join('; ')}`] : []),
    ...(report.droppedChecks.length > 0
      ? [`Left out since an earlier report: ${report.droppedChecks.join(', ')}`]
      : []),
    `Files, from ${report.filesFrom}: ${report.changedFiles.map((file) => file.path).join(', ') || 'none'}`,
    MOVE_WORDS[report.move.reason],
  ].join('\n');
}

function renderDraft(draft: ChatDocDraftDto, inPanel: boolean): string {
  const flags = draft.claims.filter((claim) => claim.status === 'unverified');
  return [
    `Draft \`${draft.id}\` of ${draft.docKey ?? `${draft.source}/${draft.path}`}.`,
    ...(draft.baseVersion ? [`Compared with version ${draft.baseVersion}.`] : ['A new document.']),
    ...(draft.duplicates.length > 0
      ? [
          'Hub found documents like this one. Show the user, and do not write a second one on the same topic:',
          ...draft.duplicates.map(
            (doc) => `- ${doc.key}: ${doc.title} (${doc.source}/${doc.path}) ${doc.url}`,
          ),
        ]
      : ['Hub found no similar document.']),
    ...(flags.length > 0
      ? ['Flagged, each needing the owner:', ...flags.map((claim) => `- ${claim.id}: ${claim.text}`)]
      : []),
    inPanel
      ? `The owner sees this in the panel. Now call save_doc with draft "${draft.id}": it waits for them.`
      : `Show the user the draft and the flags. When they agree, call save_doc with draft "${draft.id}", and their answer to each flag in \`answers\`.`,
  ].join('\n');
}

function renderRun(run: AgentRunDto): string {
  const when = run.state === 'scheduled' && run.runAt ? `, at ${run.runAt}` : '';
  const repeat = run.repeat ? `, every ${run.repeat.day} ${run.repeat.time}` : '';
  const hold = run.hold ? `, held: ${run.hold}` : '';
  const waiting = run.waitingOn ? `, waiting on: ${run.waitingOn.command}` : '';
  const ended = run.summary
    ? `
  ${run.summary}`
    : '';
  return `- ${run.title}${run.cardKey ? ` (${run.cardKey})` : ''}: ${run.state}${when}${repeat}${hold}${waiting}, ${run.folder} on ${run.deviceName}${run.failure ? `, ${run.failure}` : ''}${ended}`;
}

export const chatToolHandlers = {
  async list_queue(context, input) {
    const actor = await context.allowed('queue.read');
    const { state, runs } = await context.deps.agentQueue.queue(
      actor,
      input.card ? { card: input.card } : {},
    );
    const head = [
      `Queue: ${state.paused ? `paused (${state.pausedReason ?? 'owner'}${state.resumesAt ? `, until ${state.resumesAt}` : ''})` : 'running'}. ${state.running} of ${state.maxConcurrent} at once, ${state.usedToday} of ${state.perDay} today, timezone ${state.timezone}${state.quietHours ? `, quiet ${state.quietHours.from}-${state.quietHours.to}` : ''}.`,
      'Only the owner can add, move, pause or cancel a run, in Hub.',
    ];
    const lines = runs.length === 0 ? [...head, 'No runs.'] : [...head, ...runs.map(renderRun)];
    return lines.join('\n');
  },

  async list_chats(context, input) {
    const actor = await context.allowed('chat.read');
    const chats = await context.deps.chats.list(actor, { deleted: input.deleted === true });
    return chats.length === 0 ? 'No chats.' : chats.map(renderChat).join('\n');
  },
  async get_chat(context, input) {
    const actor = await context.allowed('chat.read');
    const chat = await context.deps.chats.get(actor, input.chat);
    const lines = chat.messages.flatMap((message) => [
      `${message.role === 'user' ? 'User' : `Claude${message.status ? ` (${message.status})` : ''}`}: ${message.content}`,
      ...message.steps.map((step) => `  - ${step.name}: ${step.status}`),
      ...message.changedFiles.map(
        (file) =>
          `  - changed ${file.path}${file.additions === undefined ? '' : ` +${file.additions} -${file.deletions ?? 0}`}`,
      ),
    ]);
    return [renderChat(chat), ...lines].join('\n');
  },
  async export_chat(context, input) {
    const actor = await context.allowed('chat.read');
    return (await context.deps.chats.exportMarkdown(actor, input.chat)).markdown;
  },
  async update_chat(context, input) {
    const actor = await context.allowed('chat.manage');
    const { chat, project: _project, ...change } = input;
    return `Updated: ${renderChat(await context.deps.chats.update(actor, chat, change))}`;
  },
  async delete_chat(context, input) {
    const actor = await context.allowed('chat.manage');
    await context.deps.chats.remove(actor, input.chat);
    return `Deleted chat \`${input.chat}\`. restore_chat brings it back.`;
  },
  async restore_chat(context, input) {
    const actor = await context.allowed('chat.manage');
    return `Restored: ${renderChat(await context.deps.chats.restore(actor, input.chat))}`;
  },
  async list_prompt_templates(context) {
    const actor = await context.allowed('chat.read');
    const templates = await context.deps.chats.templates(actor);
    if (templates.length === 0) return 'No saved prompts.';
    return templates.map((item) => `${item.title} (\`${item.id}\`):\n${item.body}`).join('\n\n');
  },
  async save_prompt_template(context, input) {
    const actor = await context.allowed('chat.manage');
    const { title, body, id } = input;
    const saved = await context.deps.chats.saveTemplate(actor, { title, body }, id);
    return `Saved the prompt "${saved.title}" (\`${saved.id}\`).`;
  },
  async delete_prompt_template(context, input) {
    const actor = await context.allowed('chat.manage');
    await context.deps.chats.removeTemplate(actor, input.id);
    return `Deleted the saved prompt \`${input.id}\`.`;
  },
  async report_stage(context, input) {
    await context.allowed('chat.read');
    if (!stageFitsProtocol(input)) {
      throw new AppException('hub.common.validation', { details: { issues: [{ path: 'stage' }] } });
    }
    return `Noted: ${input.protocol} ${input.stage} ${input.state}.`;
  },
  async report_work(context, input) {
    const actor = await context.actor();
    const { project: _project, ...report } = input;
    return renderReport(await context.deps.workReports.report(actor, context.toolUseId, report));
  },
  async list_work_reports(context, input) {
    const actor = await context.allowed('card.read');
    const reports = await context.deps.workReports.reportsOn(actor, input.key);
    return reports.length === 0
      ? `${input.key} has no work reports.`
      : reports.map(renderReport).join('\n\n');
  },
  async propose_plan(context, input) {
    const actor = await context.allowed('chat.read');
    const { project: _project, ...plan } = input;
    const { inPanel, text } = await context.deps.workReports.proposePlan(actor, context.toolUseId, plan);
    return inPanel
      ? 'The plan is in the panel, with Run this plan. Stop here and wait for the owner.'
      : `Show the user this plan in your reply:\n\n${text}`;
  },
  async propose_doc(context, input) {
    const actor = await context.allowed('chat.read');
    const { project: _project, ...proposal } = input;
    const { draft, inPanel } = await context.deps.docDrafts.propose(actor, context.toolUseId, proposal);
    return renderDraft(draft, inPanel);
  },

  // Documents
  async save_doc(context, input) {
    const actor = await context.allowed('docs.write');
    const { project: _project, draft, answers, content, ...save } = input;
    let saved: SaveDocResult;
    if (draft) {
      saved = await context.deps.docDrafts.save(actor, draft, answers);
    } else {
      if (content === undefined) {
        throw new AppException('hub.common.validation', { details: { issues: [{ path: 'content' }] } });
      }
      await context.deps.docDrafts.assertNoOpenDraftBypass(actor, context.toolUseId, {
        key: save.key,
        path: save.path,
      });
      saved = await context.deps.docsWrite.save(actor, { ...save, content });
    }
    return [
      saved.unchanged
        ? `No change: ${saved.source}/${saved.path} already holds this text.`
        : `Saved ${saved.source}/${saved.path}. It is not committed.`,
      `Version: ${saved.hash}`,
      ...(saved.key ? [`Card: ${saved.key}`] : []),
      ...(saved.revisionId ? [`The earlier text is revision \`${saved.revisionId}\`.`] : []),
      ...(saved.withheld ? ['It looks like it holds a secret, so it was left out of the index.'] : []),
      ...(saved.similar.length > 0
        ? [
            'Similar documents exist. Check this is not a duplicate:',
            ...saved.similar.map((doc) => `- ${doc.key}: ${doc.title} (${doc.source}/${doc.path})`),
          ]
        : []),
    ].join('\n');
  },
  async list_doc_revisions(context, input) {
    const actor = await context.allowed('docs.read');
    const revisions = await context.deps.docsWrite.revisions(actor, input.key);
    if (revisions.length === 0) return `${input.key} has no earlier texts.`;
    return revisions
      .map(
        (item) =>
          `\`${item.id}\` ${item.createdAt}, ${item.chars} characters${item.reason ? `: ${item.reason}` : ''}`,
      )
      .join('\n');
  },
  async restore_doc_revision(context, input) {
    const actor = await context.allowed('docs.write');
    const saved = await context.deps.docsWrite.restore(actor, input.key, input.revision, input.baseHash);
    return `Restored ${saved.source}/${saved.path}. Version: ${saved.hash}. It is not committed.`;
  },
} satisfies Partial<ToolHandlers>;
