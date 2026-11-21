---
name: next
description: Start the next Hub task. Pick a ready task or the one you name, read what it links to, and claim it.
user-invocable: true
argument-hint: '[card key]'
---

Start the next task: $ARGUMENTS

Say which project is active, in one line.

1. If a card key was given above, call `hub.get_card` with it. If not, call `hub.list_tasks` for my specialties, show the top 3, and ask me to confirm one.
2. Read what it links to: `hub.get_card` for linked cards, `hub.get_decision` for decisions it depends on, `hub.get_doc` for referenced docs. If an open "blocked by" link exists, stop and tell me what blocks it.
3. Call `hub.claim_task` with the key and the branch name you will use (`feat/<key-lower>-<slug>`). Follow the project's rule about asking before creating branches.
4. Call `hub.start_task` when you begin editing code.
5. While working:
   - an unclear business rule: `hub.search_docs` first, then `hub.request_decision`, never guess;
   - a missing external thing: `hub.create_need`, describing it and never pasting its value;
   - your change affects another role: `hub.create_handoff` with a ready prompt for them.
6. Put the key in commit messages: `feat(scope): message (KEY)`.

Run `/hub:done` when the task is complete or when you stop for the day. Never send a secret, token or password to Hub, in any field.
