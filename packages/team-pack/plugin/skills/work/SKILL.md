---
name: work
description: Carry out one Hub task from its card, with stages shown as a live checklist and a structured report as evidence on the card. A task may start and move to In review. It is never completed here.
user-invocable: true
argument-hint: '<card key>'
---

Carry out this card: $ARGUMENTS

If no card key was given, ask for one and stop. Say which project is active.

**What this does to the card, so nothing is a surprise.** Say each of these out loud when it happens:

- If the task is not started yet, stage 2 claims and starts it (`hub.claim_task`, `hub.start_task`). Say that you are doing it first.
- At the end, if every check is verified against a real step that succeeded, Hub moves the task to In review by itself. Outside the panel it never moves.
- It is never completed here.

At the start and end of each stage below, call `hub.report_stage` with `protocol: "work"`, the stage, and `state`: `started`, then `done` or `failed`. A panel shows these as a checklist on this turn. Elsewhere they cost nothing. A short `note` says what happened, with no secret in it.

## 1. Understand (`understand`)

Read the card with `hub.get_card`, then what it links to: other cards, decisions, plans. Read its docs with `hub.search_docs` and `hub.get_doc`. Look at the code it names.

A business rule, limit, name or flow still unclear: stop and ask with `AskUserQuestion`, or offer `hub.request_decision`. Never guess one. Something external missing: `hub.create_need`, describing it and never pasting the value.

## 2. Plan (`plan`)

Write the steps, and the acceptance checks that would prove the work done. Each check is an exact command, or an exact thing to look at. Take the checks from the card when it has them. Show this, then go on unless the card or I said to wait.

If the task is not started, say "Starting the task now." and start it.

## 3. Execute (`execute`)

Do the steps in this folder. Keep to the card's scope, and name anything else you notice rather than doing it. Commit, push, branch, delete and deploy each pause for my approval when this runs in the panel, and follow the project's rules anywhere else.

## 4. Verify (`verify`)

Run every check from stage 2, each exactly as written, with no `cd`, pipe or filter added, because Hub matches the command word for word. Show its real output. Never report a check you did not run.

**A failed check.** Say what failed and what you think the cause is, in one line.

- **A mechanical failure in this task's own change** (formatting, import order, a lint rule with an automatic fix, a type error or a test you broke in a file you changed): fix it and run the check again, without asking. At most two attempts, and the failure stays in the history, which is correct.
- **Ask me with `AskUserQuestion`** only when the fix would change behaviour I did not ask for, touch files outside this task, weaken or skip a test, or when two attempts did not pass. Then offer to fix it another way or to report it as it stands.
- A check that fails for a reason outside this task (a broken environment, a failure already on the branch before you started): do not fix it here. Report it as failed, with the cause, and carry on to the report.

## 5. Report (`report`)

Call `hub.report_work` exactly once for this work, after the checks:

- `card`, and a `summary` in plain words of what changed.
- `checks`: every check, with its `name`, its exact `command`, and its `outcome`: `passed`, `failed` or `skipped`. Include the failed ones. A check with nothing to run has no `command`, and stays marked as claimed.
- `changedFiles`: the paths you changed. In the panel, Hub uses the device's own facts instead.
- `notChecked`: what was not run or could not be. Say so plainly, or send an empty list.

Hub checks your claims against the real steps. If it refuses because a step you reported as passed really failed, correct the report and call it again. Never call it passed to get past this.

Its answer says whether the task moved and why. Give me that, with the same summary, here.

**Never call `hub.complete_task`.** The owner confirms the work. Do not call `hub.submit_task` unless I ask: Hub moves the task by itself when the checks earn it.

Never send a secret, token or password to Hub, in any field.
