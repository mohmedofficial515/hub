-- Owner decision 9c (2026-11-19): an idea or a plan saved from a studio names the chat and the reply it came from, so every member's
-- browser finds the session from the card. Additive: nullable columns, no foreign key (a chat may be deleted, the card keeps its history).
SET lock_timeout = '5s';

ALTER TABLE "idea_details" ADD COLUMN "source_chat_id" UUID;
ALTER TABLE "idea_details" ADD COLUMN "source_message_id" UUID;
ALTER TABLE "plan_details" ADD COLUMN "source_chat_id" UUID;
ALTER TABLE "plan_details" ADD COLUMN "source_message_id" UUID;

CREATE INDEX "idea_details_source_chat_id_idx" ON "idea_details" ("source_chat_id");
CREATE INDEX "plan_details_source_chat_id_idx" ON "plan_details" ("source_chat_id");
