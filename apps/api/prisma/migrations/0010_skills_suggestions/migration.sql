-- docs/16 §11, D64 to D66: Hub's skills and their revisions, the plugin each device took, and suggestions with AI. Additive: one new table and nullable columns.
SET lock_timeout = '5s';

-- What Hub's plugin sync last gave this device: its version, each skill's hash, and the last failure.
ALTER TABLE "devices" ADD COLUMN "plugin_version" TEXT;
ALTER TABLE "devices" ADD COLUMN "plugin_skills" JSONB;
ALTER TABLE "devices" ADD COLUMN "plugin_synced_at" TIMESTAMPTZ(3);
ALTER TABLE "devices" ADD COLUMN "plugin_sync_error" TEXT;

-- `propose_suggestions`' proposals on a turn, with what the owner did with each.
ALTER TABLE "chat_messages" ADD COLUMN "suggestions" JSONB;

-- The earlier text of a Hub skill, kept at each save from the panel. Not scoped to a project: one Hub, one plugin.
CREATE TABLE "skill_revisions" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "name" TEXT NOT NULL,
    "content_hash" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "saved_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "skill_revisions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "skill_revisions_name_created_at_idx" ON "skill_revisions"("name", "created_at");
