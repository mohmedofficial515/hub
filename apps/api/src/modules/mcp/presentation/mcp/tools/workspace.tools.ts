/**
 * @file Handlers of the tools for orientation, sessions, projects, members, settings, sources, audit, inbox, onboarding.
 * @description They call the same services as the REST routes. Invite links stay out of the answers: the link goes by
 * mail or from Members in Hub, and a one-time credential has no business in a chat transcript (docs/15 §2). Each answer
 * says where the mail went (docs/16 D68), so nobody believes a friend was emailed when only the test inbox was.
 */
import { type MailMode, settingsCatalogue } from '@hub/contracts';

import { QUEUES } from '@/infra/queue/queue.service';
import { isoWeekOf, localDate } from '@/modules/digests';
import { AppException } from '@/shared/errors';

import { cardRef, cardTable, moreLine, plain } from '../render';

const MAIL_SAID: Record<MailMode, string> = {
  real: 'The link went by email.',
  local:
    'The email went to the local test inbox (Mailpit) only, so it reaches nobody: the owner shares the link from Members › Waiting to join › New link.',
  off: 'Hub has no mail server, so no email went: the owner shares the link from Members › Waiting to join › New link.',
};
import type { ToolContext, ToolHandlers } from '../tool-context';

const DAY_MS = 86_400_000;
const SEEN_TTL_SEC = 30 * 24 * 60 * 60;

/** The same two steps as the REST route (`modules/system`). */
async function startRun(context: ToolContext, workspaceId: string, sourceId: string): Promise<string> {
  const runId = await context.deps.runner.open(workspaceId, sourceId);
  await context.deps.queues.add(QUEUES.capture, 'run', { workspaceId, runId });
  return runId;
}

/** One heading's part of a Markdown document, by its text or anchor. */
function sectionOf(text: string, section: string): string {
  const wanted = section.toLowerCase().replace(/-/g, ' ').trim();
  const lines = text.split('\n');
  const start = lines.findIndex(
    (line) =>
      /^#{1,6}\s/.test(line) &&
      line
        .replace(/^#+\s*/, '')
        .toLowerCase()
        .replace(/-/g, ' ')
        .trim() === wanted,
  );
  if (start === -1)
    return `No section "${section}". Headings:\n${lines.filter((line) => /^#{1,6}\s/.test(line)).join('\n')}`;
  const level = /^#+/.exec(lines[start] ?? '')?.[0].length ?? 1;
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((line) => {
    const hashes = /^#+(?=\s)/.exec(line)?.[0].length;
    return hashes !== undefined && hashes <= level;
  });
  return [lines[start], ...(end === -1 ? rest : rest.slice(0, end))].join('\n');
}

export const workspaceToolHandlers = {
  async get_project_brief(context) {
    const actor = await context.actor();
    const project = await context.deps.projects.get(actor);
    const [sources, awaiting, members] = await Promise.all([
      context.deps.sources.list(actor.workspaceId),
      context.deps.query.list(actor, { awaiting: 'me', limit: 10 }),
      context.deps.members.list(actor, { limit: 1 }),
    ]);
    const { counts } = project;
    return [
      `# ${project.name} — project brief`,
      `Active project: ${project.name} (slug \`${project.slug}\`, ${project.status}). Your roles here: ${actor.roles.join(', ')}.`,
      `Key prefix ${project.keyPrefix} · timezone ${project.timezone} · ${members.pagination.total ?? 0} members`,
      ...(project.description ? ['## Description', project.description] : []),
      ...(project.goals ? ['## Goals', project.goals] : []),
      ...(project.links.length > 0
        ? ['## Links', ...project.links.map((link) => `- ${link.label}: ${link.url}`)]
        : []),
      ...(project.repoPaths.length > 0
        ? ['## Local folders', ...project.repoPaths.map((path) => `- ${path}`)]
        : []),
      '## Open right now',
      `${counts.openDecisions} decisions open · ${counts.openNeeds} needs · ${counts.pendingHandoffs} handoffs pending · ${counts.readyTasks} tasks ready`,
      ...(awaiting.items.length > 0
        ? ['## Awaiting you', ...awaiting.items.map((card) => `- ${cardRef(card)} (${card.awaiting ?? ''})`)]
        : []),
      '## Sources',
      ...(sources.length > 0
        ? sources.map((source) => `- ${source.name} (${source.kind}${source.enabled ? '' : ', disabled'})`)
        : ['None connected.']),
      'Next: whats_new, list_tasks.',
    ].join('\n');
  },
  async whats_new(context, input) {
    const actor = await context.actor();
    const { redis, clock, query, sessions } = context.deps;
    const seenKey = `mcp:seen:${actor.userId}:${actor.workspaceId}`;
    const now = clock.now();
    const seen = await redis.main.get(seenKey);
    const since = input.since ?? seen ?? new Date(now.getTime() - DAY_MS).toISOString();
    await redis.main.set(seenKey, now.toISOString(), 'EX', SEEN_TTL_SEC);
    const [awaiting, quiet, timeline] = await Promise.all([
      query.list(actor, { awaiting: 'me', limit: 20 }),
      sessions.withoutSummary(actor),
      query.timeline(actor, {
        from: new Date(since).toISOString(),
        types: input.types,
        limit: input.limit ?? 40,
      }),
    ]);
    return [
      `What is new in ${(await context.project()).name} since ${since}`,
      `## Awaiting you (${awaiting.items.length})`,
      ...awaiting.items.map((card) => `- ${cardRef(card)} · ${card.type} · ${card.awaiting ?? ''}`),
      `## Your sessions without a summary (${quiet.length})`,
      ...quiet.map((session) => `- ${session.cardKey} · session_id ${session.sessionId}`),
      `## Changes (${timeline.items.length})`,
      ...timeline.items.map(
        (row) =>
          `- ${row.event.createdAt} ${cardRef(row.card)} · ${row.event.kind} by ${row.event.actor.displayName ?? row.event.actor.kind} via ${row.event.via}${row.collapsed > 0 ? ` (+${row.collapsed})` : ''}`,
      ),
      ...moreLine(timeline.pagination.nextCursor),
    ].join('\n');
  },
  async search_docs(context, input) {
    const hits = await context.deps.search.docs(
      await context.actor(),
      input.query,
      input.kind ? [input.kind] : undefined,
      input.limit ?? 8,
    );
    const wanted = input.source ? hits.filter((hit) => hit.source === input.source) : hits;
    if (wanted.length === 0) return `No documents match "${input.query}".`;
    return [
      `${wanted.length} documents for "${input.query}"`,
      ...wanted.flatMap((hit, index) => [
        `${index + 1}. ${cardRef(hit.card)} · ${hit.source}: ${hit.path}`,
        ...hit.chunks.map(
          (chunk) =>
            `   ${chunk.heading ? `§ ${chunk.heading}: ` : ''}${chunk.excerpt.replace(/<\/?mark>/g, '')}`,
        ),
      ]),
      'Read one with get_doc(key), and `section` for one heading.',
    ].join('\n');
  },
  async get_doc(context, input) {
    const actor = await context.actor();
    const { docs } = context.deps;
    let doc;
    if (input.key) doc = await docs.content(actor, input.key);
    else if (input.source && input.path) doc = await docs.byPath(actor, input.source, input.path);
    else throw new AppException('hub.common.validation', { details: { issues: [{ path: 'key' }] } });
    const text = doc.content ?? `(no text: ${doc.unavailable ?? 'not indexed yet'})`;
    const part = input.section ? sectionOf(text, input.section) : text;
    return [
      cardRef(doc),
      `Path: ${plain(doc.detail?.['path'])}`,
      ...(doc.fileHash ? [`Version: ${doc.fileHash}`] : []),
      part.slice(0, input.maxChars ?? 20_000),
    ].join('\n');
  },

  // Sessions and briefs
  async log_session(context, input) {
    const { project: _project, ...summary } = input;
    const { card, followUpKeys } = await context.deps.sessions.logSummary(await context.actor(), summary);
    const project = await context.project();
    return [
      `Session logged → ${cardRef(card)} in ${project.slug}`,
      ...(followUpKeys.length > 0 ? [`Also created: ${followUpKeys.join(', ')}`] : []),
    ].join('\n');
  },
  async list_my_sessions_without_summary(context, input) {
    const sessions = await context.deps.sessions.withoutSummary(await context.actor(), input.limit ?? 10);
    if (sessions.length === 0) return 'No sessions without a summary.';
    return [
      `${sessions.length} sessions without a summary`,
      '| session_id | started | where | commits | files | card |',
      '| --- | --- | --- | --- | --- | --- |',
      ...sessions.map(
        (session) =>
          `| ${session.sessionId} | ${session.startedAt} | ${session.branch ?? session.repo ?? '–'} | ${session.commits} | ${session.files} | ${session.cardKey} |`,
      ),
      'Write them with log_session(sessionId, changed).',
    ].join('\n');
  },
  async save_brief(context, input) {
    const actor = await context.actor();
    const kind = input.kind ?? 'morning';
    const { timezone } = await context.deps.projects.get(actor);
    const now = context.deps.clock.now();
    const today = localDate(now, timezone);
    const date = input.date ?? (kind === 'weekly' ? isoWeekOf(today).iso : today);
    await context.deps.briefs.saveNarrative(actor, kind, date, { narrative: input.narrative });
    return `Saved the ${kind} brief of ${date}. It shows on the Today page.`;
  },

  // Projects
  async list_projects(context) {
    const projects = await context.deps.projects.list(context.principal);
    if (projects.length === 0) return 'You belong to no project yet. create_project makes one.';
    return [
      `${projects.length} projects`,
      '| slug | name | key | status | your roles | default | decisions | needs | handoffs | ready tasks |',
      '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
      ...projects.map(
        (project) =>
          `| ${project.slug} | ${project.name} | ${project.keyPrefix} | ${project.status} | ${project.roles.join(', ')} | ${project.isDefault ? 'yes' : ''} | ${project.counts.openDecisions} | ${project.counts.openNeeds} | ${project.counts.pendingHandoffs} | ${project.counts.readyTasks} |`,
      ),
    ].join('\n');
  },
  async get_project(context) {
    const actor = await context.actor();
    const project = await context.deps.projects.get(actor);
    return [
      `${project.name} (slug \`${project.slug}\`, key ${project.keyPrefix}, ${project.status})`,
      `Your roles: ${actor.roles.join(', ')} · timezone ${project.timezone} · locale ${project.defaultLocale}`,
      ...(project.description ? ['## Description', project.description] : []),
      ...(project.goals ? ['## Goals', project.goals] : []),
      ...(project.links.length > 0
        ? ['## Links', ...project.links.map((link) => `- ${link.label}: ${link.url}`)]
        : []),
      ...(project.repoPaths.length > 0
        ? ['## Local folders', ...project.repoPaths.map((path) => `- ${path}`)]
        : []),
    ].join('\n');
  },
  async create_project(context, input) {
    const { project: _argument, ...body } = input;
    const created = await context.deps.projects.create(context.principal, body);
    const base = context.deps.config.HUB_PUBLIC_URL.replace(/\/+$/, '');
    return [
      `Created project ${created.name} (slug \`${created.slug}\`, key ${created.keyPrefix}). You are its owner.`,
      `Use it with project="${created.slug}", or switch_project.`,
      `URL: ${base}/${created.defaultLocale}/${created.slug}`,
    ].join('\n');
  },
  async update_project(context, input) {
    const actor = await context.actor();
    const { project: _argument, status, ...fields } = input;
    const { projects } = context.deps;
    const did: string[] = Object.keys(fields);
    const current = await projects.get(actor);
    const reopening = status === 'active' && current.status === 'closed';
    if (status === 'closed') await context.allowed('project.close');
    if (reopening) await context.allowed('project.reopen');
    if (Object.keys(fields).length > 0 || status === 'paused') await context.allowed('project.update');
    if (reopening) {
      await projects.reopen(actor);
      did.push('reopened');
    }
    if (
      Object.keys(fields).length > 0 ||
      status === 'paused' ||
      (status === 'active' && current.status === 'paused')
    ) {
      await projects.update(actor, {
        ...fields,
        ...(status === 'paused' || status === 'active' ? { status } : {}),
      });
      if (status && status !== 'closed') did.push(`status: ${status}`);
    }
    if (status === 'closed') {
      await projects.close(actor);
      did.push('closed');
    }
    return `Updated project ${current.slug}: ${did.join(', ') || 'nothing'}.`;
  },
  async switch_project(context, input) {
    await context.deps.me.setDefaultProject(context.principal.userId, input.slug);
    return `Your default project is now \`${input.slug}\`. A folder linked to another project still uses its own.`;
  },

  // Administration
  async list_members(context, input) {
    const page = await context.deps.members.list(await context.actor(), {
      cursor: input.cursor,
      limit: input.limit ?? 25,
    });
    return [
      `${page.pagination.total ?? page.items.length} members`,
      ...page.items.map(
        (member) =>
          `- ${member.displayName} <${member.email}> · ${member.roles.join(', ')} · ${member.status} · id ${member.userId}`,
      ),
      ...moreLine(page.pagination.nextCursor),
    ].join('\n');
  },
  async invite_member(context, input) {
    const invite = await context.deps.invites.create(
      await context.allowed('member.invite'),
      input.email,
      input.roles,
    );
    return `Invited ${invite.email} as ${invite.roles.join(', ')}. ${MAIL_SAID[invite.mail]} Invite id ${invite.id}.`;
  },
  async list_invites(context) {
    const invites = await context.deps.invites.list(await context.allowed('member.invite'));
    if (invites.length === 0) return 'No invites.';
    return invites
      .map((invite) => `- ${invite.email} · ${invite.roles.join(', ')} · ${invite.status} · id ${invite.id}`)
      .join('\n');
  },
  async resend_invite(context, input) {
    const link = await context.deps.invites.resend(await context.allowed('member.invite'), input.inviteId);
    return `A new link for invite ${input.inviteId}, valid for seven days. The old one stopped working. ${MAIL_SAID[link.mail]}`;
  },
  async revoke_invite(context, input) {
    await context.deps.invites.revoke(await context.allowed('member.invite'), input.inviteId);
    return `Revoked invite ${input.inviteId}.`;
  },
  async change_member_roles(context, input) {
    const member = await context.deps.members.changeRoles(
      await context.allowed('member.change_roles'),
      input.userId,
      input.roles,
    );
    return `${member.displayName} now holds: ${member.roles.join(', ')}.`;
  },
  async disable_member(context, input) {
    const actor = await context.allowed('member.disable');
    if (input.disableAccount) await context.deps.members.disable(actor, input.userId);
    else await context.deps.members.remove(actor, input.userId);
    return `Removed member ${input.userId} from this project${input.disableAccount ? ', disabling the account if this was their only project' : ''}.`;
  },
  async enable_member(context, input) {
    await context.deps.members.enable(await context.allowed('member.disable'), input.userId);
    return `Brought member ${input.userId} back.`;
  },
  async set_github_identity(context, input) {
    const result = await context.deps.members.setGithubLogins(
      await context.allowed('member.github_identity'),
      input.userId,
      input.logins,
    );
    return `GitHub logins of ${input.userId}: ${result.logins.join(', ') || 'none'}.`;
  },
  async get_settings(context) {
    const actor = await context.actor();
    const rows = await context.deps.settings.list(actor.workspaceId);
    const meaning = new Map<string, string>(settingsCatalogue().map((row) => [row.key, row.description.en]));
    return rows
      .map(
        (row) =>
          `- \`${row.key}\` = ${JSON.stringify(row.value)}${row.isDefault ? ' (default)' : ` (default ${JSON.stringify(row.default)})`}: ${meaning.get(row.key) ?? ''}`,
      )
      .join('\n');
  },
  async update_settings(context, input) {
    const actor = await context.allowed('settings.write');
    if (input.reset) {
      const row = await context.deps.settings.reset(actor, input.key);
      return `\`${row.key}\` is back to its default: ${JSON.stringify(row.value)}.`;
    }
    const row = await context.deps.settings.put(actor, input.key, input.value);
    return `\`${row.key}\` is now ${JSON.stringify(row.value)}.`;
  },
  async list_sources(context) {
    const actor = await context.actor();
    const sources = await context.deps.sources.list(actor.workspaceId);
    if (sources.length === 0) return 'No sources.';
    return sources
      .map(
        (source) =>
          `- ${source.name} (${source.kind}) · ${source.enabled ? 'enabled' : 'disabled'} · ${source.hasSecret ? 'has a secret' : 'no secret'} · last success ${source.lastSuccessAt ?? 'never'}${source.lastError ? ` · last error: ${source.lastError}` : ''} · id ${source.id}`,
      )
      .join('\n');
  },
  async add_source(context, input) {
    const source = await context.deps.sources.create(await context.allowed('source.manage'), {
      kind: input.kind,
      name: input.name,
      config: input.config,
    });
    return `Added source ${source.name} (${source.kind}), id ${source.id}.`;
  },
  async update_source(context, input) {
    const { sourceId, project: _project, ...fields } = input;
    const source = await context.deps.sources.update(
      await context.allowed('source.manage'),
      sourceId,
      fields,
    );
    return `Changed source ${source.name}.`;
  },
  async enable_source(context, input) {
    const source = await context.deps.sources.update(await context.allowed('source.manage'), input.sourceId, {
      enabled: true,
    });
    return `Enabled source ${source.name}.`;
  },
  async disable_source(context, input) {
    const source = await context.deps.sources.update(await context.allowed('source.manage'), input.sourceId, {
      enabled: false,
    });
    return `Disabled source ${source.name}.`;
  },
  async delete_source(context, input) {
    await context.deps.sources.remove(await context.allowed('source.manage'), input.sourceId);
    return `Deleted source ${input.sourceId}. Its history stays.`;
  },
  async test_source(context, input) {
    const result = await context.deps.sources.test(await context.allowed('source.manage'), input.sourceId);
    return result.ok
      ? `The source can be reached${result.details.filesFound === undefined ? '' : `: ${result.details.filesFound} files`}.`
      : 'The source cannot be reached.';
  },
  async run_source(context, input) {
    const actor = await context.allowed('source.run');
    const runId = await startRun(context, actor.workspaceId, input.sourceId);
    return `Started source ${input.sourceId}, run ${runId}. The Sources page shows how it went.`;
  },
  async reindex_docs(context, input) {
    const actor = await context.allowed('docs.reindex');
    const sources = input.sourceId
      ? [{ id: input.sourceId }]
      : await context.deps.runner.sourcesFor(actor.workspaceId, 'docs');
    if (sources.length === 0) throw new AppException('hub.common.not_found');
    for (const source of sources) await startRun(context, actor.workspaceId, source.id);
    return `Started indexing ${sources.length} docs source${sources.length === 1 ? '' : 's'}.`;
  },
  async rescan_lab(context) {
    const actor = await context.allowed('redesign.rescan');
    const [source] = await context.deps.runner.sourcesFor(actor.workspaceId, 'lab');
    if (!source) throw new AppException('hub.redesign.lab_unavailable');
    await startRun(context, actor.workspaceId, source.id);
    return 'Started scanning the lab.';
  },
  async read_audit(context, input) {
    const { project: _project, ...query } = input;
    const page = await context.deps.audit.list(await context.allowed('audit.read'), query);
    if (page.items.length === 0) return 'No audit rows.';
    return [
      ...page.items.map(
        (row) =>
          `- ${row.createdAt} ${row.actor.displayName ?? row.actor.kind} via ${row.via}: ${row.action} · ${row.summary}`,
      ),
      ...moreLine(page.pagination.nextCursor),
    ].join('\n');
  },
  async list_notifications(context, input) {
    const page = await context.deps.inbox.list(await context.actor(), {
      ...(input.unread ? { unread: true } : {}),
      ...(input.cursor ? { cursor: input.cursor } : {}),
      ...(input.limit ? { limit: input.limit } : {}),
    });
    if (page.items.length === 0) return 'Your inbox is empty.';
    const cards = page.items.flatMap((item) => (item.card ? [item.card] : []));
    return [
      cardTable(`Inbox (${page.items.length})`, cards),
      '## Notifications',
      ...page.items.map(
        (item) => `- id ${item.id} · ${item.kind} · ${item.readAt ? 'read' : 'unread'} · ${item.title}`,
      ),
      ...moreLine(page.pagination.nextCursor),
    ].join('\n');
  },
  async read_notification(context, input) {
    const actor = await context.actor();
    if (input.all) {
      await context.deps.inbox.readAll(actor, {});
      return 'Marked every notification as read.';
    }
    if (!input.notificationId) {
      throw new AppException('hub.common.validation', {
        details: { issues: [{ path: 'notificationId' }] },
      });
    }
    const state = input.state ?? 'read';
    const { inbox } = context.deps;
    if (state === 'read') await inbox.read(actor, input.notificationId);
    if (state === 'unread') await inbox.unread(actor, input.notificationId);
    if (state === 'archived') await inbox.archive(actor, input.notificationId);
    if (state === 'unarchived') await inbox.unarchive(actor, input.notificationId);
    return `Notification ${input.notificationId} is now ${state}.`;
  },
  async get_onboarding(context) {
    const groups = await context.deps.onboarding.get(await context.actor());
    if (groups.length === 0) return 'No reading path for your roles.';
    return groups
      .flatMap((group) => [
        `## ${group.role}`,
        ...group.items.map(
          (item) => `- [${item.done ? 'x' : ' '}] ${item.title} (${item.ref}) · id ${item.id}`,
        ),
      ])
      .join('\n');
  },
  async tick_onboarding_item(context, input) {
    const actor = await context.actor();
    const done = input.done !== false;
    if (done) await context.deps.onboarding.tick(actor, input.itemId);
    else await context.deps.onboarding.untick(actor, input.itemId);
    return `${done ? 'Ticked' : 'Unticked'} ${input.itemId}.`;
  },
} satisfies Partial<ToolHandlers>;
