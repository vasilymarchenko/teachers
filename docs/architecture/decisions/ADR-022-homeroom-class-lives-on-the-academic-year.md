---
id: ADR-022
title: The homeroom class is a nullable column of academic_year, matched against className as text
status: accepted
date: 2026-10-01
ticket: T-045
---

## Context

Specification §3.5 and §6.2: the teacher names their own class (the one they
are homeroom teacher of), and in «Мої уроки» their lessons in that class are
highlighted. The class moves up a grade every September — 8-Б becomes 9-Б —
so a name that is right this year is wrong for the last one. `className` on an
`OWN` slot is free text (overview §4), and there is no class entity today.
Overview §7 sketches the class list of specification §9 as a `Student` table
unrelated to the schedule, and the overview §9 row on free-text dictionaries
names that same phase as one where a class may become an entity.

## Options

**A column on `User`.** One value, one place to edit. Costs: the teacher must
change it every September, and from that moment every past year in the
calendar highlights the new class name — which no past lesson carries — so
the highlight silently vanishes from history.

**A column on `AcademicYear`.** Each year keeps its own class; a date finds
its year the way it finds its semester. Costs: the teacher enters it once per
year, and a calendar range that spans two years has to look up two values.

**A class entity** referenced by slots. Exact matching, no spelling issue.
Costs: a table, a screen, and a migration of every stored `className` into
references — the dictionary overview §4 decided against.

## Decision

**`academic_year.homeroom_class_name`, nullable text, entered on `/year`.** It
is optional and not part of the year-setup gate (ADR-018). An `OWN` lesson is
`isInMyClass` when its `className` matches the homeroom class of the year its
date falls in; the flag is computed for rendering, like `isTaughtByMe`, and
never stored. The match is one pure function in `lib/domain` over free text,
tolerant of letter case, whitespace and hyphens.

## Consequences

No relation between a slot and the class exists in the database, so renaming
the homeroom class changes the highlight everywhere in that year at once, and
a misspelt `className` simply is not highlighted.

Revisit if a class ever becomes an entity that schedule slots reference —
for instance when the overview §9 trigger for real dictionaries fires: then
the column becomes a reference to it, and the text match goes.
