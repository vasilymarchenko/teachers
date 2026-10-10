---
id: T-065
type: ticket
title: Information event — a last day before its date is refused in Ukrainian, not «Invalid input»
status: todo
depends_on: [T-012]
refs:
  - docs/specs/specification.md §8
  - docs/specs/specification.md §6.3
  - docs/architecture/architect-overview.md §8.2
  - docs/architecture/design/T-012-events.md
  - docs/scenarios/events.md
  - docs/scenarios/README.md
  - docs/scenarios/CLAUDE.md
---

## Goal

When a teacher adds or edits an information event and gives it a «Останній
день» earlier than its «Дата», the form shows «Дата завершення не може бути
раніша за дату початку» under «Останній день» — the message
`lib/validation/event.ts` names — and not zod's default «Invalid input», which
is what the running application shows today (S-023, S-025). The year,
semester and non-teaching-period forms, which share the rule, keep showing the
same message, and a test pins the information-event message under the same
module loading the production bundle has.

## Acceptance criteria

- [ ] Adding an information event with «Дата» 2026-10-20 and «Останній день»
      2026-10-18 saves nothing and shows «Дата завершення не може бути раніша
      за дату початку» under «Останній день». The same holds when an existing
      information event is edited to those dates.
- [ ] Both are seen in a browser on a production build
      (`npm run build && npm run start`), not only under `next dev` or in a
      unit test.
- [ ] The year, semester and non-teaching-period forms show the same message
      for an end date earlier than the start date, as they do now.
- [ ] A test that fails on `main` as of this ticket's filing: it loads every
      schema under `lib/validation/` before parsing, the way the server bundle
      does, and asserts the information-event refusal carries the message.
- [ ] After every schema under `lib/validation/` is loaded, `DATE_RANGE_RULE`
      in `lib/validation/fields.ts` still holds its `message`. No object a
      schema passes to zod is changed by that call in a way another schema
      can see.
- [ ] In `docs/scenarios/events.md`, the S-023 edge case states the Ukrainian
      message and is walked in a browser (its «(у браузері не пройдено)» is
      not added). S-025's reference to it holds. The S-023 row is removed from
      «Розбіжності» in `docs/scenarios/README.md`.
- [ ] `npm run gate` passes.

## Notes

- Found on 2026-10-10, in the review of PR 59, by walking the scenario
  catalogue on the deployed instance.
- Cause, reproduced in a unit test on 2026-10-10. zod 4 normalises the params
  object of `.refine(fn, params)` in place, turning `message` into `error`.
  `academicYear.ts`, `semester.ts` and `nonTeachingPeriod.ts` pass the shared
  `DATE_RANGE_RULE` to `.refine`. By the time `event.ts` spreads that object
  into `ctx.addIssue({ code: "custom", ...DATE_RANGE_RULE })`, it has no
  `message`, and zod reports its default. `event.test.ts` imports only
  `event.ts`, so it passes. Importing `academicYear.ts` first gives
  `{"error":"Дата завершення…","message":"Invalid input"}`.
