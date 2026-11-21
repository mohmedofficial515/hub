-- docs/17 Schema Studio: where a project's Prisma schema is read from, its snapshots, the Arabic names given to it (D62), and drafts of changes (D63). Four new tables, nothing else changes.
-- CreateTable
CREATE TABLE "schema_sources" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "workspace_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "schema_dir" TEXT NOT NULL DEFAULT 'prisma/schema',
    "device_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "schema_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "schema_snapshots" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "workspace_id" UUID NOT NULL,
    "source_id" UUID NOT NULL,
    "hash" TEXT NOT NULL,
    "parsed" JSONB NOT NULL,
    "stats" JSONB NOT NULL,
    "changes" JSONB,
    "trigger" TEXT NOT NULL,
    "taken_by_id" UUID,
    "draft_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "schema_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "schema_annotations" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "workspace_id" UUID NOT NULL,
    "source_id" UUID NOT NULL,
    "target" TEXT NOT NULL,
    "name_ar" TEXT,
    "description_ar" TEXT,
    "notes" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "sensitivity" TEXT NOT NULL DEFAULT 'none',
    "updated_by_id" UUID,
    "synced_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "schema_annotations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "schema_drafts" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "workspace_id" UUID NOT NULL,
    "source_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'editing',
    "changes" JSONB NOT NULL DEFAULT '[]',
    "review" TEXT,
    "chat_id" UUID,
    "base_snapshot_id" UUID,
    "applied_snapshot_id" UUID,
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "schema_drafts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "schema_sources_workspace_id_name_key" ON "schema_sources"("workspace_id", "name");

-- CreateIndex
CREATE INDEX "schema_snapshots_source_id_created_at_idx" ON "schema_snapshots"("source_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "schema_annotations_source_id_target_key" ON "schema_annotations"("source_id", "target");

-- CreateIndex
CREATE INDEX "schema_drafts_source_id_status_idx" ON "schema_drafts"("source_id", "status");
