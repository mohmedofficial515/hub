---
version: v1-baseline
title: Current settings pages
status: reference
created: 2026-11-18
source: Goteav-Dashboard feat/cartat-whatsapp (dev server :6001, sandbox banner on, signed in as the dev seed admin)
---

# v1-baseline: the settings pages as they are today

Screenshots of the real dashboard, unchanged. Component inventory and structure notes: [components.md](components.md).

## Files

| Folder | Route | Shots |
|---|---|---|
| `./` (root) | `/{ar,en}/settings` (overview) | 390 / 768 / 1440 x rtl / ltr x light / dark (12) |
| `group/` | `/{ar,en}/settings/organisation/org-refund-policy` (one organisation group: `refund_policy`) | 390 / 768 / 1440 x rtl / ltr x light / dark (12) |
| `preferences/` | `/ar/settings/preferences/appearance` (personal preference tab) | 390 / 1440 x rtl x light / dark (4) |

Names follow `<width>-<rtl|ltr>-<light|dark>.png`. The lab's toolbar matching (`lab/src/shell/Pane.tsx`) only
indexes images at the version root and in `shots/` (`lab/src/core/registry.ts` glob `*/*/{*,shots/*}`), so the
gallery shows the overview shots; `group/` and `preferences/` are reference files to open directly.

## How they were taken

- Full page, theme set through the dashboard's own store (`localStorage['dashboard-settings'].state.theme` and the
  next-themes `theme` key) plus `prefers-color-scheme`; the Next.js dev indicator (`nextjs-portal`) hidden.
- The dashboard scrolls inside its main content pane, not the document, so the viewport height was raised once to
  fit that pane's content at a 900 px tall window. Pages with viewport-based heights
  (`min-h-[calc(100vh-280px)]` on the category page, `xl:h-[calc(100vh-280px)]` on the category list) never fit
  fully: on `group/1440-*` the 33-entry category list is cut at the bottom, as it is on a real screen
  (it scrolls inside its card with a hidden scrollbar).
- Not captured: the floating unsaved-changes bar, the review-changes dialog and the history sheet (they need
  an edit or a click; see components.md for their structure).
