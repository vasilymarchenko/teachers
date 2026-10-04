# Year setup shows the way out

**Ticket:** `docs/backlog/T-041-year-setup-shows-the-way-out.md`
**Status:** authoritative for T-041 and matches what was built (PR #50); the
expected screens in §4 are what `T-048`'s browser test asserts.

Rationale lives in `docs/architecture/architect-overview.md` §8.6. This document
adds no reasoning: it states the item → section mapping, the states of the bar
at the bottom of `/year`, and what the teacher sees after each save of a first
setup.

## 1. Modules

| File | What it holds |
|---|---|
| `components/year/setup-steps.ts` | `SETUP_ANCHORS`; `setupSteps(status, academicYearId)` — the four items, in page order, each with `label`, `done`, `href`; `nextSetupStep(steps)` — the first item not done, or `null`. Pure. |
| `components/year/setup-checklist.tsx` | The checklist at the top of the page, built from `setupSteps()`. A missing item's label is `<a href="#…">`; a done item is text. |
| `components/year/setup-progress.tsx` | `SetupProgress` (client) — the sticky bar; `rememberRender()` — its one piece of state, render by render; `progressNotice()` — which notice it shows; `CompletionNotice`. |
| `components/year/section.tsx` | `Section` takes an optional `id`, rendered on the `<section>` with `scroll-mt-4`. |
| `components/year/labels.ts` | `SETUP_PROGRESS` — every word of the bar. |
| `app/(app)/(schedule)/year/page.tsx` | Computes `nextSetupStep(setupSteps(setup, selected?.id ?? null))` and renders `<SetupProgress renderId={randomUUID()}>` as the page's last child, outside every condition. |

`getSetupStatus()`, `requireCompleteSetup()`, the `(app)` layout and
`navItemsFor()` are unchanged (T-038).

## 2. Items and the section each links to

| Key (`SETUP_GATE.items`) | `done` when | `href` |
|---|---|---|
| `academicYear` | the selected year is in `status.years` | `#year-bounds` |
| `initialParity` | that year's `hasInitialAnchor` | `#year-bounds` |
| `semesters` | that year's `hasBothSemesters` | `#semesters`; `#year-bounds` while no year is selected — the semesters' section is not rendered without one |
| `bellSchedule` | `status.hasBellSchedule` | `#bells` |

The selected year is `pickYear()`'s, the one whose forms are on screen.

| Anchor (`SETUP_ANCHORS`) | Carried by |
|---|---|
| `year-bounds` | the «Межі навчального року» `Section` in `page.tsx` |
| `semesters` | `SemestersSection` |
| `bells` | `BellsSection` |

## 3. The bar's states

`page.tsx` passes `renderId = randomUUID()`, drawn anew on every server render
of `/year` — a save's revalidation and every navigation to it alike.

`SetupProgress({ complete, next, renderId })` keeps one piece of state,
`ProgressMemory = { complete, completedIn }`, starting at
`{ complete, completedIn: null }` on mount. Each render applies
`rememberRender(memory, { complete, renderId })`: when `complete` changed from
false to true, `completedIn` becomes this `renderId`; when it changed back,
`completedIn` is `null`; otherwise the memory is unchanged. `completedHere` is
`completedIn === renderId`.

Mount alone is not a visit boundary. The router keys the page without its search
parameters (`createRouterCacheKey(…, true)` in Next's `layout-router`), so the
menu's link to `/year` on `/year` and a `YearSwitcher` change re-render the
component without remounting it. The new `renderId` of that render is what ends
the notice.

| `complete` | `completedHere` | `next` | `progressNotice()` | Shown |
|---|---|---|---|---|
| false | — | an item | `"next"` | «Наступний крок: *label*» and «Перейти» → `next.href` |
| false | — | `null` | `null` | nothing |
| true | true | — | `"complete"` | `CompletionNotice`: «Навчальний рік налаштовано», the text, **«Заповнити розклад» → `/schedule`** (`Button size="lg"`), «Перейти до календаря» → `/calendar` |
| true | false | — | `null` | nothing — the ordinary screen: opened complete, or any render after the completing one (opened again, another year selected, another save) |

The wrapper is `sticky bottom-4 z-10`, `role="status"`, `aria-live="polite"`,
and is rendered in every state so that the live region exists before its content
changes.

## 4. A first setup, save by save

A teacher with no rows, on `/year` at any width. "Menu" is `navItemsFor()`.

| After | Checklist | Bar | Menu |
|---|---|---|---|
| opening the page | all four «ще бракує»; all four are links (`#year-bounds` ×3, `#bells`) | «Наступний крок: Перший і останній день навчального року» | «Навчальний рік» only |
| saving the year with its initial parity («Додати» in «Межі навчального року») | first two «є»; «Обидва семестри» → `#semesters`, «Розклад дзвінків…» → `#bells` | «Наступний крок: Обидва семестри», «Перейти» → `#semesters` | «Навчальний рік» only |
| saving semester 1 | unchanged | unchanged | unchanged |
| saving semester 2 | first three «є»; «Розклад дзвінків…» → `#bells` | «Наступний крок: Розклад дзвінків — хоча б для одного уроку», «Перейти» → `#bells` | «Навчальний рік» only |
| saving the bell schedule | gone | `CompletionNotice` | all four items |
| opening `/year` again | gone | nothing | all four items |

The same holds for any order of the three saves: whichever save makes `complete`
true is answered with `CompletionNotice`.

## 5. Tests

`components/year/setup-steps.test.ts` covers §2 and the "next" column of §4.
`components/year/setup-progress.test.ts` covers `progressNotice()` over §3,
`rememberRender()` folded over the renders of one mount, each with its own id (a
first setup; opened complete and left so; opened complete, reopened by a
deletion, completed again; completed, then opened again on the same route),
the server-rendered bar in its "next" and ordinary states, `CompletionNotice`'s
two links in order, and the checklist's links. The unit suite has no DOM, so the
transition from "next" to "complete" across a real save is not exercised there;
that walk is `T-048`.
