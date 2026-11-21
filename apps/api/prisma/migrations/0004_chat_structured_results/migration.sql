-- Structured results (docs/16 §7.2, D50 to D53): the steps' commands reports are checked against, questions on the approval path, plans, reports and notices on the turn, document drafts. A new chat defaults to Execute (D51).
ALTER TABLE "chats" ALTER COLUMN "mode" SET DEFAULT 'execute';

ALTER TABLE "chat_steps" ADD COLUMN "command" TEXT;
CREATE INDEX "chat_steps_workspace_id_tool_use_id_idx" ON "chat_steps"("workspace_id", "tool_use_id");

ALTER TABLE "chat_messages"
    ADD COLUMN "structured_plan" JSONB,
    ADD COLUMN "reports" JSONB NOT NULL DEFAULT '[]',
    ADD COLUMN "notices" JSONB NOT NULL DEFAULT '[]';

ALTER TABLE "chat_approvals"
    ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'approval',
    ADD COLUMN "effect" TEXT NOT NULL DEFAULT '',
    ADD COLUMN "draft_id" UUID,
    ADD COLUMN "questions" JSONB,
    ADD COLUMN "answers" JSONB;

CREATE TABLE "doc_drafts" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "workspace_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "chat_id" UUID,
    "message_id" UUID,
    "doc_key" TEXT,
    "source" TEXT,
    "path" TEXT,
    "title" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "base_version" TEXT,
    "base_text" TEXT,
    "draft" TEXT NOT NULL,
    "duplicates" JSONB NOT NULL DEFAULT '[]',
    "claims" JSONB NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'open',
    "refused_code" TEXT,
    "saved_version" TEXT,
    "revision_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "doc_drafts_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "doc_drafts_workspace_id_message_id_idx" ON "doc_drafts"("workspace_id", "message_id");
CREATE INDEX "doc_drafts_chat_id_status_idx" ON "doc_drafts"("chat_id", "status");
ALTER TABLE "doc_drafts" ADD CONSTRAINT "doc_drafts_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "doc_drafts" ADD CONSTRAINT "doc_drafts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "doc_drafts" ADD CONSTRAINT "doc_drafts_chat_id_fkey" FOREIGN KEY ("chat_id") REFERENCES "chats"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "doc_drafts" ADD CONSTRAINT "doc_drafts_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "chat_messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;
