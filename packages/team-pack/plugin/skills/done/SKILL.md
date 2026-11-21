---
name: done
description: Finish this session with Hub. Write the session summary, with handoffs and follow-ups, and move the claimed task on.
user-invocable: true
---

Finish this session properly before you stop.

1. Collect from git: repo, branch, commits made since the session started, files changed.
2. Write the summary: what changed (bullets with file paths, endpoints, schema changes), what remains, what another role must do (handoffs with a ready prompt), and follow-up tasks you noticed.
3. Call `hub.log_session` with `sessionId` from the "Hub session id" line of the session context (if it is absent, ask me), and repo, branch, changed, remaining, handoffs, followUps, cardKeys, commits, durationSec.
4. For the task you claimed: `hub.submit_task`, or `hub.complete_task` if I tell you it is merged, with the PR URL when one exists.
5. Reply with the keys Hub returned.

Rules: be specific; do not skip step 3 even if the session was short. Never send a secret, token or password to Hub, in any field.
