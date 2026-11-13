# D-0004: The chemistry engine is plain TypeScript, and every rule is tested against the textbook

- Status: accepted
- Date: 2026-11-12
- Decided by: Lead (the build session)
- Teams: chem

## Context
A practice app that teaches a wrong rule does harm. The chemistry also has to be usable by every module and quick to test.

Sam's standing rule for words on screen, from his earlier physics sims, is that a screen carries no citations. That rule is in his own notes outside this repo, so it is not quoted here.

## Decision
- The engine in `src/chem/` is plain TypeScript. It imports nothing from React, the DOM, Three.js or any package.
- Every rule has a test whose expected answer is written from the textbook, never from what the code returns.
- The source is OpenStax Chemistry 2e (sections 7.3, 7.4 and 7.6 when this was decided; `docs/chemistry/sources.md` has the current list). Element data is generated from Valence's validated periodic-table data.
- The app never prints a number it did not get from a cited source. The citations live in `docs/chemistry/sources.md`, in code comments and in tests, and never on screen.

## Consequences
- The engine's tests run in plain Node in milliseconds.
- `pnpm check:repo` fails any import of a package, or of another folder, from `src/chem/`.
- A new chemistry fact needs its source and its test in the same change.
