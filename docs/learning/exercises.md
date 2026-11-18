# The exercises

How an exercise works (D-0035, provisional). Sam's ask is D-0030. The
code is in `src/modules/lewis/exercise/`, opened at `/exercises` or from the Exercises tab of the Lewis module.

## One molecule, one sheet

A student works one molecule from the pool (`EXERCISES` and `EXERCISE_SETS` in `src/chem/exercises.ts`) the way
the class worksheet row asks. The panel shows the formula, the name and the parts, in the worksheet's order and
under its column names. There is no step rail and no Hint button.

| Part | How it is answered | What counts as right |
|---|---|---|
| Valence electrons | A number in a box, then "Check the total" or Enter | `totalElectrons(p)` |
| Lewis structure | Built on the board with the free build gestures, then "Check the structure" | `assess(s, speciesOf(p)).complete` |
| Resonance (inside Lewis structure) | Yes or No, once the structure is right | `hasResonance(p)` |
| Electron geometry | One of the five names | the engine's `ShapeInfo.geometry` for `referenceStructure(p)` |
| Molecular geometry | One of four names (`shapeChoices`) | `ShapeInfo.shape` |
| Bond angle | One of five angle texts from the shape table, "No bond angle" among them. An angle two bonds of the molecule really make (`alsoAngles`: 180° across a trigonal bipyramid or an octahedron, 90° or 120° alone in a trigonal bipyramid) is never offered as a wrong pick | the table's angle, or no angle for 2 atoms |
| Bond polarity | For each kind of bond: ΔEN typed and checked, then Polar or Nonpolar | ΔEN from the course table; polar when the bond has a dipole |
| Net dipole | Polar or nonpolar (for an ion: the dipoles cancel or not), then for a polar one which way it points | `moleculePolarity` on the finished structure |

The geometry, angle and polarity parts take their answers from the engine's finished structure, so a student can
answer them before building anything. Two parts wait for others, and say so in a plain line until then: resonance
waits for the structure, and the net dipole waits for Molecular geometry and Bond polarity.

The direction picks are built from the molecule: toward or away from the atoms of one element ("toward the 3
chlorine atoms"), toward or away from the lone pairs, and along a single bond of a polar kind that has several (a
nonpolar bond has no dipole to follow, and the pick is left out when any bond of that kind lies within 45° of the net
dipole, since "along 1 bond" does not say which bond: ICl3, ICl5 and ClF5, where the net dipole runs along one bond). Picks that point the same way are merged, and the right one is the closest
to the net dipole (within 35°, every other pick at least 45° away). The net dipole is the bond dipoles added up and
lone pairs add nothing to it (`docs/chemistry/sources.md`), so the accepted pick is always worded by the atoms: for
water, the hydronium ion and the amide ion it is "Away from the 2 hydrogen atoms", and the answer line and the
finished row add where the arrow passes, as the class worksheet does ("away from the 2 hydrogen atoms, through the
oxygen atom"). A lone pair pick stays only as a wrong one ("toward the lone pair" for PCl3). When the middle atom's
element is also an outer atom (ozone), the label says "the 2 outer oxygen atoms". A square pyramid (ICl5, ClF5) and a T-shape (ICl3)
have their other dipoles cancel in pairs, so the right pick names the 1 atom the net dipole points at ("toward the
chlorine atom across from the lone pair", "toward the chlorine atom in the flat triangle with the 2 lone pairs"),
with "toward 1 of the 4 chlorine atoms in the square" (or "of the 2 across from each other") as a wrong pick. A bond
to hydrogen is written with hydrogen first (H–Cl). For 2 atoms the picks are "from A
toward B" and "from B toward A".

A molecule of two atoms has no middle atom: both geometries are linear and the right bond angle is "No bond angle".
The words never print a group count for it and never say "the middle atom" of it.

## Checking

- A right part is marked with a check and locks.
- A wrong part gets the three-part card (what the answer is, why it does not answer the question, the question
  handed back) with the wrong idea named. The answer comes on the third wrong try (L3).
- Resonance and polar or nonpolar have two answers, so the first pick is final and a wrong one gets the answer in
  its card, as step 6 does. A wrong pick still counts as a missed part.
- The same wrong pick twice in a row, an empty box, and a check of a board with atoms missing or loose are not
  tries.
- The wrong ideas each part names are listed in `src/modules/lewis/exercise/words.ts`: the valence total uses the
  guide's `totalCoach`; the structure names the first problem `assess` finds (atoms missing or loose, another atom
  in the middle, too many or too few electrons, a shell short or over, an unpaired electron, formal charges that can
  be smaller); the geometries name a count of only the bonded atoms, shared pairs counted as groups, the electron
  geometry given as the molecular geometry, lone pairs left out, the flat drawing's square planar; the angle names
  the angle without lone pairs, a squeeze with no lone pairs, the flat 90°, "no bond angle" on a molecule with a
  middle atom; ΔEN names the two values added, the subtraction the wrong way round, one atom's value, and ΔEN times
  the number of bonds; the direction names the opposite way and a single bond.
- Where a card hands back lone pairs to place, it says where they go: with 5 electron groups in the places of the
  flat triangle around the middle atom, with 2 lone pairs on 6 groups on opposite sides (OpenStax 7.6). Ozone's
  middle atom is "the middle oxygen atom" on every card.
- A card for one part never states the answer of another part that is still open. A wrong idea that cannot be
  named without that (the electron geometry inside a molecular geometry card) waits until the other part is
  answered, and the card falls back to a plainer one. `tests/exercise-words.test.ts` checks every card for every
  molecule the tests know.

## What is held back

- The electron counter over the board shows what is on the board, never the total the molecule needs.
- The strip of checks judges the board as free build does (one molecule, full shells, formal charges) until the
  valence total is right. Then it shows the electron total too.
- The 3D shape opens only once both geometries are right and the finished structure is on the board. The bond
  angle labels appear on the model only once the bond angle is right.
- Key terms: the module opens a card with no molecule outside the guided steps, so `src/modules/lewis/exercise/terms.ts`
  leaves a term plain when its card would draw the molecule, use an atom from one of its columns, show a molecule
  with the same electron or molecular geometry or angle, or work a bond the molecule has, while the part it gives
  away is still open. Each card is judged on its own: the part hands the same set to the module as
  `blockedTerms`, and the module never opens a blocked card and takes links to blocked cards out of every card it
  opens. `tests/exercise-terms.test.ts` holds every molecule and every set of open parts to that. With every part
  open, water has 12 of the 41 terms live (none before round 1, when a card that linked to a blocked card was
  blocked too). For a molecule of 2 atoms the net dipole is its 1 bond dipole, so while the net dipole is open a card
  that draws or names a bond from the same 2 columns (H–Cl on HBr), or says which atom a dipole points at, stays
  plain. While Bond polarity is open, a card that gives a ΔEN of 0 or talks about a bond of 2 atoms of one element
  stays plain on a molecule with such a bond (F2, N2, O3). `tests/exercise-terms.test.ts` also checks every live card
  against facts written by hand for each of the 43 molecules (its geometries, angle, ΔEN values and dipole).

## The finished sheet

When the last part is answered the model lifts into 3D, the full row is shown as a table at the top of the sheet,
the atoms hop and paper flies (`Part.done`), and the molecule is saved as `ex:<id>` (the `exercises` list on the
home screen). A board change that breaks a right structure takes the structure back to open; every other part is
about the molecule and stays.

## The next molecule

"Next molecule" is always there, so a student can skip. It is a quiet button until the sheet is done and the main
button after: when an answer takes its control off the sheet, the module moves the focus to the main button, so a
second Enter on a main "Next molecule" would skip the molecule and empty its sheet. While it is quiet the focus
waits on the sheet, where Enter does nothing. Picking the molecule already on screen in the picker closes the
picker and keeps the sheet. It opens, in this order (`nextAt` in
`src/modules/lewis/exercise/state.ts`, tested in `tests/exercise.test.ts`):

1. a molecule that was finished with a missed part, once 3 more molecules have been finished since;
2. the next molecule in the picker's order (the sets in order) that is not finished;
3. a molecule with a missed part, before its turn, when every molecule is finished;
4. the next molecule in order.

A molecule finished with every part right on the first try leaves the queue. Changing molecule, by "Next molecule"
or the picker, empties the board and that molecule's answers. The queue is kept in memory, so a reload forgets it;
the finished list is saved.

The exercises open on the first molecule of the picker, even when it is finished. `openingExercise(st, solved)`
in `state.ts` (tested) picks the first unfinished one while the sheet is untouched, but the saved list reaches the
module after it starts (`store.mergeSolved`), so the call belongs in `store.ts`, which this folder does not own: it
waits for the lead (review round 1, CODE-6).

## Checks

- `pnpm exec vitest run exercise`: the answers worked by hand for the 20 worksheet molecules and 8 of two atoms
  (`tests/exercise-pool.ts`), the checks, locks and resets, the next-molecule rule, saved ids, the wording scan, and
  the key terms.
- `node scripts/check-exercise.mjs desktop` and `phone`: one molecule worked with real input, a wrong answer per
  part, the locks, the finished sheet, the next molecule, a reload and the keyboard, with the picker on the molecule
  already on screen and a second Enter after the total.
