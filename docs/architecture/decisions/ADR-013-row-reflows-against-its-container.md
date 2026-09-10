---
id: ADR-013
title: A calendar row reflows against its container, not the viewport
status: accepted
date: 2026-09-10
ticket: T-021
---

## Context

`LessonRow` is the one component every calendar view renders a lesson with, and
that sharing is deliberate: Q-002 decided a day-centric calendar, so the week is
seven `DayCard`s and the day view is one of them (overview §10.2).

The row lays the lesson number and its bell times out as a fixed `w-16` (64 px)
column beside the payload. How much is left for the payload depends on the card,
and the card's width is not a function of the viewport alone. The work area is
capped at `max-w-5xl` beside a sidebar, so at `xl` the week's seven columns give
a card about 127 px wide — 95 px of content — and the 64 px column plus the 12 px
gap leaves about 19 px for the subject name. `min-w-0` let the box shrink to it;
nothing made the text follow, so the text painted over the neighbouring day:
«Інформатика» +57 px, «Математика» +52 px, «Алгебра» +22 px at a 1400 px
viewport (T-021).

`lg`'s four columns are 135 px of content, narrow for the same reason, and the
**widest** card of all, at 320 px, is the phone-width week view, where the grid
is one column and the row has the full screen. A viewport breakpoint therefore
does not even order the cases correctly.

There is no DOM test environment in this project. `vitest.config.mts` runs the
unit suite in `node`, and says why the `components` entry is there at all: for
convention tests over the source — the navigation menu's links against the real
routes — «not for rendering React, which would need a DOM environment this
project does not carry».

## Options

**A breakpoint on the row.** `xl:` variants inside `LessonRow`, or a `compact`
prop the week view passes. It reads as the obvious fix and it is wrong about the
thing that matters: the row would compact at `xl` in the day view, where the card
is a thousand pixels wide, and stay wide at 320 px, where the criterion says it
must not change. A prop is worse than a variant, because it cannot be
breakpoint-conditional at all — the week view is narrow only from `lg` up.

**Shrink the left column for everyone.** Drop `w-16`, or set the times in
`text-xs`. One rule, no container queries, and it pays for the week view with the
day view — the screen the teacher spends the day on — by making the number and
time of every lesson smaller everywhere. The ticket rules it out directly: the
fix constrains the payload side rather than dropping the left column.

**Wrap harder and leave the geometry alone.** `break-words` on the payload and
nothing else. It removes the overflow — `min-content` becomes one character — and
at 19 px it spells «Інформатика» down eleven lines. The overflow criterion
passes and the readability criterion does not.

**A container query.** `DayLessons` declares the container and the row reflows
below a threshold: the number and its bell times become one wrapping line above
the payload, which then gets the card's whole width. Costs a containment context
per day rendered and a threshold that has to be kept in one place, and it is the
only option whose input is the quantity that actually decides the layout.

**A browser test for the constraint**, Playwright against the running app, which
is what the ticket's first criterion is written in terms of —
`documentElement.scrollWidth`, bounding rects. It would measure the real thing.
It also costs the project its first browser-test dependency, a seeded database in
CI for the page to render from, and a second kind of suite in a gate that
currently runs one; and what it would catch — a layout that overflows in a
browser — is reachable here from three source properties instead.

## Decision

The container query, with the threshold and every class it needs in
`components/calendar/lessonRowLayout.ts`.

Every list that renders a `LessonRow` carries the container — `DayLessons` and
the lesson editor of T-011 alike — and `LessonRow` reflows below `14rem`
(224 px): the row stops being a side-by-side flex, the 64 px column becomes an
auto-width wrapping line whose two bell times stay together as one wrap item,
joined by a dash, and the payload keeps `min-w-0` with `break-words` so no
single long token can leave the box at any width. `break-words` sits on the
container as well, where it is inherited by the card's other free text — an
event title, a note, the name of a non-teaching period — none of which is inside
a lesson row and each of which is one long teacher-typed token away from the
same overflow. The threshold is the width below which the side-by-side form stops
working — 64 px of column, 12 px of gap and the 97 px «Інформатика» measures
beside them is 173 px — rounded up to the next size with room for the «заміна»
badge on the same line.

The enforcement is `components/calendar/lessonRowLayout.test.ts`, a convention
test over the source in the shape `lib/auth/queryDiscipline.test.ts` uses. It
pins the properties the absence of the overflow rests on: one threshold rather
than two, the container opened by **every** file that renders the row — without
which every `@max-[…]` variant is inert there while the source still looks
right — the bell times held together as one wrap item, and a payload that can
wrap. The list of renderers is taken from the repository at test time rather
than written down, because a written list is a list that goes stale the first
time a screen draws a lesson. No browser test and no new dependency.

## Consequences

The row's layout is decided by the box it is in, so a future view may put a day
in any width without being consulted: the month view's phone list and the day
view get the wide form because they are wide, and `T-013`'s printed page will get
whichever form its column width implies. The week grid's breakpoints — `md:2`,
`lg:4`, `xl:7` — become free to change, which is the other half of the defect:
T-007 chose seven columns and the row never learnt.

The cost is that the guarantee is checked one step away from the thing it is
about. The test proves the source has the properties; it does not measure a
rendered page, and a Tailwind upgrade that stopped generating `@max-[14rem]:`
utilities would leave it green. Against that: the classes are literals in one
module, and the production build is where an un-generated utility shows up.

**Revisit if** a second component needs the same reflow — the template editor's
`CLASS` cells are the candidate named in overview §10.2 — in which case the
threshold belongs in the theme as a named container size rather than in a
calendar module. And revisit the browser test the moment CI acquires a seeded
database for any other reason: the criterion is written in bounding rects, and
measuring them would then be cheap.
