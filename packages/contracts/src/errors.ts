/**
 * @file Error catalogue: stable code to HTTP status (docs/04 §1.9).
 * @description Messages live in apps/api/src/i18n/{en,ar}/errors.json, and an arch test keeps both in step.
 * `hub.cards.human_only` is gone (D27). `hub.workspaces.archived` became `closed` (D30).
 */
export const ERROR_CATALOGUE = {
  'hub.common.validation': 400,
  'hub.common.unauthorized': 401,
  'hub.common.forbidden': 403,
  'hub.common.not_found': 404,
  'hub.common.conflict': 409,
  'hub.common.payload_too_large': 413,
  'hub.common.idempotency_key_reused': 422,
  'hub.common.rate_limited': 429,
  'hub.common.internal': 500,
  'hub.common.unavailable': 503,

  'hub.identity.invalid_credentials': 401,
  'hub.identity.locked': 423,
  'hub.identity.totp_required': 401,
  'hub.identity.totp_invalid': 401,
  'hub.identity.totp_setup_required': 403,
  'hub.identity.totp_already_enabled': 409,
  'hub.identity.totp_not_enabled': 409,
  'hub.identity.session_expired': 401,
  'hub.identity.refresh_invalid': 401,
  'hub.identity.token_invalid': 401,
  'hub.identity.token_revoked': 401,
  'hub.identity.token_scope': 403,
  'hub.identity.account_disabled': 403,
  'hub.identity.invite_invalid': 404,
  'hub.identity.invite_expired': 410,
  'hub.identity.invite_accepted': 409,
  'hub.identity.email_taken': 409,
  'hub.identity.password_weak': 400,
  'hub.identity.reset_invalid': 404,

  'hub.workspaces.not_found': 404,
  'hub.workspaces.no_project': 400,
  'hub.workspaces.slug_taken': 409,
  'hub.workspaces.key_prefix_taken': 409,
  'hub.workspaces.closed': 409,
  'hub.workspaces.last_owner': 409,
  'hub.workspaces.role_invalid': 400,
  'hub.workspaces.member_removed': 409,
  'hub.workspaces.setting_unknown': 404,
  'hub.workspaces.setting_invalid': 400,
  'hub.workspaces.source_kind_invalid': 400,
  'hub.workspaces.source_dependency_missing': 422,
  'hub.workspaces.source_connection_failed': 422,
  'hub.workspaces.source_run_in_progress': 409,

  'hub.cards.not_found': 404,
  'hub.cards.type_mismatch': 409,
  'hub.cards.invalid_transition': 409,
  'hub.cards.archived': 409,
  'hub.cards.link_self': 400,
  'hub.cards.link_exists': 409,
  'hub.cards.link_cycle': 409,
  'hub.cards.comment_not_found': 404,
  'hub.cards.comment_not_author': 403,
  'hub.cards.external_key_exists': 409,

  'hub.tasks.already_claimed': 409,
  'hub.tasks.not_claimer': 403,
  'hub.tasks.specialty_role_mismatch': 403,

  'hub.decisions.not_decider': 403,
  'hub.decisions.already_decided': 409,
  'hub.decisions.option_not_found': 404,
  'hub.decisions.options_min': 400,
  'hub.decisions.adr_source_missing': 422,
  'hub.decisions.adr_not_drafted': 409,
  'hub.decisions.adr_already_open': 409,
  'hub.decisions.adr_pr_failed': 502,

  'hub.needs.not_responsible': 403,
  'hub.needs.location_required': 400,
  'hub.needs.self_verify_note_required': 400,

  'hub.handoffs.not_recipient': 403,
  'hub.handoffs.already_acknowledged': 409,

  'hub.redesign.owner_only': 403,
  'hub.redesign.not_in_review': 409,
  'hub.redesign.lab_unavailable': 503,
  'hub.redesign.write_failed': 500,

  'hub.plans.step_not_found': 404,
  'hub.plans.revision_not_found': 404,

  'hub.docs.not_found': 404,
  'hub.docs.reindex_running': 409,

  'hub.capture.payload_invalid': 400,
  'hub.capture.import_running': 409,
  'hub.capture.source_disabled': 409,

  'hub.notifications.push_invalid_subscription': 400,
  'hub.notifications.telegram_code_invalid': 404,
  'hub.notifications.telegram_already_linked': 409,
  'hub.notifications.channel_invalid': 400,

  'hub.github.auth_failed': 502,
  'hub.github.rate_limited': 503,
  'hub.github.repo_not_found': 502,
  'hub.github.clone_failed': 500,

  'hub.security.secret_detected': 422,
} as const;

export type ErrorCode = keyof typeof ERROR_CATALOGUE;
export const ERROR_CODES = Object.keys(ERROR_CATALOGUE) as ErrorCode[];
