---
name: start
description: Start a work session with Hub. What is new, what awaits you, your sessions without a summary, and what to work on next.
user-invocable: true
---

Start a work session for me in Hub.

The session context names the active project and my roles. If it does not, call `hub.get_project_brief` and take them from there. Say which project is active, in one line.

Do this now:

1. Call `hub.get_project_brief`, `hub.whats_new` and `hub.list_my_sessions_without_summary`.
2. Read the MCP resource `hub://brief/today` if it has anything.
3. Report in my language, briefly and in this order:
   - (a) decisions and needs awaiting my roles, with deadlines, overdue first;
   - (b) handoffs pending for my roles;
   - (c) my sessions without a summary: offer to write them now with `hub.log_session` (ask me what I did, then call it);
   - (d) up to 5 ready tasks for my specialties, with keys;
   - (e) notable changes by others since my last session.
4. Ask whether to save a short narrative (12 lines at most) with `hub.save_brief`, so that it shows on my Today page. Save it only if I agree.
5. End by asking which task to start, or suggest `/hub:next`.

If a Hub tool is not available yet, the `hub` server may still be connecting: wait a moment and try once more before saying Hub cannot be reached.

Rules: refer to cards by key; keep the report under 40 lines. Never send a secret, token or password to Hub, in any field.
