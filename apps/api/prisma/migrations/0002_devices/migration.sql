-- Devices and browser-approved pairing (docs/16 §4, §5). A device's credentials are rows of api_tokens with device_id set.
CREATE TABLE "devices" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "user_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "bridge_version" TEXT,
    "claude_version" TEXT,
    "vscode_found" BOOLEAN,
    "health" JSONB NOT NULL DEFAULT '[]',
    "health_at" TIMESTAMPTZ(3),
    "last_seen_at" TIMESTAMPTZ(3),
    "paired_at" TIMESTAMPTZ(3) NOT NULL,
    "revoked_at" TIMESTAMPTZ(3),
    CONSTRAINT "devices_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "devices_user_id_idx" ON "devices"("user_id");
ALTER TABLE "devices" ADD CONSTRAINT "devices_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "device_pairings" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "device_code_hash" TEXT NOT NULL,
    "user_code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "approved_by_id" UUID,
    "device_id" UUID,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "device_pairings_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "device_pairings_device_code_hash_key" ON "device_pairings"("device_code_hash");
CREATE UNIQUE INDEX "device_pairings_user_code_key" ON "device_pairings"("user_code");
CREATE INDEX "device_pairings_expires_at_idx" ON "device_pairings"("expires_at");
ALTER TABLE "device_pairings" ADD CONSTRAINT "device_pairings_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

SET lock_timeout = '5s';
ALTER TABLE "api_tokens" ADD COLUMN "device_id" UUID;
CREATE INDEX "api_tokens_device_id_idx" ON "api_tokens"("device_id");
ALTER TABLE "api_tokens" ADD CONSTRAINT "api_tokens_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE SET NULL ON UPDATE CASCADE;
