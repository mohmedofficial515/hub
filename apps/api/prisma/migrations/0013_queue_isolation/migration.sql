-- docs/16 §9.2, queue isolation: a run in its own copy of its repository (`wt-<key>`), the hold on a folder with changes not committed, and the owner's choice
-- between the two. Additive: nullable columns, and defaults that keep every existing row as it was.
SET lock_timeout = '5s';

ALTER TABLE "agent_runs"
  ADD COLUMN "worktree_folder" TEXT,
  ADD COLUMN "worktree_branch" TEXT,
  ADD COLUMN "worktree_base" TEXT,
  ADD COLUMN "worktree_removed_at" TIMESTAMPTZ(3),
  ADD COLUMN "dirty_files" INTEGER,
  ADD COLUMN "allow_dirty" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "agent_queue_settings" ADD COLUMN "isolation" TEXT NOT NULL DEFAULT 'worktree';
