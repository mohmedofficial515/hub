-- v5-live-plan, batch 3: evidence on a plan's steps. An uploaded attachment keeps its bytes here, beside the card, so a backup holds them.
-- Additive: attachments written by the lab scanner have no row, and read as before.
SET lock_timeout = '5s';

CREATE TABLE "card_attachment_files" (
    "attachment_id" UUID NOT NULL,
    "data" BYTEA NOT NULL,
    "size" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "thumb" BYTEA,

    CONSTRAINT "card_attachment_files_pkey" PRIMARY KEY ("attachment_id")
);

ALTER TABLE "card_attachment_files" ADD CONSTRAINT "card_attachment_files_attachment_id_fkey" FOREIGN KEY ("attachment_id") REFERENCES "card_attachments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
