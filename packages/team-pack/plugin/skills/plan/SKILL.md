---
name: plan
description: Think a topic through with the project's own context, draft a plan with ordered steps, and save it in Hub.
user-invocable: true
argument-hint: '<topic>'
---

Write a plan for this topic: $ARGUMENTS

Write every word of the plan and of your replies in the language I wrote the topic in. Keep code, paths, card keys and product names as they are.

1. Call `hub.get_project_brief` and say which project is active, in one line, with what you will look at first.
2. Read what Hub knows: `hub.search_docs`, `hub.get_doc`, `hub.list_plans`, `hub.list_ideas`, and `hub.list_cards(q=…)` for related decisions, tasks and needs. When the topic names an idea or a plan by key, read it with `hub.get_card` or `hub.get_plan` first: the plan builds on it. Look at the code too when the topic touches it, and read the files that decide.
3. When a business rule is still open and the plan cannot go on without it, ask me one short question with your question tool and wait. Otherwise do not stop to ask: put what only I can answer in the plan's `questions`. Never assume a business rule; offer `hub.request_decision` for one that needs a decision.
4. Before you write, weigh it: the order that removes the biggest risk first, what can run in parallel, and what is out of scope.
5. Draft the plan and propose it with `hub.propose_plan`: the `title` (the work's own name, never starting with a card key), the `goal` (one or two sentences), the `approach`, ordered `steps` each small enough to be one task, its `title` one short line (under 150 characters, the detail goes in its `why`), with the `role` that does it, its `size` (S, M or L) and the steps it comes `after`, the `checks` that prove it works, the `risks`, what is `outOfScope`, the open `questions`, a small flow `diagram` (3 to 8 nodes) when the plan has a flow worth seeing, and the `sources` you relied on with their real URLs. Then reply in at most three short lines, never repeating the plan in words.
6. When I ask for a change, answer questions, or apply a suggestion: work it in, keep every part I did not ask about as it was, and call `hub.propose_plan` again with the whole plan. Say in one or two lines what changed.
7. **In Plan mode (the Plan Studio, or the panel in Plan)** you cannot write: stop after proposing; I save the plan from the page. **Otherwise**, when I agree, save it with `hub.create_plan(title, body, steps)`. If the topic is an existing idea, use `hub.idea_to_plan` first, then `hub.update_plan`. Reply with the plan's key and URL, and offer `hub.plan_to_tasks` to turn the steps into tasks; do that only if I say so.

Nothing invented: a card key, a path or a source you name is one you read.

Never send a secret, token or password to Hub, in any field.
