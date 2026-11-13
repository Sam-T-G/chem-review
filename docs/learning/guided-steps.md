# The guided steps

How a guided problem teaches, as built. The direction is Sam's (D-0006). The step split, the problem list, the free build mode and the drag gesture are the build session's reading of it and wait for his yes (D-0007).

## What Sam asked for (2026-11-12)

> First and foremost I want to GUIDE students to building proper sequential knowledge on how to properly tackle the problems, starting with being able to identify number of electrons, drawing individual dot structures, making connections, double bonds, etc. the idea is to also have an orchestrated experience where the app visually guides them into being able to see what is going on and how their actions impact any given configuration.

## The five steps

A student works one molecule in five steps on a 3D board:

1. **Count** the valence electrons of each atom, then the total (the charge of an ion included).
2. **Place** the atoms on the board, after answering which atom goes in the middle.
3. **Bond** each outer atom to the middle atom by dragging one atom onto the other.
4. **Check** every atom's electron count, the electron total, and the formal charges.
5. **Shape**: count the electron groups, commit to a shape, then watch the flat drawing lift into 3D.

The board shows the effect of every action as it happens. Free build is the same board with 18 atoms and no set problem.

## The problems

Twenty molecules in five groups, in teaching order. The list, and the shape each finished molecule has, are in `src/chem/problems.ts`. A test checks each shape against the engine.

| Group | Molecules |
|---|---|
| Single bonds | CH4, NH3, H2O |
| Double and triple bonds | CO2, CH2O, HCN |
| Ions | NH4+, NO2−, CO3 2− |
| Fewer or more than 8 electrons | BF3, PCl5, SF4, ClF3, XeF2, SF6, BrF5, XeF4 |
| Expanded octets with double bonds | SO2, SO4 2−, PO4 3− |

Every guided problem has one middle atom.

## Hints

- A hint is always a move the board accepts. `nextMove()` in `src/modules/lewis/guide.ts` tries the move before suggesting it.
- One test solves all twenty problems using only the hints the app gives, and another checks that every hinted move is one the board accepts.

## Words

- Every sentence a student reads is in `src/modules/lewis/guide.ts`, written as pure functions of the problem and the board so the wording can be tested.
- The words are plain and literal. They name the atom instead of saying "it", say what to do, never cite a source, and never describe the interface. The rules are DOC7 in `docs/AGENTS.md`. Sam's full voice file is on his own machine.
- `tests/guide.test.ts` scans every sentence for banned phrasing.
- What the app says when an answer is wrong has its own doc: [wrong-answers.md](wrong-answers.md).
