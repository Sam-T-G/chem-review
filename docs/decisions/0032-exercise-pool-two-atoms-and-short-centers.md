# D-0032: The exercise pool holds 43 molecules in six sets, every problem names its electron geometry, and a middle atom the electron count leaves short is finished short

- Status: provisional
- Date: 2026-11-17
- Decided by: the chem build session (package CHEM), reading Sam's ask of 2026-11-17 (D-0030, quoted below). Sam has not confirmed it.
- Teams: chem, learning, lewis

## Context
Sam wrote on 2026-11-17:

> I want to also add an exercise feature that is less guided but has a wider pool of problems. then I want to also incorporate particularly differentiating between electron and molecular geometry, along with all of the appropriate applications through the entire app stack to make way for this. Use the following molecules for reference [five photos of a class worksheet] . finally lets expand the feature to also enable 3d models for molecules that do not have a center element. [...]

The engine had 3 placeholder
exercises, no electron geometry on a problem, and two open questions that the worksheet raises:

- CH3+ has 6 valence electrons. Three C–H bonds use all 6, and hydrogen cannot take a double bond, so carbon can
  only reach 6. `assess` called carbon short, so a correct drawing could never pass. Options: leave CH3+ out of the
  pool; accept any middle atom that the best drawing leaves short; or accept it only when it has no unshared
  electrons left. The second would also pass CH2 (carbon with a lone pair at 6), which is what a half-built CH4 looks
  like, so a student halfway through would be told they were done.
- A molecule of two atoms has no middle atom, but a problem has to name one. With iodine named in IF, `assess`
  let iodine hold 10 (the room a guided middle atom gets while its outer atoms are still being bonded), so I=F was
  sent back for its formal charges; with fluorine named, the same drawing was sent back for iodine being over-full.

## Decision
- `EXERCISES` holds 43 molecules, each once, listed set by set. `EXERCISE_SETS` has six sets: `sheet` (the 20
  worksheet molecules in the sheet's order; H2O, BF3, PCl5, SF6, CO3 2− and XeF4 are the guided problems' own
  objects), `two-atoms` (HF, HCl, HBr, F2, Cl2, Br2, N2, O2; IF is in the sheet), `single-bonds`, `double-bonds`,
  `ions` and `not-eight`. CO is left out: its drawing (C≡O with −1 on carbon) puts the negative charge on the less
  electronegative atom, against a rule in OpenStax 7.4, and no source page that was read shows it.
- `Problem.geometry` is required and holds the electron geometry. `ElectronGeometry` and `MolecularGeometry` are
  aliases in `vsepr.ts` for `Geometry` and `ShapeName`. In this run no module reads `p.geometry` (RUN.md contract).
- A two-atom molecule is linear in both geometries with no bond angle, whichever atom is named its center. The
  counts in `ShapeInfo` describe the atom that is not hydrogen, or else the less electronegative one. A named atom
  of a two-atom molecule gets no room past 8, so I=F is over-full on iodine either way.
- A middle atom is finished short when the best drawing for the species (or, in free build, for the atoms and
  charge on the board) leaves it short, it holds exactly that many electrons, and none of them are unshared
  (`shortCenter` in `src/chem/assess.ts`). CH3+ passes with carbon at 6. CH2 with a lone pair is still short. In
  free build, where the charge is read off the board, the middle atom must also be at exactly 6 (two short of 8)
  with a formal charge of at most +1, so a middle atom with its unshared electrons taken off (OH2 4+, CH2 2+,
  NH2 3+, BH2+, BeH+) is still short. With a target species the rule is as above (fix round 1, 2026-11-17).
- `hasResonance` is true when the app's convention (D-0005) finds more than one best drawing with the same bonds
  and charges. Under that convention SO2 and SO3 have one drawing each, so the app says they have no resonance.

## Consequences
- Every exercise's answers (electron count, drawing, both geometries, bond angle text, ΔEN of each bond, polar or
  not, resonance) are worked by hand in `tests/exercises.test.ts`, with the sources listed in
  `docs/chemistry/sources.md` ("The exercise pool").
- Two answers rest on how the app already applies the course's rules and want Sam's eye: CH3− comes out nonpolar
  (C–H is 0.4, nonpolar on the course table, so there are no dipoles to add), and PH2− comes out nonpolar (P–H is
  0.0; the slides' formal-charge rule for ΔEN 0 is for ozone, two atoms of one element, so it does not apply). See
  the known gaps.
- The app answers linear for both geometries of a two-atom molecule because it has no middle atom. A course that
  treats one atom as the middle atom would answer tetrahedral for IF's electron geometry (4 groups on iodine).
  [TBD: Sam's instructor's key settles it.]
- Code that compares an atom's count with its target to call it short (instead of reading `AtomReport.status` or
  the issues) will still call carbon in CH3+ short.
- Names and set titles are the session's wording, not yet read by learning.
