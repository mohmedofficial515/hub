/**
 * @file What a chat may do by itself (docs/16 D41, D46, S1 Q4, C1, C7). These lists live in the bridge, not in Hub, so a taken-over Hub session cannot widen them.
 * @description Execute runs `acceptEdits`: reads and edits in the folder go ahead, and anything with no allow rule reaches the permission tool, which is the owner. `acceptEdits` alone also lets `rm` and `mv` through,
 * so the `ask` list is required, and ask beats allow, which is what keeps it in force over the owner's own allow rules (C1: they stay loaded). Rules match command text, so this is a pause for the owner rather than a security
 * boundary around a program. Ask and Plan are read only: every writing tool is denied outright, and the permission tool refuses whatever else reaches it. `test/permissions.spec.mjs` holds the lists to the Hub tool table.
 */

/** Program prefixes that pause, for each shell. `*` is a Claude Code rule wildcard. */
const BASH_ASK = [
  // Delete
  'rm',
  'rmdir',
  'unlink',
  'shred',
  'del',
  'git rm',
  'git clean',
  'find * -delete',
  'xargs rm',
  // Move, which destroys what it overwrites and which `acceptEdits` allows
  'mv',
  'git mv',
  // Commit and history
  'git commit',
  'git push',
  'git merge',
  'git rebase',
  'git reset',
  'git revert',
  'git cherry-pick',
  'git restore',
  'git stash',
  'git tag',
  // Branch and worktree
  'git branch',
  'git switch',
  'git checkout',
  'git worktree',
  // Docker
  'docker',
  'docker-compose',
  'podman',
  // Deploy
  'psync',
  'rsync',
  'scp',
  'ssh',
  'gh',
  'kubectl',
  'helm',
  'terraform',
  'vercel',
  'netlify',
  'fly',
  'npm publish',
  'pnpm publish',
  'pnpm deploy',
  'yarn publish',
  // Above all of these
  'sudo',
];

const POWERSHELL_ASK = [
  'Remove-Item',
  'rm',
  'rmdir',
  'del',
  'rd',
  'ri',
  'erase',
  'Clear-Content',
  'Move-Item',
  'mv',
  'move',
  'mi',
  'git',
  'docker',
  'docker-compose',
  'podman',
  'psync',
  'rsync',
  'scp',
  'ssh',
  'gh',
  'kubectl',
  'helm',
  'terraform',
  'vercel',
  'netlify',
  'fly',
  'npm publish',
  'pnpm publish',
  'pnpm deploy',
];

/** Hub's read tools: the `readOnly` rows of `TOOL_TABLE`, and `report_stage`, which writes nothing. */
export const HUB_READ_TOOLS = [
  'get_project_brief',
  'whats_new',
  'search_docs',
  'get_doc',
  'list_doc_revisions',
  'get_card',
  'list_cards',
  'list_deleted',
  'list_tasks',
  'list_decisions',
  'get_decision',
  'list_needs',
  'list_handoffs',
  'list_redesigns',
  'list_releases',
  'list_ideas',
  'list_plans',
  'get_plan',
  'list_my_sessions_without_summary',
  'list_projects',
  'get_project',
  'list_devices',
  'check_device',
  'list_members',
  'list_invites',
  'get_settings',
  'list_sources',
  'read_audit',
  'list_notifications',
  'get_onboarding',
  'list_chats',
  'get_chat',
  'export_chat',
  'list_prompt_templates',
  'list_queue',
  'get_schema',
  'get_schema_draft',
  'list_work_reports',
  'report_stage',
  'propose_plan',
  'propose_doc',
  'propose_suggestions',
  'list_skills',
];

/**
 * Hub's tools that pause in a bridge run: the `destructive` rows of `TOOL_TABLE`. This is D46's `update_project`, which can widen the folder allowlist, `save_doc` (§7.1) and
 * the rest of what the table already marks sensitive.
 */
export const HUB_ASK_TOOLS = [
  'save_doc',
  'restore_doc_revision',
  'update_project',
  'cancel_task',
  'decide',
  'withdraw_decision',
  'supersede_decision',
  'open_adr_pr',
  'verify_need',
  'reject_need_delivery',
  'cancel_need',
  'dismiss_handoff',
  'approve_redesign',
  'reject_redesign',
  'release',
  'redact_comment',
  'delete_card',
  'fix_device',
  'revoke_device',
  'revoke_invite',
  'change_member_roles',
  'disable_member',
  'update_settings',
  'disable_source',
  'delete_source',
  'delete_chat',
  'delete_prompt_template',
];

/** The rest of the table, for the read-only deny list, so a write is refused by rule even under an allow the owner holds. */
export const HUB_OTHER_TOOLS = [
  'refresh_schema',
  'update_schema_draft',
  'set_schema_annotations',
  'create_task',
  'update_task',
  'claim_task',
  'unclaim_task',
  'start_task',
  'submit_task',
  'complete_task',
  'reopen_task',
  'request_decision',
  'update_decision',
  'draft_adr',
  'create_need',
  'start_need',
  'deliver_need',
  'create_handoff',
  'acknowledge_handoff',
  'apply_handoff',
  'send_redesign_to_review',
  'request_redesign_changes',
  'mark_redesign_ported',
  'rescan_lab',
  'create_release',
  'update_release',
  'create_idea',
  'update_idea',
  'idea_to_plan',
  'create_plan',
  'update_plan',
  'plan_to_tasks',
  'update_card',
  'move_card',
  'comment',
  'link_cards',
  'watch_card',
  'restore_card',
  'log_session',
  'save_brief',
  'create_project',
  'switch_project',
  'invite_member',
  'resend_invite',
  'enable_member',
  'set_github_identity',
  'add_source',
  'update_source',
  'enable_source',
  'test_source',
  'run_source',
  'reindex_docs',
  'read_notification',
  'tick_onboarding_item',
  'update_chat',
  'restore_chat',
  'save_prompt_template',
  'report_work',
];

const HUB_SERVER = 'hub';

export function askRules() {
  return [
    ...BASH_ASK.map((program) => `Bash(${program} *)`),
    ...POWERSHELL_ASK.map((program) => `PowerShell(${program} *)`),
    ...HUB_ASK_TOOLS.map((tool) => `mcp__${HUB_SERVER}__${tool}`),
  ];
}

/** Execute (D41). `mcp__hub` lets Hub's other tools run, so `/hub:work` can write evidence with no prompt on each call. */
export function executeSettings() {
  return { permissions: { allow: [`mcp__${HUB_SERVER}`], ask: askRules() } };
}

/** Ask and Plan. Deny beats any allow rule the owner holds, so read only stays true. Shells are denied whole: a rule cannot tell a read from a write. */
export function readOnlySettings(guardCommand) {
  return {
    ...(guardCommand
      ? {
          hooks: {
            PreToolUse: [{ matcher: 'mcp__.*', hooks: [{ type: 'command', command: guardCommand }] }],
          },
        }
      : {}),
    permissions: {
      allow: HUB_READ_TOOLS.map((tool) => `mcp__${HUB_SERVER}__${tool}`),
      deny: [
        'Write',
        'Edit',
        'MultiEdit',
        'NotebookEdit',
        'Bash',
        'PowerShell',
        ...[...HUB_ASK_TOOLS, ...HUB_OTHER_TOOLS].map((tool) => `mcp__${HUB_SERVER}__${tool}`),
      ],
    },
  };
}

/** What `hub-read-only-guard` lets through in Ask and Plan: Hub's read tools, and the permission tool itself. */
export function isReadOnlyMcpTool(name) {
  if (name === 'mcp__hubperm__approve') return true;
  const [, server, tool] = /^mcp__(.+?)__(.+)$/.exec(name) ?? [];
  return server === HUB_SERVER && HUB_READ_TOOLS.includes(tool);
}

/**
 * `auto`: the owner's own choice to let a turn run to its end. The same settings as Execute, so every rule still routes a sensitive call to the permission tool, and the bridge then allows it at
 * once and records it as an `auto.decision` (`approved`), so the chat shows each call that was allowed for the owner. A question takes its recommended option, as an automatic queue run does.
 */
export const MODE_FLAGS = {
  ask: { permissionMode: 'default', readOnly: true, autoApprove: false },
  plan: { permissionMode: 'plan', readOnly: true, autoApprove: false },
  execute: { permissionMode: 'acceptEdits', readOnly: false, autoApprove: false },
  auto: { permissionMode: 'acceptEdits', readOnly: false, autoApprove: true },
};

const COMMAND_CATEGORIES = [
  [/\b(git\s+(-\S+\s+\S+\s+)*worktree)\b/i, 'worktree'],
  [/\b(git\s+(-\S+\s+\S+\s+)*(branch|switch|checkout))\b/i, 'branch'],
  [/\b(git\s+(-\S+\s+\S+\s+)*push)\b/i, 'push'],
  [/\b(git\s+(-\S+\s+\S+\s+)*(commit|merge|rebase|reset|revert|cherry-pick|tag|stash|restore))\b/i, 'commit'],
  [/\b(docker|docker-compose|podman)\b/i, 'docker'],
  [/\b(psync|rsync|scp|ssh|kubectl|helm|terraform|vercel|netlify|fly|gh|publish|deploy)\b/i, 'deploy'],
  [
    /(^|[\s;&|("'])(rm|rmdir|unlink|shred|del|rd|ri|erase|Remove-Item|Clear-Content|git\s+rm|git\s+clean)\b/i,
    'delete',
  ],
  [/(^|[\s;&|("'])(mv|move|mi|Move-Item|git\s+mv)\b/i, 'move'],
];

/** The D41 class of a paused call, for the prompt's wording. It decides nothing. */
export function categoryOf(toolName, input) {
  if (toolName?.endsWith('__update_project')) return 'hub_project';
  if (/__(save_doc|restore_doc_revision)$/.test(toolName ?? '')) return 'hub_doc';
  if (toolName?.startsWith('mcp__')) return 'hub_sensitive';
  const command = typeof input?.command === 'string' ? input.command : '';
  for (const [pattern, category] of COMMAND_CATEGORIES) if (pattern.test(command)) return category;
  return 'other';
}

/**
 * The approval's effect line (docs/16 §7.2): one fixed sentence per D41 category, never model text. `@hub/contracts` (`APPROVAL_EFFECTS`) is the source, and a test holds the two together.
 */
export const APPROVAL_EFFECTS = {
  delete: 'Deletes files',
  move: 'Moves or overwrites files',
  commit: 'Changes Git history',
  push: 'Pushes to a remote',
  deploy: 'Deploys or reaches another machine',
  branch: 'Creates or switches a branch',
  worktree: 'Creates a worktree',
  docker: 'Runs Docker',
  hub_project: 'Changes the project, including its allowed folders',
  hub_doc: 'Writes a document',
  hub_sensitive: 'A sensitive Hub action',
  other: 'A command you have not allowed',
};

/** The one line the owner reads: the exact command, or the tool's main input. */
export function describeCall(toolName, input) {
  if (typeof input?.command === 'string') return input.command;
  if (typeof input?.file_path === 'string') return `${toolName} ${input.file_path}`;
  return `${toolName} ${JSON.stringify(input ?? {})}`;
}
