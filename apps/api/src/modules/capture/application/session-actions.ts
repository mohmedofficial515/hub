/**
 * @file The two card actions behind a session (docs/06 §4): `change.create` and `session.log`.
 * @description `change.create` is a `system` row, held by nobody, because nobody hand-writes a change. A session's
 * card is the exception: its `permissions` asks for `session.log`, which every member holds (D27), while the system
 * actor of the reconcile job passes as any system actor does. `session.log` either writes the summary, creating
 * follow-ups and handoffs in the same transaction, or merges Git facts that arrived later.
 */
import {
  type CreateSessionChangeInput,
  createSessionChangeSchema,
  logSessionSchema,
  type PermissionAction,
} from '@hub/contracts';
import { Injectable } from '@nestjs/common';
import { z } from 'zod';

import {
  type CardActionContext,
  type CardActionDefinition,
  CardActionHandler,
  type CardActionPlan,
  type FollowUp,
} from '@/modules/cards';

import { summaryBody, summaryTitle } from '../domain/session';

const changePayloadSchema = createSessionChangeSchema.extend({
  /** Who to tell that the session has no summary. Only the reconcile job sets it. */
  notifyUserId: z.uuid().optional(),
});
type ChangeCreatePayload = CreateSessionChangeInput & { readonly notifyUserId?: string | undefined };

@Injectable()
@CardActionHandler()
export class SessionChangeCreateAction implements CardActionDefinition<ChangeCreatePayload> {
  readonly action = 'change.create';
  readonly payload = changePayloadSchema;

  permissions(): readonly PermissionAction[] {
    return ['session.log'];
  }

  plan({ payload }: CardActionContext<ChangeCreatePayload>): CardActionPlan {
    const facts = payload.facts ?? { commits: [], filesChanged: 0, additions: 0, deletions: 0 };
    return {
      create: {
        title: payload.title,
        body: payload.body ?? null,
        repo: payload.repo ?? null,
        branch: payload.branch ?? null,
        source: 'session',
        externalKey: `session:${payload.sessionId}`,
      },
      detail: {
        kind: 'session',
        commits: facts.commits,
        commitCount: facts.commits.length,
        filesChanged: facts.filesChanged,
        additions: facts.additions,
        deletions: facts.deletions,
        session: {
          sessionId: payload.sessionId,
          changed: payload.changed ?? null,
          remaining: payload.remaining ?? null,
          durationSec: payload.durationSec ?? null,
          noSummary: payload.noSummary,
        },
      },
      ...(payload.notifyUserId
        ? {
            notify: [
              { kind: 'system' as const, i18nKey: 'session_no_summary', userIds: [payload.notifyUserId] },
            ],
          }
        : {}),
    };
  }
}

const factsSchema = z.object({
  mode: z.literal('facts'),
  commits: z.array(z.unknown()).max(200),
  filesChanged: z.number().int().min(0),
  additions: z.number().int().min(0),
  deletions: z.number().int().min(0),
});

const summarySchema = logSessionSchema.extend({
  mode: z.literal('summary'),
  /** The member's role a handoff comes from. */
  fromRole: z.string().max(40),
  /** Existing cards to link: `cardKeys` and keys named in the text, checked by the service. */
  linkKeys: z.array(z.string()).max(60),
});

const sessionLogSchema = z.discriminatedUnion('mode', [summarySchema, factsSchema]);
type SessionLogPayload = z.infer<typeof sessionLogSchema>;
type SummaryPayload = z.infer<typeof summarySchema>;

function followUpsOf(payload: SummaryPayload, cardId: string, key: string): FollowUp[] {
  const handoffs = (payload.handoffs ?? []).map((handoff): FollowUp => ({
    action: 'handoff.create',
    target: null,
    trusted: true,
    payload: {
      title: handoff.title,
      links: [{ kind: 'relates', key }],
      detail: {
        kind: handoff.kind,
        fromRole: payload.fromRole,
        toRole: handoff.toRole,
        summary: handoff.summary,
        sourceKey: key,
        ...(handoff.severity ? { severity: handoff.severity } : {}),
        ...(handoff.prompt ? { prompt: handoff.prompt } : {}),
      },
    },
  }));
  const tasks = (payload.followUps ?? []).map((task): FollowUp => ({
    action: 'task.create',
    target: null,
    trusted: true,
    payload: {
      title: task.title,
      ...(task.body ? { body: task.body } : {}),
      ...(task.priority ? { priority: task.priority } : {}),
      links: [{ kind: 'relates', key }],
      detail: { specialty: task.specialty, origin: 'session_followup' },
    },
  }));
  const links = payload.linkKeys.map((other): FollowUp => ({
    action: 'card.link',
    target: { cardId },
    trusted: true,
    payload: { op: 'add', kind: 'relates', key: other },
  }));
  return [...handoffs, ...tasks, ...links];
}

@Injectable()
@CardActionHandler()
export class SessionLogAction implements CardActionDefinition<SessionLogPayload> {
  readonly action = 'session.log';
  readonly payload = sessionLogSchema;

  plan({ card, payload }: CardActionContext<SessionLogPayload>): CardActionPlan {
    if (!card) throw new Error('session.log needs the session card');
    const session = (card.detail?.['session'] ?? {}) as Record<string, unknown>;

    if (payload.mode === 'facts') {
      const known = card.detail ?? {};
      const same =
        known['commitCount'] === payload.commits.length &&
        known['filesChanged'] === payload.filesChanged &&
        known['additions'] === payload.additions &&
        known['deletions'] === payload.deletions;
      if (same) return { noop: true };
      return {
        detail: {
          commits: payload.commits,
          commitCount: payload.commits.length,
          filesChanged: payload.filesChanged,
          additions: payload.additions,
          deletions: payload.deletions,
        },
        event: { kind: 'field_changed', data: { field: 'facts' } },
      };
    }

    const hasCommits = Number(card.detail?.['commitCount'] ?? 0) > 0;
    return {
      patch: {
        title: summaryTitle(payload.changed),
        body: summaryBody(payload),
        ...(payload.repo ? { repo: payload.repo } : {}),
        ...(payload.branch ? { branch: payload.branch } : {}),
      },
      detail: {
        session: {
          ...session,
          changed: payload.changed,
          remaining: payload.remaining ?? null,
          ...(payload.durationSec === undefined ? {} : { durationSec: payload.durationSec }),
          noSummary: false,
        },
        ...(payload.commits && !hasCommits
          ? { commits: payload.commits.map((sha) => ({ sha })), commitCount: payload.commits.length }
          : {}),
      },
      event: {
        kind: 'session_logged',
        data: {
          sessionId: payload.sessionId,
          hasSummary: true,
          upgraded: session['noSummary'] === true,
        },
      },
      followUps: () => followUpsOf(payload, card.id, card.key),
    };
  }
}
