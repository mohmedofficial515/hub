# Ask

**Layout idea.** The page must not look like a chatbot, so it has none of a chatbot's parts: no bubbles, no thread, no streaming, no avatar. The search field is the focal point and its button says Search. Results read like citations, with the path and heading first and the excerpt under them. The hand-off sits in its own quiet panel with the exact command, a plain list of what that command does, and the sentence that the answer appears in your terminal, not here.

**Checked against D06 and 05.** 09 §12 agrees with D06: "no generation", and the page only hints at `/hub:ask`. D06 wins and nothing had to change. Hub has no write-back for `ask` in 05 §2.6, so there is no place on this page where an answer could ever appear, and the design relies on that. The placeholder page's old copy ("Questions answered from the docs") contradicted D06 and is gone. The steps in the panel paraphrase the `ask` prompt in 05 §2.6.

## Conflicts for the owner
1. **Multi-word questions: decided by the owner (2026-11-04).** `/hub:ask` is a skill command in the team pack, and it receives the whole question. An MCP prompt would not: the Claude Code docs (code.claude.com/docs/en/mcp, "Execute MCP prompts") split prompt arguments on whitespace. The page text does not change. The plan docs are being updated by the orchestrator.
2. **Endpoint shape.** 09 §12 has `scope=all|docs|cards` and `excerptHtml`. 04 §3.9 has `types`, `includeDocs` and `highlight` / `excerpt`. 04 wins for the port. The URL keeps `scope`, as 09 §11 links to it.

## Deviations from 09 §12
- **Scope is a segment** (All, Docs, Cards), one Tab stop. The placeholder is a keyword example, because a full question over a keyword search promised more than the search does. The error code is `hub.ask.unavailable`.
- **Title stays "Ask the project",** with meta text that says Hub writes no answers. The sidebar word is the shell's "Ask". The owner may prefer "Search" if the word still suggests a chatbot.
- **Marked excerpts are segments,** not `excerptHtml`, so nothing uses `dangerouslySetInnerHTML`.
- **The panel adds "what this command does"** and a link to the tokens page, more than the wireframe's one line. On tablet and phone it shrinks to the command and sits above the results.
- **Search is a client-side stand-in** over the same text the viewer shows, with light Arabic folding and no trigram.
