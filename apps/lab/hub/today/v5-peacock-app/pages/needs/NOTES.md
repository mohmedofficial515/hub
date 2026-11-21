# Needs: notes for the version README

## Layout idea
A board you read as a route: Requested, In progress, Delivered, joined by one rail, with Verified as its own row when asked for. Phones get the same stages as a list. The owner asked that "a location is a pointer, never the value" be visible in the design, so it is carried three ways:
- **The rule at the top of the page:** one line that stays on the page and cannot be dismissed ("Hub keeps the address and the value stays in the vault…"). It was a 100 px banner with a diagram, until review M10.
- **`LocationPointer`, the only way a location is drawn:** a signpost icon, a dashed outline (it points elsewhere), a label saying "Where the value is, not the value", and the path with its last part in bold. There are deliberately no dots, no mask and no reveal button, because those would say a secret is here. Copy takes the address.
- **The Deliver form:** the rule again, starting points for an address, a preview of what the team will see, and a block on anything that looks like a value. That covers known token formats (`detectSecret`) and also long unbroken mixes of case and digits (`looksLikeRawValue`), which match no known format.

## Deviations from 09 §8
- **Mine is off by default, with mine sorted first and marked.** 09 says owner and accountant default to Mine. With it on, the owner's board is 2 cards with an empty middle column, which hides the one thing a board is for: seeing who holds what. The review made this the rule for every page.
- **`awaiting=me`, not `mine=1`**, as on Today's tiles.
- **Verified takes a full-width row** rather than a fourth column. At 240 px a column breaks location paths mid-word.
- **Cancelled shows with Verified**, marked with its status. 09 gives it no place.
- **By role is grouped sections, not a matrix.** With this few cards, a roles-by-statuses grid is mostly empty cells.
- **Verify role:** the requester's roles or pm/owner, per 09. **Owner decision 2026-11-04:** whoever delivered may verify it too, with a required note. History records «تحقق ذاتي», the need keeps `selfVerified`, and that Verify button is never filled. If another person verifies, nothing changes.

## Data
`needsOpen` is 3, and doc 04 does not define it. Here "open" means requested or in progress, and delivered is counted apart ("3 open, 2 awaiting a check"). Today's tile counts both and says so ("open or awaiting a check: 5"), so the owner's 2 is honestly part of it. Question 1 below.

`shared/mocks/hub-app/needs.ts` adds 6 needs. Locations are vault paths, a doc path, or the name of an env key. Nothing in it looks like a token.

## Questions for the owner
1. **Does `needsOpen` count delivered needs?** If it does, the board should hold 3 rather than 5.
2. **Should `looksLikeRawValue` exist on the server too?** It is a lab heuristic, and the real filter is the API's `hub.security.secret_detected`.

## Not built
`reject-delivery` (`04 §3.12`) has no action in the kit's `CardAction`. GTV-233's two `blocks` links are one-sided in the mock: GTV-259 and GTV-267 do not list it back.

## Checked (2026-11-04, own headless Chromium, before the review; after it, see the version README)
Default at 390, 768, 1440 × ar, en × light, dark; frontend, empty, loading, error at 390 and 1440 in ar-dark and en-light; `verified=1`, `lane=role`, both, `awaiting=me`, `kind=contract` at all three widths. Sheets: deliver and verify forms, delivered, verified, cancelled. No overflow, no AA failure on rendered text, no console errors. Flows: JWT and raw value refused with the sheet still open, location accepted and shown, Verify leaves the board and returns with Show verified, Blocks popover lists 2 cards, sidebar count follows. Phone: first action ends at y = 655 of 844. Not run: a screen reader, and New need's dialog beyond the typecheck.
