# Timeline (09 §5)

## Layout idea
The page's job is to read as time, so the layout is an axis rather than a list. A spine runs down the inline start with the hour beside each node. A pause of 3 h or more shows on the spine as a dashed stretch with words ("6 h quiet"), so distance means something. The day header sticks under the app header, your last visit is a teal tide line between the rows it separates, and from 1280 px a rail gives one bar per day and jumps there. Events that change what a card means get the card surface. Small ones (a comment, a reminder, a field edit, a claim) stay a single line on the spine, so a busy day still has a shape.

## Decision: its own row, not `CardRow` (README deviation 7)
**`TimelineItem` is its own component (`parts/item.tsx`).** A `CardRow` says what a card is now. A timeline row says what happened to it at a moment, so it leads with a time, an actor and a verb, and it needs an excerpt, a "+n" expander below the row and a node on the spine. `CardRow`'s two-line contract cannot hold those without becoming a different component. It keeps everything else `CardRow` promises: one neutral surface and border, coloured type icon, stretched link, actions above the link, `rowProps`. This is also what 08 §5.2 asks for. If the owner agrees, deviation 7 can close: `CardRow` for lists of cards, `TimelineItem` for lists of events.

## Deviations from 09
1. **URL names follow 09 §5, not 04 §3.9.** 09 says `members` and `awaiting=me`; 04 says `actors` and `mine`, and `mine` means something else ("events on cards I watch, own or claimed"). The real build needs one answer. See the questions below.
2. **`+ New ▾` is not repeated on the page.** The app header's "+" is on every page and does the same.
3. **The `live` indicator stays in the app header.** The page adds only a refresh button with `r`.
4. **Inline actions only on the newest row of a card.** Otherwise a decision with five events shows Decide five times.
5. **A change card's `created` event is left out** when the card has other events. Its first commit or PR says the same thing.
6. **Actions are outline buttons.** No row is the page's single focus, so the page has no filled button.
7. **The mock simulates SSE.** Three events arrive 1.2 s after the page opens, so the pill shows. A fourth arrives at 20 s: at the top of the list it prepends, scrolled down it adds to the pill. `?live=off` stops both.
8. **Filters sit behind one button at every width**, in the page, not 09 §5's bottom sheet on a phone. Active ones are removable chips. `f` opens them and moves focus inside.
9. **Mine is off by default and the stream keeps its order.** A card waiting on me is marked on its newest row.

## Questions for the owner
- `awaiting=me` (09) or `mine` (04)? They filter differently.
- The sidebar's since-last-visit count (25 for the owner, 26 for Sara) is the `hub-today` total without my own events, the same number Today's section shows, and a visit here clears both. The stream holds more events than that in this lab, because every page's mock adds events.
- The pill is a separate thing: what arrived while you were here, and it says so in words.
- The quiet marker starts at 3 h. Is that the right rhythm for this team?

## Checked
After the review: see the version README. Before it: widths 390, 768, 1024, 1280, 1440 × ar, en × light, dark × default, frontend, empty, loading, error, plus `types=decision`.
