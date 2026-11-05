/**
 * @file MCP tool table (docs/15 §6, docs/05 §2.4).
 * @description Placeholder until H1-01: names and the actions each tool performs, no input schemas yet.
 * The MCP agent adds `input` per tool and registers the tools. A test in this package requires every
 * mutating action with surface `any` to have a tool, so REST and MCP cannot drift apart.
 */
import type { PermissionAction } from '../permissions';

export interface McpToolEntry {
  readonly name: string;
  /** The permission actions this tool performs. Empty for pure reads with no row of their own. */
  readonly actions: readonly PermissionAction[];
  /** Sets `destructiveHint`, and the description tells Claude to confirm in the chat first (docs/15 §2). */
  readonly destructive?: boolean;
  /** Team pack tools that only read. */
  readonly readOnly?: boolean;
}

export const MCP_TOOLS: readonly McpToolEntry[] = [
  // Orientation and reads
  { name: 'get_project_brief', actions: ['project.read'], readOnly: true },
  { name: 'whats_new', actions: ['card.read'], readOnly: true },
  { name: 'search_docs', actions: ['docs.read'], readOnly: true },
  { name: 'get_doc', actions: ['docs.read'], readOnly: true },
  { name: 'get_card', actions: ['card.read'], readOnly: true },
  { name: 'list_cards', actions: ['card.read'], readOnly: true },
  { name: 'list_deleted', actions: ['card.read_deleted'], readOnly: true },

  // Tasks
  { name: 'list_tasks', actions: ['card.read'], readOnly: true },
  { name: 'create_task', actions: ['task.create'] },
  {
    name: 'update_task',
    actions: ['task.edit_detail', 'task.mark_ready', 'task.mark_backlog', 'task.resume'],
  },
  { name: 'claim_task', actions: ['task.claim'] },
  { name: 'unclaim_task', actions: ['task.unclaim'] },
  { name: 'start_task', actions: ['task.start'] },
  { name: 'submit_task', actions: ['task.submit_review'] },
  { name: 'complete_task', actions: ['task.complete'] },
  { name: 'reopen_task', actions: ['task.reopen'] },
  { name: 'cancel_task', actions: ['task.cancel'], destructive: true },

  // Decisions
  { name: 'request_decision', actions: ['decision.create'] },
  { name: 'get_decision', actions: ['card.read'], readOnly: true },
  { name: 'update_decision', actions: ['decision.edit_options'] },
  { name: 'decide', actions: ['decision.decide'], destructive: true },
  { name: 'withdraw_decision', actions: ['decision.withdraw'], destructive: true },
  { name: 'supersede_decision', actions: ['decision.supersede'], destructive: true },
  { name: 'draft_adr', actions: ['decision.draft_adr'] },
  { name: 'open_adr_pr', actions: ['decision.open_adr_pr'], destructive: true },

  // Needs
  { name: 'list_needs', actions: ['card.read'], readOnly: true },
  { name: 'create_need', actions: ['need.create'] },
  { name: 'start_need', actions: ['need.start'] },
  { name: 'deliver_need', actions: ['need.deliver'] },
  { name: 'verify_need', actions: ['need.verify'], destructive: true },
  { name: 'reject_need_delivery', actions: ['need.reject_delivery'], destructive: true },
  { name: 'cancel_need', actions: ['need.cancel'], destructive: true },

  // Handoffs
  { name: 'list_handoffs', actions: ['card.read'], readOnly: true },
  { name: 'create_handoff', actions: ['handoff.create'] },
  { name: 'acknowledge_handoff', actions: ['handoff.acknowledge'] },
  { name: 'apply_handoff', actions: ['handoff.apply'] },
  { name: 'dismiss_handoff', actions: ['handoff.dismiss'], destructive: true },

  // Redesign
  { name: 'list_redesigns', actions: ['card.read'], readOnly: true },
  { name: 'send_redesign_to_review', actions: ['redesign.send_to_review'] },
  { name: 'approve_redesign', actions: ['redesign.approve'], destructive: true },
  { name: 'reject_redesign', actions: ['redesign.reject'], destructive: true },
  { name: 'request_redesign_changes', actions: ['redesign.request_changes'] },
  { name: 'mark_redesign_ported', actions: ['redesign.mark_ported'] },
  { name: 'rescan_lab', actions: ['redesign.rescan'] },

  // Releases
  { name: 'create_release', actions: ['release.create'] },
  { name: 'update_release', actions: ['release.edit'] },
  { name: 'release', actions: ['release.release'], destructive: true },

  // Ideas
  { name: 'list_ideas', actions: ['card.read'], readOnly: true },
  { name: 'create_idea', actions: ['idea.create'] },
  {
    name: 'update_idea',
    actions: ['idea.update', 'idea.explore', 'idea.accept', 'idea.park', 'idea.reject', 'idea.reopen'],
  },
  { name: 'idea_to_plan', actions: ['idea.to_plan'] },

  // Plans
  { name: 'list_plans', actions: ['card.read'], readOnly: true },
  { name: 'get_plan', actions: ['card.read'], readOnly: true },
  { name: 'create_plan', actions: ['plan.create'] },
  {
    name: 'update_plan',
    actions: [
      'plan.update',
      'plan.submit_review',
      'plan.approve',
      'plan.start',
      'plan.finish',
      'plan.abandon',
    ],
  },
  { name: 'plan_to_tasks', actions: ['plan.to_tasks'] },

  // Any card
  { name: 'update_card', actions: ['card.edit_content', 'card.edit_routing'] },
  { name: 'comment', actions: ['card.comment', 'card.comment_edit'] },
  { name: 'redact_comment', actions: ['card.comment_redact'], destructive: true },
  { name: 'link_cards', actions: ['card.link'] },
  { name: 'watch_card', actions: ['card.watch'] },
  { name: 'delete_card', actions: ['card.delete'], destructive: true },
  { name: 'restore_card', actions: ['card.restore'] },

  // Sessions and briefs
  { name: 'log_session', actions: ['session.log'] },
  { name: 'list_my_sessions_without_summary', actions: ['card.read'], readOnly: true },
  { name: 'save_brief', actions: ['brief.save', 'brief.save_weekly'] },

  // Projects
  { name: 'list_projects', actions: ['project.read'], readOnly: true },
  { name: 'get_project', actions: ['project.read'], readOnly: true },
  { name: 'create_project', actions: ['project.create'] },
  {
    name: 'update_project',
    actions: ['project.update', 'project.close', 'project.reopen'],
    destructive: true,
  },
  { name: 'switch_project', actions: ['project.switch'] },

  // Administration
  { name: 'list_members', actions: ['member.read'], readOnly: true },
  { name: 'invite_member', actions: ['member.invite'] },
  { name: 'change_member_roles', actions: ['member.change_roles'], destructive: true },
  { name: 'disable_member', actions: ['member.disable'], destructive: true },
  { name: 'set_github_identity', actions: ['member.github_identity'] },
  { name: 'get_settings', actions: ['settings.read'], readOnly: true },
  { name: 'update_settings', actions: ['settings.write'], destructive: true },
  { name: 'list_sources', actions: ['source.read'], readOnly: true },
  { name: 'add_source', actions: ['source.manage'] },
  { name: 'enable_source', actions: ['source.manage'] },
  { name: 'disable_source', actions: ['source.manage'], destructive: true },
  { name: 'run_source', actions: ['source.run'] },
  { name: 'reindex_docs', actions: ['docs.reindex'] },
  { name: 'read_audit', actions: ['audit.read'], readOnly: true },
  { name: 'list_notifications', actions: ['notification.read'], readOnly: true },
  { name: 'read_notification', actions: ['notification.read'] },
  { name: 'get_onboarding', actions: ['onboarding.use'], readOnly: true },
  { name: 'tick_onboarding_item', actions: ['onboarding.use'] },
];

export const MCP_TOOL_NAMES = MCP_TOOLS.map((tool) => tool.name);
