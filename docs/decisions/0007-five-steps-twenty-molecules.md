# D-0007: Five steps, twenty guided molecules, a free build mode, and bonding by dragging one atom onto another

- Status: provisional
- Date: 2026-11-12
- Decided by: Lead (the build session), reading D-0006
- Teams: learning, lewis

## Context
D-0006 asks for a guided sequence. It does not name the steps or the problems. The build session chose them so there was something to try. Sam has used the result. He has not said yes or no to the step split, the problem list, its order, the free build mode, or the drag gesture.

## Decision
- Five steps: Count (the valence electrons of each atom, then the total), Place (answer which atom goes in the middle, then put the atoms on the board), Bond (drag each outer atom onto the middle atom), Check (every atom's electron count, the total, the formal charges), Shape (count the electron groups, commit to a shape, watch the drawing lift into 3D).
- Twenty guided molecules in five groups, in this order: single bonds; double and triple bonds; ions; fewer or more than 8 electrons; expanded octets with double bonds. The list is in `src/chem/problems.ts`.
- A bond is made by dragging one atom onto another. Bonding from the keyboard works as well.
- A free build mode: the same board with 18 atoms and no set problem.

## Consequences
- This is in the build and stays until Sam says otherwise. Work inside these steps can go on. Anyone who wants to change the steps, the list or the gesture asks him first.
- `docs/learning/guided-steps.md` describes the steps as built.
