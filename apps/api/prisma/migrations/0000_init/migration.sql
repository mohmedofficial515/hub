-- 0000_init: hand-written prefix (extensions, uuid_generate_v7, search configuration), then the DDL from
--   prisma migrate diff --from-empty --to-schema prisma/schema --script
-- then the suffix (search triggers), which Prisma cannot express. Function copied from
-- F:/Goteav/backend/prisma/migrations/0000_init/migration.sql.

CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS vector;

-- uuid_generate_v7(): RFC 9562 UUID v7 built on gen_random_uuid().
--   bytes 0-5   : unix timestamp in milliseconds (48 bits, big-endian)
--   byte  6-7   : version nibble (0111) + 12-bit sub-millisecond fraction (method 3 of the RFC,
--                 keeps ids generated in the same millisecond monotonically increasing)
--   byte  8     : RFC 4122 variant (10xx xxxx) + 6 random bits
--   bytes 9-15  : random
CREATE OR REPLACE FUNCTION uuid_generate_v7() RETURNS uuid
LANGUAGE plpgsql
VOLATILE PARALLEL SAFE
AS $$
DECLARE
    unix_us bigint := (extract(epoch FROM clock_timestamp()) * 1000000)::bigint;
    unix_ms bigint := unix_us / 1000;
    sub_ms  int    := ((unix_us % 1000) * 4096 / 1000)::int;
    bytes   bytea  := uuid_send(gen_random_uuid());
BEGIN
    bytes := overlay(bytes PLACING substring(int8send(unix_ms) FROM 3) FROM 1 FOR 6);
    bytes := set_byte(bytes, 6, 112 | (sub_ms >> 8));
    bytes := set_byte(bytes, 7, sub_ms & 255);
    bytes := set_byte(bytes, 8, 128 | (get_byte(bytes, 8) & 63));
    RETURN encode(bytes, 'hex')::uuid;
END
$$;

-- Search configuration (docs/03 §12): no stemming, works for Arabic and English.
CREATE TEXT SEARCH CONFIGURATION hub_simple ( COPY = simple );
ALTER TEXT SEARCH CONFIGURATION hub_simple
    ALTER MAPPING FOR asciiword, word, hword, hword_part WITH unaccent, simple;

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "audit_log" (
    "id" BIGSERIAL NOT NULL,
    "workspace_id" UUID,
    "actor_kind" TEXT NOT NULL,
    "actor_id" UUID,
    "via" TEXT NOT NULL,
    "token_id" UUID,
    "action" TEXT NOT NULL,
    "target_type" TEXT NOT NULL,
    "target_id" TEXT,
    "summary" TEXT NOT NULL,
    "ip" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "capture_runs" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "source_id" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "started_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMPTZ(3),
    "status" TEXT NOT NULL DEFAULT 'running',
    "created" INTEGER NOT NULL DEFAULT 0,
    "updated" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "cursor_before" JSONB,
    "cursor_after" JSONB,

    CONSTRAINT "capture_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session_logs" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "workspace_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "session_id" TEXT NOT NULL,
    "repo" TEXT,
    "branch" TEXT,
    "cwd" TEXT,
    "hook_received_at" TIMESTAMPTZ(3),
    "hook_payload" JSONB,
    "summary_received_at" TIMESTAMPTZ(3),
    "summary_payload" JSONB,
    "card_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "session_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cards" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "workspace_id" UUID NOT NULL,
    "seq" INTEGER NOT NULL,
    "key" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "status" TEXT NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'P2',
    "owner_role" TEXT,
    "assignee_id" UUID,
    "created_by_kind" TEXT NOT NULL,
    "created_by_id" UUID,
    "created_via" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "external_key" TEXT,
    "module" TEXT,
    "repo" TEXT,
    "branch" TEXT,
    "commit_sha" TEXT,
    "due_at" TIMESTAMPTZ(3),
    "closed_at" TIMESTAMPTZ(3),
    "archived_at" TIMESTAMPTZ(3),
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "comment_count" INTEGER NOT NULL DEFAULT 0,
    "event_seq" INTEGER NOT NULL DEFAULT 0,
    "last_event_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "search_vector" tsvector,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "cards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "card_links" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "workspace_id" UUID NOT NULL,
    "from_card_id" UUID NOT NULL,
    "to_card_id" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "card_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "card_events" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "workspace_id" UUID NOT NULL,
    "card_id" UUID NOT NULL,
    "seq" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "actor_kind" TEXT NOT NULL,
    "actor_id" UUID,
    "via" TEXT NOT NULL,
    "data" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "card_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "card_comments" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "workspace_id" UUID NOT NULL,
    "card_id" UUID NOT NULL,
    "author_kind" TEXT NOT NULL,
    "author_id" UUID NOT NULL,
    "via" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "body_redacted_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "edited_at" TIMESTAMPTZ(3),

    CONSTRAINT "card_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "card_watchers" (
    "card_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "card_watchers_pkey" PRIMARY KEY ("card_id","user_id")
);

-- CreateTable
CREATE TABLE "card_attachments" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "card_id" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "mime" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "card_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_details" (
    "card_id" UUID NOT NULL,
    "specialty" TEXT NOT NULL,
    "effort" TEXT,
    "acceptance" TEXT,
    "prompt" TEXT,
    "origin" TEXT NOT NULL DEFAULT 'manual',
    "claimed_by_id" UUID,
    "claimed_at" TIMESTAMPTZ(3),
    "branch" TEXT,
    "pr_url" TEXT,
    "started_at" TIMESTAMPTZ(3),
    "done_at" TIMESTAMPTZ(3),

    CONSTRAINT "task_details_pkey" PRIMARY KEY ("card_id")
);

-- CreateTable
CREATE TABLE "decision_details" (
    "card_id" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "options" JSONB NOT NULL,
    "decider_role" TEXT NOT NULL,
    "chosen_option_id" TEXT,
    "rationale" TEXT,
    "decided_by_id" UUID,
    "decided_at" TIMESTAMPTZ(3),
    "reminders_sent" JSONB NOT NULL DEFAULT '[]',
    "escalated_at" TIMESTAMPTZ(3),
    "escalated_to_role" TEXT,
    "adr_repo_source_id" UUID,
    "adr_path" TEXT,
    "adr_pr_url" TEXT,
    "adr_status" TEXT NOT NULL DEFAULT 'none',
    "adr_body" TEXT,

    CONSTRAINT "decision_details_pkey" PRIMARY KEY ("card_id")
);

-- CreateTable
CREATE TABLE "need_details" (
    "card_id" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "responsible_role" TEXT NOT NULL,
    "location" TEXT,
    "delivered_by_id" UUID,
    "delivered_at" TIMESTAMPTZ(3),
    "verified_by_id" UUID,
    "verified_at" TIMESTAMPTZ(3),
    "verification_note" TEXT,

    CONSTRAINT "need_details_pkey" PRIMARY KEY ("card_id")
);

-- CreateTable
CREATE TABLE "change_details" (
    "card_id" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "repo_source_id" UUID,
    "author_login" TEXT,
    "author_user_id" UUID,
    "commits" JSONB NOT NULL DEFAULT '[]',
    "commit_count" INTEGER NOT NULL DEFAULT 0,
    "files_changed" INTEGER NOT NULL DEFAULT 0,
    "additions" INTEGER NOT NULL DEFAULT 0,
    "deletions" INTEGER NOT NULL DEFAULT 0,
    "window_start" TIMESTAMPTZ(3),
    "window_end" TIMESTAMPTZ(3),
    "pr_number" INTEGER,
    "pr_state" TEXT,
    "pr_url" TEXT,
    "session" JSONB,

    CONSTRAINT "change_details_pkey" PRIMARY KEY ("card_id")
);

-- CreateTable
CREATE TABLE "handoff_details" (
    "card_id" UUID NOT NULL,
    "from_role" TEXT NOT NULL,
    "to_role" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'info',
    "summary" TEXT NOT NULL,
    "prompt" TEXT,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "source_card_id" UUID,
    "acknowledged_by_id" UUID,
    "acknowledged_at" TIMESTAMPTZ(3),
    "applied_by_id" UUID,
    "applied_at" TIMESTAMPTZ(3),
    "applied_task_id" UUID,

    CONSTRAINT "handoff_details_pkey" PRIMARY KEY ("card_id")
);

-- CreateTable
CREATE TABLE "redesign_details" (
    "card_id" UUID NOT NULL,
    "app" TEXT NOT NULL,
    "page" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "lab_path" TEXT NOT NULL,
    "lab_url" TEXT NOT NULL,
    "base" TEXT,
    "touches_components" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "review_score" INTEGER,
    "review_summary" TEXT,
    "front_matter" JSONB NOT NULL DEFAULT '{}',
    "readme_hash" TEXT NOT NULL,
    "approved_by_id" UUID,
    "approved_at" TIMESTAMPTZ(3),
    "rejected_by_id" UUID,
    "rejected_at" TIMESTAMPTZ(3),
    "decision_note" TEXT,
    "port_task_id" UUID,
    "ported_ref" TEXT,

    CONSTRAINT "redesign_details_pkey" PRIMARY KEY ("card_id")
);

-- CreateTable
CREATE TABLE "doc_details" (
    "card_id" UUID NOT NULL,
    "source_id" UUID NOT NULL,
    "path" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "lang" TEXT NOT NULL DEFAULT 'en',
    "headings" JSONB NOT NULL DEFAULT '[]',
    "word_count" INTEGER NOT NULL DEFAULT 0,
    "last_commit_sha" TEXT,
    "content_hash" TEXT,
    "last_indexed_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "doc_details_pkey" PRIMARY KEY ("card_id")
);

-- CreateTable
CREATE TABLE "release_details" (
    "card_id" UUID NOT NULL,
    "version" TEXT NOT NULL,
    "repo" TEXT,
    "tag" TEXT,
    "released_at" TIMESTAMPTZ(3),
    "included_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "notes" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "release_details_pkey" PRIMARY KEY ("card_id")
);

-- CreateTable
CREATE TABLE "idea_details" (
    "card_id" UUID NOT NULL,
    "problem" TEXT,
    "notes" TEXT,
    "role" TEXT,
    "plan_card_id" UUID,

    CONSTRAINT "idea_details_pkey" PRIMARY KEY ("card_id")
);

-- CreateTable
CREATE TABLE "plan_details" (
    "card_id" UUID NOT NULL,
    "steps" JSONB NOT NULL DEFAULT '[]',
    "revision" INTEGER NOT NULL DEFAULT 1,
    "source_idea_id" UUID,
    "approved_by_id" UUID,
    "approved_at" TIMESTAMPTZ(3),

    CONSTRAINT "plan_details_pkey" PRIMARY KEY ("card_id")
);

-- CreateTable
CREATE TABLE "briefs" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "workspace_id" UUID NOT NULL,
    "user_id" UUID,
    "kind" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "sections" JSONB NOT NULL,
    "narrative" TEXT,
    "narrative_by" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "briefs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "doc_chunks" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "workspace_id" UUID NOT NULL,
    "doc_card_id" UUID NOT NULL,
    "ordinal" INTEGER NOT NULL,
    "heading" TEXT,
    "anchor" TEXT,
    "content" TEXT NOT NULL,
    "search_vector" tsvector,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "doc_chunks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "doc_chunk_embeddings" (
    "chunk_id" UUID NOT NULL,
    "model" TEXT NOT NULL,
    "embedding" vector(1024) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "doc_chunk_embeddings_pkey" PRIMARY KEY ("chunk_id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'ar',
    "avatar_color" TEXT NOT NULL,
    "totp_secret_enc" TEXT,
    "totp_enabled_at" TIMESTAMPTZ(3),
    "status" TEXT NOT NULL DEFAULT 'active',
    "last_seen_at" TIMESTAMPTZ(3),
    "default_workspace_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invites" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "workspace_id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "roles" TEXT[],
    "token_hash" TEXT NOT NULL,
    "created_by_id" UUID NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "accepted_at" TIMESTAMPTZ(3),
    "accepted_user_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "user_id" UUID NOT NULL,
    "family_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "user_agent" TEXT,
    "ip" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "revoked_at" TIMESTAMPTZ(3),
    "replaced_by_id" UUID,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_tokens" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "user_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'mcp',
    "prefix" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "last_used_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMPTZ(3),

    CONSTRAINT "api_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "password_resets" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "user_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "used_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_resets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "login_attempts" (
    "id" BIGSERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "ip" TEXT NOT NULL,
    "succeeded" BOOLEAN NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "login_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "workspace_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "card_id" UUID,
    "group_key" TEXT,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "data" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "read_at" TIMESTAMPTZ(3),
    "archived_at" TIMESTAMPTZ(3),

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_jobs" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "notification_id" UUID NOT NULL,
    "channel" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "next_attempt_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sent_at" TIMESTAMPTZ(3),
    "error" TEXT,

    CONSTRAINT "notification_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "channel_preferences" (
    "user_id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "channel" TEXT NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'immediate',
    "kinds" TEXT[] DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT "channel_preferences_pkey" PRIMARY KEY ("user_id","workspace_id","channel")
);

-- CreateTable
CREATE TABLE "push_subscriptions" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "user_id" UUID NOT NULL,
    "endpoint" TEXT NOT NULL,
    "keys" JSONB NOT NULL,
    "user_agent" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "failed_at" TIMESTAMPTZ(3),

    CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "telegram_links" (
    "user_id" UUID NOT NULL,
    "chat_id" TEXT NOT NULL,
    "username" TEXT,
    "linked_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "telegram_links_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "telegram_link_codes" (
    "code" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "telegram_link_codes_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "workspaces" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "key_prefix" TEXT NOT NULL,
    "card_seq" INTEGER NOT NULL DEFAULT 0,
    "timezone" TEXT NOT NULL DEFAULT 'Europe/Istanbul',
    "default_locale" TEXT NOT NULL DEFAULT 'ar',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "description" TEXT,
    "goals" TEXT,
    "links" JSONB NOT NULL DEFAULT '[]',
    "repo_paths" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" TEXT NOT NULL DEFAULT 'active',
    "closed_at" TIMESTAMPTZ(3),
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "workspaces_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "memberships" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "workspace_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "roles" TEXT[],
    "status" TEXT NOT NULL DEFAULT 'active',
    "joined_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "removed_at" TIMESTAMPTZ(3),

    CONSTRAINT "memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workspace_settings" (
    "workspace_id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_by_id" UUID,

    CONSTRAINT "workspace_settings_pkey" PRIMARY KEY ("workspace_id","key")
);

-- CreateTable
CREATE TABLE "sources" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "workspace_id" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "secret_enc" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "cursor" JSONB NOT NULL DEFAULT '{}',
    "last_run_at" TIMESTAMPTZ(3),
    "last_success_at" TIMESTAMPTZ(3),
    "last_error" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "github_identities" (
    "workspace_id" UUID NOT NULL,
    "login" TEXT NOT NULL,
    "user_id" UUID NOT NULL,

    CONSTRAINT "github_identities_pkey" PRIMARY KEY ("workspace_id","login")
);

-- CreateTable
CREATE TABLE "onboarding_progress" (
    "workspace_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "item_id" TEXT NOT NULL,
    "done_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "onboarding_progress_pkey" PRIMARY KEY ("workspace_id","user_id","item_id")
);

-- CreateIndex
CREATE INDEX "audit_log_workspace_id_created_at_idx" ON "audit_log"("workspace_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "audit_log_actor_id_created_at_idx" ON "audit_log"("actor_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "capture_runs_source_id_started_at_idx" ON "capture_runs"("source_id", "started_at" DESC);

-- CreateIndex
CREATE INDEX "session_logs_user_id_created_at_idx" ON "session_logs"("user_id", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "session_logs_workspace_id_session_id_key" ON "session_logs"("workspace_id", "session_id");

-- CreateIndex
CREATE INDEX "cards_workspace_id_last_event_at_idx" ON "cards"("workspace_id", "last_event_at" DESC);

-- CreateIndex
CREATE INDEX "cards_workspace_id_type_status_idx" ON "cards"("workspace_id", "type", "status");

-- CreateIndex
CREATE INDEX "cards_workspace_id_owner_role_status_idx" ON "cards"("workspace_id", "owner_role", "status");

-- CreateIndex
CREATE INDEX "cards_workspace_id_assignee_id_status_idx" ON "cards"("workspace_id", "assignee_id", "status");

-- CreateIndex
CREATE INDEX "cards_workspace_id_due_at_idx" ON "cards"("workspace_id", "due_at");

-- CreateIndex
CREATE INDEX "cards_search_vector_idx" ON "cards" USING GIN ("search_vector");

-- CreateIndex
CREATE INDEX "cards_tags_idx" ON "cards" USING GIN ("tags");

-- CreateIndex
CREATE UNIQUE INDEX "cards_workspace_id_seq_key" ON "cards"("workspace_id", "seq");

-- CreateIndex
CREATE UNIQUE INDEX "cards_workspace_id_key_key" ON "cards"("workspace_id", "key");

-- CreateIndex
CREATE UNIQUE INDEX "cards_workspace_id_external_key_key" ON "cards"("workspace_id", "external_key");

-- CreateIndex
CREATE INDEX "card_links_to_card_id_kind_idx" ON "card_links"("to_card_id", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "card_links_from_card_id_to_card_id_kind_key" ON "card_links"("from_card_id", "to_card_id", "kind");

-- CreateIndex
CREATE INDEX "card_events_workspace_id_created_at_idx" ON "card_events"("workspace_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "card_events_workspace_id_kind_created_at_idx" ON "card_events"("workspace_id", "kind", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "card_events_card_id_seq_key" ON "card_events"("card_id", "seq");

-- CreateIndex
CREATE INDEX "card_comments_card_id_created_at_idx" ON "card_comments"("card_id", "created_at");

-- CreateIndex
CREATE INDEX "card_attachments_card_id_idx" ON "card_attachments"("card_id");

-- CreateIndex
CREATE UNIQUE INDEX "doc_details_source_id_path_key" ON "doc_details"("source_id", "path");

-- CreateIndex
CREATE UNIQUE INDEX "briefs_workspace_id_user_id_kind_date_key" ON "briefs"("workspace_id", "user_id", "kind", "date");

-- CreateIndex
CREATE INDEX "doc_chunks_search_vector_idx" ON "doc_chunks" USING GIN ("search_vector");

-- CreateIndex
CREATE UNIQUE INDEX "doc_chunks_doc_card_id_ordinal_key" ON "doc_chunks"("doc_card_id", "ordinal");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "invites_token_hash_key" ON "invites"("token_hash");

-- CreateIndex
CREATE INDEX "invites_workspace_id_email_idx" ON "invites"("workspace_id", "email");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_token_hash_key" ON "sessions"("token_hash");

-- CreateIndex
CREATE INDEX "sessions_user_id_family_id_idx" ON "sessions"("user_id", "family_id");

-- CreateIndex
CREATE UNIQUE INDEX "api_tokens_prefix_key" ON "api_tokens"("prefix");

-- CreateIndex
CREATE INDEX "api_tokens_user_id_idx" ON "api_tokens"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "password_resets_token_hash_key" ON "password_resets"("token_hash");

-- CreateIndex
CREATE INDEX "login_attempts_email_created_at_idx" ON "login_attempts"("email", "created_at");

-- CreateIndex
CREATE INDEX "login_attempts_ip_created_at_idx" ON "login_attempts"("ip", "created_at");

-- CreateIndex
CREATE INDEX "notifications_user_id_workspace_id_read_at_created_at_idx" ON "notifications"("user_id", "workspace_id", "read_at", "created_at" DESC);

-- CreateIndex
CREATE INDEX "notification_jobs_status_next_attempt_at_idx" ON "notification_jobs"("status", "next_attempt_at");

-- CreateIndex
CREATE UNIQUE INDEX "push_subscriptions_endpoint_key" ON "push_subscriptions"("endpoint");

-- CreateIndex
CREATE INDEX "push_subscriptions_user_id_idx" ON "push_subscriptions"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "telegram_links_chat_id_key" ON "telegram_links"("chat_id");

-- CreateIndex
CREATE UNIQUE INDEX "workspaces_slug_key" ON "workspaces"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "workspaces_key_prefix_key" ON "workspaces"("key_prefix");

-- CreateIndex
CREATE UNIQUE INDEX "memberships_workspace_id_user_id_key" ON "memberships"("workspace_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "sources_workspace_id_name_key" ON "sources"("workspace_id", "name");

-- AddForeignKey
ALTER TABLE "capture_runs" ADD CONSTRAINT "capture_runs_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "sources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_links" ADD CONSTRAINT "card_links_from_card_id_fkey" FOREIGN KEY ("from_card_id") REFERENCES "cards"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_links" ADD CONSTRAINT "card_links_to_card_id_fkey" FOREIGN KEY ("to_card_id") REFERENCES "cards"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_events" ADD CONSTRAINT "card_events_card_id_fkey" FOREIGN KEY ("card_id") REFERENCES "cards"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_comments" ADD CONSTRAINT "card_comments_card_id_fkey" FOREIGN KEY ("card_id") REFERENCES "cards"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_watchers" ADD CONSTRAINT "card_watchers_card_id_fkey" FOREIGN KEY ("card_id") REFERENCES "cards"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_attachments" ADD CONSTRAINT "card_attachments_card_id_fkey" FOREIGN KEY ("card_id") REFERENCES "cards"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_details" ADD CONSTRAINT "task_details_card_id_fkey" FOREIGN KEY ("card_id") REFERENCES "cards"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decision_details" ADD CONSTRAINT "decision_details_card_id_fkey" FOREIGN KEY ("card_id") REFERENCES "cards"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "need_details" ADD CONSTRAINT "need_details_card_id_fkey" FOREIGN KEY ("card_id") REFERENCES "cards"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "change_details" ADD CONSTRAINT "change_details_card_id_fkey" FOREIGN KEY ("card_id") REFERENCES "cards"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "handoff_details" ADD CONSTRAINT "handoff_details_card_id_fkey" FOREIGN KEY ("card_id") REFERENCES "cards"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "redesign_details" ADD CONSTRAINT "redesign_details_card_id_fkey" FOREIGN KEY ("card_id") REFERENCES "cards"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doc_details" ADD CONSTRAINT "doc_details_card_id_fkey" FOREIGN KEY ("card_id") REFERENCES "cards"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "release_details" ADD CONSTRAINT "release_details_card_id_fkey" FOREIGN KEY ("card_id") REFERENCES "cards"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "idea_details" ADD CONSTRAINT "idea_details_card_id_fkey" FOREIGN KEY ("card_id") REFERENCES "cards"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_details" ADD CONSTRAINT "plan_details_card_id_fkey" FOREIGN KEY ("card_id") REFERENCES "cards"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doc_chunks" ADD CONSTRAINT "doc_chunks_doc_card_id_fkey" FOREIGN KEY ("doc_card_id") REFERENCES "doc_details"("card_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doc_chunk_embeddings" ADD CONSTRAINT "doc_chunk_embeddings_chunk_id_fkey" FOREIGN KEY ("chunk_id") REFERENCES "doc_chunks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_tokens" ADD CONSTRAINT "api_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_jobs" ADD CONSTRAINT "notification_jobs_notification_id_fkey" FOREIGN KEY ("notification_id") REFERENCES "notifications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Search triggers (docs/03 §12).
CREATE FUNCTION cards_search_vector_update() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.search_vector :=
        setweight(to_tsvector('hub_simple', NEW.key || ' ' || NEW.title), 'A') ||
        setweight(to_tsvector('hub_simple', coalesce(NEW.body, '')), 'B') ||
        setweight(to_tsvector('hub_simple', array_to_string(NEW.tags, ' ')), 'C');
    RETURN NEW;
END
$$;

CREATE TRIGGER cards_search_vector
    BEFORE INSERT OR UPDATE OF title, body, tags, key ON cards
    FOR EACH ROW EXECUTE FUNCTION cards_search_vector_update();

CREATE FUNCTION doc_chunks_search_vector_update() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.search_vector :=
        setweight(to_tsvector('hub_simple', coalesce(NEW.heading, '')), 'A') ||
        setweight(to_tsvector('hub_simple', NEW.content), 'B');
    RETURN NEW;
END
$$;

CREATE TRIGGER doc_chunks_search_vector
    BEFORE INSERT OR UPDATE OF heading, content ON doc_chunks
    FOR EACH ROW EXECUTE FUNCTION doc_chunks_search_vector_update();


-- Trigram fallback on titles (docs/03 §12). Declared in cards.prisma, so there is no drift.
CREATE INDEX "cards_title_trgm_idx" ON "cards" USING GIN ("title" gin_trgm_ops);
