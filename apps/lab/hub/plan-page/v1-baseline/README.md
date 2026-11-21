---
version: v1-baseline
title: Current plan page (from code)
status: reference
base:
created: 2026-11-18
tokens: inherit
touches-components: []
ported:
---

# Baseline: today's plan page, described from code

Hub answers at http://127.0.0.1:7300 but every page needs a signed-in member, and this session has no sign-in it may use, so there are
no screenshots. The page is described from `apps/web/src/components/planning/detail.tsx` and `detail-parts.tsx` (read 2026-11-18). The
shots in `apps/web/src/components/planning/shots/` are of the Planning lists, not of this page.

## Layout at 1440 (Arabic, RTL)

```
 ← Planning / GTV-472                                                    [⋯]
┌ Hero ─────────────────────────────────────────────────────────────────────┐
│ [route tile] Plan · GTV-472 · Draft · P1 · Mine                [Live]     │
│ Title (text-title)                                                        │
│ Created by Owner · 2 h ago · updated 1 h ago                              │
│ ▬▬▬▬ draft ▬▬▬▬ in review ▬▬▬▬ approved ▬▬▬▬ in progress ▬▬▬▬ done         │ stage track
│ (compass) one sentence on what comes next for this status                 │
│ ───────────────────────────────────────────────────────────────────────── │
│ [Send for review][Create tasks][Abandon]   ✦ Claude [Develop][Run next][Explain] │
└───────────────────────────────────────────────────────────────────────────┘
 [The plan] [Comments 1] [History] [Links 17]
┌ Steps ───────────────── 0 of 50 ┐  ┌ Progress ─────────┐
│ ① step 1 ……………… owner  [Next]   │  │ 0 / 50  ▬▬▬▬▬▬▬▬  │
│ │                               │  │ 50 without a task │
│ ② step 2 ……………… owner           │  ├ Outline ──────────┤
│ │  … 48 more, one flat list …   │  │ قرارات المالك      │
│ ㊿ step 50 ……………… frontend       │  │ ما وجدناه          │
├ Approach ──────────────── [Edit]┤  │ المراحل            │
│ Markdown body; images → alt text│  ├ Details ──────────┤
├ Evidence · Runs · Revisions ────┤  │ Priority · Role · Tags │
└─────────────────────────────────┘  └───────────────────┘
```

At 390 the side column drops below the tabs and the hero's buttons wrap.

## What it shows well
- One filled button (the status action), the stage track in words, the next step marked in words, steps that slide in live.
- The Claude actions (Develop, Run the next step, Explain).

## What is missing (the brief)
1. **Phases.** Steps carry no phase; the 9 phases exist only as a numbered list in the body, so the page cannot group or measure them.
2. **Images.** `common/markdown.tsx:150-156` renders `![alt](src)` as `<em>alt</em>`.
3. **Linked ideas.** 15 `relates` links to ideas live only in the Links tab, unordered, no priority grouping.
4. **Sources.** No field. Here: the research folder path and Hub source in the body, the showcase link in a comment.
5. **Decisions.** A Markdown table in the body.

See `components.md` for the component inventory.
