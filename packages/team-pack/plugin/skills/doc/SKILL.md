---
name: doc
description: Develop a project document with no duplicates and nothing invented, saved through Hub with its earlier text kept. Use to improve a doc, document a task, or find gaps between the docs and the cards and code.
user-invocable: true
argument-hint: '<improve DOC-KEY | document CARD-KEY | gaps | topic>'
---

Work on this document request: $ARGUMENTS

Say which project is active. Read its language and audience rules first: `hub.get_project_brief`, and the folder's `CLAUDE.md`. Write the way those say.

At the start and end of each stage below, call `hub.report_stage` with `protocol: "doc"`, the stage, and `state`: `started`, then `done` or `failed`. A panel shows these as a checklist on this turn. Elsewhere they cost nothing.

## 1. Search (`search`)

`hub.search_docs` with several wordings, then `hub.get_doc` for each likely match. Note each one's `Version:` line. Never start a new document before searching.

For "gaps": compare what cards (`hub.list_cards`) and the code mention against what the docs cover, and answer with a list of what is missing and where each point was mentioned. Save nothing unless I then ask.

## 2. Propose (`propose`)

Say: update an existing document or write a new one, which, and why. A new one must not repeat an existing one. Wait for my answer unless I already said which.

## 3. Draft (`draft`)

Write the text. Show it as a diff against the current text, or in full if it is new.

**Nothing invented.** Check each claim against the project: the code, cards or an existing document. A claim you cannot verify is flagged, like this: `> Unverified: <the claim>, and what would settle it`. It is never written as fact.

## 4. Save (`save`)

Only when I agree, call `hub.save_doc`:

- An existing document: `key`, the whole new `content`, and `baseHash` from the `Version:` line you read.
- A new one: `source`, `path` and `content`.
- `reason`: one line on why.

`save_doc` keeps the earlier text as a revision and commits nothing. In the panel it pauses for my approval.

If it refuses because the version moved, read the document again, redo the diff against the new text, and ask again. Never overwrite what you did not see. If it warns that a similar document exists, show me that warning.

## 5. Link (`link`)

Link the document to its related cards with `hub.link_cards`, and tell me the document's key and what the save changed. A Git commit stays a separate step that I ask for.

`hub.list_doc_revisions` and `hub.restore_doc_revision` bring an earlier text back.

Never send a secret, token or password to Hub, in any field.
