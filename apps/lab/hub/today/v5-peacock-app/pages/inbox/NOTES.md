# Inbox (09 §15)

## Layout idea
The job is to clear what is addressed to me, phone first. One narrow reading column (800 px) that opens on what is unread, newest first, by Today, Yesterday and Earlier, with the quick action on each row and the one filled button on the newest row that asks something of me. Unread is semibold with a dot. The cards waiting on me are not repeated: one line says how many, and links to Today. Archive is a button, and a swipe on touch.

## Deviations from 09 and 08
1. **The URL is `show=all`, not `unread=1`,** because Unread is now the default. `kind` and `awaiting=me` are unchanged. P3 ("Inbox opens on the awaiting-me block") no longer holds: review M9 chose the wireframe's Unread.
2. **`e` flips the lead item only**, so pressing it twice is back where it started. A group never merges read and unread items. In the Unread view the row leaves at once, so `e` there gives a toast with Undo.
3. **The unread dot is `foreground`, not `primary`** (08 §5.5). The kit rule keeps bright cyan for the primary action, links and focus.
4. **`Kind` groups the 11 API kinds into 6 families**, because 11 options help nobody. The URL's `kind` holds the family.
5. **`InboxItem` is its own row for "To read"**, as 08 §5.5 specifies: it needs a body line and a chip, and some items have no card at all (briefs, system).
6. **"+n on this card" is a text fact**, not an expander. Opening the card shows the history.
7. **The `action` list was widened.** 04 lists `decide acknowledge deliver claim verify review`; the mock also uses `approve` and `apply`, because a redesign and an acknowledged handoff need them. The button shows only while the card still offers that action.

## Shared change
`kit/inbox-store.ts` holds read and archive state, and `useMyCounts().inbox` now reads it. The badge was a fixed number, and 09 §15's acceptance needs "Mark all read" to clear it. Today's tile follows too.

## Answered (review 2026-11-04)
- **Default:** Unread as the wireframe draws it (M9).
- **A notification on a card I acted on:** acting marks it read wherever the action was taken, and Undo restores it (M1). It stays in All as history until archived.

## Checked
Before the review: widths 390, 768, 1024, 1280, 1440 × ar, en × light, dark × default, frontend, empty, loading, error, plus `archived=1`. After it: see the version README. Swipe was checked with synthetic touch pointer events in Chromium, not on a real phone. No role lacks access to this page, so it has no 403 state.
