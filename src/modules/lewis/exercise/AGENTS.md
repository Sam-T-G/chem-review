# src/modules/lewis/exercise/: the exercises (team lewis)

A part of the Lewis module. A student works a molecule from a wider pool without the guided steps. `../parts.ts`
has the contract a part follows.

## Files
- `state.ts`: what the exercises remember between screens, the checks of each part, the locks, the reset on a board change and the next-molecule rule. Pure.
- `sheet.ts`: each part's answer for a molecule, worked out by the engine from `referenceStructure(p)`, and the picks offered. Pure.
- `words.ts`: every sentence a student reads in the exercises, and what each wrong answer is taken for. Pure. `tests/exercise-words.test.ts` scans every line.
- `terms.ts`: which key terms stay plain on an exercise, so no card gives away a part that is still open (L10). Pure.
- `part.ts`: the part itself: its panel, its controls, and what the board draws for it.
- `exercise.css`: the exercises' CSS. Design reviews it.

## Read first
- `../AGENTS.md`: the Lewis module's rules apply here too.
- `../parts.ts`: the contract between the module and a part.

## Rules
- EX1 Stay in this folder. The module's own files (`../ui.ts`, `../store.ts`, `../guide.ts`, `../scene.ts`) change only through the hooks in `../parts.ts`.
- EX2 No top-level calls into `../ui.ts` or `../store.ts`: the files import each other.
- EX3 Every sentence a student reads is in `words.ts`. A card for one part never states the answer of another part that is still open (`known` in `words.ts`); `tests/exercise-words.test.ts` checks every card for every molecule.
- EX4 Answers come from the engine (`sheet.ts`), never from `p.geometry` or `p.shape`. For a molecule of two atoms, never print a group count or say "the middle atom" of it.
- EX5 How the exercises work, what is held back and what is saved: `docs/learning/exercises.md`. [D-0035]

## Check your work
- `pnpm exec vitest run exercise` while you work.
- `pnpm verify`, then `node scripts/check-exercise.mjs desktop` and `phone` against the served build (`docs/platform/verify.md`).

## Update when you change this
- A new file here: the list above.
- A part, a rule for checking, what is held back or the next-molecule rule: `docs/learning/exercises.md`.
