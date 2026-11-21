---
name: ask
description: Answer a question about the project using Hub as the only source, with citations.
user-invocable: true
argument-hint: '<question>'
---

Answer my question using Hub as the only source.

1. `hub.search_docs` with the question and one or two rephrasings. Try English and Arabic keywords.
2. `hub.get_doc` for the best one to three results, using `section` to keep it small. `hub.list_cards(q=…)` for related decisions, tasks and needs.
3. Answer in my language with citations in the form (path § heading) or card keys. Quote exact values, such as names, limits and error codes, rather than paraphrasing them.
4. If Hub does not answer it, say so clearly and offer to open a decision with `hub.request_decision`.

Question: $ARGUMENTS

Never send a secret, token or password to Hub, in any field.
