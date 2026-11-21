-- docs/16 D61 to D63: the backup history and the owner's backup settings. Additive: two new tables, nothing else changes.
CREATE TABLE "backups" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "status" TEXT NOT NULL DEFAULT 'running',
    "trigger" TEXT NOT NULL,
    "slot_at" TIMESTAMPTZ(3),
    "path" TEXT,
    "size_bytes" BIGINT,
    "docs" INTEGER,
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "failure" TEXT,
    "started_by_id" UUID,
    "started_at" TIMESTAMPTZ(3) NOT NULL,
    "ended_at" TIMESTAMPTZ(3),
    "deleted_at" TIMESTAMPTZ(3),
    "deleted_by" TEXT,
    "deleted_by_id" UUID,

    CONSTRAINT "backups_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "backups_started_at_idx" ON "backups"("started_at");

CREATE TABLE "backup_settings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "folder" TEXT,
    "time" TEXT NOT NULL DEFAULT '03:00',
    "keep" INTEGER NOT NULL DEFAULT 14,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "backup_settings_pkey" PRIMARY KEY ("id")
);
