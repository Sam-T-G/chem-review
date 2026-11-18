# D-0035: An exercise is the worksheet's row for one molecule, answered part by part with no steps and no hints

- Status: provisional
- Date: 2026-11-17
- Decided by: The build session for package EXERCISE, reading Sam's request of 2026-11-17 below (D-0030)
- Teams: lewis, learning, design

## Context
Sam wrote on 2026-11-17, with five photos of his class worksheet (the lead's record of the whole request quotes all
of it):

> I want to also add an exercise feature that is less guided but has a wider pool of problems. [...] Use the
> following molecules for reference

The worksheet's row for a molecule has
these columns: valence electron count, Lewis structure (does it have resonance?), electron geometry, molecular
geometry, 3D structure with bond angles, bond polarity (ΔEN), net dipole.

How to build it was this session's choice. Options looked at:
- The guided steps with the hints taken out. Turned down: the step rail sets the order, and the worksheet does not.
- One check button for the whole sheet. Turned down: a student filling in one column at a time gets no answer until
  every column is filled, and one wrong column would hide the others' results.
- Each answer judged on the press for picks, and a check button for what is typed. Chosen.

## Decision
- One molecule fills the panel as one sheet, in the worksheet's order, with the worksheet's column names. There is
  no step rail and no Hint button.
- Picks (electron geometry, molecular geometry, bond angle, resonance, polar or nonpolar, the net dipole's
  direction) are judged when pressed. Typed answers (the valence electron total, each ΔEN) have a check button and
  take Enter. The structure is built on the board and judged by "Check the structure".
- A right part is marked and locks. A wrong part gets the three-part card (D-0017) with the wrong idea named. The
  answer comes on the third wrong try, except for the two-way picks (resonance, polar or nonpolar), where the first
  pick is final and the card gives the answer, as in step 6 (L3).
- Two parts wait for others: resonance waits for the structure, and the net dipole waits for the molecular
  geometry and the bond polarity, because it is the bond dipoles added up in that geometry. Every other part can be
  answered in any order, because its answer comes from the engine's finished structure, whatever is on the board.
- Nothing gives a part away before it is answered: the electron counter shows only what is on the board, the strip
  of checks leaves out the electron total until the valence part is right, the 3D shape opens only with both
  geometries right and the finished structure on the board, the angle labels appear only once the angle is right, a
  card never states the answer of another open part, and key terms whose cards would are left plain.
- "Next molecule" is a quiet button until the sheet is done, so a repeated Enter after an answer stays on the sheet
  (review round 1, CODE-2).
- "Next molecule" goes to a molecule finished with a missed part once 3 more molecules are finished, then to the
  next unfinished one in the picker's order. Details and the rule's tests are in `docs/learning/exercises.md`.

## Consequences
- The exercise's own words, checks and rules sit in `src/modules/lewis/exercise/` and reach the module only
  through the part contract (`src/modules/lewis/parts.ts`). No module file changed.
- The queue of molecules that come back is kept in memory: a reload forgets it. The saved list keeps what is
  finished (`ex:` ids). Keeping the queue would need the shell's saved progress to hold more than ids.
- Open for Sam: whether the direction of the net dipole should be drawn on the model, as in step 6, in place of a
  pick (the brief asked for a pick in this version); whether ionic bonds (ΔEN above 2.0) get their own pick.
