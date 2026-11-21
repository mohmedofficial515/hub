# Tasks (09 §6)

## Layout idea
The job is to see work move and to move it. The board breaks out of the page's 1100 px, because six columns need the room. The four columns where work is alive (Ready, Claimed, In progress, In review) share the width. Backlog and Done fold to narrow rails at the two ends with just a name and a number, and open on a click. A chevron in each header says which way work flows, and it mirrors in Arabic. When you claim a task it travels across the board to its next column with `layoutId` and focus goes with it: that is the page's one piece of motion, and it answers an action. Rows are `CardRow`, with the move button on its own line and the type word hidden. The first Ready task I can claim is the page's filled button. The list view is a real sortable table with the same move button, and `CardRow`s on a phone. Under 768 px the page opens on the list, and an explicit choice is remembered. At 768 px columns are 208 px, so three whole columns show beside the rail and a sliver of the next says there is more. Filters sit behind one button at every width.

## Deviations from 09
1. **`Mine` keeps the Ready column.** 09 reads as `assignee=me`, which would leave an engineer on a page whose purpose is finding work with nothing to claim. With `Mine`: my claimed work, plus what is ready for my roles.
2. **Moves belong to the claimer, and others do not see those buttons.** 08 §5.6 says never hide an action for lack of a role, and Claim follows that (disabled, with a tooltip naming the role). "You are not the claimer" is not a role, and five disabled buttons on a board are noise. The sheet says who claimed it.
3. **`Send back` is `in_review → in_progress` with a required note, and from `done` or `cancelled` it goes to `ready`** for owner or pm. 09 describes the first and 04 §3.10's `reopen` the second, under one endpoint name. The lab does both.
4. **Awaiting review is a chip behind Filters**, not a header button. Same URL idea (`review=1`).
5. **P2 and P3 are hidden on the board** (08 §5.1, dense lists). The list shows them all, and owner and pm edit them there in place.
6. **`Mine` is off by default for everyone**, against 09 §6's "engineers open on Mine". Mine are marked and sorted first in each column, and an explicit choice is remembered (review M6).
7. **`Generate skeleton` and the per-type fields of `+ New task` are not built.** `NewCardDialog` creates with title, role and priority, then opens the card (noted in the version README).
8. **No drag and drop**, as 09 says for v1.
9. **The read-only accountant state exists but was not seen.** No lab persona holds only `accountant`.

## Shared changes
In `kit/`: actions `mark_ready` and `reopen` (`i18n.ts`, `card-store.ts`, `card-actions.tsx`); `submit` became a form with an optional PR link; claimer-only moves; `openBlockers(card)` replaces the flag check, so finishing a blocker frees a task; `updateTask` for priority and branch. Mock: `extraTasks` adds GTV-270 to GTV-288 to `cards` (GTV-288 is GTV-261's port task), because the catalogue had nothing in Backlog, Claimed or In review. `extraChanges` adds GTV-290 to GTV-292 for the Timeline.

## Questions for the owner
- Is `Mine` keeping Ready what you want for engineers?
- Hide moves from non-claimers, or show them disabled? (The critic says hide, with the claimer named on the card, and the page does that. It is still your call.)
- 04 has no endpoint for `in_review → in_progress`. Add one, or widen `reopen`?

## Checked
Before the review: widths 390, 768, 1024, 1280, 1440 × ar, en × light, dark × default, frontend, empty, loading, error, plus `view=list` and `mine=1`. After it: see the version README. No role lacks access to this page, so it has no 403 state.
