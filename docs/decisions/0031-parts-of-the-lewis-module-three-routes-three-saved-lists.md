# D-0031: The quiz and the exercises are parts of the Lewis module, each with its own route, home-screen card and saved list

- Status: provisional
- Date: 2026-11-17
- Decided by: Lead (the session that ran the parallel build), on Sam's ask in D-0030
- Teams: lead, lewis, shell, platform

## Context
D-0030 asks for a geometry quiz and for exercises. Both need the Lewis module's 3D board: the quiz shows lifted models, and an exercise has a student build the Lewis structure. Options looked at:

- **Two new modules.** A module may not import another module (`docs/architecture.md`), so each would need its own copy of the board, or the board would first have to move to a shared folder. Turned down for now: the board is 2,600 lines that five packages were about to change at once.
- **Two more modes inside `ui.ts`, `store.ts` and `guide.ts`.** Those files are over 2,000 lines each, and every builder would have edited the same functions. Turned down.
- **Parts.** Chosen.

## Decision
- A part is a mode of the Lewis module that brings its own panel and its own rules for the board. `src/modules/lewis/parts.ts` holds the contract (`Part`) and the list (`PARTS`). The shapes quiz lives in `src/modules/lewis/shapes/` and the exercises in `src/modules/lewis/exercise/`, each a scope with its own `AGENTS.md`, its own words file and its own tests.
- `ui.ts` asks the part of the current mode for each region of the screen and hands it the presses and key strokes it does not know. `store.ts` asks the part's `state.ts` what is on the board and whether it can be edited. A part changes the state with `update()`.
- The module opens in a start mode (`start` in its props). Three routes render the same screen: `/lewis` (guided), `/shapes`, `/exercises`. The home screen has a card for each.
- Each card has its own saved list: `lewis` (unchanged), `shapes`, `exercises`. Inside the module the three are one list, and the prefix of an id says which list it belongs to: none for a guided problem, `shape:` for a row of the shape table, `ex:` for an exercise.
- The four modes are tabs in the module's top bar, so a student can move between them without going back to the home screen.

## Consequences
- The saved key `chem-review:progress:lewis` and what is stored under it do not change. Two keys are new.
- A part's files and the module's own files import each other, so a part must not call into `ui.ts` or `store.ts` while it loads.
- Moving the board to a shared folder, so that a part can become a module of its own, stays possible and is not done (W-011 is the first step).
- A part opens to students by one switch in two places: `OPEN_PARTS` in `src/modules/lewis/parts.ts` (its tab, and whether its route may start in it) and `OPEN` in `src/modules/registry.ts` (its card). On 2026-11-17 Sam asked for the two geometry names to go live first, so the first push has both parts built and closed.
- Waiting for Sam: whether the quiz and the exercises should be cards on the home screen, tabs inside the module, or both (both are built), and the cards' names.
