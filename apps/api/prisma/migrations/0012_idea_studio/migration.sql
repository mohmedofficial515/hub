-- docs/15 §4, the Idea Studio: `propose_idea`'s report on the turn that made it. Additive: one nullable column.
SET lock_timeout = '5s';

ALTER TABLE "chat_messages" ADD COLUMN "idea" JSONB;
