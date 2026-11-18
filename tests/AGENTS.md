# tests/: unit tests (team platform, with each test file owned by the team it tests)

Vitest, in plain Node. The suite covers the engine, the Lewis module's guide and store, and the repo's own structure
checks. None of it touches React, React Native or Three.js.

## Files
- `assess.test.ts`, `layout.test.ts`, `problems.test.ts`, `solve.test.ts`, `structure.test.ts`, `vsepr.test.ts`: the engine. Team chem.
- `exercises.test.ts`: the exercise pool and its sets, every exercise's answers worked by hand, the electron geometry on every problem, molecules of two atoms, and a middle atom the electron count leaves short. Team chem.
- `polarity.test.ts`: bond and molecular polarity, sigma and pi bonds, hybridization, with the course slides' worked examples as the expected answers. Team chem.
- `guide.test.ts`: the guide's step rules and wording, including the scan of every sentence. Team lewis, reviewed by learning.
- `store.test.ts`: the step flow in the Lewis module's store. Team lewis.
- `terms.test.ts`: the key terms: which words are highlighted, what each card says, and that a card's example is never the molecule on screen. Team lewis, reviewed by learning and chem.
- `exercise.test.ts`: the exercises: each part's answer worked by hand, the checks, the locks, the reset on a board change, the next-molecule rule and what is saved. Team lewis.
- `exercise-words.test.ts`: every sentence the exercises can show, scanned, and that no card gives an answer away early. Team lewis, reviewed by learning.
- `exercise-terms.test.ts`: which key terms open a card on an exercise. Team lewis, reviewed by learning.
- `exercise-pool.ts`: shared by the exercise tests: the 20 worksheet molecules and 8 of two atoms, with their answers worked by hand.
- `shapes.test.ts`: the shapes quiz's 13 rows, example molecules, choices and deck, with the shape table written by hand from OpenStax 2e, 7.6. Team lewis, reviewed by chem.
- `shapes-words.test.ts`: the shapes quiz's wording scan, every wrong-answer card against the table, and the key-term cards that can open during a question. Team lewis, reviewed by learning.
- `repo.test.ts`: the repo checks, against made-up repos in a temp folder. Team platform.
- `helpers.ts`: shared by the test files. It builds structures with the same moves the app offers.

## Read first
- `docs/platform/verify.md`: the checks, in the order you run them, and what each proves.

## Rules
- TS1 Write the failing test before the fix.
- TS2 Never delete, skip or loosen a test so that the suite passes. If a test is wrong, say why in your handoff entry and name the owning team as reviewer.
- TS3 An expected answer in an engine test is written from the textbook, never copied from what the code returns. [D-0004]
- TS4 Build structures through `helpers.ts`, with the moves the app offers, so a test cannot reach a state a student cannot.
- TS5 Teams run their own tests by file name (`pnpm exec vitest run guide store`). Keep one subject per file.
- TS6 Tests run in plain Node. Anything that needs a browser is checked by `scripts/check-browser.mjs`.
- TS7 A test file also follows the rules of the team that owns it. `pnpm who <path>` prints them.

## Check your work
- `pnpm exec vitest run <name>` for one file, `pnpm test` for all of them, `pnpm verify` before you call it done.

## Update when you change this
- A new test file: the list above, its owner in `docs/ownership.json`, and that team's "check" command there if the name is new.
- A change in what the suite covers: an entry in `docs/verified.md`.
