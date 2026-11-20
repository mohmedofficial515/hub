/**
 * @file The permission matrix's arch test (docs/12 H0-06): every (action × role × actor kind) cell is checked against
 * the table, through the real `CardService` decision, and docs/04 §2 cannot drift from the code.
 * @description AppModule is compiled but never initialised, so nothing connects.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  ACTOR_KINDS,
  type Grant,
  grantFor,
  isAllowed,
  type MemberActor,
  PERMISSION_ACTIONS,
  type PermissionAction,
  type PermissionFacts,
  type Role,
  ROLES,
  surfaceOf,
} from '@hub/contracts';
import { Test, type TestingModule } from '@nestjs/testing';

import { AppModule } from '@/app.module';
import { CardActionRegistry, CardService, type CardView } from '@/modules/cards';

/** Actions that exist in the table with a module to come. Each names its task. */
const DEFERRED: Readonly<Partial<Record<PermissionAction, string>>> = {
  'decision.open_adr_pr': 'H3-06',
  'redesign.rescan': 'H2-05',
};

const CARD_PREFIXES = [
  'card.',
  'task.',
  'decision.',
  'need.',
  'change.',
  'handoff.',
  'redesign.',
  'doc.',
  'release.',
  'idea.',
  'plan.',
];
const CARD_ACTIONS = PERMISSION_ACTIONS.filter((action) =>
  CARD_PREFIXES.some((prefix) => action.startsWith(prefix)),
);

/**
 * Rows with no handler of their own, or judged elsewhere: reads have no action, comment edit judges its author, and
 * the edit and complete actions name these two rows from their `permissions`.
 */
const NOT_APPLIED = new Set<PermissionAction>([
  'card.read',
  'card.read_deleted',
  'card.comment_edit',
  'card.edit_routing',
  'task.review',
]);

/** Rows `apply` asks for depend on the card or payload here; the row under test is forced through `permissions`. */
const CARD_FACTS: readonly {
  readonly name: string;
  readonly facts: PermissionFacts;
  readonly card: Partial<CardView>;
}[] = [
  {
    name: 'no relation',
    facts: { routedRoles: ['qa'], specialty: 'qa' },
    card: { ownerRole: 'qa', detail: { specialty: 'qa' } },
  },
  {
    name: 'routed to the role',
    facts: { routedRoles: ['backend'], specialty: 'backend' },
    card: { ownerRole: 'backend', detail: { specialty: 'backend' } },
  },
  {
    name: 'assignee',
    facts: { routedRoles: [], isAssignee: true },
    card: { ownerRole: null, assigneeId: 'me', detail: {} },
  },
  {
    name: 'creator',
    facts: { routedRoles: [], isCreator: true },
    card: { ownerRole: null, createdById: 'me', detail: {} },
  },
  {
    name: 'deliverer',
    facts: { routedRoles: [], isDeliverer: true },
    card: { ownerRole: null, detail: { deliveredById: 'me' } },
  },
];

function actorOf(kind: 'user' | 'agent' | 'hook', role: Role): MemberActor {
  const base = { userId: 'me', workspaceId: 'w', roles: [role] };
  switch (kind) {
    case 'user':
      return { ...base, kind, via: 'web' };
    case 'agent':
      return { ...base, kind, via: 'mcp', tokenId: 't' };
    case 'hook':
      return { ...base, kind, via: 'hook', tokenId: 't' };
  }
}

describe('permission matrix', () => {
  let moduleRef: TestingModule;
  let service: CardService;
  let registry: CardActionRegistry;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    service = moduleRef.get(CardService, { strict: false });
    registry = moduleRef.get(CardActionRegistry, { strict: false });
  });

  afterAll(async () => {
    await moduleRef.close();
  });

  it('every card action in the table has a handler, except what is named as deferred', () => {
    const missing = CARD_ACTIONS.filter(
      (action) => !NOT_APPLIED.has(action) && !DEFERRED[action] && !registry.get(action),
    );
    expect(missing).toEqual([]);
    for (const action of Object.keys(DEFERRED) as PermissionAction[])
      expect(registry.get(action)).toBeUndefined();
  });

  it('every (action × role × actor kind × card relation) cell follows the table, and the kind plays no part (D27)', () => {
    const cells: string[] = [];
    let checked = 0;
    const kinds = ACTOR_KINDS.filter((kind): kind is 'user' | 'agent' | 'hook' => kind !== 'system');
    for (const action of CARD_ACTIONS) {
      if (NOT_APPLIED.has(action) || !registry.get(action)) continue;
      // The action's own row, whatever its `permissions` would ask for a given payload.
      const definition = { ...registry.get(action), action, permissions: undefined, plan: () => ({}) };
      for (const role of ROLES) {
        for (const { name, facts, card } of CARD_FACTS) {
          const expected = isAllowed(action, [role], {
            isAssignee: false,
            isCreator: false,
            isDeliverer: false,
            specialty: null,
            ...facts,
          });
          for (const kind of kinds) {
            checked += 1;
            const got = service.isPermitted(actorOf(kind, role), definition as never, {}, {
              assigneeId: null,
              createdById: null,
              ...card,
            } as CardView);
            if (got !== expected) cells.push(`${action} × ${role} × ${kind} × ${name}: ${String(got)}`);
          }
        }
      }
    }
    expect(cells).toEqual([]);
    expect(checked).toBeGreaterThan(5000);
  });

  it('a system actor passes, because it has no roles to check', () => {
    const definition = registry.get('card.unblock');
    expect(definition).toBeDefined();
    const system = { kind: 'system', userId: null, via: 'adapter', workspaceId: 'w', roles: [] } as const;
    expect(service.isPermitted(system, definition as never, {}, null)).toBe(true);
    for (const role of ROLES) {
      expect(service.isPermitted(actorOf('user', role), definition as never, {}, null)).toBe(false);
    }
  });

  it('a system row is held by nobody and offered nowhere', () => {
    const rows = PERMISSION_ACTIONS.filter((action) => surfaceOf(action) === 'system');
    expect(rows).toEqual(
      expect.arrayContaining([
        'card.unblock',
        'plan.sync_step',
        'task.close_as_ported',
        'redesign.create',
        'doc.create',
        'change.create',
      ]),
    );
    for (const action of rows) for (const role of ROLES) expect(grantFor(action, role)).toBe('N');
  });

  describe('docs/04 §2 says what the code does', () => {
    const LEGEND: Readonly<Record<string, Grant>> = {
      '✓': 'Y',
      '✗': 'N',
      R: 'R',
      S: 'S',
      A: 'A',
      C: 'C',
      V: 'V',
    };
    /** The doc's row, and the table rows it stands for. */
    const ROWS: readonly (readonly [string, readonly PermissionAction[]])[] = [
      ['Create task', ['task.create']],
      ['Create decision', ['decision.create']],
      ['Create need', ['need.create']],
      ['Create handoff', ['handoff.create']],
      ['Create release', ['release.create']],
      ['Edit title/body/tags/module', ['card.edit_content']],
      ['Edit priority / dueAt / ownerRole / assignee', ['card.edit_routing']],
      ['Task: claim / unclaim', ['task.claim', 'task.unclaim']],
      ['Task: start / submit-review / done', ['task.start', 'task.submit_review', 'task.complete']],
      ['Task: complete or resume from review', ['task.review', 'task.resume']],
      ['Task: cancel / reopen', ['task.cancel', 'task.reopen']],
      ['Task: edit specialty/effort/acceptance/prompt', ['task.edit_detail']],
      ['Decision: edit options (while open)', ['decision.edit_options']],
      ['Decision: decide', ['decision.decide']],
      ['Decision: withdraw', ['decision.withdraw']],
      ['Decision: supersede', ['decision.supersede']],
      ['Decision: draft ADR body', ['decision.draft_adr']],
      ['Decision: open ADR PR', ['decision.open_adr_pr']],
      ['Need: start / deliver', ['need.start', 'need.deliver']],
      ['Need: verify / reject delivery (D24)', ['need.verify', 'need.reject_delivery']],
      ['Need: cancel', ['need.cancel']],
      ['Handoff: acknowledge / dismiss', ['handoff.acknowledge', 'handoff.dismiss']],
      ['Handoff: apply (D25)', ['handoff.apply']],
      ['Redesign: submit for review', ['redesign.send_to_review']],
      ['Redesign: approve / reject', ['redesign.approve', 'redesign.reject']],
      ['Redesign: request changes', ['redesign.request_changes']],
      ['Redesign: mark ported', ['redesign.mark_ported']],
      ['Release: edit included / notes / mark released', ['release.edit', 'release.release']],
      ['Delete / restore card (D28)', ['card.delete', 'card.restore']],
      ['Comment', ['card.comment']],
      ['Report work (docs/16 §7.2)', ['card.report_work']],
      ['Edit own comment (15 min)', ['card.comment_edit']],
      ['Redact comment', ['card.comment_redact']],
      ['Link / unlink', ['card.link']],
      ['Watch / unwatch', ['card.watch']],
      ['Read deleted cards', ['card.read_deleted']],
      ['Idea: create', ['idea.create']],
      [
        'Idea: edit / explore / accept / park / reject / reopen / turn into a plan',
        [
          'idea.update',
          'idea.explore',
          'idea.accept',
          'idea.park',
          'idea.reject',
          'idea.reopen',
          'idea.to_plan',
        ],
      ],
      ['Plan: create', ['plan.create']],
      [
        'Plan: edit / submit for review / start / finish / abandon / create tasks from steps',
        ['plan.update', 'plan.submit_review', 'plan.start', 'plan.finish', 'plan.abandon', 'plan.to_tasks'],
      ],
      ['Plan: approve', ['plan.approve']],
      ['Plan: request changes', ['plan.request_changes']],
      ['Plan: add evidence to a step', ['plan.add_evidence']],
      ["Plan: remove a step's evidence", ['plan.remove_evidence']],
      ['Plan: remove evidence you added', ['plan.remove_own_evidence']],
      ['Plan: ask for or attach its explainer video', ['plan.request_explainer', 'plan.attach_explainer']],
      ['Audit log: read', ['audit.read']],
    ];

    const doc = readFileSync(join(__dirname, '../../../../docs/04-api-reference.md'), 'utf8');
    const table = new Map(
      [...doc.matchAll(/^\| (.+?) \| (.) \| (.) \| (.) \| (.) \| (.) \| (.) \| (.) \|$/gm)].map((match) => [
        match[1] as string,
        match.slice(2, 9),
      ]),
    );

    it.each(ROWS)('%s', (label, actions) => {
      const cells = table.get(label);
      expect([label, cells?.length]).toEqual([label, ROLES.length]);
      ROLES.forEach((role, index) => {
        const documented = LEGEND[cells?.[index] as string];
        for (const action of actions) {
          expect([action, role, grantFor(action, role)]).toEqual([action, role, documented]);
        }
      });
    });
  });
});
