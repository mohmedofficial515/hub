-- docs/16 "§7.2 as built": what a stale save found in the file (filtered and capped), and the engine's skills and MCP servers as reported on the turn. Both are nullable and additive.
ALTER TABLE "doc_drafts" ADD COLUMN "conflict" JSONB;

ALTER TABLE "chat_messages" ADD COLUMN "engine_facts" JSONB;
