-- docs/16 D58 to D60: a queued run's mode, its extra folders, its roles, and the chats its pending items started. Additive: new columns with defaults, nothing else changes.
ALTER TABLE "agent_runs" ADD COLUMN "mode" TEXT NOT NULL DEFAULT 'approval';
ALTER TABLE "agent_runs" ADD COLUMN "extra_folders" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "agent_runs" ADD COLUMN "roles" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "agent_runs" ADD COLUMN "followups" JSONB NOT NULL DEFAULT '{}';
