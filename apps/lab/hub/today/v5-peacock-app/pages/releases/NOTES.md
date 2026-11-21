# Releases

**Layout idea.** The batch going out next is laid open as a manifest: what it carries, grouped by type, beside the notes each audience will read, with Mark released as the page's one filled button. Shipped releases only need a line each, so they sit below on a date spine grouped by month, because a release is first of all a moment. A line under the manifest counts finished cards that are in no release yet.

## Deviations from 09 §16
- **The include list is the eligible cards as a checklist,** not `CardPicker`. The picker filters by type and not by status, and this list needs done, applied, decided or ported, since the last release. Nothing is left to search for.
- **Mark released runs at once with Undo,** rather than a confirm dialog. `ConfirmDialog` styles its button as destructive, and this is neither destructive nor irreversible in the lab.
- **Author chip** comes from a small map in the mock. The real API has it on the note's events.
- **The sheet and manifest show notes as plain text with line breaks.** Real notes are markdown. A manual notes editor is not built; the copy says it can be edited.

## Mock additions
Finished cards this page needs joined the catalogue through `releaseCards`: 10 done tasks, 1 applied handoff, 1 decided decision, and 5 releases. They use `GTV-181` to `GTV-200`, skipping the keys other pages took. Lists of tasks and decisions will show them as done or decided.

## Open questions
- `notesSkeleton` writes the same grouped list for all three audiences under a different first line. 07 §6.3 is the template to compare it with when this is ported.

## Review answered (2026-11-04)
- **B1:** the manifest's header stacks under `md`. It used to leave the title block a 3 px column at 390 px. The header now keeps the full width there, and the audit's sliver check covers every view at 320, 390 and 430 px.
- **M6:** status is a segment, Repo is the filter beside it, and it folds on a phone. **M7/M8:** New release is outline, filled only in the empty state, with the header's copy and subtitle hidden there.
- **M15:** "Rebuild skeleton" is now «أعد توليد المسودة» in Arabic.
