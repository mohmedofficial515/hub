# Decisions: notes for the version README

## Layout idea
A docket. The deadline is the structure, so from 768 px every question hangs off a time rail, earliest first, under Overdue, Due in 24 h and Later. The focal point is "on the table": the next question routed to me, opened out with its options side by side. Each option has its own "Choose this", which opens the sheet's form with that option picked and the cursor in the rationale. The recommended option's button is the page's filled one (the first if none is recommended). On a phone each option folds its pros and cons behind a disclosure. Other questions are `CardRow`s whose options read as one sentence ("A or B or C"), so the choice shows before anything is opened. Recorded outcomes sit on the same rail, in the past. Phones drop the gutter, and the date moves to the meta line.

## Deviations from 09 §7
- **Mine is off by default**, against 09 §7's "on for deciders" (review M6). Mine are marked and come first inside their band.
- **Filter param is `awaiting=me`, not `mine=1`**, because Today's tiles and the kit's `FilterBar` already use it.
- **Decider filter is single-select** (`decider`, not `decider[]`). `FilterBar` only gives an "All" chip in single mode, and the wireframe shows one.
- **"Decided" also lists withdrawn and superseded.** They are outcomes too, and need a home. Each says why.
- **"Recently decided" under the open list** is an addition, so the room shows outcomes without a tab change. A decision made in this session leaves it, so focus can move to the next question.
- **Rationale minimum is 20 characters** per 09. `04 §3.11` says 1..2000. The sheet follows 09.
- **Withdraw and supersede:** Withdraw runs. Supersede appears only as data (GTV-199), since its "link menu" action does not exist yet.

## Shared changes
- `kit/sheet-sections/decision.tsx`: required rationale, secret filter, Draft ADR and target repo, ADR status chain, PR link, Open PR, reasons on closed decisions, `openDecideWith`.
- `kit/card-store.ts`: `decide` and `verify` send an `unblocked` event to the cards they block. Undo restores them. `decide` stores `adrStatus: drafted`.
- `kit/card-actions.tsx`: the owner can decide any decision (09 §7).
- New kit parts, shared with Needs and Handoffs: `Segmented`, `RowAction`, `PickField`, `FilterDisclosure`.
- `shared/mocks/hub-app/decisions.ts`: 2 open and 4 closed. Open reaches the 5 that `decisionsOpen` promises, and deciders are `backend` and `designer`, so the owner stays at 3 of 5 and Sara at 0 of 5.

## Questions for the owner
1. **Rationale:** 09 asks for at least 20 characters, 04 for at least 1. Which wins?
2. **Who decides an escalated card?** The mock routes GTV-219 to `pm` as both decider and escalation target, so the escalation changes nothing visible but the label.

## Not built
"Edit options" (08 §5.4), Supersede from a link menu. Undo does not reverse "Open ADR PR", which stands in for a real PR.

## Checked (2026-11-04, own headless Chromium, before the review; after it, see the version README)
Default at 390, 768, 1440 × ar, en × light, dark; frontend, empty, loading, error at 390 and 1440 in ar-dark and en-light; `status=decided`, `status=all`, `decider=frontend` at all three widths. Sheets: decide form, open, PR open, merged, superseded, withdrawn. No overflow, no AA failure on rendered text, no console errors. Flows: `j` `k` `Enter`, Esc returns focus, Choose presets the option, empty and short rationale refused, row leaves and focus moves on, `u` restores, `unblocked` on GTV-249, ADR chain and PR link, Sara's disabled Decide with tooltip, New decision with `CardPicker`. Phone: Decide ends at y = 779 of 844. Not run: a screen reader.
