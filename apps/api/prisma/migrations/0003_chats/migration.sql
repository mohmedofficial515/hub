-- Chats (docs/16 §4, §7) and doc revisions (§10). A chat's one running turn is enforced here, by a partial unique index, so two sends cannot both start.
CREATE TABLE "chats" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "workspace_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "device_id" UUID NOT NULL,
    "folder" TEXT NOT NULL,
    "branch" TEXT,
    "mode" TEXT NOT NULL DEFAULT 'ask',
    "model" TEXT,
    "effort" TEXT,
    "session_id" TEXT,
    "title" TEXT NOT NULL DEFAULT '',
    "pinned_at" TIMESTAMPTZ(3),
    "parent_chat_id" UUID,
    "parent_message_id" UUID,
    "last_seq" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),
    CONSTRAINT "chats_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "chats_workspace_id_user_id_updated_at_idx" ON "chats"("workspace_id", "user_id", "updated_at");
ALTER TABLE "chats" ADD CONSTRAINT "chats_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "chats" ADD CONSTRAINT "chats_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "chats" ADD CONSTRAINT "chats_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "chats" ADD CONSTRAINT "chats_parent_chat_id_fkey" FOREIGN KEY ("parent_chat_id") REFERENCES "chats"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "chat_messages" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "workspace_id" UUID NOT NULL,
    "chat_id" UUID NOT NULL,
    "ordinal" INTEGER NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL DEFAULT '',
    "truncated" BOOLEAN NOT NULL DEFAULT false,
    "context" JSONB,
    "status" TEXT,
    "failure" TEXT,
    "failure_message" TEXT,
    "model" TEXT,
    "claude_version" TEXT,
    "duration_ms" INTEGER,
    "usage" JSONB,
    "limit" JSONB,
    "stages" JSONB NOT NULL DEFAULT '[]',
    "plan" TEXT,
    "changed_files" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMPTZ(3),
    CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "chat_messages_chat_id_ordinal_key" ON "chat_messages"("chat_id", "ordinal");
-- One turn per chat (docs/16 §7).
CREATE UNIQUE INDEX "chat_messages_one_running_turn" ON "chat_messages"("chat_id") WHERE "status" = 'running';
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_chat_id_fkey" FOREIGN KEY ("chat_id") REFERENCES "chats"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "chat_steps" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "workspace_id" UUID NOT NULL,
    "chat_id" UUID NOT NULL,
    "message_id" UUID NOT NULL,
    "tool_use_id" TEXT NOT NULL,
    "parent_tool_use_id" TEXT,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'running',
    "input" JSONB,
    "output" TEXT,
    "decision" TEXT,
    "text_offset" INTEGER NOT NULL DEFAULT 0,
    "started_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMPTZ(3),
    CONSTRAINT "chat_steps_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "chat_steps_message_id_tool_use_id_key" ON "chat_steps"("message_id", "tool_use_id");
CREATE INDEX "chat_steps_chat_id_idx" ON "chat_steps"("chat_id");
ALTER TABLE "chat_steps" ADD CONSTRAINT "chat_steps_chat_id_fkey" FOREIGN KEY ("chat_id") REFERENCES "chats"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "chat_steps" ADD CONSTRAINT "chat_steps_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "chat_messages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "chat_approvals" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "chat_id" UUID NOT NULL,
    "message_id" UUID NOT NULL,
    "tool_use_id" TEXT NOT NULL,
    "tool_name" TEXT NOT NULL,
    "command" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "input" JSONB,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "answered_by_id" UUID,
    "answered_at" TIMESTAMPTZ(3),
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "chat_approvals_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "chat_approvals_chat_id_status_idx" ON "chat_approvals"("chat_id", "status");
ALTER TABLE "chat_approvals" ADD CONSTRAINT "chat_approvals_chat_id_fkey" FOREIGN KEY ("chat_id") REFERENCES "chats"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "chat_approvals" ADD CONSTRAINT "chat_approvals_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "chat_messages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "chat_prompt_templates" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "workspace_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),
    CONSTRAINT "chat_prompt_templates_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "chat_prompt_templates_workspace_id_idx" ON "chat_prompt_templates"("workspace_id");
ALTER TABLE "chat_prompt_templates" ADD CONSTRAINT "chat_prompt_templates_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "doc_revisions" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "workspace_id" UUID NOT NULL,
    "doc_card_id" UUID NOT NULL,
    "content_hash" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "reason" TEXT,
    "saved_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "doc_revisions_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "doc_revisions_doc_card_id_created_at_idx" ON "doc_revisions"("doc_card_id", "created_at");
ALTER TABLE "doc_revisions" ADD CONSTRAINT "doc_revisions_doc_card_id_fkey" FOREIGN KEY ("doc_card_id") REFERENCES "doc_details"("card_id") ON DELETE RESTRICT ON UPDATE CASCADE;
