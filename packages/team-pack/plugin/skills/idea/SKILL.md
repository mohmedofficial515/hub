---
name: idea
description: The Idea Studio's research. Take an idea described in a few words, check how much of it already exists in Hub and in the code, research it, organise it, and return one structured report with propose_idea. Reads only, and creates nothing.
user-invocable: true
argument-hint: '<the idea in your own words>'
---

Here is my idea: $ARGUMENTS

Turn it into a report I can decide on. **Read only.** Never create, change, claim or start anything: no `hub.create_idea`, no `hub.create_plan`, no file edits and no commands. When I accept the report, Hub saves it as an idea. In the panel this runs in Plan, where writing is refused anyway.

Write every word of the report and of your replies in the language I wrote the idea in. Keep code, paths, card keys and product names as they are.

The page shows each of your steps as you take them and the whole report beside the conversation, so the conversation itself stays short: say what you are about to do in one line, never repeat the report in words.

1. **Understand.** Call `hub.get_project_brief`. Then write one short line: who the idea is for, what changes for them, and the two or three things you will check first. If the idea can be read in two very different ways, ask me one short question with your question tool, with the options you see, and wait; otherwise go on without asking.
2. **Check what exists in Hub.** Search before you judge, with the idea's words in my language and in English:
   - `hub.list_ideas` and `hub.list_plans`, then `hub.get_plan` or `hub.get_card` on anything close.
   - `hub.list_cards` for tasks, decisions and needs on the same ground.
   - `hub.search_docs`, then `hub.get_doc` on the documents that match.
3. **Check what exists in the code.** Search the working folder with Grep and Glob for the idea's nouns and verbs, and Read the files that match. A screen, a route, a table, a setting or a service that already does part of it is a match. Prefer reading the one file that decides over searching ten times.
4. **Research outside.** When web search is available, look at how good products and sources solve the same problem: patterns, pitfalls, standards, numbers. Keep every page you rely on as a numbered source with its real URL. Two or three strong sources beat ten weak ones. If web search is refused or unavailable, say so in `basis` and go on without it. Never invent a source or a URL.
5. **Think before you judge.** Before writing the report, weigh it: what would make this idea fail, what is the smallest version that still solves the problem, and what in the code or in Hub would have to change first. Let that shape the suggestions, the steps and the risks.
6. **Judge.** `overlap` is how much of the idea already exists, from 0 to 100, and `verdict` says it in a word: `new` (under 20), `partial`, or `exists` (85 and over). Each match gets its own overlap and one line on what it already covers and what it does not. `basis` says in one sentence what you searched.
7. **Organise and suggest.** Write the idea as you now understand it (`summary`, three sentences at most), the `problem` it solves, and its `value`. Give up to six `suggestions`: `improve`, `alternative`, `addition`, `simplify`. Draw one small `diagram` of how it works: 3 to 8 nodes (`actor`, `step`, `data` or `decision`), edges with short labels, and loops back only when the flow really returns. Draft the `steps` of a plan, each small enough to be one task, with the role that does it. List the real `risks`, and the `questions` only I can answer, each one answerable in a line.
8. **Report.** Call `hub.propose_idea` once with the whole report. A match's `ref` is a card key, a doc path, or a file path from the repository's own folder (`web/src/…`, `backend/src/…`), never a drive letter. Then reply in at most three short lines: the verdict and overlap, the one thing that matters most, and that you wait for my decision. No lists of what is in the report.

**When I come back:**
- A change, a suggestion to apply, or answers to your questions: work them into the report, keep every part I did not ask about as it was, move answered questions out of `questions` and into the report where they belong, and call `hub.propose_idea` again with the whole new report. Then say in one or two lines what changed.
- A question about the report: answer it in a few lines, and change the report only if I ask.

Nothing invented: a match names a card key, a doc path or a file path you read; a finding names the source it came from; a number you could not find is not given.

Never send a secret, token or password to Hub, in any field.
