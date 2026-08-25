---
id: Q-005
type: question
title: Student contact structure — one contact or several with roles
status: open
depends_on: []
refs:
  - docs/architecture/architect-overview.md §10.5
  - docs/specs/specification.md §12.2
  - docs/specs/specification.md §9
---

## Question

Does a `Student` carry one primary contact, or several (mother, father,
grandmother) each with a role?

## Current default

None — `Student` belongs to the second phase and does not exist yet. The
specification already warns that several will be needed, so `Student` is to be
designed so contacts can move into their own table.

## Cost of changing later

One migration, "single field → separate table", against an empty or nearly empty
students table.

## Needed from

The teacher, before the class-list work starts. No effect on the MVP; there is
no ticket for it yet, and none is expected before the second phase.
