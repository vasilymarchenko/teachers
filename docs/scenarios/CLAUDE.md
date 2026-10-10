# CLAUDE.md — `docs/scenarios/`

Conventions of the scenario catalogue. These rules apply to every file in this
directory. Why the catalogue exists: `ADR-030`. How it is built and refreshed:
`/teachers-scenarios`.

## What this directory is

What a teacher can do in the application **now**, and what they see at each
step. Not what was intended (`docs/specs/specification.md`), not how it works
(`docs/architecture/**`), not what to do next (`docs/backlog/`).

A behaviour the specification promises and the application does not have is
not a scenario. It is listed in the README under «Задумано, але не збудовано».

## Language

**Ukrainian, for a teacher** — the root `CLAUDE.md`, "Language requirements":
no code identifiers and no untranslated technical words in the prose. Product
terms are the Ukrainian ones in `docs/architecture/glossary.md`.

The only non-Ukrainian text: file names, scenario ids, frontmatter, and the
`trace` comments below.

## Layout

- `README.md` — the index and the catalogue's state. Frontmatter:

  ```yaml
  ---
  base: <sha>          # the main commit the catalogue was last checked against
  updated: YYYY-MM-DD
  next_id: S-NNN       # the next free id
  ---
  ```

  Body, in this order: one paragraph saying where the scenarios were walked
  — a production build with the demo data, the deployed instance, or a
  development server — and on what date; a table `ID | Сценарій | Розділ | Перевірено` with one
  row per scenario; «Задумано, але не збудовано» (what the specification or a
  feature promises, with its section); «Розбіжності» (where a source says one
  thing and the application does another, and what the application does);
  «Відкриті питання» (what the user has not answered yet).
- One file per area of what a teacher wants to do, named in English kebab case
  (`year-setup.md`, `day-changes.md`). The areas are derived from the
  scenarios, not fixed here. Each starts with a one-paragraph Ukrainian
  summary of the area.

## What one scenario is

**One thing the teacher wants to get, from the screen they start on to the
result they see.** Not one form field, and not one screen: two intents that
share a screen are two scenarios, and one intent that crosses screens is one.
Reading counts — looking at the week is a scenario. Signing in counts.

Out of scope: what the person running the deployment does (the account console,
`npm run teacher`), and anything only a developer reaches.

## Scenario format

```markdown
### S-012 · Замінити урок на один день
<!-- trace: spec §5.4 · demo §5.4 · T-011 · app/(app)/(calendar)/calendar/[view]/[date]/lesson/[lessonNumber]/page.tsx · lib/actions/dayOverride.ts -->

**Навіщо:** one sentence, in the teacher's words.
**Перед тим:** what must already be true (the year is set up, a timetable exists).
**Кроки:**
1. Відкриває … — бачить …
2. Змінює … і натискає … — бачить …
**Результат:** what the teacher sees afterwards, and where — the calendar on
which dates, which views.
**Особливі випадки:**
- *Час:* …
- *Неповне або хибне введення:* …
- *Не стосується:* паралельні вкладки, частковий збій.
**Перевірено:** у браузері 2026-10-07
```

- **`trace`** — an HTML comment right under the heading, the one place a path,
  a ticket id or a section number may appear: the sources the scenario was
  taken from and the code it was checked against. A review follows it from the
  scenario to the code. It names every page and every write the scenario goes
  through.
- **Особливі випадки** — five categories, every one considered for every
  scenario: *Час* (dates, midnight, the edges of the year, a semester and a
  break), *Неповне або хибне введення*, *Майбутній стан* (planned, not yet
  begun), *Паралельні вкладки* (two tabs, a stale screen), *Частковий збій*
  (one part fails, the rest does not). The categories that do not apply are
  named on the *Не стосується* line, so a reader can tell "considered" from
  "forgotten". Each case states what the application **does** now, not what it
  should do — and what the **teacher meets**, not what the code holds:
  - a refusal is stated with the input that triggers it, taken from the
    condition in the code, not from the wording of its message; at a date
    boundary, both sides are stated (today is accepted, yesterday is not);
  - where the browser stops the input before the application sees it (a
    required field, a length limit, a web-address field), the case says so
    instead of quoting the application's refusal;
  - a refusal the form gives no way to reach — the field is not shown in that
    state — is not a case at all.
- **Перевірено** — one of three:
  - `у браузері <date>` — walked through in a running application on that date;
  - `у коді` — read from the pages, the validation and the tests, not run;
  - `лише в документах` — taken from the specification or the demo scenario
    with the code not settling it. It goes with an entry in «Відкриті питання».

  When the main path was walked and some steps were not, the label is
  `у браузері <date>` and each step not walked ends with «(у браузері не
  пройдено)». **The same holds for every edge case:** the label speaks for the
  steps and for the cases that were tried, and a case taken from the code and
  not tried in the browser ends with «(у браузері не пройдено)». Without it, a
  reader takes the case as walked.

## Ids

`S-NNN`, taken from `next_id` in the README, assigned once and never reused. A
scenario whose behaviour is removed keeps its id and heading, its body replaced
by **Вилучено:** the date, why, and the scenario that replaced it, if any.

## Sources and what each is trusted for

| Source | Trusted for |
|---|---|
| the code — pages, form components, Server Actions, validation, tests | what the application does: it decides |
| a walk through the running application | what the teacher actually meets: it checks the code's reading, word for word |
| `docs/demo-scenario.md` | what was walked through in a browser, on its date |
| a feature layer marked done | what that feature changed |
| `docs/specs/specification.md` | what was intended, where the code is silent |
| `docs/backlog/` tickets marked done | when a behaviour arrived and what it was meant to do |

When a document disagrees with the code, the scenario states what the code does
and the disagreement goes to «Розбіжності» if a teacher would notice it. When
the code does something no document explains and it cannot be told whether
that was meant, it is a question to the user, not a guess.

## Completeness

Every page a teacher can reach and every write a page offers appear in the
`trace` of at least one scenario.

## Feature layers

A feature in `docs/features/<slug>/` describes its scenarios as a layer over
this catalogue: each one either names the `S-NNN` it changes or is a new
scenario with an id taken from `next_id`. While the feature is not done — its
`idea.md` status, `docs/features/CLAUDE.md` — the catalogue does not include it. When it is done, the layer is folded in: changed
scenarios are rewritten in place, new ones added to their area, and their
`trace` names the feature.

## Keeping it current

The README's `base` says how current the catalogue is. A teacher-visible change
that merges without updating its scenarios leaves the catalogue behind `main`
until a refresh run (`/teachers-scenarios`) catches up from `base`.
