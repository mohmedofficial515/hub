-- docs/16 D68: a revoked invite keeps its row, so every list can say pending, accepted, expired or revoked. Additive: nullable columns.
SET lock_timeout = '5s';

ALTER TABLE "invites" ADD COLUMN "revoked_at" TIMESTAMPTZ(3);
ALTER TABLE "invites" ADD COLUMN "revoked_by_id" UUID;
