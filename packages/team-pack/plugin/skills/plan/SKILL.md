---
name: plan
description: Think a topic through with the project's own context, draft a plan with ordered steps, and save it in Hub.
user-invocable: true
argument-hint: '<topic>'
---

Write a plan for this topic: $ARGUMENTS

1. Call `hub.get_project_brief` and say which project is active.
2. Read what Hub knows: `hub.search_docs`, `hub.get_doc`, `hub.list_plans`, `hub.list_ideas`, and `hub.list_cards(q=…)` for related decisions, tasks and needs. Look at the code too when the topic touches it.
3. Ask me what you cannot find out, in one message, and wait. Never assume a business rule: if it is still open, offer `hub.request_decision`.
4. Draft the plan: the goal, the approach, what is out of scope, the risks. Add ordered steps, each small enough to be one task, with the role that does it. Propose it with `hub.propose_plan(title, steps, checks, risks)`, show me its answer if it says to, and ask for changes.
5. When I agree, save it with `hub.create_plan(title, body, steps)`. If the topic is an existing idea, use `hub.idea_to_plan` first, then `hub.update_plan`.
6. Reply with the plan's key and URL. Offer `hub.plan_to_tasks` to turn the steps into tasks, and do that only if I say so.

Never send a secret, token or password to Hub, in any field.
