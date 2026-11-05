/**
 * @file The MCP prompts (docs/05 §2.6). Claude Code shows them as `/hub:<name>` because the server is named `hub`.
 * @description `ask` and `plan` are not here: Claude Code splits prompt arguments on whitespace, so a free-text argument
 * would lose all but its first word. They are skills in the team pack (D26, docs/15 §4). Every text states the
 * no-secrets rule, and a golden test keeps it there.
 */
export interface McpPromptContext {
  readonly displayName: string;
  readonly roles: readonly string[];
  readonly project: string;
}

export interface McpPromptEntry {
  readonly name: string;
  readonly title: string;
  readonly description: string;
  /** Argument name to whether it is required. */
  readonly args?: Readonly<Record<string, boolean>>;
  render(context: McpPromptContext, args: Readonly<Record<string, string | undefined>>): string;
}

const NO_SECRETS = 'Never send a secret, token or password to Hub, in any field.';
const CONFIRM =
  'Sensitive tools (decide, verify, approve, reject, delete and the like) ask you to confirm with me in the chat first: do so.';

export const MCP_PROMPTS: readonly McpPromptEntry[] = [
  {
    name: 'start',
    title: 'Start a work session',
    description: 'What is new, what awaits you, and what to work on next.',
    render: ({
      displayName,
      roles,
      project,
    }) => `You are starting a work session for ${displayName} (roles: ${roles.join(', ')}) in Hub project "${project}".
Do this now:
1. Call hub.get_project_brief, hub.whats_new and hub.list_my_sessions_without_summary.
2. Read resource hub://brief/today if it has anything.
3. Say which project is active, then report in my language, briefly and in this order:
   (a) decisions and needs awaiting my roles, with deadlines, overdue first;
   (b) handoffs pending for my roles;
   (c) my sessions without a summary: offer to write them now with hub.log_session (ask me what I did, then call it);
   (d) up to 5 ready tasks for my specialties, with keys;
   (e) notable changes by others since my last session.
4. Ask whether to save a short narrative (12 lines at most) with hub.save_brief, so that it shows on my Today page. Save it if I agree.
5. End by asking which task to start, or suggest /hub:next.
Rules: refer to cards by key; keep the report under 40 lines. ${NO_SECRETS}`,
  },
  {
    name: 'next',
    title: 'Start the next task',
    description: 'Pick a ready task or the one you name, read what it links to, and claim it.',
    args: { key: false },
    render: (_context, { key }) => `Start the next task${key ? ` ${key}` : ''}.
1. ${key ? `Call hub.get_card("${key}").` : 'Call hub.list_tasks for my specialties, show the top 3, and ask me to confirm one.'}
2. Read what it links to: hub.get_card for linked cards, hub.get_decision for decisions it depends on, hub.get_doc for referenced docs. If an open "blocked by" link exists, stop and tell me what blocks it.
3. Call hub.claim_task with the key and the branch name you will use (feat/<key-lower>-<slug>). Follow the project's rule about asking before creating branches.
4. Call hub.start_task when you begin editing code.
5. While working: unclear business rule: hub.search_docs first, then hub.request_decision, never guess. Missing external thing: hub.create_need, describing it. Your change affects another role: hub.create_handoff with a ready prompt for them.
6. Put the key in commit messages: "feat(scope): message (KEY)".
Run /hub:done when the task is complete or when you stop for the day. ${NO_SECRETS}`,
  },
  {
    name: 'done',
    title: 'Finish this session',
    description: 'Write the session summary into Hub, with handoffs and follow-ups.',
    render: () => `Finish this session properly before you stop.
1. Collect from git: repo, branch, commits made since the session started, files changed.
2. Write the summary: what changed (bullets with file paths, endpoints, schema changes), what remains, what another role must do (handoffs with a ready prompt), and follow-up tasks you noticed.
3. Call hub.log_session with sessionId from the "Hub session id" line of the session context (if it is absent, ask me), repo, branch, changed, remaining, handoffs, followUps, cardKeys, commits, durationSec.
4. For the task you claimed: hub.submit_task, or hub.complete_task if I tell you it is merged, with the PR URL when one exists.
5. Reply with the keys Hub returned.
Rules: be specific; do not skip step 3 even if the session was short. ${NO_SECRETS}`,
  },
  {
    name: 'decision',
    title: 'Open a decision',
    description: 'Draft options with me and open a decision routed to whoever decides.',
    render: () => `Help me open a decision in Hub.
1. Ask me, in one message, for: the question, the kind (product, technical, financial, design), who decides (role), the deadline, and the cards it blocks.
2. Draft 2 to 4 options with pros, cons and cost; mark at most one recommended; check hub.search_docs for rules or ADRs that already answer it, and tell me if one does.
3. Show the draft, ask for confirmation, then call hub.request_decision.
4. Reply with the key and the due date. Whoever holds the role may decide on the page, or through hub.decide after confirming in the chat. ${NO_SECRETS}`,
  },
  {
    name: 'need',
    title: 'Record a need',
    description:
      'Record something needed from outside the code: token, account, contract, value, file or access.',
    render: () => `Help me record something we need from outside the code.
1. Ask me for: what it is, the kind, who is responsible (role), why we need it, and which cards wait on it.
2. Call hub.create_need. Describe where the value should be stored, such as "backend .env on prod as MOYASAR_SECRET". ${NO_SECRETS}
3. Reply with the key. The responsible person marks it delivered and it is then verified.`,
  },
  {
    name: 'adr',
    title: 'Write an ADR',
    description: 'Write the ADR of a decided decision and save it on the card.',
    args: { key: true },
    render: (_context, { key }) => `Write the ADR for decision ${key ?? ''}.
1. hub.get_decision("${key ?? ''}"). If it is not decided, stop and say so.
2. hub.search_docs for the affected area, and read the related docs so that the ADR cites the right files.
3. Write the ADR in English:
   # NNNN — <title>
   Status: Accepted · Date: <decided date> · Hub: ${key ?? ''}
   ## Context (the question, the facts, the options considered with their trade-offs)
   ## Decision (the chosen option and the rationale recorded in Hub)
   ## Consequences (what changes in code, docs, settings; what becomes forbidden; follow-ups)
4. Call hub.draft_adr("${key ?? ''}", body). This release saves the text on the card: it opens no pull request. ${NO_SECRETS}`,
  },
  {
    name: 'weekly',
    title: 'Write the weekly summary',
    description: "Write this week's summary for the project. For owner and pm.",
    render: () => `Write this week's summary for the project.
1. hub.whats_new with since 7 days ago and limit 100, and hub.list_cards for decisions decided, handoffs applied, tasks done, needs verified, redesigns approved this week.
2. Write 25 lines at most in my language: shipped, decided, blocked (with who must act), risks, next week.
3. Call hub.save_brief(kind="weekly", narrative). It appears on the Today page of every member. ${NO_SECRETS}`,
  },
  {
    name: 'release-notes',
    title: 'Write release notes',
    description: 'Write the notes of a release for each audience.',
    args: { key: true },
    render: (_context, { key }) => `Write release notes for release card ${key ?? ''}.
1. hub.get_card("${key ?? ''}") and hub.get_card for each included card.
2. Write three versions: team (technical, with keys), owner (what customers and operations gain), accountant (anything touching money: fees, refunds, currencies, ledger). 15 lines each at most.
3. Call hub.update_release("${key ?? ''}", notes={ team, owner, accountant }). ${NO_SECRETS}`,
  },
];

export const MCP_SERVER_INSTRUCTIONS = `Hub is this team's operations room: tasks, decisions, needs, handoffs, redesigns, releases, ideas, plans and docs. Every chat acts on one project: the "project" argument, else the folder's link, else the member's default. Say which project is active when you first use Hub. Refer to cards by key, such as GTV-123. ${CONFIRM} ${NO_SECRETS}`;
