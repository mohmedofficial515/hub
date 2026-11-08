---
name: suggest
description: Read the project through Hub and propose the tasks, plans or skills most worth doing next, as structured proposals the owner accepts one by one. Reads only, and creates nothing.
user-invocable: true
argument-hint: '[focus]'
---

Propose what is most worth doing next on this project. If I named a focus, keep to it: $ARGUMENTS

**Read only.** Never create, change, claim or start anything here: no `hub.create_task`, no `hub.create_plan`, no `hub.save_doc`, no file edits and no commands. I accept each proposal in Hub, and Hub creates it then. In the panel this runs in Ask, where writing is refused anyway.

1. Call `hub.get_project_brief` and say which project is active. Then read what is real:
   - `hub.whats_new` for what changed lately.
   - `hub.list_tasks` (ready, claimed, in progress and backlog), `hub.list_decisions` (open ones), `hub.list_needs`, `hub.list_ideas`.
   - `hub.list_plans`, and `hub.get_plan` for each approved or running plan.
   - `hub.list_queue` for what is already booked to run.
   - `hub.list_skills` for the skills Hub already carries to every device.
   - `hub.search_docs` and `hub.get_doc` when the focus names a topic.
2. Look for real gaps: a plan whose next steps have no task, an idea that was never planned, a decision that holds work back, work in backlog that looks ready, a need with nothing moving it, and the same kind of work done again and again that no skill covers. Never propose what already exists: check the lists first, and name the cards you checked.
3. Propose with `hub.propose_suggestions(summary, items)`: up to 6 items, the most useful first. Each item is one of:
   - `kind: task` with `title` and `why`, the facts it rests on with card keys. Add what you know: `priority`, `ownerRole`, `specialty`, `effort` (`S` when it takes under an hour), `related` card keys, and a `body` with its acceptance checks.
   - `kind: plan` with `title`, `why` and ordered `steps`, each small enough to be one task, with the role that does it.
   - `kind: skill` with `name` (lowercase words joined by dashes, and not a name `hub.list_skills` already has), `description` (when Claude should use it), `why`, and the whole skill as Markdown in `body`.
4. When the tool answers that the proposals are in the panel, stop there: I accept or dismiss each one. Outside the panel, show its answer in your reply, and create one only if I ask you to.

Nothing invented: every `why` names what you read. When Hub has too little to go on, propose fewer items or none, and say what is missing.

Never send a secret, token or password to Hub, in any field.
