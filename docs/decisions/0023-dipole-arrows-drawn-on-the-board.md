# D-0023: A student drags each bond's dipole arrow from one atom to the other, then drags the net dipole out of the middle atom

- Status: provisional
- Date: 2026-11-16
- Decided by: The build session, reading D-0022
- Teams: learning, lewis, chem

## Context
D-0022 asks for a part of the polar segment where a student draws a line and is assessed on where the dipole points. It does not say which lines, or how they are judged. The build session looked at these options:

- A free line anywhere on the board, matched to the nearest bond. Turned down: a line that misses the atoms has to be guessed at, and a wrong guess reads as a wrong answer.
- Drawing only the bond dipoles. Turned down: the course's method ends with the net dipole, and "where the dipole goes towards" covers the molecule's dipole as much as a bond's.
- Drawing every bond's arrow one by one. Turned down: sulfur hexafluoride would need six arrows that all say the same thing.

## Decision
The build session's choices, for Sam to confirm:

- **A bond's dipole.** For each kind of bond the student presses on one of its two atoms, drags to the other and lets go. The arrow points at the atom where the student let go, and that is the answer "this bond is polar and this atom is δ−". A button, "Nonpolar, no arrow", is the answer for a bond with no dipole. These replace the three buttons D-0021 built. One right arrow answers every bond of that kind, and the board then draws the arrow on each of them.
- **The net dipole.** The polar-or-nonpolar question stays as D-0021 built it, with the first pick final. For a polar molecule one more question follows: the student presses on the middle atom of the 3D model and drags the way the bond arrows add up. Only the direction is judged, and an arrow within 35° of the net dipole as it appears on screen is right. The step is finished when that arrow is right, and the board shows the net dipole only then.
- **Seen end-on.** When less than 45% of the net dipole lies across the screen, no direction on screen can be right. The app does not count that try, says so, and turns the model. The model also turns to a side view when the question opens, and stops turning by itself until the arrow is right.
- **A wrong arrow** stays on the board in the color for mistakes until the next arrow is started, and the card names what it does: it points at the δ+ atom, it sits on a nonpolar bond, it points against the bond arrows, or it follows one bond where several add up. The answer comes on the third miss, as in D-0017.
- **Without a drag.** A tap on each atom draws the same bond arrow, and so does Enter on each atom's keyboard target. For the net dipole, the left and right arrow keys turn an arrow on the middle atom 15° at a time and Enter sets it.
- A bond's arrow can be drawn on the flat drawing or on the 3D model. The net dipole is drawn on the 3D model only, because the flat drawing does not have the real angles.

## Consequences
- A wrong arrow between two atoms that are not the bond in question is refused with a message and costs no try.
- The 35°, the 45% and the 15° are the build session's numbers. Nobody has tried them with a student or on a real phone (W-003).
- The direction is judged in `src/modules/lewis/guide.ts` (`judgeNetArrow`) from `netAsSeen` in `src/chem/polarity.ts`, which adds the bond dipoles the way the viewer sees them. The board only reports the gesture.
- Carried by `src/modules/lewis/scene.ts` (the gesture and the arrows), `src/modules/lewis/store.ts` (`drawBondArrow`, `drawNetArrow`), the step 6 section of `src/modules/lewis/guide.ts`, `tests/guide.test.ts`, `tests/store.test.ts`, `tests/polarity.test.ts`, and the step 6 part of `scripts/check-browser.mjs`, which draws every arrow with real mouse, touch and key events.
