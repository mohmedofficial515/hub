-- docs/16 §9, "Slice 5 as built": the agent queue. Two new tables, nothing else changes.
CREATE TABLE "agent_runs" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "workspace_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "device_id" UUID NOT NULL,
    "folder" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "card_key" TEXT,
    "plan_step" INTEGER,
    "prompt" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'queued',
    "position" DOUBLE PRECISION NOT NULL,
    "run_at" TIMESTAMPTZ(3),
    "repeat_day" INTEGER,
    "repeat_time" TEXT,
    "paused_at" TIMESTAMPTZ(3),
    "chat_id" UUID,
    "message_id" UUID,
    "failure" TEXT,
    "summary" TEXT,
    "changed_files" JSONB NOT NULL DEFAULT '[]',
    "moved" BOOLEAN,
    "started_at" TIMESTAMPTZ(3),
    "ended_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "agent_runs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "agent_runs_user_id_state_idx" ON "agent_runs"("user_id", "state");
CREATE INDEX "agent_runs_workspace_id_state_idx" ON "agent_runs"("workspace_id", "state");
CREATE INDEX "agent_runs_workspace_id_card_key_idx" ON "agent_runs"("workspace_id", "card_key");

CREATE TABLE "agent_queue_settings" (
    "user_id" UUID NOT NULL,
    "max_concurrent" INTEGER NOT NULL DEFAULT 1,
    "per_day" INTEGER NOT NULL DEFAULT 5,
    "quiet_from" TEXT,
    "quiet_to" TEXT,
    "timezone" TEXT,
    "paused_at" TIMESTAMPTZ(3),
    "paused_reason" TEXT,
    "resumes_at" TIMESTAMPTZ(3),
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "agent_queue_settings_pkey" PRIMARY KEY ("user_id")
);
