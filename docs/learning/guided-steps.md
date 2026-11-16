# The guided steps

How a guided problem teaches, as built. The direction is Sam's (D-0006). The step split, the problem list, the free build mode and the drag gesture are the build session's reading of it and wait for his yes (D-0007). Steps 6 and 7 came from his request for dipoles and the concepts in his chapter 7 and 8 slides, and putting them here as steps waits for his yes too (D-0021). He asked for the dipoles to be drawn (D-0022). How they are drawn is the build session's design and waits for his yes (D-0023). He asked for questions to be noticeable, for the app to show how to work the board, for the checks to stay on screen (D-0024), and for one-move controls and a clearer dipole drawing (D-0025). How those are built waits for his yes too (D-0026).

## What Sam asked for (2026-11-12)

> First and foremost I want to GUIDE students to building proper sequential knowledge on how to properly tackle the problems, starting with being able to identify number of electrons, drawing individual dot structures, making connections, double bonds, etc. the idea is to also have an orchestrated experience where the app visually guides them into being able to see what is going on and how their actions impact any given configuration.

## The seven steps

A student works one molecule in seven steps on a 3D board:

1. **Count** the valence electrons of each atom, then the total (the charge of an ion included).
2. **Place** the atoms on the board, after answering which atom goes in the middle.
3. **Bond** each outer atom to the middle atom by dragging one atom onto the other.
4. **Check** every atom's electron count, the electron total, and the formal charges.
5. **Shape**: count the electron groups, commit to a shape, then watch the flat drawing lift into 3D.
6. **Polar**: for each kind of bond, draw the bond's dipole arrow on the board, or press "Nonpolar, no arrow". Then say whether the molecule is polar. For a polar molecule, draw its net dipole on the 3D model. The atoms' electronegativities from the course's table are on screen. An ion is asked whether its bond dipoles cancel, and an ion whose dipoles do not cancel has its net dipole drawn too.
7. **Orbitals**: count the sigma bonds and the pi bonds, then pick the hybridization of the middle atom. The molecule counts as finished after this step, and the panel ends with a table of everything found: shape, electron groups, bond angle, polarity, sigma and pi bonds, hybridization.

Steps 6 and 7 work on the lifted 3D model, and the board cannot be edited in them. A change to the board in an earlier step throws away the answers to steps 5, 6 and 7.

## Where to look next

Sam asked for a glow or a pointing finger where a student's attention should be (D-0024). As built (D-0026):

- At every moment one place is the next action. `cue()` in `src/modules/lewis/store.ts` names it: a question in the panel, an atom in the row under the board, atoms on the board, or the button that leads on.
- That place glows. On a desktop a pointing hand also points at a question from the left edge of the panel.
- On the board the hand acts out the drag the step needs, until the student has tried it once: an atom from the row onto the board (the first atom only), an outer atom onto the middle atom (until the first bond), a bond's dipole arrow (until the first try), the net dipole (until the first try).
- The hand never shows an answer. A bond's question has three answers, so the two atoms and the "Nonpolar, no arrow" button all glow, and the hand takes the answers in turn: the arrow one way, the arrow the other way, the button. It drags the net dipole to each aim point in turn.
- In the count step the glow is on the first counter still at 0, then on "Check my counts". A counter that was checked wrong gets the glow back until it is changed.
- In the check step the glow is on the list of checks. It does not point at the atom to fix: the Hint button does that in words.

## How to work the board

The place, bond and check steps list the moves the board takes under their instruction, and free build lists all of them (`howTo` and `howToFree` in `src/modules/lewis/guide.ts`):

- **Put an atom on the board:** drag it from the row under the board, or tap it.
- **Take an atom off:** drag it to the bin. While an atom is carried, the Clear button is the bin and says "Drop here to take it off". Dragging the atom off the edge of the board works too.
- **Bond two atoms:** drag one onto the other. In free build, and in the bond and check steps, an atom dropped from the row onto an atom on the board is bonded to it in the same move.
- **Take a bond back:** swipe across its line. The swipe has to start on bare board. One swipe cuts one line of a double or triple bond. A tap on the bond and "Remove a bond" still works.
- **Add or take off an electron:** tap the atom, then "+ electron" or "− electron".
- **Start over:** Clear empties the board. From the 3D view or from steps 5 to 7 it also brings the flat board back, and a guided molecule returns to the place step. Undo straight after it puts back the atoms, the step, the view and the answers.

## The checks that stay on screen

Sam asked for the indicators that serve as checks to be a persistent part of the interface (D-0024). As built (D-0026):

- A strip of three chips sits under the electron counter in every step from Place on, and in free build: **Electron total**, **Full shells** with a count ("2 of 3"), and **Formal charges**. A chip is green with a check mark when the check passes, strawberry with a cross when something is wrong, and plain while it waits for the board.
- They are the three checks of step 4's list (`checkChips` and `checkRows` in `src/modules/lewis/guide.ts`). A test holds the two to the same states for every problem. Two differences, both about an electron total that is not wrong yet: while atoms are still off the board the electron total waits, where the list says how many atoms are still to come. And before the check step an ion's electron total waits while its atoms hold what neutral atoms bring, because the ion's charge is dealt with in the check step.
- Each atom's electron count ("6 of 8") is beside it on the flat board from the place step on. Formal charges show beside the atoms from step 4 on.
- The counter gives pairs beside its electron numbers on a wide screen: "4 pairs" in bonds, and "4 lone pairs" once every atom has a full shell. Before that an atom's unshared electrons are not all in pairs, so no number is given.

## Drawing the dipoles in step 6

Sam asked for a part where a student draws a line and is assessed on where the dipole points (D-0022). What follows is how the build session built it (D-0023).

- **A bond's arrow.** The student presses on one atom of the bond, drags to the other atom and lets go. The arrow points at the atom where the student let go, so the arrow says that atom is δ−. While the arrow is held over an atom, a label beside the arrowhead says "points at oxygen". A tap on each atom, or Enter on each atom's keyboard target, draws the same arrow. It works on the flat drawing and on the 3D model.
- One right arrow answers every bond of that kind (both C–O bonds of carbon dioxide), and the board then draws the arrow on each of them.
- An arrow between two atoms that are not the bond in question is refused with a message and costs no try.
- **Aim points for the net dipole (D-0025, D-0026).** Small dots sit around the model: beyond each outer atom, beyond each lone pair of the middle atom, toward the middle of the outer atoms, and straight away from it, which is the empty space on the far side. An arrow dragged within 13° of a dot snaps to it, and a label says where it points ("toward a lone pair", "away from the 2 hydrogen atoms"). A tap on a dot sets the arrow there. A direction between the dots still counts.
- **The net dipole.** After "polar" or "nonpolar" is answered, a polar molecule gets one more question. The student presses on the middle atom of the 3D model and drags the way the bond arrows add up. Only the direction counts: an arrow within 35° of the net dipole, as it appears on screen, is right (`NET_WITHIN` in `src/modules/lewis/guide.ts`). From the keyboard, the left and right arrow keys turn an arrow on the middle atom 15° at a time, and Enter sets it.
- When the question opens, the model turns until the net dipole lies across the screen, and it stops turning by itself. If a student turns the model so that the net dipole points at them or away (less than 45% of it across the screen, `NET_ACROSS`), the app does not count the try, says so, and turns the model back.
- The board shows the net dipole only after the student has drawn it the right way. The step is finished then. A molecule whose dipoles cancel has nothing to draw, and its step is finished when "polar" or "nonpolar" is answered.
- Once the net dipole is asked for, the Hint button gives two hints about adding the bond arrows.

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
