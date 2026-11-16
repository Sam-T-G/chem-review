# D-0021: Polarity and bonding are two more steps on each guided molecule, worked the way Sam's course slides work them

- Status: provisional
- Date: 2026-11-13
- Decided by: Lead (the build session), reading Sam's request below
- Teams: learning, lewis, chem

## Context
Sam asked:

> lets add features to identify dipoles and other relevant molecular concepts, refer to the chapter 8 and chapter 7 slides i have in my downloads folder

The slides are his Chem 1A lecture slides for chapters 7 and 8 (summer 2026, on Interactive General Chemistry, Macmillan Learning): `Lecture+Chapter+7+Su26.pdf` with 86 slides and `Lecture+Chapter+8+Su26.pdf` with 33. The build session found them in his Documents folder. They are not in the repo.

His words ask for the features and name the source. They do not say where the features go. The build session looked at three places:

- A separate module for polarity. Turned down: a student would have to build the molecule again, and polarity depends on the shape that the Lewis module has just found.
- Rows of facts in the table at the end of the shape step, with no questions. Turned down: D-0006 asks for a guided sequence, and D-0012 asks for a wrong assumption to be explained, which needs a question to answer.
- Two more steps on the same molecule, after the shape. Chosen.

## Decision
The build session's choices, for Sam to confirm:

- Step 6, Polar. For each kind of bond the student says whether the bond is polar and which atom is δ−. Then one question about the whole molecule: polar or nonpolar. The board draws an arrow on each polar bond and, for a polar molecule, the net dipole on the 3D model.
- Step 7, Orbitals. The student counts the sigma and pi bonds, then picks the hybridization of the middle atom. A molecule counts as finished after this step, where before it was finished after the shape.
- The chemistry in these two steps follows the slides: their rounded electronegativity table, a nonpolar bond at a difference of 0.4 or less, a polar bond up to 2.0, a dipole arrow that points at the more electronegative atom, and bond dipoles that cancel only when the same atoms sit evenly around the middle atom. `docs/chemistry/sources.md` has the details.
- An ion is asked whether its bond dipoles cancel. The app does not call an ion polar or nonpolar.
- The whole-molecule question has two answers, so the first pick is final and the card gives the right answer at once. This is a second exception to "the answer comes last" in D-0017, beside the shape name.
- Left out: molecular orbital theory, lattice energy and bond enthalpy, which the same slides cover. They are different activities and would be modules of their own.

## Consequences
- D-0007's five steps stay as they are and two come after them, so the guided flow has seven steps. D-0007 is provisional as well, and both wait for Sam.
- A molecule saved as finished before this change stays finished.
- Free build shows polarity, the sigma and pi counts and the hybridization as rows of its table, and draws no arrows.
- Carried by `src/chem/polarity.ts`, `src/chem/orbitals.ts`, the step 6 and step 7 sections of `src/modules/lewis/guide.ts`, `tests/polarity.test.ts`, and the step 6 and 7 parts of `scripts/check-browser.mjs`.
