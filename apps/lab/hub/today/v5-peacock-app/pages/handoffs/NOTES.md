# Handoffs: notes for the version README

## Layout idea
The page answers "was it received?", so its focal point is the relay: three stops with a count at each (Waiting to be received, Received not applied, Applied), and breaking or stale called out at the stop. The relay is also the status filter. Below it, handoffs are grouped by desk, meaning the role that receives them, with my roles first and marked. The diff opens in place under the row, because reading it is most of receiving it; the lead row starts open from 768 px. "Copy prompt" keeps its words on every row. The sheet is for acting.

## Deviations from 09 §9
- **Status defaults to moving (pending and acknowledged)**, as `04 §3.13` does. 09's chips have no such state, so with no stop pressed, the list shows both.
- **Grouped by receiving role.** 09 shows one flat list, but its readers are receivers, and grouping shows at a glance whose desk is full. The sort inside a desk follows 09: stale, then breaking, then oldest.
- **`awaiting=me`, not `mine=1`**, as on Today's tiles. "To my roles" reads as the kit's "Awaiting me" chip.
- **Notable is `info`, not `warning`.** The kit keeps warning for stale, and the old sheet used it for notable.
- **Mock keys:** 09's example GTV-238 goes frontend to designer, not frontend to frontend, so Sara's count stays at the 1 her sidebar shows.

## Shared changes
- `kit/sheet-sections/handoff.tsx`: Apply form (create a task, link one, or neither), stale age, who acknowledged and applied, dismissal reason, `CopyPromptButton`, `severityTone`.
- `kit/card-store.ts`: `apply` keeps `appliedTaskKey`.
- `kit/card-actions.tsx`: dismiss allows the receiver or pm (09 §9).
- `shared/mocks/hub-app/handoffs.ts`: 4 handoffs and task GTV-222. Pending stays at the 2 `handoffsPending` promises.

## Owner decisions (2026-11-04)
- **Naming.** Handoff is «إحالة», plural «إحالات», page «الإحالات». Creating one is «أحل» or «إحالة جديدة». «استلم» and «طبّق» stay. English stays Handoff, and the route and view id stay `handoffs`. `hub-today.ts` is not edited, so its one total named in the old word is overridden in `team.tsx`.
- **Owner and pm may acknowledge any handoff,** with their name on the acknowledgement. Apply stays with the receiving role, and shows disabled with a tooltip naming it.
- **My choice, for your review: what an acknowledgement-only row does in the owner's stack.** The stack does not fill up with every handoff in the workspace. A handoff routed to another role shows only on this page, unless it is overdue (past `handoffs.stale_hours`, 48 h). An overdue one joins the owner's stack with a filled-or-outline Acknowledge. Default data: GTV-238, so the owner's stack is 8, up from 7. Acknowledging it does not route Apply to the owner: the row leaves, and the handoff keeps waiting on its role.

## Questions for the owner
1. **Should Undo on Apply also remove the task it created?** Today the task stays. A real API would need a decision too.

## Not built
The manual dialog's title is the summary's first clause, because 09 lists no title field.

## Checked (2026-11-04, own headless Chromium, before the review; after it, see the version README)
Default at 390, 768, 1440 × ar, en × light, dark; frontend, empty, loading, error at 390 and 1440 in ar-dark and en-light; `status=applied|all|pending`, `awaiting=me`, `severity=breaking` at all three widths. Sheets: acknowledge form, breaking, applied, dismissed. No overflow, no AA failure on rendered text, no console errors. Flows: Copy prompt puts text containing `pnpm api:sync` on the clipboard, `a` opens Acknowledge, focus returns to the row, relay and sidebar counts follow, Apply creates a task and shows its chip. Phone: first action ends at y = 701 of 844. Not run: a screen reader, and New handoff's dialog beyond the typecheck.

The To and Severity groups each have an "All" chip. Since the review their names are visible, so the two can be told apart.
