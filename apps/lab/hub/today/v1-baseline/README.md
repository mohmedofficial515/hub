---
version: v1-baseline
title: Spec wireframe (no real page yet)
status: reference
base:
created: 2026-11-04
tokens: inherit
touches-components: []
ported:
---

# Baseline = the specification

Hub is not built yet, so there is no page to screenshot. The baseline is the wireframe and rules in
`F:/Goteav/project-hub/docs/09-pages.md` §4, the brief sections in `07-notifications-and-digests.md`
§6.1 and the token set in `08-ux-and-design.md` §3 (loaded by `lab/src/styles/hub.css`).

```
┌ Today · Tuesday 4 Nov ───────────────────────────────────────────── [Refresh] ┐
│ ┌ Narrative (only if saved) ──────────────────────────────────────────────┐   │
│ └─────────────────────────────────────────────────────────────────────────┘   │
│ ┌ Awaiting me (4) ──────────────┐ ┌ Deadlines (2) ───────────────────────┐   │
│ └───────────────────────────────┘ ├ Sessions without summary (1) ────────┤   │
│ ┌ Ready for my roles (6) ───────┐ ├ Since your last visit (12) ──────────┤   │
│ └───────────────────────────────┘ └──────────────────────────────────────┘   │
│ Counters strip: open decisions 3 · pending handoffs 2 · needs 1 · my tasks 2  │
└───────────────────────────────────────────────────────────────────────────────┘
```

Owner additions for the redesign (2026-11-04): team stats (weekly totals with deltas, per-member
activity and focus, card flow by type) and capture source health.
