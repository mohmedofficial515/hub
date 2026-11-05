# Redesign

**Layout idea.** The page's job is the owner's verdict, so a version in review is laid open: wide picture, score and review beside it, Approve one click away. Every other version is a tile. Each lab page opens with a rail of all its versions, oldest at the start, so the filter narrows the pictures without hiding the history. The compare view is the signature: side by side with synced scroll, plus a curtain that wipes one version over the other, which shows what actually moved.

**Pictures are real.** The tiles, lightbox and compare read the lab's own files through a lazy glob: `web/wallet`, `dashboard/finance-currencies`, `hub/today` v2 and v5. `hub/today` v2 and v5 have all 12 size, language and theme combinations, so that pair shows the toolbar best.

## Deviations from 09 §10
- **Compare shows screenshots, not two iframes.** 08 §5.4 asks for lab iframes. Older wallet versions have only 4 shots, so a pill names the closest file when the exact one does not exist. The real iframes make that pill unnecessary.
- **The curtain is an addition.** Not in 08. On a phone the split view shows one version at a time, with an A/B switch.
- **Notes toggle** shows the concept and review summary. The lab's `notes=` overlay needs the iframe.
- **Status filter adds Ported and Rejected,** and each chip carries a count. 09 lists review, draft, approved, all.
- **The owner's preselected filter** writes `status=review` to the URL once on arrival, so clearing it is a normal click. A reload without a param preselects again.
- **Version tiles are not `CardRow`** (P1). A version is its picture. They keep the rule: one neutral surface and border, row keyboard (`j` `k` `Enter`, `x` adds to compare).
- **Port task:** approval creates one when the card has none (09 §10), and Undo removes it. GTV-252 keeps the catalogue's GTV-265, and GTV-261 has GTV-288. Claim on an approved redesign acts on that task, so it lands on the board with `/hub:next` in the toast. Once it is claimed the card offers only Mark ported (review M2).
- **Status is a segment, App is the filter behind it.** They were two chip groups with no divider.
- **Bulk "Send to review"** (10 §4) is not built. The single action is in the sheet.

## Doc conflicts, for the owner
- **`request_changes` differs across docs.** 10 §6: status stays `review`, owner only. 04: `review → draft`, roles owner, pm, qa. 09: owner, human. The lab follows 09 and 10. The reconciliation table does not cover it.
- **Mock status:** `hub/today/v5-peacock-app` is `review` here and `draft` on disk, so the Today counter of 2 has a second real version. Wallet v2 to v6 are `draft` per 10 §4's import rule.

## Mock fixes
- GTV-252's `base` was `v6-ledger`, which does not exist. It is now `v4-twin-tanks`, the real base.
- Two captures on disk are blank, one flat colour: `web/wallet/v6-departure-board/shots/1440-ltr-dark.png` and `web/wallet/v7-twin-tanks/shots/390-rtl-dark.png`. The gallery skips them. Someone should recapture them.
