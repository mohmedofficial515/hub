# Planning (docs/15 §4)

The page answers one question: **what are we thinking about, and what is planned next?** It has no v5 design, so this is the reasoning for an owner review. Shots are in `shots/`.

## Layout

From the top: the header, the filter row, one focal card across the whole width, then two lanes.

- **The two lanes are the page's answer, in the order the question asks it.** "What we are thinking about" holds ideas and "What is planned next" holds plans. They run with reading direction, because an idea becomes a plan: in Arabic ideas are on the right and plans on the left, in English the reverse. Plans get the wider lane (7 to 5), because a plan row carries more: a step count, its text, a next action.
- **Inside a lane, status is a heading, not a badge on every row.** Plans read in the order a person asks about them: waiting for approval, approved and not started, in progress, drafts. Ideas read "being explored", then "not started". Removing the repeated badge is what keeps a row to two or three lines.
- **The focal card is the one next thing this page wants from me.** A plan waiting for my approval comes first, then a finished plan to close, then work that can start, then an idea ready to become a plan (`pickFocal` in `features/planning/model.ts`, with tests). It holds the card's opening text and, for a plan, its first five steps with their tasks. Its action is the page's only filled button. If I can do nothing, the most active plan takes the spot under the words "Moving now" with no filled button, so the page still answers the question and never asks for something I cannot give. A card that is focal is not also a row.
- **On a phone** everything stacks in the same order as the DOM, so Tab and reading agree: focal, ideas, plans. The rows' buttons go full width on their own line, as Tasks does. Lanes sit side by side only from 1280 px, because below that the idea lane is too narrow for a title and a button.

## Rules kept

- **No coloured side or top edge on any card or panel** (D31). The focal card is the same neutral surface and uniform border as any card. It stands out through position and size, not colour. The type shows through the coloured icon on each lane's heading.
- **At most one filled button.** New idea and New plan are outline, since creating is never the filled button unless the page is empty. On an empty page New idea is filled and is the only one.
- **Step progress** is words first ("2 of 5"), with a thin neutral meter beside them. The meter uses `foreground` on `muted`, so it is never colour alone, and it is hidden from screen readers because the words already say it.
- **Nothing is invented.** There is no trend, no health score, no estimate: the API has none of these. An idea with no problem says so.

## Sheet

- **Editing is `?action=edit`.** The sheet already treats an open form as the one filled button, so the action bar goes quiet while editing, and a reload stays in the form.
- **A plan's form saves in one request**: title, body, steps, priority, tags. So one save is one revision and one event.
- **A live change while editing** does not touch the draft. A line says someone else changed the card and that saving replaces their text. The API keeps the replaced text as a revision, so nothing is lost.
- **Revisions** are folded by default, since most readers want the current text. Each past one can be read in place and restored, and a restore is itself a new revision. An entry names who replaced it, which is what the API knows, not who wrote it.
- **"Turn into a plan"** is a form that opens with the idea's problem and notes as the plan's text, and lands on the new plan's sheet.
- **"Create tasks from steps"** keeps the sheet open, unlike other actions, because the answer the member waits for is each step gaining its task there.

## Questions for the owner

1. **Is the focal order right?** Approve, finish, start, then ideas. It is one function, so changing it is one line.
2. **Parked ideas sit under "Closed".** They can reopen, so they could stay in the active lane. I moved them out so that lane holds only what is being thought about now.
3. **There is no plan owner.** A plan has no assignee or role in the API, so "Mine" here means what I wrote, plus ideas and steps routed to my roles.

## Limits

- A decision's or a plan's `question`-like fields follow the API: Planning shows what `GET /ideas` and `GET /plans` return, up to 1000 of each.
- The sidebar's Planning badge waits for `GET /counters` (README, Known limits). The page's own numbers come from its rows.
