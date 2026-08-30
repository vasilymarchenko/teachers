---
id: T-019
type: ticket
title: Make the architecture's invariants findable in the document
status: todo
depends_on: [T-017]
refs:
  - docs/architecture/architect-overview.md §3
  - docs/architecture/architect-overview.md §8
  - docs/architecture/decisions/ADR-001-review-reads-the-documents.md
---

## Goal

Make it possible to tell, from `architect-overview.md` alone, which of its
statements are rules that code can violate and which are the reasoning around
them — so that a reader who has to check code against the document does not have
to infer the difference.

## Acceptance criteria

- [ ] Every statement in `architect-overview.md` that code can violate is
      identifiable as such, by a convention the document applies consistently and
      states once.
- [ ] The convention adds no new copy of any rule: it marks the sentence where
      it already stands. A list of invariants collected elsewhere in the same
      document is not an acceptable answer.
- [ ] The document still reads as prose to someone reading it for understanding
      rather than for checking — §9 and §10 keep their present form.
- [ ] Ukrainian prose with English identifiers verbatim, as the rest of the
      document (root `CLAUDE.md`).
- [ ] `docs/architecture/glossary.md` and `docs/architecture/design/**` are left
      alone unless the convention demands otherwise; if it does, the ticket says
      why.

## Notes

The cost `ADR-001` accepted: the reviewer reads the documents at review time, so
review quality now depends on those documents distinguishing rule from
rationale. §3.2's invariants are already labelled `I1`–`I3` and are the model to
follow; §8.4 and §8.5 state rules in running prose that a reader has to
recognise as normative.

Not urgent, and deliberately not attempted inside T-017: it changes the primary
architecture document, which is the user's to shape, and it is worth doing after
a few real reviews have shown which statements reviewers actually miss.
