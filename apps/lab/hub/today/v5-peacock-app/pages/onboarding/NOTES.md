# Onboarding

**Layout idea.** This is the one page whose content really is a sequence, so it is drawn as a trail: numbered markers joined by a line that turns solid where the member has been, split into read, set up and start working. The next step stands beside it as a card with the page's one filled button, and stays in view while the trail scrolls. On a phone the card comes first. The progress bar has one cell per step, because steps are counted, not percentages.

## Deviations from 09 §13
- **"Preview a role's path" is an addition,** for owner and PM. The owner has finished his own path, so his page would otherwise be empty of use, and it is the only way to see what a role gets. Previews save nothing. Owner decides whether to keep it.
- **8 steps for Sara, not the wireframe's 9.** She has 2 left, matching the catalogue's sidebar count, because she has already logged sessions and claimed work. Automatic steps are therefore ticked for her. The preview shows them unticked.
- **04 returns a group per role; 09 asks for a union without duplicates.** The mock lists each step once, with the roles that hold it.
- **Item kinds:** 04 and 03 say `doc | card | url | action`, 09 says `doc | action | auto`. 04 wins, with `auto` as a flag on a step.
- **Hiding from the sidebar:** 09 says the item hides when done, 08 §2 says the count hides. The shell keeps the item and drops the count, so the page stays reachable. The profile-menu link in 09 is not added, because the shell is not mine to edit.

## Shared changes
`navExtras().onboardingLeft` now reads `stepsLeft` from the mock, and the page calls `notifyCardStore()`, so ticking a step updates the sidebar count. Verified: 2 → 1.

Progress is module state, so it survives a scenario switch until the page reloads.

## Review answered (2026-11-04)
- **Bar:** each cell maps to its own step, so a solid cell is that step done, even when an earlier one is not.
- **Title:** always the welcome. It no longer says "finished" while loading or on error, and the owner no longer reads "done" twice.
- **Empty (M8):** a manager is told "You have not set a reading path yet" with one next step, Settings › General. Other members keep the sentence naming the owner, with Docs.
- **Preview chips** are a kit `ChipGroup`: one Tab stop, arrow keys.
