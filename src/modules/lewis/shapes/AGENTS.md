# src/modules/lewis/shapes/: the shapes quiz (team lewis)

A part of the Lewis module. A student sees each electron geometry and molecular geometry as a 3D model, then is
quizzed on them until every one is known. `../parts.ts` has the contract a part follows.

## Files
- `state.ts`: what the quiz remembers between screens, and the molecule the board shows. Pure.
- `deck.ts`: the 13 rows, the example molecules, the questions and their choices, and the deck that picks the next row with a seeded random source. Pure.
- `words.ts`: every sentence the quiz shows, as pure functions, and the key terms left plain while a question is open. Learning design reviews it.
- `part.ts`: the part itself: its panel, its controls, and what the board draws for it.
- `shapes.css`: the quiz's CSS. Design reviews it.

## Read first
- `../AGENTS.md`: the Lewis module's rules apply here too.
- `docs/learning/shapes-quiz.md`: what the quiz teaches, the question kinds, the rule for "known", what is saved.
- `../parts.ts`: the contract between the module and a part.

## Rules
- SQ1 Stay in this folder. The module's own files (`../ui.ts`, `../store.ts`, `../guide.ts`, `../scene.ts`) change only through the hooks in `../parts.ts`.
- SQ2 No top-level calls into `../ui.ts` or `../store.ts`: the files import each other.
- SQ3 Every sentence a student reads is in `words.ts`. `tests/shapes-words.test.ts` scans every line and checks every wrong-answer card against the shape table for every row and pick.
- SQ4 While a question is open nothing on screen gives its answer: no angle marks, no readout, no geometry's name in a heading, no switch between the geometries, and no key-term card that states it (`blockedTerms`). Choices are plain text.
- SQ5 The rule for "known" and the deck's order are in `deck.ts` and `docs/learning/shapes-quiz.md`. Change them together, with `tests/shapes.test.ts`. [D-0034]

## Check your work
- `pnpm exec vitest run shapes` while you work.
- `pnpm verify`, then `node scripts/check-shapes.mjs desktop` and `phone` against the served build (`docs/platform/verify.md`).

## Update when you change this
- A new file here: the list above.
- The questions, the rule for "known" or what is saved: `docs/learning/shapes-quiz.md`.
