-- v5-live-plan (owner approval 2026-11-19): a plan's steps grouped in ordered phases. Additive: a plan saved before phases has
-- none, and its steps read as one list. Each step names its phase by `phaseId` inside `steps`, so only the list is a column.
SET lock_timeout = '5s';

ALTER TABLE "plan_details" ADD COLUMN "phases" JSONB NOT NULL DEFAULT '[]';
