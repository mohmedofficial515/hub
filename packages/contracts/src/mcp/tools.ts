/**
 * @file MCP tool table (docs/15 §6, docs/05 §2.4): the whole contract between Claude Code and Hub.
 * @description One row per tool: its Zod input, the permission actions it performs, and the REST routes it stands
 * for. Two tests hold it to the code: a contracts test requires a tool for every mutating action with surface `any`,
 * and an API arch test requires a tool for every web mutation. A tool never takes a secret value, and there is no
 * tool for API tokens (docs/15 §2). Inputs reuse the REST schemas, flattened where `detail` would only get in the
 * way of a model. `project` is added to every tool by `MCP_TOOLS`.
 */
import { z } from 'zod';

import { queueRunsQuerySchema } from '../agent-queue';
import { logSessionSchema } from '../capture';
import {
  acknowledgeHandoffSchema,
  applyHandoffSchema,
  approveRedesignSchema,
  CARD_FLAGS,
  CARD_SORTS,
  cardKeySchema,
  cardTypeSchema,
  claimTaskSchema,
  commentBodySchema,
  completeTaskSchema,
  createDecisionSchema,
  createHandoffSchema,
  createIdeaSchema,
  createNeedSchema,
  createPlanSchema,
  createReleaseSchema,
  createTaskSchema,
  decideSchema,
  DECISION_STATUSES,
  deliverNeedSchema,
  DOC_KINDS,
  draftAdrSchema,
  editDecisionOptionsSchema,
  editReleaseSchema,
  editTaskDetailSchema,
  explainerRequestSchema,
  HANDOFF_STATUSES,
  IDEA_STATUSES,
  ideaToPlanSchema,
  LINK_INPUT_KINDS,
  markPortedSchema,
  NEED_STATUSES,
  optionalReasonSchema,
  PLAN_EVIDENCE_KINDS,
  PLAN_STATUSES,
  planToTasksSchema,
  reasonSchema,
  REDESIGN_STATUSES,
  redesignNoteSchema,
  RELEASE_STATUSES,
  releaseSchema,
  submitTaskSchema,
  supersedeDecisionSchema,
  TASK_STATUSES,
  updateCardSchema,
  updateIdeaSchema,
  updatePlanSchema,
  verifyNeedSchema,
} from '../cards';
import { auditQuerySchema } from '../cards/read-models';
import {
  promptTemplateInputSchema,
  proposeDocSchema,
  proposedPlanSchema,
  reportWorkSchema,
  saveDocToolSchema,
  stageReportSchema,
  updateChatSchema,
} from '../chat';
import { fixDeviceSchema } from '../devices';
import { proposedIdeaSchema } from '../idea-studio';
import type { PermissionAction } from '../permissions';
import {
  createProjectSchema,
  createSourceSchema,
  githubLoginsSchema,
  projectSlugSchema,
  updateProjectSchema,
  updateSourceSchema,
} from '../projects';
import { roleSchema, specialtySchema } from '../roles';
import { putAnnotationsSchema, refreshSchemaSchema, updateSchemaDraftSchema } from '../schema-studio';
import { SKILL_SOURCES } from '../skills';
import { proposeSuggestionsSchema } from '../suggestions';
import { saveNarrativeSchema } from '../today';

const key = z.object({ key: cardKeySchema.describe('The card key, such as GTV-123') });
const limit = z.number().int().min(1).max(100).optional();
const page = { cursor: z.string().max(400).optional(), limit };
const noInput = z.object({});

/** `detail` of a create schema, lifted to the top level. */
function flatCreate<S extends z.ZodObject<{ detail: z.ZodObject }>>(schema: S) {
  const { detail, ...rest } = schema.shape as z.ZodRawShape & { detail: z.ZodObject };
  return z.object({ ...rest, ...detail.shape });
}

/** Keys of the `detail` object of a create schema, so a tool can put a flat input back together. */
export function nestCreateInput<S extends z.ZodObject<{ detail: z.ZodObject }>>(
  schema: S,
  input: Readonly<Record<string, unknown>>,
): Record<string, unknown> {
  const detailKeys = Object.keys(schema.shape.detail.shape);
  const header: Record<string, unknown> = {};
  const detail: Record<string, unknown> = {};
  for (const [name, value] of Object.entries(input)) {
    if (name === 'project') continue;
    (detailKeys.includes(name) ? detail : header)[name] = value;
  }
  return { ...header, detail };
}

const taskUpdateInput = key.extend({
  ...updateCardSchema.shape,
  ...editTaskDetailSchema.shape,
  move: z
    .enum(['ready', 'backlog', 'resume'])
    .optional()
    .describe('ready: backlog to ready. backlog: ready to backlog. resume: from review back to in progress.'),
});

export interface McpToolDefinition {
  readonly description: string;
  readonly input: z.ZodObject;
  /** The permission actions this tool performs. */
  readonly actions: readonly PermissionAction[];
  /** REST routes this tool stands for, as `METHOD path` from the Nest controllers. Reads may leave it empty. */
  readonly routes?: readonly string[];
  /** Sets `destructiveHint`, and the description tells Claude to confirm in the chat first (docs/15 §2). */
  readonly destructive?: boolean;
  readonly readOnly?: boolean;
  /** A create: wrapped in `IdempotencyService.run` with the tool call id. */
  readonly createsCards?: boolean;
}

const W = '/workspaces/:ws';

const TOOL_TABLE = {
  // Orientation and reads
  get_project_brief: {
    description:
      'What this project is and who you are in it: active project, your roles, counts, sources. Call it first, and tell the user which project is active.',
    input: noInput,
    actions: ['project.read'],
    readOnly: true,
  },
  whats_new: {
    description:
      'What changed since your last call: what awaits you, your sessions without a summary, then recent events.',
    input: z.object({
      since: z.iso.datetime({ offset: true }).optional(),
      types: z.array(cardTypeSchema).max(10).optional(),
      limit,
    }),
    actions: ['card.read'],
    readOnly: true,
  },
  search_docs: {
    description: 'Full-text search over the indexed Markdown docs of this project.',
    input: z.object({
      query: z.string().min(2).max(200),
      kind: z.enum(DOC_KINDS).optional(),
      source: z.string().max(80).optional(),
      limit: z.number().int().min(1).max(20).optional(),
    }),
    actions: ['docs.read'],
    readOnly: true,
  },
  get_doc: {
    description: 'Read one indexed document, or one section of it. Pass its key, or source and path.',
    input: z.object({
      key: cardKeySchema.optional(),
      source: z.string().max(80).optional(),
      path: z.string().max(500).optional(),
      section: z.string().max(120).optional(),
      maxChars: z.number().int().min(500).max(60_000).optional(),
    }),
    actions: ['docs.read'],
    readOnly: true,
  },
  save_doc: {
    description:
      'Write a Markdown document to its file, through Hub, from any device. After propose_doc, pass `draft`: what is saved is that draft with the answers to its flags, and it refuses while a flag is unanswered. Otherwise pass key, or source and path for a new file, with content and baseHash from the Version line of get_doc. The earlier text is kept as a revision, a save based on an older version is refused, and it warns about similar documents. Search first (search_docs), so nothing is written twice. It commits nothing.',
    input: saveDocToolSchema,
    actions: ['docs.write'],
    routes: ['POST /workspaces/:ws/docs/save'],
    destructive: true,
  },
  list_doc_revisions: {
    description: 'The earlier texts of a document, newest first, each with its id for restore_doc_revision.',
    input: z.object({ key: cardKeySchema }),
    actions: ['docs.read'],
    readOnly: true,
  },
  restore_doc_revision: {
    description:
      'Put an earlier text of a document back. What is there now becomes a revision too, so this can be undone.',
    input: z.object({
      key: cardKeySchema,
      revision: z.string().uuid(),
      baseHash: z.string().max(100).optional(),
    }),
    actions: ['docs.write'],
    routes: ['POST /workspaces/:ws/docs/:key/revisions/:id/restore'],
    destructive: true,
  },
  get_card: {
    description:
      'One card with everything its sheet shows: detail, links, comments, and what you may do now.',
    input: key.extend({
      includeComments: z.boolean().optional(),
      includeEvents: z.boolean().optional(),
    }),
    actions: ['card.read'],
    readOnly: true,
  },
  list_cards: {
    description: 'Search and filter cards of any type. `awaiting: true` lists what waits on you.',
    input: z.object({
      type: z.array(cardTypeSchema).max(10).optional(),
      status: z.array(z.string().max(40)).max(10).optional(),
      role: z.array(roleSchema).max(7).optional(),
      assignee: z.string().max(40).optional().describe('A user id, or "me"'),
      module: z.string().max(40).optional(),
      repo: z.string().max(80).optional(),
      tag: z.string().max(40).optional(),
      q: z.string().trim().min(1).max(200).optional(),
      dueBefore: z.iso.datetime().optional(),
      flags: z.array(z.enum(CARD_FLAGS)).max(5).optional(),
      awaiting: z.boolean().optional(),
      sort: z.enum(CARD_SORTS).optional(),
      ...page,
    }),
    actions: ['card.read'],
    readOnly: true,
  },
  list_deleted: {
    description: 'The Deleted view: every deleted card for owner and pm, your own otherwise.',
    input: z.object(page),
    actions: ['card.read_deleted'],
    readOnly: true,
  },

  // Tasks
  list_tasks: {
    description:
      'Tasks. With no filter: ready, unblocked tasks for your specialties. `mine: true`: your claims.',
    input: z.object({
      specialty: specialtySchema.optional(),
      status: z.array(z.enum(TASK_STATUSES)).max(7).optional(),
      mine: z.boolean().optional(),
      q: z.string().trim().min(1).max(200).optional(),
      ...page,
    }),
    actions: ['card.read'],
    readOnly: true,
  },
  create_task: {
    description:
      'Create a task. It starts in backlog, or ready when it has a prompt or acceptance. Use one call per task: repeating it creates another.',
    input: flatCreate(createTaskSchema).omit({ origin: true }),
    actions: ['task.create'],
    routes: ['POST /workspaces/:ws/cards'],
    createsCards: true,
  },
  update_task: {
    description:
      'Edit any field of a task: title, body, priority, role, due date, tags, module, assignee, specialty, effort, acceptance, prompt, branch, PR URL. `move` also moves it between backlog, ready and review.',
    input: taskUpdateInput,
    actions: [
      'card.edit_content',
      'card.edit_routing',
      'task.edit_detail',
      'task.mark_ready',
      'task.mark_backlog',
      'task.resume',
    ],
    routes: [
      `PATCH ${W}/tasks/:key`,
      `POST ${W}/tasks/:key/mark-ready`,
      `POST ${W}/tasks/:key/mark-backlog`,
      `POST ${W}/tasks/:key/resume`,
    ],
  },
  claim_task: {
    description: 'Claim a task for yourself, optionally naming your branch.',
    input: key.extend(claimTaskSchema.shape),
    actions: ['task.claim'],
    routes: [`POST ${W}/tasks/:key/claim`],
  },
  unclaim_task: {
    description: 'Give a claimed task back.',
    input: key,
    actions: ['task.unclaim'],
    routes: [`POST ${W}/tasks/:key/unclaim`],
  },
  start_task: {
    description: 'Start a task you claimed.',
    input: key,
    actions: ['task.start'],
    routes: [`POST ${W}/tasks/:key/start`],
  },
  submit_task: {
    description: 'Send a task to review, with its PR URL and a note.',
    input: key.extend(submitTaskSchema.shape),
    actions: ['task.submit_review'],
    routes: [`POST ${W}/tasks/:key/submit-review`],
  },
  complete_task: {
    description: 'Mark a task done.',
    input: key.extend(completeTaskSchema.shape),
    actions: ['task.complete', 'task.review'],
    routes: [`POST ${W}/tasks/:key/done`],
  },
  reopen_task: {
    description: 'Reopen a finished or cancelled task.',
    input: key.extend(optionalReasonSchema.shape),
    actions: ['task.reopen'],
    routes: [`POST ${W}/tasks/:key/reopen`],
  },
  cancel_task: {
    description: 'Cancel a task, with a reason.',
    input: key.extend(reasonSchema.shape),
    actions: ['task.cancel'],
    routes: [`POST ${W}/tasks/:key/cancel`],
    destructive: true,
  },

  // Decisions
  list_decisions: {
    description: 'Decisions. With no filter: open ones, by deadline, with what each blocks.',
    input: z.object({
      status: z.array(z.enum(DECISION_STATUSES)).max(4).optional(),
      deciderRole: z.array(roleSchema).max(7).optional(),
      mine: z.boolean().optional(),
      overdue: z.boolean().optional(),
      ...page,
    }),
    actions: ['card.read'],
    readOnly: true,
  },
  request_decision: {
    description:
      'Open a decision with at least two options, routed to the role that decides. Use it whenever a business rule is missing. Search the docs first.',
    input: flatCreate(createDecisionSchema),
    actions: ['decision.create'],
    routes: ['POST /workspaces/:ws/cards'],
    createsCards: true,
  },
  get_decision: {
    description: 'A decision: question, options, the choice and rationale, its ADR, and what it blocks.',
    input: key,
    actions: ['card.read'],
    readOnly: true,
  },
  update_decision: {
    description: 'Replace the options of an open decision. For its title or question use update_card.',
    input: key.extend(editDecisionOptionsSchema.shape),
    actions: ['decision.edit_options'],
    routes: [`PATCH ${W}/decisions/:key/options`],
  },
  decide: {
    description:
      'Decide an open decision: choose an option and give the rationale. This unblocks whatever waits on it.',
    input: key.extend(decideSchema.shape),
    actions: ['decision.decide'],
    routes: [`POST ${W}/decisions/:key/decide`],
    destructive: true,
  },
  withdraw_decision: {
    description: 'Withdraw an open decision, with a reason.',
    input: key.extend(reasonSchema.shape),
    actions: ['decision.withdraw'],
    routes: [`POST ${W}/decisions/:key/withdraw`],
    destructive: true,
  },
  supersede_decision: {
    description: 'Replace a decision by another one.',
    input: key.extend(supersedeDecisionSchema.shape),
    actions: ['decision.supersede'],
    routes: [`POST ${W}/decisions/:key/supersede`],
    destructive: true,
  },
  draft_adr: {
    description: 'Save the ADR text of a decided decision.',
    input: key.extend(draftAdrSchema.shape),
    actions: ['decision.draft_adr'],
    routes: [`PUT ${W}/decisions/:key/adr`],
  },
  open_adr_pr: {
    description:
      'Open a pull request with the saved ADR. It needs a GitHub connection, which this release does not have.',
    input: key,
    actions: ['decision.open_adr_pr'],
    destructive: true,
  },

  // Needs
  list_needs: {
    description: 'Needs: things required from outside the code. With no filter: the unfinished ones.',
    input: z.object({
      status: z.array(z.enum(NEED_STATUSES)).max(5).optional(),
      responsibleRole: z.array(roleSchema).max(7).optional(),
      mine: z.boolean().optional(),
      stale: z.boolean().optional(),
      ...page,
    }),
    actions: ['card.read'],
    readOnly: true,
  },
  create_need: {
    description:
      'Record something needed from outside the code: a token, account, contract, value or access. Describe it and where it should go. Never send the value.',
    input: flatCreate(createNeedSchema),
    actions: ['need.create'],
    routes: ['POST /workspaces/:ws/cards'],
    createsCards: true,
  },
  start_need: {
    description: 'Start working on a need.',
    input: key,
    actions: ['need.start'],
    routes: [`POST ${W}/needs/:key/start`],
  },
  deliver_need: {
    description: 'Say where a needed value was put. Never send the value itself.',
    input: key.extend(deliverNeedSchema.shape),
    actions: ['need.deliver'],
    routes: [`POST ${W}/needs/:key/deliver`],
  },
  verify_need: {
    description: 'Verify a delivered need. Verifying your own delivery needs a note.',
    input: key.extend(verifyNeedSchema.shape),
    actions: ['need.verify'],
    routes: [`POST ${W}/needs/:key/verify`],
    destructive: true,
  },
  reject_need_delivery: {
    description: 'Send a delivery back, with a reason.',
    input: key.extend(reasonSchema.shape),
    actions: ['need.reject_delivery'],
    routes: [`POST ${W}/needs/:key/reject-delivery`],
    destructive: true,
  },
  cancel_need: {
    description: 'Cancel a need, with a reason.',
    input: key.extend(reasonSchema.shape),
    actions: ['need.cancel'],
    routes: [`POST ${W}/needs/:key/cancel`],
    destructive: true,
  },

  // Handoffs
  list_handoffs: {
    description: 'Handoffs. With no filter: unfinished ones, breaking first.',
    input: z.object({
      status: z.array(z.enum(HANDOFF_STATUSES)).max(4).optional(),
      toRole: z.array(roleSchema).max(7).optional(),
      mine: z.boolean().optional(),
      stale: z.boolean().optional(),
      ...page,
    }),
    actions: ['card.read'],
    readOnly: true,
  },
  create_handoff: {
    description: 'Tell another role that your change affects them, with a ready prompt for their agent.',
    input: flatCreate(createHandoffSchema).extend({
      fromRole: roleSchema.optional().describe('Defaults to your first role'),
    }),
    actions: ['handoff.create'],
    routes: ['POST /workspaces/:ws/cards'],
    createsCards: true,
  },
  acknowledge_handoff: {
    description: 'Acknowledge a handoff.',
    input: key.extend(acknowledgeHandoffSchema.shape),
    actions: ['handoff.acknowledge'],
    routes: [`POST ${W}/handoffs/:key/acknowledge`],
  },
  apply_handoff: {
    description: 'Mark a handoff applied, naming the task that carried it or creating one.',
    input: key.extend(applyHandoffSchema.shape),
    actions: ['handoff.apply'],
    routes: [`POST ${W}/handoffs/:key/apply`],
    createsCards: true,
  },
  dismiss_handoff: {
    description: 'Dismiss a handoff, with a reason.',
    input: key.extend(reasonSchema.shape),
    actions: ['handoff.dismiss'],
    routes: [`POST ${W}/handoffs/:key/dismiss`],
    destructive: true,
  },

  // Redesign
  list_redesigns: {
    description: 'Redesign versions from the lab.',
    input: z.object({
      app: z.string().max(40).optional(),
      page: z.string().max(100).optional(),
      status: z.array(z.enum(REDESIGN_STATUSES)).max(6).optional(),
      cursor: z.string().max(400).optional(),
      limit,
    }),
    actions: ['card.read'],
    readOnly: true,
  },
  send_redesign_to_review: {
    description: 'Send a redesign version to review.',
    input: key,
    actions: ['redesign.send_to_review'],
    routes: [`POST ${W}/redesign/:key/submit-review`],
  },
  approve_redesign: {
    description: 'Approve a redesign version, creating its port task. Owner only.',
    input: key.extend(approveRedesignSchema.shape),
    actions: ['redesign.approve'],
    routes: [`POST ${W}/redesign/:key/approve`],
    destructive: true,
    createsCards: true,
  },
  reject_redesign: {
    description: 'Reject a redesign version, with a note. Owner only.',
    input: key.extend(redesignNoteSchema.shape),
    actions: ['redesign.reject'],
    routes: [`POST ${W}/redesign/:key/reject`],
    destructive: true,
  },
  request_redesign_changes: {
    description: 'Ask for changes on a version in review. Its status stays review.',
    input: key.extend(redesignNoteSchema.shape),
    actions: ['redesign.request_changes'],
    routes: [`POST ${W}/redesign/:key/request-changes`],
  },
  mark_redesign_ported: {
    description: 'Mark an approved version ported, closing its port task.',
    input: key.extend(markPortedSchema.shape),
    actions: ['redesign.mark_ported'],
    routes: [`POST ${W}/redesign/:key/mark-ported`],
  },
  rescan_lab: {
    description: 'Scan the redesign lab now.',
    input: noInput,
    actions: ['redesign.rescan'],
    routes: [`POST ${W}/redesign/rescan`],
  },

  // Releases
  list_releases: {
    description: 'Releases.',
    input: z.object({ status: z.array(z.enum(RELEASE_STATUSES)).max(2).optional(), ...page }),
    actions: ['card.read'],
    readOnly: true,
  },
  create_release: {
    description: 'Create a planned release, optionally with the cards it includes.',
    input: flatCreate(createReleaseSchema),
    actions: ['release.create'],
    routes: ['POST /workspaces/:ws/cards'],
    createsCards: true,
  },
  update_release: {
    description:
      'Edit a release: version, tag, included cards, notes per audience. `generateNotes` fills empty notes from the included cards.',
    input: key.extend({ ...editReleaseSchema.shape, generateNotes: z.boolean().optional() }),
    actions: ['release.edit', 'release.generate_notes'],
    routes: [`PATCH ${W}/releases/:key`, `POST ${W}/releases/:key/generate-notes`],
  },
  release: {
    description:
      'Mark a release released. It cannot be undone: tell the user the version and how many cards it ships, and wait for a yes.',
    input: key.extend(releaseSchema.shape),
    actions: ['release.release'],
    routes: [`POST ${W}/releases/:key/release`],
    destructive: true,
  },

  // Ideas
  list_ideas: {
    description: 'Ideas worth thinking about.',
    input: z.object({
      status: z.array(z.enum(IDEA_STATUSES)).max(5).optional(),
      q: z.string().trim().min(1).max(200).optional(),
      ...page,
    }),
    actions: ['card.read'],
    readOnly: true,
  },
  create_idea: {
    description: 'Record an idea: its title, the problem, and notes in Markdown.',
    input: flatCreate(createIdeaSchema),
    actions: ['idea.create'],
    routes: ['POST /workspaces/:ws/cards'],
    createsCards: true,
  },
  update_idea: {
    description:
      'Edit an idea, and move it with `move`: explore, accept, park, reject or reopen. Use idea_to_plan to turn it into a plan.',
    input: key.extend({
      ...updateIdeaSchema.shape,
      move: z.enum(['explore', 'accept', 'park', 'reject', 'reopen']).optional(),
      reason: z.string().trim().max(2000).optional(),
    }),
    actions: ['idea.update', 'idea.explore', 'idea.accept', 'idea.park', 'idea.reject', 'idea.reopen'],
    routes: [
      `PATCH ${W}/ideas/:key`,
      `POST ${W}/ideas/:key/explore`,
      `POST ${W}/ideas/:key/accept`,
      `POST ${W}/ideas/:key/park`,
      `POST ${W}/ideas/:key/reject`,
      `POST ${W}/ideas/:key/reopen`,
    ],
  },
  idea_to_plan: {
    description: 'Turn an idea into a linked plan and accept the idea.',
    input: key.extend(ideaToPlanSchema.shape),
    actions: ['idea.to_plan'],
    routes: [`POST ${W}/ideas/:key/to-plan`],
    createsCards: true,
  },

  // Plans
  list_plans: {
    description: 'Plans, with their step progress.',
    input: z.object({
      status: z.array(z.enum(PLAN_STATUSES)).max(6).optional(),
      q: z.string().trim().min(1).max(200).optional(),
      ...page,
    }),
    actions: ['card.read'],
    readOnly: true,
  },
  get_plan: {
    description: 'A plan: its full Markdown, its phases, ordered steps with their tasks, and its revisions.',
    input: key.extend({ includeRevisions: z.boolean().optional() }),
    actions: ['card.read'],
    readOnly: true,
  },
  create_plan: {
    description:
      'Save a written plan: full Markdown `body` and ordered `steps`. Group the steps in `phases` (`{id, title, note?}` in order, at most 20) and give each step its `phaseId`; a plan without phases reads as one list. It starts as a draft. Then plan_to_tasks creates its tasks.',
    input: flatCreate(createPlanSchema),
    actions: ['plan.create'],
    routes: ['POST /workspaces/:ws/cards'],
    createsCards: true,
  },
  update_plan: {
    description:
      'Edit a plan: body, steps, phases, title. Each step may carry `why`, `size` (S, M, L), `after` (ids of earlier steps), `acceptance` and `phaseId` (one of the `phases` of the plan). `phases` is the whole ordered list `{id, title, note?}`: a phase that steps still name cannot be removed, so move those steps in the same call. A new body adds a revision, and `restoreRevision` brings an old one back. `move` changes its status: submit_review, approve, request_changes (owner or pm, back to draft, `reason` required), start, finish, abandon.',
    input: key.extend({
      ...updatePlanSchema.shape,
      restoreRevision: z.number().int().min(1).optional(),
      move: z.enum(['submit_review', 'approve', 'request_changes', 'start', 'finish', 'abandon']).optional(),
      reason: z.string().trim().max(2000).optional(),
    }),
    actions: [
      'plan.update',
      'plan.restore_revision',
      'plan.submit_review',
      'plan.approve',
      'plan.request_changes',
      'plan.start',
      'plan.finish',
      'plan.abandon',
    ],
    routes: [
      `PATCH ${W}/plans/:key`,
      `POST ${W}/plans/:key/restore`,
      `POST ${W}/plans/:key/submit-review`,
      `POST ${W}/plans/:key/approve`,
      `POST ${W}/plans/:key/request-changes`,
      `POST ${W}/plans/:key/start`,
      `POST ${W}/plans/:key/finish`,
      `POST ${W}/plans/:key/abandon`,
    ],
  },
  add_step_evidence: {
    description:
      "Attach a screenshot or a clip to a plan step as its evidence, when you finish the step: `kind` before or after for a picture (PNG, JPEG or WebP, up to 8 MB), video for a clip (MP4 or WebM, up to 40 MB), and a one-line `caption`. `path` is the file's absolute path; it must lie inside one of the project's registered folders (or a Hub worktree of one) on the machine Hub runs on. Hub keeps a picture without its metadata. `step` is the step's id, or its number from 1.",
    input: key.extend({
      step: z.union([z.string().min(1).max(64), z.number().int().min(1).max(200)]),
      kind: z.enum(PLAN_EVIDENCE_KINDS),
      caption: z.string().trim().min(1).max(200).optional(),
      path: z.string().min(1).max(500),
    }),
    actions: ['plan.add_evidence'],
    routes: [`POST ${W}/plans/:key/steps/:stepId/evidence`],
  },
  remove_step_evidence: {
    description:
      "Remove a file from a plan step's evidence, by its attachment id (get_plan lists them). The plan's owner, a pm and its creator may remove any; anyone may remove what they added. Its bytes are deleted.",
    input: key.extend({
      step: z.union([z.string().min(1).max(64), z.number().int().min(1).max(200)]),
      attachmentId: z.uuid(),
    }),
    actions: ['plan.remove_evidence', 'plan.remove_own_evidence'],
    routes: [`DELETE ${W}/plans/:key/steps/:stepId/evidence/:attachmentId`],
    destructive: true,
  },
  list_plan_runs: {
    description:
      "Claude's runs on a plan from every member of the project: step, state, who and the stages reported. No prompt, folder or chat.",
    input: key,
    actions: ['plan.read_runs'],
    routes: [`GET ${W}/plans/:key/runs`],
    readOnly: true,
  },
  request_plan_explainer: {
    description:
      "Ask for the plan's explainer video, made by Hams: `style`, `voice` (google, the default, sends only the script's text to Google; hams stays on the machine; none), `googleVoice` (Charon by default), `dialect`, `aspect`, `length`, `captions`. It records the request for the plan's current revision; the owner's agent queue makes it in Hams' folder.",
    input: key.extend(explainerRequestSchema.shape),
    actions: ['plan.request_explainer'],
    routes: [`POST ${W}/plans/:key/explainer`],
  },
  attach_plan_explainer: {
    description:
      "Attach the explainer film made for a plan with Hams' plan-film: the absolute paths of the exported mp4, its poster and its captions (.vtt), each inside one of the project's registered folders on the machine Hub runs on; `chapters` from plan-explainer.chapters.json (`phase` is the plan's phase number, null for the intro and the close; `start` in seconds); `revision` the plan revision it explains (as the run was told); and `hamsProject` {id, url} to open it in Hams.",
    input: key.extend({
      revision: z.number().int().min(1),
      video: z.string().min(1).max(500),
      poster: z.string().min(1).max(500).optional(),
      captions: z.string().min(1).max(500).optional(),
      chapters: z
        .array(
          z.object({
            phase: z.number().int().min(0).max(99).nullable(),
            title: z.string().trim().min(1).max(200).optional(),
            start: z.number().min(0).max(36_000),
          }),
        )
        .max(60),
      hamsProject: z.object({ id: z.string().min(1).max(200), url: z.url() }).optional(),
    }),
    actions: ['plan.attach_explainer'],
  },
  plan_to_tasks: {
    description: 'Create one task per step with no task yet, and move the plan to in progress.',
    input: key.extend(planToTasksSchema.shape),
    actions: ['plan.to_tasks'],
    routes: [`POST ${W}/plans/:key/to-tasks`],
    createsCards: true,
  },

  // Any card
  update_card: {
    description:
      'Edit the header of any card: title, body, priority, role, due date, tags, module, assignee, repo, branch.',
    input: key.extend(updateCardSchema.shape),
    actions: ['card.edit_content', 'card.edit_routing'],
    routes: [`PATCH ${W}/cards/:key`],
  },
  move_card: {
    description: 'Move a card to another status, for moves with no tool of their own.',
    input: key.extend({ to: z.string().min(1).max(40), reason: z.string().trim().max(2000).optional() }),
    actions: ['card.read'],
    routes: [`POST ${W}/cards/:key/transition`],
  },
  comment: {
    description:
      'Comment on a card, or edit your own comment within 15 minutes by passing `commentId`. Mention with @user:<id> or @role:<role>.',
    input: key.extend({ ...commentBodySchema.shape, commentId: z.uuid().optional() }),
    actions: ['card.comment', 'card.comment_edit'],
    routes: [`POST ${W}/cards/:key/comments`, `PATCH ${W}/cards/:key/comments/:id`],
  },
  redact_comment: {
    description: 'Redact a comment: the text is gone, the fact stays.',
    input: key.extend({ commentId: z.uuid() }),
    actions: ['card.comment_redact'],
    routes: [`POST ${W}/cards/:key/comments/:id/redact`],
    destructive: true,
  },
  link_cards: {
    description: 'Link two cards, or remove a link with `remove: true`.',
    input: z.object({
      from: cardKeySchema,
      to: cardKeySchema,
      kind: z.enum(LINK_INPUT_KINDS),
      remove: z.boolean().optional(),
    }),
    actions: ['card.link'],
    routes: [`POST ${W}/cards/:key/links`, `DELETE ${W}/cards/:key/links`],
  },
  watch_card: {
    description: 'Watch a card, or stop with `watching: false`.',
    input: key.extend({ watching: z.boolean().optional() }),
    actions: ['card.watch'],
    routes: [`POST ${W}/cards/:key/watch`, `DELETE ${W}/cards/:key/watch`],
  },
  delete_card: {
    description:
      'Delete a card: hidden from every page, count and search, and recoverable with restore_card. Hub never loses it.',
    input: key.extend(optionalReasonSchema.shape),
    actions: ['card.delete'],
    routes: [`POST ${W}/cards/:key/delete`],
    destructive: true,
  },
  restore_card: {
    description: 'Restore a deleted card.',
    input: key,
    actions: ['card.restore'],
    routes: [`POST ${W}/cards/:key/restore`],
  },

  // Sessions and briefs
  log_session: {
    description:
      'Record what this Claude Code session did. Safe to repeat for one sessionId: it updates the same card, and creates each handoff and follow-up once. `sessionId` is the "Hub session id" from the session context.',
    input: logSessionSchema,
    actions: ['session.log'],
    createsCards: true,
  },
  list_my_sessions_without_summary: {
    description: 'Your sessions that left only Git facts. Write them with log_session.',
    input: z.object({ limit: z.number().int().min(1).max(20).optional() }),
    actions: ['card.read'],
    readOnly: true,
  },
  save_brief: {
    description:
      'Save the short narrative of your morning brief, shown on your Today page, or the weekly one for the project (owner or pm).',
    input: z.object({
      kind: z.enum(['morning', 'weekly']).optional(),
      date: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$|^\d{4}-W\d{2}$/)
        .optional(),
      narrative: saveNarrativeSchema.shape.narrative,
    }),
    actions: ['brief.save', 'brief.save_weekly'],
    routes: [`PUT ${W}/briefs/:kind/:date/narrative`],
  },

  // Projects
  list_projects: {
    description: 'The projects you belong to, with what is waiting in each.',
    input: noInput,
    actions: ['project.read'],
    readOnly: true,
  },
  get_project: {
    description: 'One project with its details, your roles and its counts.',
    input: noInput,
    actions: ['project.read'],
    readOnly: true,
  },
  create_project: {
    description:
      'Create a project and become its owner. `slug` is lowercase with dashes, `keyPrefix` is 2 to 6 capitals, used in card keys.',
    input: createProjectSchema,
    actions: ['project.create'],
    routes: ['POST /workspaces'],
  },
  update_project: {
    description:
      'Change a project: name, description, goals, links, local folders, timezone. `status` pauses, closes or reopens it. Closing makes it read-only, and it can be reopened. Projects are never deleted.',
    input: updateProjectSchema.omit({ status: true }).extend({
      status: z.enum(['active', 'paused', 'closed']).optional(),
    }),
    actions: ['project.update', 'project.close', 'project.reopen'],
    routes: ['PATCH /workspaces/:ws', 'POST /workspaces/:ws/close', 'POST /workspaces/:ws/reopen'],
    destructive: true,
  },
  switch_project: {
    description:
      'Set the project a chat lands on when neither `project` nor the folder names one. Say so to the user.',
    input: z.object({ slug: projectSlugSchema }),
    actions: ['project.switch'],
    routes: ['PUT /me/default-project'],
  },

  // Devices (docs/16 §5). Pairing makes credentials and the Link button writes Claude Code's config on a press (D44), so neither has a tool.
  list_devices: {
    description: 'Your paired devices: online or not, the Claude Code version, and the last health report.',
    input: noInput,
    actions: ['device.manage'],
    readOnly: true,
  },
  check_device: {
    description: 'Runs the health checks on one device now and reports them, as Settings › Devices does.',
    input: z.object({ device: z.string().uuid() }),
    actions: ['device.manage'],
    readOnly: true,
  },
  fix_device: {
    description:
      'Runs one fix on a device from the closed list: `mcp_server`, `plugin` or `login_start`. It changes user-level Claude Code settings on that device, so confirm with the user in the chat before calling this.',
    input: z.object({ device: z.string().uuid(), fix: fixDeviceSchema.shape.fix }),
    actions: ['device.manage'],
    routes: ['POST /me/devices/:id/fix'],
    destructive: true,
  },
  revoke_device: {
    description:
      'Revoke a paired device. Its bridge is cut at once and its Claude Code loses Hub. Pairing it again needs the browser, so confirm with the user in the chat before calling this.',
    input: z.object({ device: z.string().uuid() }),
    actions: ['device.manage'],
    routes: ['DELETE /me/devices/:id'],
    destructive: true,
  },

  // Chats (docs/16 §7). Starting or running one and answering its approvals are web only: an agent must not start agents or approve its own call. Slice 5's queue is how an agent run gets scheduled.
  list_chats: {
    description: 'Your Hub panel chats on this project, pinned first, with their device, folder and mode.',
    input: z.object({ deleted: z.boolean().optional() }),
    actions: ['chat.read'],
    readOnly: true,
  },
  get_chat: {
    description: 'One panel chat: its words, and for each turn the steps, status and changed files.',
    input: z.object({ chat: z.string().uuid() }),
    actions: ['chat.read'],
    readOnly: true,
  },
  export_chat: {
    description: 'One panel chat as Markdown.',
    input: z.object({ chat: z.string().uuid() }),
    actions: ['chat.read'],
    readOnly: true,
  },
  update_chat: {
    description:
      "Rename or pin a panel chat. Its mode is the owner's to set, so an agent cannot widen what a chat may do.",
    input: updateChatSchema.pick({ title: true, pinned: true }).extend({ chat: z.string().uuid() }),
    actions: ['chat.manage'],
    routes: ['PATCH /workspaces/:ws/chats/:id'],
  },
  delete_chat: {
    description: 'Delete a panel chat, stopping its turn if one is running. It can be restored.',
    input: z.object({ chat: z.string().uuid() }),
    actions: ['chat.manage'],
    routes: ['DELETE /workspaces/:ws/chats/:id'],
    destructive: true,
  },
  restore_chat: {
    description: 'Bring a deleted panel chat back.',
    input: z.object({ chat: z.string().uuid() }),
    actions: ['chat.manage'],
    routes: ['POST /workspaces/:ws/chats/:id/restore'],
  },
  list_prompt_templates: {
    description: 'Frequent prompts saved on this project.',
    input: noInput,
    actions: ['chat.read'],
    readOnly: true,
  },
  save_prompt_template: {
    description: 'Save a frequent prompt on this project, or change one by passing its id.',
    input: promptTemplateInputSchema.extend({ id: z.string().uuid().optional() }),
    actions: ['chat.manage'],
    routes: ['POST /workspaces/:ws/prompt-templates', 'PUT /workspaces/:ws/prompt-templates/:id'],
  },
  delete_prompt_template: {
    description: 'Delete a saved prompt.',
    input: z.object({ id: z.string().uuid() }),
    actions: ['chat.manage'],
    routes: ['DELETE /workspaces/:ws/prompt-templates/:id'],
    destructive: true,
  },
  report_stage: {
    description:
      "Say which stage of /hub:work (protocol work), /hub:doc (doc) or a plan's explainer video (film: script, voice, scenes, render, attach) you are in, so the panel and the plan's page show a live checklist. Call it as each stage starts, and as it ends or fails. It stores nothing and changes nothing.",
    input: stageReportSchema,
    actions: ['chat.read'],
    readOnly: true,
  },
  report_work: {
    description:
      "Write a task's work report on its card as evidence: what changed, each check with its exact command and outcome, and what was not checked. Hub checks each claim against the real steps of this chat: a check is verified only if a step really ran that exact command and succeeded, and saying a failed step passed is refused. Copy each command word for word, and report every check, failed ones too. If every check is verified the task moves to In review by itself. It never completes a task. In a chat outside the panel, checks stay claimed and the task does not move.",
    input: reportWorkSchema,
    actions: ['card.report_work'],
  },
  list_work_reports: {
    description:
      "A card's work reports, newest first: each check with its real runs, what is verified and what is only claimed.",
    input: z.object({ key: cardKeySchema }),
    actions: ['card.read'],
    readOnly: true,
  },
  propose_plan: {
    description:
      'Propose a plan in structured form, so the panel and the Plan Studio show its steps, checks and risks and offer Run this plan. Add what you know: the `goal`, the `approach`, the `size` of each step (S, M, L), the steps each comes `after` (by number) and its `acceptance` (when it counts as done), what is `outOfScope`, the `questions` only the user can answer, a small flow `diagram`, and the `sources` you relied on. Write each of the `questions` as `{text, options, recommended, why, multi}`: 2 to 5 short `options` the owner can pick, the index of the one you `recommended` and `why` in one line, and `multi: true` when several can be true together. The page adds Other, for an answer in their own words. It stores the plan on this turn and changes nothing else. Call it again with the whole plan after each change. Outside a panel, show the answer to the user in your reply. To save a plan as a card, use create_plan once the user agrees; in Plan mode the user saves it from the page.',
    input: proposedPlanSchema,
    actions: ['chat.read'],
    readOnly: true,
  },
  propose_idea: {
    description:
      "The Idea Studio's report (/hub:idea): the idea as you now understand it, how much of it already exists (`overlap`, 0 to 100, and `verdict`) with each match and where it lives (a card key, a doc or file path, or a URL), what your research found with numbered `sources`, your suggestions, a small flow `diagram` (nodes and edges), a draft plan's `steps`, risks and open questions. Write each of the `questions` as `{text, options, recommended, why, multi}`: 2 to 5 short `options` the owner can pick, the index of the one you `recommended` and `why` in one line, and `multi: true` when several can be true together. The page adds Other, for an answer in their own words. It stores the report on this turn and creates nothing: the owner's Accept saves it as an idea. Call it again with the whole report after each change the owner asks for. Outside a panel, show the answer to the user in your reply.",
    input: proposedIdeaSchema,
    actions: ['chat.read'],
    readOnly: true,
  },
  propose_doc: {
    description:
      "Propose a document's new text before saving it. Give `doc` for an existing one (with baseVersion, the Version line of get_doc), or `source` and `path` for a new file. List each claim you checked as `verified` with its source, and each one you could not check as `unverified`: its text must appear in the draft word for word. Hub finds real duplicates itself and answers with them and a draft id. In the panel the owner sees a diff and answers each flag. Then call save_doc with `draft`; it refuses while a flag is unanswered.",
    input: proposeDocSchema,
    actions: ['chat.read'],
    readOnly: true,
  },

  propose_suggestions: {
    description:
      "Propose what is worth doing next as structured items, so the panel shows each one with Accept and Dismiss: `task` (title, why, priority, ownerRole, specialty, effort, related, body), `plan` (title, why, steps) or `skill` (name, description, why, body). It stores the proposals on this turn and creates nothing: the owner's Accept creates each one in Hub. Every `why` names the cards or docs it rests on. Outside a panel, show the answer to the user in your reply.",
    input: proposeSuggestionsSchema,
    actions: ['chat.read'],
    readOnly: true,
  },

  // Skills (docs/16 §11, D64 to D66). Reading only: creating, editing and Move to Hub are the owner's press on the Skills page, because a skill reaches every device and would steer every later chat.
  list_skills: {
    description:
      "The skills Hub's plugin carries to every device (`hub`, with `core` for Hub's own protocols), and the owner's personal skills on the main machine (`personal`), each with its name and when to use it. Read it before proposing a skill, so you never propose one that exists. It cannot create or change a skill.",
    input: z.object({ source: z.enum(SKILL_SOURCES).optional() }),
    actions: ['skill.read'],
    readOnly: true,
  },

  // The agent queue (docs/16 §9). Reading only: adding, ordering, pausing and cancelling runs and changing the limits are the owner's own press, because an agent that could add a run would be starting an agent, and one that could resume a run or lift a limit would be approving itself.
  list_queue: {
    description:
      "The owner's agent queue: what is running, what waits for an approval, what is next or scheduled, and what finished recently, with the limits and why a due run is held. `card` narrows it to one card's runs. It cannot add, move or stop a run.",
    input: queueRunsQuerySchema,
    actions: ['queue.read'],
    readOnly: true,
  },

  // Schema Studio (docs/17): the database design, its Arabic names and the drafts of changes reviewed in a chat.
  get_schema: {
    description:
      "The project's database design as Hub last read it from the Prisma files: domains, models, fields, enums and relations, with the Arabic names and notes the team added. `domain` or `model` narrows it; `missingNames: true` lists only what has no Arabic name yet.",
    input: z.object({
      domain: z.string().max(64).optional(),
      model: z.string().max(64).optional(),
      missingNames: z.boolean().optional(),
    }),
    actions: ['schema.read'],
    readOnly: true,
  },
  refresh_schema: {
    description:
      'Read the Prisma files again and keep a new snapshot when they changed. After applying a draft, pass its `draftId`: the draft becomes applied with this snapshot, and the page shows the new design.',
    input: refreshSchemaSchema,
    actions: ['schema.manage'],
    routes: [`POST ${W}/schema/refresh`],
  },
  get_schema_draft: {
    description: 'One draft of database changes: its proposed changes, status and the review so far.',
    input: z.object({ draftId: z.uuid() }),
    actions: ['schema.read'],
    readOnly: true,
  },
  update_schema_draft: {
    description:
      "Save a draft's review (Markdown: what you found and what was agreed), its changes as agreed, or its status: `in_review`, `applying` while you edit the files, `editing` to hand it back.",
    input: updateSchemaDraftSchema.extend({ draftId: z.uuid() }),
    actions: ['schema.draft'],
    routes: [`PATCH ${W}/schema/drafts/:id`],
  },
  set_schema_annotations: {
    description:
      'Save Arabic names, descriptions, notes, tags and sensitivity for models, fields and enums. `target` is `model:Booking`, `field:Booking.status`, `enum:BookingStatus` or `enumValue:BookingStatus.PAID`. A field left out keeps its value.',
    input: putAnnotationsSchema,
    actions: ['schema.annotate'],
    routes: [`PUT ${W}/schema/annotations`],
  },

  // Administration
  list_members: {
    description: 'The members of this project and their roles.',
    input: z.object(page),
    actions: ['member.read'],
    readOnly: true,
  },
  invite_member: {
    description:
      'Invite someone by email with roles. The link goes by mail when Hub has a real mail server, and is never shown here; the answer says where the mail went.',
    input: z.object({ email: z.email(), roles: z.array(roleSchema).min(1).max(7) }),
    actions: ['member.invite'],
    routes: [`POST ${W}/invites`],
  },
  list_invites: {
    description: 'The invites of this project, each pending, accepted, expired or revoked.',
    input: noInput,
    actions: ['member.invite'],
    readOnly: true,
  },
  resend_invite: {
    description: 'Issue a new invite link for seven more days and mail it. The old one stops working.',
    input: z.object({ inviteId: z.uuid() }),
    actions: ['member.invite'],
    routes: [`POST ${W}/invites/:id/resend`],
  },
  revoke_invite: {
    description: 'Revoke an invite: its link stops working, and the list keeps it as revoked.',
    input: z.object({ inviteId: z.uuid() }),
    actions: ['member.invite'],
    routes: [`DELETE ${W}/invites/:id`],
    destructive: true,
  },
  change_member_roles: {
    description: "Replace a member's roles in this project.",
    input: z.object({ userId: z.uuid(), roles: z.array(roleSchema).min(1).max(7) }),
    actions: ['member.change_roles'],
    routes: [`PATCH ${W}/members/:userId`],
    destructive: true,
  },
  disable_member: {
    description:
      'Remove a member from this project. `disableAccount` also disables the account when this was their only project.',
    input: z.object({ userId: z.uuid(), disableAccount: z.boolean().optional() }),
    actions: ['member.disable'],
    routes: [`POST ${W}/members/:userId/remove`, `POST ${W}/members/:userId/disable`],
    destructive: true,
  },
  enable_member: {
    description: 'Bring a removed or disabled member back.',
    input: z.object({ userId: z.uuid() }),
    actions: ['member.disable'],
    routes: [`POST ${W}/members/:userId/enable`],
  },
  set_github_identity: {
    description: 'Replace the GitHub logins that map to a member.',
    input: z.object({ userId: z.uuid(), logins: githubLoginsSchema.shape.logins }),
    actions: ['member.github_identity'],
    routes: [`PUT ${W}/members/:userId/github-logins`],
  },
  get_settings: {
    description: 'Every setting of this project with its value, its default and what it means.',
    input: noInput,
    actions: ['settings.read'],
    readOnly: true,
  },
  update_settings: {
    description: 'Change one setting, or put it back to its default with `reset: true`.',
    input: z.object({
      key: z.string().min(1).max(100),
      value: z.unknown().optional(),
      reset: z.boolean().optional(),
    }),
    actions: ['settings.write'],
    routes: [`PUT ${W}/settings/:key`, `DELETE ${W}/settings/:key`],
    destructive: true,
  },
  list_sources: {
    description: 'The sources of this project. A secret shows only as "has a secret".',
    input: noInput,
    actions: ['source.read'],
    readOnly: true,
  },
  add_source: {
    description: 'Add a source. A secret cannot be set here: the member sets it in the web UI.',
    input: createSourceSchema.omit({ secret: true }).strict(),
    actions: ['source.manage'],
    routes: [`POST ${W}/sources`],
  },
  update_source: {
    description: 'Change a source. Its secret can only be changed in the web UI.',
    input: updateSourceSchema.omit({ secret: true, enabled: true }).extend({ sourceId: z.uuid() }).strict(),
    actions: ['source.manage'],
    routes: [`PATCH ${W}/sources/:id`],
  },
  enable_source: {
    description: 'Enable a source.',
    input: z.object({ sourceId: z.uuid() }),
    actions: ['source.manage'],
    routes: [`PATCH ${W}/sources/:id`],
  },
  disable_source: {
    description: 'Disable a source. Its history stays.',
    input: z.object({ sourceId: z.uuid() }),
    actions: ['source.manage'],
    routes: [`PATCH ${W}/sources/:id`],
    destructive: true,
  },
  delete_source: {
    description: 'Delete a source. Its history stays.',
    input: z.object({ sourceId: z.uuid() }),
    actions: ['source.manage'],
    routes: [`DELETE ${W}/sources/:id`],
    destructive: true,
  },
  test_source: {
    description: 'Check that a source can be reached.',
    input: z.object({ sourceId: z.uuid() }),
    actions: ['source.manage'],
    routes: [`POST ${W}/sources/:id/test`],
  },
  run_source: {
    description: 'Run a source now.',
    input: z.object({ sourceId: z.uuid() }),
    actions: ['source.run'],
    routes: [`POST ${W}/sources/:id/run`],
  },
  reindex_docs: {
    description: 'Index the docs of this project again now.',
    input: z.object({ sourceId: z.uuid().optional() }),
    actions: ['docs.reindex'],
    routes: [`POST ${W}/docs/reindex`],
  },
  read_audit: {
    description: 'Who did what in this project, newest first.',
    input: z.object({
      actor: auditQuerySchema.shape.actor,
      action: auditQuerySchema.shape.action,
      targetType: auditQuerySchema.shape.targetType,
      from: auditQuerySchema.shape.from,
      to: auditQuerySchema.shape.to,
      ...page,
    }),
    actions: ['audit.read'],
    readOnly: true,
  },
  list_notifications: {
    description: 'Your inbox in this project.',
    input: z.object({ unread: z.boolean().optional(), ...page }),
    actions: ['notification.read'],
    readOnly: true,
  },
  read_notification: {
    description:
      'Mark one notification read, unread, archived or unarchived with `state`, or read all with `all: true`.',
    input: z.object({
      notificationId: z.uuid().optional(),
      state: z.enum(['read', 'unread', 'archived', 'unarchived']).optional(),
      all: z.boolean().optional(),
    }),
    actions: ['notification.read'],
    routes: [
      `POST ${W}/inbox/read-all`,
      `POST ${W}/inbox/:id/read`,
      `POST ${W}/inbox/:id/unread`,
      `POST ${W}/inbox/:id/archive`,
      `POST ${W}/inbox/:id/unarchive`,
    ],
  },
  get_onboarding: {
    description: 'The reading path of each role you hold, and what you have done.',
    input: noInput,
    actions: ['onboarding.use'],
    readOnly: true,
  },
  tick_onboarding_item: {
    description: 'Tick an onboarding item, or untick it with `done: false`.',
    input: z.object({ itemId: z.string().min(1).max(100), done: z.boolean().optional() }),
    actions: ['onboarding.use'],
    routes: [`POST ${W}/onboarding/:itemId/done`, `DELETE ${W}/onboarding/:itemId/done`],
  },
} as const satisfies Record<string, McpToolDefinition>;

export type McpToolName = keyof typeof TOOL_TABLE;

/** The input a tool's handler receives, with the optional `project`. */
export type McpToolInput<K extends McpToolName> = z.infer<(typeof TOOL_TABLE)[K]['input']> & {
  readonly project?: string | undefined;
};

export interface McpToolEntry extends McpToolDefinition {
  readonly name: McpToolName;
}

export const MCP_PROJECT_ARGUMENT = z
  .string()
  .max(32)
  .optional()
  .describe('Project slug. Leave it out to use the folder’s project, else your default project.');

const CONFIRM_FIRST = ' Sensitive: confirm with the user in the chat before calling this.';

function entry(name: McpToolName, tool: McpToolDefinition): McpToolEntry {
  return {
    ...tool,
    name,
    input: tool.input.extend({ project: MCP_PROJECT_ARGUMENT }),
    description: tool.destructive ? `${tool.description}${CONFIRM_FIRST}` : tool.description,
  };
}

export const MCP_TOOLS: readonly McpToolEntry[] = (Object.keys(TOOL_TABLE) as McpToolName[]).map((name) =>
  entry(name, TOOL_TABLE[name]),
);

export const MCP_TOOL_NAMES = MCP_TOOLS.map((tool) => tool.name);

/** REST routes with no tool on purpose, with why. Everything else that mutates must appear in a tool's `routes`. */
export const MCP_EXCLUDED_ROUTES: Readonly<Record<string, string>> = {
  'POST /capture/session': 'called by the SessionEnd hook; log_session is the agent side',
  'POST /workspaces/:ws/today/seen': 'the Today page marking what its viewer has seen; a chat has no page',
  'DELETE /bridge/self':
    'called by `hub-bridge uninstall` with the device credential; revoke_device is the agent side',
};
