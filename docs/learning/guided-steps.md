# The guided steps

How a guided problem teaches, as built. The direction is Sam's (D-0006). The step split, the problem list, the free build mode and the drag gesture are the build session's reading of it and wait for his yes (D-0007). Steps 6 and 7 came from his request for dipoles and the concepts in his chapter 7 and 8 slides, and putting them here as steps waits for his yes too (D-0021). He asked for the dipoles to be drawn (D-0022). How they are drawn is the build session's design and waits for his yes (D-0023). He asked for questions to be noticeable, for the app to show how to work the board, for the checks to stay on screen (D-0024), and for one-move controls and a clearer dipole drawing (D-0025). How those are built waits for his yes too (D-0026). He asked for key terms that a student can open to see what they mean (D-0027). Which words, what each card says and how it looks wait for his yes (D-0028). He asked for the app to tell the electron geometry and the molecular geometry apart everywhere (D-0030). How step 5 asks for both, what a wrong electron geometry is told, and what free build says about a molecule of two atoms are the build session's design and wait for his yes (D-0033).

## What Sam asked for (2026-11-12)

> First and foremost I want to GUIDE students to building proper sequential knowledge on how to properly tackle the problems, starting with being able to identify number of electrons, drawing individual dot structures, making connections, double bonds, etc. the idea is to also have an orchestrated experience where the app visually guides them into being able to see what is going on and how their actions impact any given configuration.

## The seven steps

A student works one molecule in seven steps on a 3D board:

1. **Count** the valence electrons of each atom, then the total (the charge of an ion included).
2. **Place** the atoms on the board, after answering which atom goes in the middle.
3. **Bond** each outer atom to the middle atom by dragging one atom onto the other.
4. **Check** every atom's electron count, the electron total, and the formal charges.
5. **Shape**: count the electron groups, pick the electron geometry, then commit to a molecular geometry and watch the flat drawing lift into 3D. The electron geometry is how all the electron groups around the middle atom are spread out, lone pairs included (5 names: linear, trigonal planar, tetrahedral, trigonal bipyramidal, octahedral). The molecular geometry is named for where the atoms sit (the 11 names). The picks for the electron geometry hold those 5 names and the molecular geometries that the same number of groups can make, so a student who gives a molecular geometry there (bent for water) is told which kind of name it is. A wrong electron geometry is explained and the student picks again. The count of groups is on screen, so the rule that turns a count into a name is the answer: the second miss and the second hint hand back a smaller question (which of the five spreads that many groups apart), and only the third miss gives the rule, as the reason for the answer. The molecular geometry's first pick is final, because the model lifts into 3D and shows it (D-0033).
6. **Polar**: for each kind of bond, draw the bond's dipole arrow on the board, or press "Nonpolar, no arrow". Then say whether the molecule is polar. For a polar molecule, draw its net dipole on the 3D model. The atoms' electronegativities from the course's table are on screen. An ion is asked whether its bond dipoles cancel, and an ion whose dipoles do not cancel has its net dipole drawn too.
7. **Orbitals**: count the sigma bonds and the pi bonds, then pick the hybridization of the middle atom. The molecule counts as finished after this step, and the panel ends with a table of everything found: molecular geometry, electron geometry, electron groups, bond angle, polarity, sigma and pi bonds, hybridization.

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

## Names for the two geometries

The course says **electron geometry** and **molecular geometry** (D-0030). Every sentence a student reads uses those two names where it means one of the two ideas: the questions of step 5, the right-answer lines, the wrong-answer cards, the hints, the table of results, step 6's reasons, the key terms' cards and free build. "Shape" stays where it is the plain word for the 3D model as a whole ("See the 3D shape") and as step 5's short label. In code, `ShapeInfo.geometry` is the electron geometry and `ShapeInfo.shape` the molecular geometry (`src/chem/vsepr.ts`). Neither name is the subject of a verb a person does ("the molecular geometry names where the atoms are"): a sentence says the name is given for where the atoms sit, or tells the student what to look at (COPY2-10). A molecule of two atoms is linear for both: the straight line is the reason for the molecular geometry only, and the electron geometry is "given" the same name, with no reason drawn from where the atoms sit (CHEM2-4, D-0033).

## Key terms

Sam asked for highlighted terms that a student can click to learn what they mean, with clear examples and clarifications (D-0027). As built (D-0028):

- **41 terms have a card:** 30 terms from "valence electrons" to "hybridization", and the 11 names of molecular geometries. "Electron geometry" and "molecular geometry" have their own cards (D-0033). The molecular geometry's card keeps the id `shape`, and the word "shape" opens it too. A card for one of the five names that are also electron geometries says so. `TERMS` in `src/modules/lewis/guide.ts` lists the words in the app's text that open each one.
- **A term is highlighted where it first appears on a screen.** A wrong answer's card and the hints each highlight their own words. Words inside buttons, headings, the lines about gestures, the electron counter and the strip of checks stay plain. Six early words (valence electrons, shell, ion, Lewis structure, middle atom, bond) stay plain in steps 5 to 7.
- **A press on the word opens its card:** what the term means, an example with a picture, one thing to keep in mind, and related terms. `termCard` in `src/modules/lewis/guide.ts` builds it.
- **A card never works on the molecule on screen.** Its example is one of 34 molecules that are not guided problems (`SAMPLES`). An exercise can be one of them (sulfur dichloride is the bent card's example), so every card has a second example and skips one whose formula and charge are the molecule on screen (D-0033). Some cards use an atom from another column of the periodic table than the molecule's atoms. With water on screen, the valence electrons card counts nitrogen's shells. The cards about electronegativity use two atoms the molecule does not have, with another ΔEN. The cards about the molecular geometry, angles and dipoles show another molecular geometry, and the cards about electron groups and hybridization show another number of groups. The two cards about the geometries show a molecule with another number of groups and another molecular geometry, so neither of the screen's two answers is named. `tests/terms.test.ts` checks each of these for all twenty problems.
- **A card links only to terms the student has met.** In a guided step the related terms are the ones that step or an earlier one uses. Free build links to all of them. The cards for resonance and for more than 8 electrons open only from a sentence that uses the words: a note under the finished structure, or a hint.
- In step 5 the names of the geometries stay plain until the molecular geometry is picked (`plainTerms` in `src/modules/lewis/guide.ts`): a name's card says which atoms and lone pairs go with it, which would answer the open question.

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

Free build shows step 6's results and asks nothing (D-0029, Sam's choice on 2026-11-17). Under the shape it lists the electronegativity of every element on the board, then one line per kind of bond, worked the way step 6 works it ("Polar. ΔEN = 3.5 − 2.1 = 1.4. ..."). A ΔEN above 2.0 reads "Ionic". A bond between two atoms of one element that formal charges make polar (ozone) says so in place of a ΔEN verdict. Once every shell is full, a line says whether the whole molecule is polar and why. A molecule with more than one middle atom gets the bond lines only. A tapped atom shows its electronegativity, and a tapped bond its ΔEN. Guided mode keeps those off its cards, because steps 2 and 6 ask them.

A finished molecule of two atoms (HCl, IF, N2) has no middle atom, and free build says so (D-0033): "There is no middle atom. The hydrogen atom and the chlorine atom sit on a straight line, so the molecular geometry is linear and there is no bond angle. The electron geometry is given as linear too." The 3D table leaves out the electron groups, the bond is named with the less electronegative atom first (H–Cl), and the one bond's dipole is the net dipole ("The H–Cl bond is the only bond, so its dipole is the net dipole."). No other sentence on such a board talks about a middle atom. The guided list keeps one middle atom per problem (L9).

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
