# CLAUDE.md — `docs/features/`

Conventions of feature descriptions. These rules apply to every file in this
directory. Why features are described here and not in the specification:
`ADR-030`. How an idea is written: `/teachers-idea`.

## What this directory is

One directory per feature: what a new piece of the application is meant to give
a teacher, agreed with the user **before** it is designed or built. Not what the
application does now (`docs/scenarios/`), not how it will work
(`docs/architecture/**`), not the work to build it (`docs/backlog/`).

A feature directory holds:

- `idea.md` — the idea, agreed through the interview `/teachers-idea` runs;
- `scenarios.md` — the feature's scenarios, a layer over `docs/scenarios/`
  (`docs/scenarios/CLAUDE.md`, «Feature layers»). Its format arrives with the
  skill mode that writes it.

## Slug

The directory name: English kebab case, two or three words naming what the
teacher gets, not how it is built — `universal-import`, not `llm-parser`. It is
chosen in the interview and fixed once `idea.md` is agreed: tickets, ADRs and
the catalogue's `trace` comments link to it.

## Language

**Ukrainian, for a teacher** — the root `CLAUDE.md`, "Language requirements".
No code identifiers, no file paths, no ticket or ADR ids in the prose. Product
terms are the Ukrainian ones in `docs/architecture/glossary.md`, including its
section of feature terms (below).

The only text that is not Ukrainian prose: the slug, the frontmatter, scenario
ids `S-NNN` (they are teacher-readable headings of the catalogue), HTML
comments, and the raw idea, which is kept in whatever language it was given.

**The audience test.** A word may appear if a teacher would need it to say what
the application does for them. If swapping it for another library, service or
technique would change nothing the teacher sees, it is a word about how the
feature is built and belongs to the design, not here — «розпізнати фразу»
passes; the name of a model, a parser or a table fails. Numbers about the
system (seconds, sizes, limits) fail too, unless a teacher meets them as such.

## `idea.md`

### Frontmatter

```yaml
---
feature: universal-import   # the slug
status: agreed              # agreed | done
agreed: YYYY-MM-DD          # the day the user confirmed the text
updated: YYYY-MM-DD         # the last confirmed change
base: <sha>                 # the origin/main commit the interview read
---
```

- `agreed` — the only state a written `idea.md` starts in: the file is written
  after the user confirms its text and never before, so there is no draft
  state in the repository.
- `done` — the feature is built. It is set in the pull request that delivers
  the last of the feature's scenarios, and it is what `docs/scenarios/CLAUDE.md`
  and `/teachers-scenarios` read as «a feature layer marked done».

Being built is not a status of its own: it is read from the backlog. Every
ticket that builds part of a feature names `docs/features/<slug>/` in its
`refs:`, and a feature is being built while one of those tickets is not done.

### Sections

Every sentence rests on the user's answers and on the current documents —
never on `docs/specs/specification.md`, which is the idea the product started
from (`ADR-030`); views have moved since.

In this order, with these headings:

1. **Сира ідея** — the user's words as they first gave them, verbatim, as a
   quote. Never edited afterwards, including typos and language: it is the
   baseline the rest is measured against.
2. **Проблема** — what the teacher cannot do now, or does at a cost, in terms of
   the catalogue scenarios it concerns. No solution in this section.
3. **Ідея** — the idea as the interview agreed it, then two lists:
   - «Що змінюється» — each item names the catalogue scenarios it changes
     (`S-NNN`), or says it is a new intent;
   - «Що не змінюється» — what the teacher keeps exactly as now, stated as
     strongly as the changes: these are the promises a design must not break.

   When the feature arrives in parts, a third list «У якому порядку» gives the
   order in which a teacher meets them. Only an order a teacher can see goes
   here; technical layers belong to the design.
4. **Що вчитель отримає** — criteria a teacher can check in the application:
   each one is an action and what the teacher sees after it.
5. **Межі** — what the feature deliberately does not do.
6. **Відкинуті шляхи** — the simpler or different paths considered in the
   interview, each with the reason it was rejected, in the user's words.
7. **Ризики** — how the feature could fail the teacher: what triggers it and
   what the teacher meets. Found by a reviewer that saw the idea and not the
   interview, and kept by the user — or named by the user in the interview.
   A risk the user dropped is not in the list: it goes, with the user's
   reason, into one HTML comment at the end of the section, so that a later
   review does not raise it again.
8. **Відкриті питання** — what the interview did not settle (below).

A section with nothing in it says so in one line («Немає.»); it is not dropped.

### Skeleton

The file starts with §1 after the frontmatter; there is no title heading.

```markdown
## 1. Сира ідея

> the user's words, verbatim

## 2. Проблема

Prose.

## 3. Ідея

Prose.

**Що змінюється**
- S-016 · Поставити інший урок на одну дату — what changes in it.
- Новий намір: what the teacher can now do.

**Що не змінюється**
- S-NNN · its title — what stays exactly as now.

**У якому порядку**  <!-- only when the feature arrives in parts -->
1. …

## 4. Що вчитель отримає

- The action — what the teacher sees after it.

## 5. Межі

- What the feature does not do.

## 6. Відкинуті шляхи

- The path — why it was rejected, in the user's words.

## 7. Ризики

- What triggers it — what the teacher meets.

<!-- відкинуто:
- the risk — the user's reason.
-->

## 8. Відкриті питання

- The question? What each answer would change.
- A question a ticket waits on. <!-- Q-NNN -->
```

The `<!-- Q-NNN -->` comment is never there when the idea is agreed; it is
added later, as «Open questions» says.

### Word budget

The body — without the frontmatter, the raw idea and the HTML comments — stays
within **1200 words**. An idea that does not fit is usually two features.
When the user splits one off, its §1 is the whole raw idea of the one it came
from, verbatim, followed by `<!-- split from <slug> -->`; its §3 says which
part of that raw idea it takes.

## Open questions

An open question lives in `idea.md` §8, in Ukrainian, with what each answer
would change. It becomes a backlog question only when a ticket has to wait on
it, so not while the idea is agreed — there is no ticket yet. Whoever writes a
ticket that builds part of the feature reads §8: for a question that ticket
waits on, they file a `Q-NNN` under `docs/backlog/CLAUDE.md`, put it in the
ticket's `depends_on`, and add its id in an HTML comment after the question —
`<!-- Q-NNN -->`, a direct change to `idea.md`. An answer is a change
to what was agreed, and goes the way «Changes after agreement» says: the answer
goes into the section it decides, the question leaves §8, and the `Q-NNN`, if
there was one, is closed by the backlog's rules.

## New product terms

A word the idea introduces for the teacher, which the glossary does not have,
is confirmed in the interview — the word and one sentence of meaning — and
added to `docs/architecture/glossary.md` §9 with no identifier and the feature's
slug. The design that names it in code fills the identifier and moves the row
to its section. A term is never used in `idea.md` before it is in the glossary.

## Changes after agreement

- **Сира ідея** never changes.
- A change to §3, §4 or §5 changes what was agreed, and so does an answer to
  an open question, wherever it lands. It goes through `/teachers-idea` on the
  same slug, which interviews only the change and asks for confirmation again;
  `updated` moves, `agreed` does not. A `done` idea may be revised too: what
  it now promises is not built, so its status goes back to `agreed`. What the
  catalogue already holds from it stays there as current behaviour; only the
  revision waits to be folded in (`docs/scenarios/CLAUDE.md`, «Feature
  layers»).
- Before the idea is merged, a change to §3, §4 or §5 on its branch — one a
  review asks for, say — goes through `/teachers-idea` on that branch the
  same way.
- A correction that changes no meaning — a typo, a wrong scenario id — is a
  direct change.
