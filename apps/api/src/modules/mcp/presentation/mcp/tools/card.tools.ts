/**
 * @file Handlers of the tools for tasks, decisions, needs, handoffs, redesign, releases, ideas, plans and any card.
 * @description Each calls `CardService.apply` with the action the REST route uses (docs/15 §6), so REST and MCP cannot
 * behave differently. Flat inputs are put back into the REST payload here.
 */
import {
  createDecisionSchema,
  createHandoffSchema,
  createIdeaSchema,
  createNeedSchema,
  createPlanSchema,
  createReleaseSchema,
  createTaskSchema,
  editTaskDetailSchema,
  nestCreateInput,
  updateCardSchema,
} from '@hub/contracts';

import { transitionActionFor } from '@/modules/cards';
import { AppException } from '@/shared/errors';

import { cardSheet, cardTable, written } from '../render';
import type { ToolHandlers } from '../tool-context';

type Rest = Readonly<Record<string, unknown>>;

/** The input without what is not the payload. */
function payloadOf(input: Rest, ...drop: readonly string[]): Record<string, unknown> {
  const dropped = new Set(['key', 'project', ...drop]);
  return Object.fromEntries(Object.entries(input).filter(([name]) => !dropped.has(name)));
}

function pick(input: Rest, names: readonly string[]): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(input).filter(([name, value]) => names.includes(name) && value !== undefined),
  );
}

const HEADER_KEYS = Object.keys(updateCardSchema.shape);
const TASK_DETAIL_KEYS = Object.keys(editTaskDetailSchema.shape);

function followUpLines(followUps: readonly string[]): readonly string[] {
  return followUps.length > 0 ? ['Also created or moved:', ...followUps.map((line) => `- ${line}`)] : [];
}

export const cardToolHandlers = {
  // Tasks
  async list_tasks(context, input) {
    const actor = await context.actor();
    if (input.mine) {
      const mine = await context.deps.tasks.mine(actor);
      return cardTable('Your claimed tasks', [...mine.claimed, ...mine.inReview, ...mine.blocked]);
    }
    if (input.status || input.q) {
      const page = await context.deps.query.listWithDetail(actor, 'task', {
        statuses: input.status,
        q: input.q,
        cursor: input.cursor,
        limit: input.limit,
      });
      return cardTable('Tasks', page.items, page.pagination.nextCursor);
    }
    const ready = await context.deps.tasks.ready(actor, input.specialty, input.limit);
    return `${cardTable('Ready tasks for your specialties', ready)}\nClaim one with claim_task.`;
  },
  create_task: (context, input) =>
    context.apply('Created', null, 'task.create', nestCreateInput(createTaskSchema, input)),
  async update_task(context, input) {
    const actor = await context.actor();
    const { key, move } = input;
    const detail = pick(input, TASK_DETAIL_KEYS);
    const header = pick(
      input,
      HEADER_KEYS.filter((name) => !(name in detail)),
    );
    const changed = [...Object.keys(header), ...Object.keys(detail), ...(move ? [`move: ${move}`] : [])];
    if (changed.length === 0) {
      throw new AppException('hub.common.validation', {
        details: { issues: [{ path: 'nothing to change' }] },
      });
    }
    if (Object.keys(header).length > 0) {
      await context.deps.cards.apply(actor, { cardKey: key }, 'card.edit_content', header);
    }
    if (Object.keys(detail).length > 0) {
      await context.deps.cards.apply(actor, { cardKey: key }, 'task.edit_detail', detail);
    }
    if (move === 'ready') await context.deps.cards.apply(actor, { cardKey: key }, 'task.mark_ready', {});
    if (move === 'backlog') await context.deps.cards.apply(actor, { cardKey: key }, 'task.mark_backlog', {});
    if (move === 'resume') await context.deps.cards.apply(actor, { cardKey: key }, 'task.resume', {});
    const card = await context.deps.query.full(actor, key);
    const project = await context.project();
    return written(
      `Updated (${changed.join(', ')})`,
      { ...card, event: { id: '', seq: 0, kind: 'field_changed' } },
      project,
    );
  },
  claim_task: (context, input) => context.apply('Claimed', input.key, 'task.claim', payloadOf(input)),
  unclaim_task: (context, input) => context.apply('Gave back', input.key, 'task.unclaim', {}),
  start_task: (context, input) => context.apply('Started', input.key, 'task.start', {}),
  submit_task: (context, input) =>
    context.apply('Sent to review', input.key, 'task.submit_review', payloadOf(input)),
  complete_task: (context, input) =>
    context.apply('Completed', input.key, 'task.complete', payloadOf(input), (_card, others) =>
      followUpLines(others),
    ),
  reopen_task: (context, input) => context.apply('Reopened', input.key, 'task.reopen', payloadOf(input)),
  cancel_task: (context, input) => context.apply('Cancelled', input.key, 'task.cancel', payloadOf(input)),

  // Decisions
  async list_decisions(context, input) {
    const actor = await context.actor();
    const statuses = input.status ?? ['open'];
    const page = await context.deps.query.listWithDetail(actor, 'decision', {
      statuses,
      roles: input.mine ? actor.roles : input.deciderRole,
      flags: input.overdue ? ['overdue'] : undefined,
      sort: statuses.includes('open') ? 'due' : 'lastEvent',
      cursor: input.cursor,
      limit: input.limit,
    });
    return cardTable(`Decisions (${statuses.join(', ')})`, page.items, page.pagination.nextCursor);
  },
  request_decision: (context, input) =>
    context.apply('Opened', null, 'decision.create', nestCreateInput(createDecisionSchema, input)),
  async get_decision(context, input) {
    const card = await context.deps.query.full(await context.actor(), input.key);
    if (card.type !== 'decision') throw new AppException('hub.cards.type_mismatch');
    return cardSheet(card, await context.project());
  },
  update_decision: (context, input) =>
    context.apply('Replaced the options of', input.key, 'decision.edit_options', payloadOf(input)),
  decide: (context, input) =>
    context.apply('Decided', input.key, 'decision.decide', payloadOf(input), (_card, others) =>
      followUpLines(others),
    ),
  withdraw_decision: (context, input) =>
    context.apply('Withdrew', input.key, 'decision.withdraw', payloadOf(input)),
  supersede_decision: (context, input) =>
    context.apply('Superseded', input.key, 'decision.supersede', payloadOf(input)),
  draft_adr: (context, input) =>
    context.apply('Saved the ADR of', input.key, 'decision.draft_adr', payloadOf(input)),
  open_adr_pr() {
    return Promise.reject(
      new AppException('hub.common.unavailable', { details: { needs: 'A GitHub connection (H3-06)' } }),
    );
  },

  // Needs
  async list_needs(context, input) {
    const actor = await context.actor();
    const page = await context.deps.query.listWithDetail(actor, 'need', {
      statuses: input.status ?? ['requested', 'in_progress', 'delivered'],
      roles: input.mine ? actor.roles : input.responsibleRole,
      flags: input.stale ? ['stale'] : undefined,
      sort: 'priority',
      cursor: input.cursor,
      limit: input.limit,
    });
    return cardTable('Needs', page.items, page.pagination.nextCursor);
  },
  create_need: (context, input) =>
    context.apply('Created', null, 'need.create', nestCreateInput(createNeedSchema, input), () => [
      'The value itself goes where the card says, never into Hub.',
    ]),
  start_need: (context, input) => context.apply('Started', input.key, 'need.start', {}),
  deliver_need: (context, input) => context.apply('Delivered', input.key, 'need.deliver', payloadOf(input)),
  verify_need: (context, input) =>
    context.apply('Verified', input.key, 'need.verify', payloadOf(input), (_card, others) =>
      followUpLines(others),
    ),
  reject_need_delivery: (context, input) =>
    context.apply('Sent back', input.key, 'need.reject_delivery', payloadOf(input)),
  cancel_need: (context, input) => context.apply('Cancelled', input.key, 'need.cancel', payloadOf(input)),

  // Handoffs
  async list_handoffs(context, input) {
    const actor = await context.actor();
    const page = await context.deps.query.listWithDetail(actor, 'handoff', {
      statuses: input.status ?? ['pending', 'acknowledged'],
      roles: input.mine ? actor.roles : input.toRole,
      flags: input.stale ? ['stale'] : undefined,
      sort: 'createdAsc',
      cursor: input.cursor,
      limit: input.limit,
    });
    return cardTable('Handoffs', page.items, page.pagination.nextCursor);
  },
  async create_handoff(context, input) {
    const actor = await context.actor();
    const nested = nestCreateInput(createHandoffSchema, {
      ...input,
      fromRole: input.fromRole ?? actor.roles[0],
    });
    return context.apply('Created', null, 'handoff.create', nested);
  },
  acknowledge_handoff: (context, input) =>
    context.apply('Acknowledged', input.key, 'handoff.acknowledge', payloadOf(input)),
  apply_handoff: (context, input) =>
    context.apply('Applied', input.key, 'handoff.apply', payloadOf(input), (_card, others) =>
      followUpLines(others),
    ),
  dismiss_handoff: (context, input) =>
    context.apply('Dismissed', input.key, 'handoff.dismiss', payloadOf(input)),

  // Redesign
  async list_redesigns(context, input) {
    const page = await context.deps.query.listWithDetail(await context.actor(), 'redesign', {
      statuses: input.status,
      where: {
        redesign: {
          ...(input.app ? { app: input.app } : {}),
          ...(input.page ? { page: input.page } : {}),
        },
      },
      cursor: input.cursor,
      limit: input.limit,
    });
    return cardTable('Redesign versions', page.items, page.pagination.nextCursor);
  },
  send_redesign_to_review: (context, input) =>
    context.apply('Sent to review', input.key, 'redesign.send_to_review', {}),
  approve_redesign: (context, input) =>
    context.apply('Approved', input.key, 'redesign.approve', payloadOf(input), (_card, others) =>
      followUpLines(others),
    ),
  reject_redesign: (context, input) =>
    context.apply('Rejected', input.key, 'redesign.reject', payloadOf(input)),
  request_redesign_changes: (context, input) =>
    context.apply('Asked for changes on', input.key, 'redesign.request_changes', payloadOf(input)),
  mark_redesign_ported: (context, input) =>
    context.apply('Marked ported', input.key, 'redesign.mark_ported', payloadOf(input), (_card, others) =>
      followUpLines(others),
    ),

  // Releases
  async list_releases(context, input) {
    const page = await context.deps.query.listWithDetail(await context.actor(), 'release', {
      statuses: input.status,
      cursor: input.cursor,
      limit: input.limit,
    });
    return cardTable('Releases', page.items, page.pagination.nextCursor);
  },
  create_release: (context, input) =>
    context.apply('Created', null, 'release.create', nestCreateInput(createReleaseSchema, input)),
  async update_release(context, input) {
    const actor = await context.actor();
    const edits = payloadOf(input, 'generateNotes');
    const hasEdits = Object.values(edits).some((value) => value !== undefined);
    if (hasEdits) await context.deps.cards.apply(actor, { cardKey: input.key }, 'release.edit', edits);
    if (input.generateNotes) await context.deps.releaseNotes.generate(actor, input.key);
    const card = await context.deps.query.full(actor, input.key);
    return written(
      input.generateNotes ? 'Filled the notes of' : 'Updated',
      { ...card, event: { id: '', seq: 0, kind: 'field_changed' } },
      await context.project(),
    );
  },
  release: (context, input) => context.apply('Released', input.key, 'release.release', payloadOf(input)),

  // Ideas
  async list_ideas(context, input) {
    const page = await context.deps.query.listWithDetail(await context.actor(), 'idea', {
      statuses: input.status,
      q: input.q,
      cursor: input.cursor,
      limit: input.limit,
    });
    return cardTable('Ideas', page.items, page.pagination.nextCursor);
  },
  create_idea: (context, input) =>
    context.apply('Created', null, 'idea.create', nestCreateInput(createIdeaSchema, input)),
  async update_idea(context, input) {
    const actor = await context.actor();
    const edits = payloadOf(input, 'move', 'reason');
    const hasEdits = Object.values(edits).some((value) => value !== undefined);
    if (hasEdits) await context.deps.cards.apply(actor, { cardKey: input.key }, 'idea.update', edits);
    if (input.move) {
      const reason = input.reason ? { reason: input.reason } : {};
      const payload = input.move === 'park' || input.move === 'reject' ? reason : {};
      await context.deps.cards.apply(actor, { cardKey: input.key }, `idea.${input.move}`, payload);
    }
    const card = await context.deps.query.full(actor, input.key);
    return written(
      input.move ? `Moved (${input.move})` : 'Updated',
      { ...card, event: { id: '', seq: 0, kind: input.move ? 'status_changed' : 'field_changed' } },
      await context.project(),
    );
  },
  idea_to_plan: (context, input) =>
    context.apply('Turned into a plan:', input.key, 'idea.to_plan', payloadOf(input), (_card, others) =>
      followUpLines(others),
    ),

  // Plans
  async list_plans(context, input) {
    const page = await context.deps.query.listWithDetail(await context.actor(), 'plan', {
      statuses: input.status,
      q: input.q,
      cursor: input.cursor,
      limit: input.limit,
    });
    const rows = page.items.map((card) => {
      const steps = (card.detail?.['steps'] ?? []) as readonly { done: boolean }[];
      return {
        ...card,
        title: `${card.title} (${steps.filter((step) => step.done).length}/${steps.length} steps)`,
      };
    });
    return cardTable('Plans', rows, page.pagination.nextCursor);
  },
  async get_plan(context, input) {
    const actor = await context.actor();
    const card = await context.deps.query.full(actor, input.key);
    if (card.type !== 'plan') throw new AppException('hub.cards.type_mismatch');
    const sheet = cardSheet(card, await context.project());
    if (!input.includeRevisions) return sheet;
    const revisions = await context.deps.plans.revisions(actor, input.key);
    return [
      sheet,
      '## Revisions',
      ...revisions.map(
        (revision) =>
          `- ${revision.revision}${revision.current ? ' (current)' : ''} · ${revision.savedAt ?? '–'} · ${revision.body?.length ?? 0} characters`,
      ),
    ].join('\n');
  },
  create_plan: (context, input) =>
    context.apply('Saved', null, 'plan.create', nestCreateInput(createPlanSchema, input)),
  async update_plan(context, input) {
    const actor = await context.actor();
    const target = { cardKey: input.key };
    const edits = payloadOf(input, 'move', 'reason', 'restoreRevision');
    const hasEdits = Object.values(edits).some((value) => value !== undefined);
    const did: string[] = [];
    if (hasEdits) {
      await context.deps.cards.apply(actor, target, 'plan.update', edits);
      did.push(...Object.keys(edits));
    }
    if (input.restoreRevision !== undefined) {
      await context.deps.cards.apply(actor, target, 'plan.restore_revision', {
        restoreRevision: input.restoreRevision,
      });
      did.push(`restored revision ${input.restoreRevision}`);
    }
    if (input.move) {
      const payload = input.move === 'abandon' && input.reason ? { reason: input.reason } : {};
      await context.deps.cards.apply(actor, target, `plan.${input.move}`, payload);
      did.push(`move: ${input.move}`);
    }
    if (did.length === 0) {
      throw new AppException('hub.common.validation', {
        details: { issues: [{ path: 'nothing to change' }] },
      });
    }
    const card = await context.deps.query.full(actor, input.key);
    return written(
      `Updated (${did.join(', ')})`,
      { ...card, event: { id: '', seq: 0, kind: 'field_changed' } },
      await context.project(),
    );
  },
  plan_to_tasks: (context, input) =>
    context.apply('Created the tasks of', input.key, 'plan.to_tasks', payloadOf(input), (_card, others) =>
      followUpLines(others),
    ),

  // Any card
  async get_card(context, input) {
    const actor = await context.actor();
    const card = await context.deps.query.full(actor, input.key);
    const comments =
      input.includeComments === false
        ? undefined
        : (await context.deps.query.comments(actor, input.key, { limit: 50 })).items;
    const sheet = cardSheet(card, await context.project(), comments);
    if (!input.includeEvents) return sheet;
    const events = await context.deps.query.events(actor, input.key, { limit: 20 });
    return [
      sheet,
      '## Events',
      ...events.items.map(
        (event) =>
          `- ${event.createdAt} ${event.kind} by ${event.actor.displayName ?? event.actor.kind} via ${event.via}`,
      ),
    ].join('\n');
  },
  async list_cards(context, input) {
    const page = await context.deps.query.list(await context.actor(), {
      type: input.type,
      status: input.status,
      role: input.role,
      assignee: input.assignee,
      module: input.module ? [input.module] : undefined,
      repo: input.repo ? [input.repo] : undefined,
      tag: input.tag ? [input.tag] : undefined,
      q: input.q,
      dueBefore: input.dueBefore,
      flags: input.flags,
      awaiting: input.awaiting ? 'me' : undefined,
      sort: input.sort,
      cursor: input.cursor,
      limit: input.limit,
    });
    return cardTable(input.awaiting ? 'Waiting on you' : 'Cards', page.items, page.pagination.nextCursor);
  },
  async list_deleted(context, input) {
    const page = await context.deps.query.deleted(await context.actor(), {
      cursor: input.cursor,
      limit: input.limit,
    });
    return cardTable('Deleted cards. restore_card brings one back.', page.items, page.pagination.nextCursor);
  },
  update_card: (context, input) =>
    context.apply(
      `Updated (${Object.keys(payloadOf(input)).join(', ')})`,
      input.key,
      'card.edit_content',
      payloadOf(input),
    ),
  async move_card(context, input) {
    const actor = await context.actor();
    const card = await context.deps.query.readable(actor, { cardKey: input.key });
    const move = transitionActionFor(card.type, card.status, input.to);
    if (!move) {
      throw new AppException('hub.cards.type_mismatch', { details: { type: card.type, to: input.to } });
    }
    return context.apply(
      `Moved to ${input.to}:`,
      input.key,
      move,
      input.reason ? { reason: input.reason } : {},
    );
  },
  async comment(context, input) {
    const actor = await context.actor();
    const target = { cardKey: input.key };
    if (input.commentId) {
      await context.deps.cards.apply(actor, target, 'card.comment_edit', {
        body: input.body,
        commentId: input.commentId,
      });
      return `Edited comment ${input.commentId} on ${input.key}.`;
    }
    const { event, card } = await context.deps.cards.apply(actor, target, 'card.comment', {
      body: input.body,
    });
    return `Comment ${String(event.data['commentId'])} added to ${card.key} — ${card.title}.`;
  },
  async redact_comment(context, input) {
    await context.deps.cards.apply(await context.actor(), { cardKey: input.key }, 'card.comment_redact', {
      commentId: input.commentId,
    });
    return `Redacted comment ${input.commentId} on ${input.key}.`;
  },
  link_cards: (context, input) =>
    context.apply(
      input.remove ? 'Unlinked' : 'Linked',
      input.from,
      'card.link',
      {
        op: input.remove ? 'remove' : 'add',
        kind: input.kind,
        key: input.to,
      },
      () => [`${input.from} ${input.kind} ${input.to}`],
    ),
  async watch_card(context, input) {
    const watching = input.watching !== false;
    await context.deps.cards.apply(await context.actor(), { cardKey: input.key }, 'card.watch', {
      op: watching ? 'add' : 'remove',
    });
    return `${watching ? 'Watching' : 'Stopped watching'} ${input.key}.`;
  },
  delete_card: (context, input) =>
    context.apply('Deleted', input.key, 'card.delete', payloadOf(input), () => [
      'It is hidden everywhere. restore_card brings it back.',
    ]),
  restore_card: (context, input) => context.apply('Restored', input.key, 'card.restore', {}),
} satisfies Partial<ToolHandlers>;
