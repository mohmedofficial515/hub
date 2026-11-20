-- v5-live-plan, batch 4: a plan explained on video by Hams. Null until the owner asks; its files are attachments of the card.
SET lock_timeout = '5s';

ALTER TABLE "plan_details" ADD COLUMN "explainer" JSONB;
