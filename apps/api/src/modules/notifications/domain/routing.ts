/**
 * @file The routing table (docs/07 §1): which event on which card concerns whom. Pure, and tested row by row.
 * @description It answers roles, user ids and "watchers". Who actually holds a role, who is still a member, and the
 * rule that an actor never hears about their own action belong to the caller.
 */
import {
  type CardType,
  type EventKind,
  type NotificationKind,
  ROLES,
  type Specialty,
  SPECIALTY_ROLES,
} from '@hub/contracts';

export interface RoutingCard {
  readonly type: CardType;
  readonly status: string;
  readonly ownerRole: string | null;
  readonly createdById: string | null;
  readonly assigneeId: string | null;
  readonly detail: Readonly<Record<string, unknown>> | null;
}

export interface RoutingEvent {
  readonly kind: EventKind;
  readonly data: Readonly<Record<string, unknown>>;
}

export interface Notice {
  readonly kind: NotificationKind;
  readonly i18nKey: string;
  readonly roles?: readonly string[];
  readonly userIds?: readonly string[];
  /** Everyone watching the card. */
  readonly watchers?: boolean;
  /** The card action the item asks for. */
  readonly action?: string;
  readonly params?: Readonly<Record<string, string | number>>;
}

/** When someone is reached twice for one event, the first of these wins (docs/07 §1). */
export const KIND_RANK: readonly NotificationKind[] = [
  'escalation',
  'deadline_reminder',
  'routed_decision',
  'routed_need',
  'routed_handoff',
  'routed_review',
  'routed_idea',
  'review_requested',
  'task_ready',
  'mention',
  'unblocked',
  'system',
  'brief',
  'watch_update',
];

/** Editing these is noise to a watcher (docs/07 §1). */
export const QUIET_FIELDS: ReadonlySet<string> = new Set([
  'tags',
  'module',
  'readme',
  'content',
  'facts',
  'branches',
  'presence',
  'review',
]);

const QUIET_EVENTS: ReadonlySet<EventKind> = new Set([
  'commit',
  'watch',
  'unwatch',
  'linked',
  'unlinked',
  'redacted',
  'unblocked',
]);

const onlyDefined = (...values: readonly (string | null | undefined)[]): string[] =>
  values.filter((value): value is string => typeof value === 'string');

function specialtyRoles(card: RoutingCard): readonly string[] {
  const specialty = card.detail?.['specialty'] as Specialty | undefined;
  const roles = specialty ? SPECIALTY_ROLES[specialty] : undefined;
  return roles ?? onlyDefined(card.ownerRole);
}

/** The inbox item of a card routed to a role, by type. */
function routedNotice(card: RoutingCard): Notice | null {
  const roles = onlyDefined(card.ownerRole);
  if (roles.length === 0) return null;
  switch (card.type) {
    case 'decision':
      return { kind: 'routed_decision', i18nKey: 'routed_decision', roles, action: 'decide' };
    case 'need':
      return { kind: 'routed_need', i18nKey: 'routed_need', roles, action: 'deliver' };
    case 'handoff':
      return { kind: 'routed_handoff', i18nKey: 'routed_handoff', roles, action: 'acknowledge' };
    case 'task':
      return card.status === 'ready'
        ? { kind: 'task_ready', i18nKey: 'task_ready', roles, action: 'claim' }
        : null;
    case 'redesign':
      return { kind: 'routed_review', i18nKey: 'routed_review', roles, action: 'review' };
    case 'idea':
      return { kind: 'routed_idea', i18nKey: 'routed_idea', roles };
    default:
      return null;
  }
}

const watchUpdate = (i18nKey = 'watch_update', userIds: readonly string[] = []): Notice => ({
  kind: 'watch_update',
  i18nKey,
  watchers: true,
  userIds,
});

const creatorAndWatchers = (card: RoutingCard, i18nKey = 'watch_update'): Notice =>
  watchUpdate(i18nKey, onlyDefined(card.createdById));

function onReview(): Notice[] {
  return [
    { kind: 'routed_review', i18nKey: 'routed_review', roles: ['owner', 'qa'], action: 'review' },
    watchUpdate(),
  ];
}

function onCreated(card: RoutingCard): Notice[] {
  switch (card.type) {
    case 'decision':
      return [
        {
          kind: 'routed_decision',
          i18nKey: 'routed_decision',
          roles: [...onlyDefined(card.ownerRole), 'owner'],
          action: 'decide',
        },
      ];
    case 'need':
    case 'handoff': {
      const routed = routedNotice(card);
      return routed ? [routed] : [];
    }
    case 'task':
      return card.status === 'ready'
        ? [{ kind: 'task_ready', i18nKey: 'task_ready', roles: specialtyRoles(card), action: 'claim' }]
        : [];
    case 'redesign':
      return card.status === 'review' ? onReview() : [];
    case 'idea': {
      const role = card.detail?.['role'];
      return typeof role === 'string' ? [{ kind: 'routed_idea', i18nKey: 'routed_idea', roles: [role] }] : [];
    }
    case 'release':
      return [{ kind: 'system', i18nKey: 'release_created', roles: ROLES }];
    default:
      return [];
  }
}

function onStatusChanged(card: RoutingCard, to: unknown): Notice[] {
  if (card.type === 'task' && to === 'ready') {
    return [
      { kind: 'task_ready', i18nKey: 'task_ready', roles: specialtyRoles(card), action: 'claim' },
      watchUpdate(),
    ];
  }
  if (card.type === 'task' && to === 'in_review') {
    return [
      { kind: 'review_requested', i18nKey: 'review_requested', roles: ['qa'], action: 'review' },
      watchUpdate(),
    ];
  }
  if (card.type === 'redesign' && to === 'review') return onReview();
  if (card.type === 'plan' && to === 'in_review') {
    return [
      { kind: 'routed_review', i18nKey: 'routed_review', roles: ['owner', 'pm'], action: 'approve' },
      watchUpdate(),
    ];
  }
  if (card.type === 'release' && to === 'released') {
    return [{ kind: 'system', i18nKey: 'release_released', roles: ROLES }];
  }
  return [watchUpdate()];
}

function onFieldChanged(card: RoutingCard, event: RoutingEvent, previousOwnerRole: string | null): Notice[] {
  const changes = (event.data['changes'] ?? {}) as Record<string, unknown>;
  const fields = [...Object.keys(changes), ...onlyDefined(event.data['field'] as string | undefined)];
  const notices: Notice[] = [];
  if (card.ownerRole !== previousOwnerRole) {
    const routed = routedNotice(card);
    if (routed) notices.push(routed);
  }
  if (fields.length === 0 || fields.some((field) => !QUIET_FIELDS.has(field))) notices.push(watchUpdate());
  return notices;
}

function onReminder(card: RoutingCard, event: RoutingEvent): Notice[] {
  const reason = event.data['reason'];
  const offsetHours = event.data['offsetHours'];
  const params = typeof offsetHours === 'number' ? { hours: offsetHours } : undefined;
  const reminded = (i18nKey: string, action?: string): Notice => ({
    kind: 'deadline_reminder',
    i18nKey,
    ...(action ? { action } : {}),
    ...(params ? { params } : {}),
  });
  switch (card.type) {
    case 'decision':
      return [
        {
          ...reminded(params ? 'deadline_reminder' : 'deadline_overdue', 'decide'),
          roles: onlyDefined(card.ownerRole),
          watchers: true,
        },
      ];
    case 'handoff':
      return [{ ...reminded('handoff_stale', 'acknowledge'), roles: onlyDefined(card.ownerRole) }];
    case 'need':
      return [
        {
          ...reminded('need_stale', 'deliver'),
          roles: onlyDefined(card.ownerRole),
          userIds: onlyDefined(card.createdById),
        },
      ];
    case 'task':
      return reason === 'orphaned_claim'
        ? [{ kind: 'watch_update', i18nKey: 'task_still_working', userIds: onlyDefined(card.assigneeId) }]
        : [];
    default:
      return [];
  }
}

/** One row of docs/07 §1 per branch. `previousOwnerRole` is the routed role before this event. */
export function routeEvent(
  event: RoutingEvent,
  card: RoutingCard,
  previousOwnerRole: string | null = card.ownerRole,
): Notice[] {
  if (QUIET_EVENTS.has(event.kind)) return [];
  switch (event.kind) {
    case 'created':
      return onCreated(card);
    case 'status_changed':
      return onStatusChanged(card, event.data['to']);
    case 'field_changed':
      return onFieldChanged(card, event, previousOwnerRole);
    case 'commented':
      return [watchUpdate('watch_comment')];
    case 'decided':
      return [creatorAndWatchers(card, 'watch_decided')];
    case 'delivered':
      return [
        {
          kind: 'watch_update',
          i18nKey: 'need_delivered',
          roles: ['owner'],
          userIds: onlyDefined(card.createdById),
          action: 'verify',
        },
      ];
    case 'verified':
    case 'acknowledged':
    case 'applied':
    case 'dismissed':
      return [creatorAndWatchers(card)];
    case 'approved':
    case 'rejected':
    case 'changes_requested':
      return [
        {
          kind: 'watch_update',
          i18nKey: 'watch_update',
          roles: ['designer'],
          userIds: onlyDefined(card.createdById),
          watchers: true,
        },
      ];
    case 'ported':
      return [{ kind: 'watch_update', i18nKey: 'watch_update', roles: ['owner'], watchers: true }];
    case 'pr_merged':
      return [watchUpdate()];
    case 'reminder_sent':
      return onReminder(card, event);
    case 'escalated':
      return [{ kind: 'escalation', i18nKey: 'escalation', roles: ['pm', 'owner'], action: 'decide' }];
    case 'session_logged':
      return event.data['hasSummary'] === false
        ? [
            {
              kind: 'system',
              i18nKey: 'session_no_summary',
              userIds: onlyDefined(
                (event.data['userId'] as string | undefined) ?? card.assigneeId ?? card.createdById,
              ),
            },
          ]
        : [];
    case 'archived':
    case 'restored':
    case 'claimed':
    case 'unclaimed':
    case 'plan_revised':
    case 'plan_steps_changed':
    case 'idea_to_plan':
    case 'plan_to_tasks':
    case 'pr_opened':
    case 'pr_closed':
      return [watchUpdate()];
    default:
      return [];
  }
}
