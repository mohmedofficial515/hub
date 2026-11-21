# Docs

**Layout idea.** The job is reading, so the page gives the column to the text: a sticky tree at the start, the document in the middle, and its outline at the end from 1280 px. The page drops the app's 1100 px limit to make room. A doc keeps its own direction, so an English doc stays LTR inside the Arabic UI while everything around it mirrors. With no doc open, the reading pane lists what changed recently.

**Markdown** goes through `kit/markdown.tsx`, built on `marked.lexer` and rendered as app elements, with no raw HTML: anchored headings, framed tables, code with copy, read-only task lists, relative links that resolve to Hub when the target is indexed. The Redesign sheet's review modal uses it too.

## Deviations from 09 §11
- **The doc lives in `?doc=KEY&anchor=`, not `/docs/[key]`.** The router's fourth segment means "open the sheet". The real route is a path. The sheet links to the viewer.
- **Mock content:** seven docs carry a sample condensed from the real text, with some details invented (21 in English and Arabic, 18, 15, ADR 0005, dashboard api-integration README, hub 05). The rest carry one opening sentence. The viewer says so in a small line.
- **Mermaid** shows as a code block. Client-side rendering is not in the lab.
- **Images** show their alt text only, the spec's offline case.
- **`DocSection` reads its outline from the doc's text,** not `doc.headings`, so the sheet and the viewer always agree. GTV-180's catalogue headings were placeholders.

## Mock additions
62 doc cards joined the catalogue through `docCards`, using free keys in `GTV-100`–`119` and `GTV-134`–`179`. File names are the real ones. They carry no events, so they do not flood the timeline. Five status reports dated after 2026-09-21 have invented names.

## Review answered (2026-11-04)
- The stale marker in the tree is now a word with a `title` that explains it, not a lone dot. Recent rows hide the repeated type word (`hideType`). The error code is `hub.docs.unavailable`.
- The `title` is a hover hint. The tree row's word is what a keyboard or touch user gets.
