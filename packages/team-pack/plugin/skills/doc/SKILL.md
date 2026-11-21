---
name: doc
description: Develop a project document with no duplicates and nothing invented, proposed as a draft with its claims flagged, then saved through Hub with its earlier text kept. Use to improve a doc, document a task, or find gaps between the docs and the cards and code.
user-invocable: true
argument-hint: '<improve DOC-KEY | document CARD-KEY | gaps | topic>'
---

Work on this document request: $ARGUMENTS

Say which project is active. Read its language and audience rules first: `hub.get_project_brief`, and the folder's `CLAUDE.md`. Write the way those say.

At the start and end of each stage below, call `hub.report_stage` with `protocol: "doc"`, the stage, and `state`: `started`, then `done` or `failed`. A panel shows these as a checklist on this turn. Elsewhere they cost nothing.

## 1. Search (`search`)

`hub.search_docs` with several wordings, then `hub.get_doc` for each likely match. Note each one's `Version:` line. Never start a new document before searching.

For "gaps": compare what cards (`hub.list_cards`) and the code mention against what the docs cover, and answer with a list of what is missing, where each point was mentioned, and what you did not read. Save nothing unless I then ask.

## 2. Propose (`propose`)

Decide: update an existing document, or write a new one. A new one must not repeat an existing one. Unless I already said which, ask me with `AskUserQuestion` and wait.

## 3. Draft (`draft`)

Write the whole text, then call `hub.propose_doc`:

- `doc` and `baseVersion` from the `Version:` line for an existing document, or `source` and `path` for a new one.
- `title`, and `reason`: one line on why.
- `draft`: the whole new text.
- `claims`: **Nothing invented.** Check each factual claim against the project: the code, cards or an existing document. List what you checked as `verified`, with its `source`. A claim you cannot verify is `unverified`: its `text` must appear in the draft word for word, and it is never presented as settled.

Hub answers with real similar documents, each with its link. Tell me about them. If one covers this topic, stop and ask before going on.

## 4. Save (`save`)

Call `hub.save_doc` with the `draft` id it gave you.

- **In the panel** it pauses. I see a diff, answer each flag, may edit the text, and press Save. What I chose is what gets saved. If I refuse with a note, redraft with `hub.propose_doc`, keeping my answers where the claim's words did not change.
- **Anywhere else**, show me the draft and each flag, wait for my answer, then pass it in `answers`: `confirm`, `remove` or `keep_flagged` for each flag's id.

`save_doc` refuses while a flag has no answer, and if the version moved. If the version moved, read the document again, redo the draft and ask again. Never overwrite what you did not see. A refused save was not saved: say so.

It keeps the earlier text as a revision and commits nothing.

## 5. Link (`link`)

Link the document to its related cards with `hub.link_cards`, and tell me the document's key and what the save changed. A Git commit stays a separate step that I ask for.

`hub.list_doc_revisions` and `hub.restore_doc_revision` bring an earlier text back.

Never send a secret, token or password to Hub, in any field.
