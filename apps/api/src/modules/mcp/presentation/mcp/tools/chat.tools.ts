/**
 * @file Handlers of the chat and document-writing tools. They call the same services as the panel and Docs.
 * @description Starting, sending to, stopping or answering a chat has no tool: those are the owner's own press (`chat.run`, `chat.answer`), so an agent cannot start agents or approve its own call.
 */
import { type ChatDto, stageFitsProtocol } from '@hub/contracts';

import { AppException } from '@/shared/errors';

import type { ToolHandlers } from '../tool-context';

function renderChat(chat: ChatDto): string {
  return `${chat.title || '(no title yet)'} (\`${chat.id}\`): ${chat.mode}, ${chat.deviceName}, ${chat.folder}${chat.pinned ? ', pinned' : ''}${chat.running ? ', running' : ''}${chat.deletedAt ? ', deleted' : ''}`;
}

export const chatToolHandlers = {
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

  // Documents
  async save_doc(context, input) {
    const actor = await context.allowed('docs.write');
    const { project: _project, ...save } = input;
    const saved = await context.deps.docsWrite.save(actor, save);
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
