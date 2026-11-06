---
name: guide
description: Work with the team's Hub, the shared timeline of tasks, decisions, needs, handoffs, plans and docs. Use at the start of a session, when choosing a task, when a business rule is unclear, when something external is missing, when a change affects another team, when planning, and before finishing.
user-invocable: false
---

# Hub

Hub is the team's operations room. This chat reaches it through the `hub` MCP server, with the member's own permissions. Cards are referenced by key, such as `GTV-123`. Hub holds no secrets and must never receive one.

Every chat acts on one project: the tool's `project` argument, else the folder's link, else the member's default. Say which project is active when you first use Hub.

## When to call what

| Situation                                              | Call                                                                                               |
| ------------------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| Session starts                                         | `/hub:start`, or `hub.whats_new`                                                                   |
| Choosing work                                          | `/hub:next`, or `hub.list_tasks` then `hub.claim_task`                                             |
| You start editing code for a task                      | `hub.start_task`                                                                                   |
| A business rule, limit, name or flow is unclear        | `hub.search_docs`, `hub.get_doc`; still unclear: `hub.request_decision`. Never guess.              |
| A token, account, contract, value or access is missing | `hub.create_need`: describe it, never paste the value                                              |
| Your change affects another team                       | `hub.create_handoff` with a ready prompt                                                           |
| You see work for later                                 | `hub.create_task`, or `followUps` of `log_session`                                                 |
| Something worth thinking about                         | `hub.create_idea`; `/hub:plan` to write a plan                                                     |
| Writing or changing a document                         | `/hub:doc`: search first, `hub.propose_doc`, then `hub.save_doc`. Never a second one on one topic  |
| Doing one task from start to finish                    | `/hub:work <key>`                                                                                  |
| You stop: task done, end of day, context nearly full   | `/hub:done`: `hub.log_session`, then `hub.submit_task`                                             |

## Sensitive tools

Whatever the member may do on the web, you may do here, including decide, verify, approve, reject and delete. Tools marked sensitive ask you to confirm with the user in the chat first: always do. A deleted card can be restored with `hub.restore_card`.

## Conventions

- Branch names: `feat/<key-lower>-<slug>`. Follow the project's rule about asking before creating a branch.
- Commit messages: Conventional Commits with the key at the end of the subject, such as `fix(payments): hold the row during refund (GTV-139)`.
- `sessionId` for `log_session` is the "Hub session id" line injected at session start.
- Write titles and summaries in the language the team uses for that field. Keep paths, endpoints and code identifiers as they are.

## Before you finish

1. `hub.log_session` with `changed`, `remaining`, `handoffs`, `followUps`, `cardKeys`, `commits`.
2. The task you claimed moved on, with its PR URL if one exists.
3. Open questions turned into `hub.request_decision`, missing things into `hub.create_need`.
4. No secret anywhere in what you sent.
