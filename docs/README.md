# Docs map

Every kind of knowledge about this repo has one home. Put a thing in its home and link to it from anywhere else. A second copy stops getting updated and ends up wrong.

## Get up to speed

- **New to the repo:** read `AGENTS.md` at the root, the newest entries in `HANDOFF.md`, then the "Now" table in [roadmap.md](roadmap.md).
- **About to change a file or folder:** run `pnpm who <path>`. It prints the team that owns the path, its reviewers, the rule files that apply, the docs for that area, the fast check, and the decisions that bind that team.
- **Wondering why something is the way it is:** the [decision index](decisions/README.md).

## What goes where

| You have | It goes in | Who keeps it | How it changes |
|---|---|---|---|
| A choice between options, or something Sam said that sets direction | A new record in [decisions/](decisions/README.md), from the [template](decisions/template.md) | Whoever made the choice. The lead keeps the index | Append only. An accepted record is never rewritten |
| How a part works or looks today | The living spec for its area (next table) | The area's team | Rewritten in place, in the same change as the code |
| A rule to follow inside one folder | That folder's `AGENTS.md` | The folder's team | One rule at a time, with its reason |
| Who owns a path, who reviews it, what may import what | [ownership.json](ownership.json), explained in [org.md](org.md) and [architecture.md](architecture.md) | Lead | In the change that adds the path |
| Work that is planned, open or blocked | [roadmap.md](roadmap.md) | The lead orders it. Any team adds items | Edited in place |
| What you did this session and what is half done | `HANDOFF.md` at the root | Everyone | A new entry on top, with every change |
| Proof that something was checked | [verified.md](verified.md) | platform | A new dated entry with the command |
| Something that went wrong | [mistakes.md](mistakes.md) | Everyone | A new entry, before the fix |
| How a change is made: branches, worktrees, review, merge | `CONTRIBUTING.md` at the root | Lead | Edited in place |

## Living specs

| Doc | What it holds | Team |
|---|---|---|
| [org.md](org.md) | The teams, who decides what, who reviews what, when to go up a level | lead |
| [architecture.md](architecture.md) | The parts, what each may import, and the contracts between them | lead |
| [chemistry/sources.md](chemistry/sources.md) | Where every chemistry rule and number comes from, the conventions, the known gaps | chem |
| [learning/guided-steps.md](learning/guided-steps.md) | The seven steps, the problem list, hints, the rules for words | learning |
| [learning/wrong-answers.md](learning/wrong-answers.md) | What each wrong answer is taken for, and what the student is told | learning |
| [learning/exercises.md](learning/exercises.md) | The exercises: the parts of the sheet, what is held back, the next-molecule rule, what is saved | learning |
| [learning/shapes-quiz.md](learning/shapes-quiz.md) | The shapes quiz: the series, the question kinds, the rule for "known", what is saved | learning |
| [design/look-and-motion.md](design/look-and-motion.md) | The palette, the type, the atoms' faces, what moves and when | design |
| [platform/verify.md](platform/verify.md) | Every check, what it proves, and what each failure code means | platform |
| [platform/expo.md](platform/expo.md) | Rules for Expo, pnpm and builds | platform |

The rules for writing docs are in `docs/AGENTS.md`.
