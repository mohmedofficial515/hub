---
name: work
description: Carry out one Hub task from its card, with stages the panel shows as a live checklist and evidence written back on the card. The task is never completed here.
user-invocable: true
argument-hint: '<card key>'
---

Carry out this card: $ARGUMENTS

If no card key was given, ask for one and stop. Say which project is active.

At the start and end of each stage below, call `hub.report_stage` with `protocol: "work"`, the stage, and `state`: `started`, then `done` or `failed`. A panel shows these as a checklist on this turn. Elsewhere they cost nothing. A short `note` says what happened, with no secret in it.

## 1. Understand (`understand`)

Read the card with `hub.get_card`, then what it links to: other cards, decisions, plans. Read its docs with `hub.search_docs` and `hub.get_doc`. Look at the code it names.

A business rule, limit, name or flow still unclear: stop and ask, or offer `hub.request_decision`. Never guess one. Something external missing: `hub.create_need`, describing it and never pasting the value.

## 2. Plan (`plan`)

Write the steps, and the acceptance checks that would prove the work done: exact commands, or exact things to look at. Take the checks from the card when it has them. Show this, then go on unless the card or I said to wait.

Move the task to started with `hub.start_task` if it is not already.

## 3. Execute (`execute`)

Do the steps in this folder. Keep to the card's scope, and name anything else you notice rather than doing it. Commit, push, branch, delete and deploy each pause for my approval when this runs in the panel, and follow the project's rules anywhere else.

## 4. Verify (`verify`)

Run every check from stage 2 and show its real output. Never report a check you did not run.

**A failed check stops here.** Report `verify` as `failed` with the check's name in the note, say what failed and what you think the cause is, and go straight to stage 5. Do not call the work done.

## 5. Report (`report`)

Write the report on the card with `hub.comment`, in this form:

```markdown
## Work report

**Result:** done, checks passed | stopped at Verify | stopped: <why>

**What changed:** <in plain words>

**Files:** <paths, or "none">

**Checks run:**

- `<exact command or check>`: passed | failed, with the line that shows it

**Not checked:** <what was not run or could not be, or "nothing">
```

Then give me the same summary here.

**Never call `hub.complete_task`.** The owner confirms the work. If the checks passed and the card's flow has a review step, `hub.submit_task` may move it there, and only if I asked for that.

Never send a secret, token or password to Hub, in any field.
