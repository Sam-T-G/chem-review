# The shapes quiz

A part of the Lewis module at `/shapes` (the "Shapes" tab). The code is in `src/modules/lewis/shapes/`. The design is D-0034 (provisional): Sam asked for it on 2026-11-17 (D-0030), and the build session chose how it works.

## What it teaches
The 13 rows of the shape table (OpenStax Chemistry 2e, section 7.6, through `ALL_CASES` in `src/chem/vsepr.ts`): for each count of bonded atoms and lone pairs on the middle atom, the electron geometry (where every electron group points, lone pairs included), the molecular geometry (where the atoms sit), and the bond angle. The two names are said in full everywhere: "electron geometry" and "molecular geometry".

## The series
One card per row, in table order (2 to 6 electron groups). The board shows a guided molecule as a 3D model with its angle marks. The panel gives the molecular geometry as the heading (bent and linear add their lone pairs, "Bent with 2 lone pairs", on the heading, the Next button and the "known" line, since each names two rows), the counts, a table (electron geometry, molecular geometry, electron groups, bond angle, example), a line on how the two names differ for this row, and why the angle is what it is. Back, Next, the left and right arrow keys, and a list of all 13 grouped by electron geometry move between cards. The switch under the model shows every electron group ("Electron geometry") or the atoms only ("Molecular geometry"): it hands the board `groupsView` `all` or `atoms`. The last card's main button starts the quiz.

| Row | Example | Row | Example |
|---|---|---|---|
| 2 atoms, no lone pairs | CO2 | 5 atoms, no lone pairs | PCl5 |
| 3 atoms, no lone pairs | BF3 | 4 atoms, 1 lone pair | SF4 |
| 2 atoms, 1 lone pair | SO2 | 3 atoms, 2 lone pairs | ClF3 |
| 4 atoms, no lone pairs | CH4 | 2 atoms, 3 lone pairs | XeF2 |
| 3 atoms, 1 lone pair | NH3 | 6 atoms, no lone pairs | SF6 |
| 2 atoms, 2 lone pairs | H2O | 5 atoms, 1 lone pair | BrF5 |
| | | 4 atoms, 2 lone pairs | XeF4 |

## The question kinds
| Kind | What is shown | What is asked | Choices |
|---|---|---|---|
| Electron geometry | the model, lone pairs drawn | the electron geometry | all 5 |
| Molecular geometry | the model, lone pairs drawn | the molecular geometry | 6 |
| Counts | "The middle atom has 3 bonded atoms and 1 lone pair." | the electron geometry, then the molecular geometry | 5, then 6 |
| Bond angle | both names in words | the bond angle | 5 |

A bond angle that two bonds of the row really make, although the row's label is another one, is never a wrong choice (`alsoAngles` in `src/chem/vsepr.ts`): 180° across a trigonal bipyramid or an octahedron, and each angle of a two-angle label alone. While a question is open, a how-to line says "Tap a choice to pick it. With a keyboard, press 1 to 5: 1 picks the first choice." (1 to 6 for the molecular geometry), which is true on a phone and with a keyboard.

During a counts or angle question the board is empty until the answer, because the model would answer it. A model question shows any guided or exercise molecule with the row's counts and one kind of outer atom (two kinds of outer atom make an angle only "about" the table's). After each question the board shows the model with its angle marks, and the panel shows the row's names, counts, angle and example, why the angle is what it is, and the known rows by name.

While a question is open nothing on screen gives its answer: no angle marks, no readout, no geometry's name in a heading, and no switch. The choices are plain text, since each geometry's name has a key-term card. A key term stays plain, and the module will not open its card or show a link to it from another card, when its card states the answer, works the question's molecule, works a molecule with the row's bonded atoms and lone pairs, or draws a 3D model with the same answer; during a bond angle question also the bond angle card, any card that says what lone pairs do to an angle, and any card that states a bond angle in its text or marks one on its picture (a card for the row's own molecular geometry can give the other row's angle: bent with SCl2's "less than 109.5°" on a 2,1 question) (`giveAway` and `blockedTerms` in `words.ts`, handed to the module through the part's `blockedTerms` hook). In a counts question whose electron part was missed, the card for that part keeps its answer back ("You'll see the electron geometry after you answer the molecular geometry.") until the molecular part is answered: with no lone pairs the two names are the same. While it is held, a molecular pick of the electron geometry gets "Your pick counts all 6 electron groups around the middle atom, lone pairs included." in place of naming it. The 13 dots at the top show known, right once, missed and not yet right, without names. On a narrow screen the dots and the question's number wait for the answer, so the choices fit under the board, and the heading still says how many are known. Once a question is finished the result and a "known" line come first.

## Wrong answers
Two tries on each part. The first wrong pick gets a card in three parts: what the pick is, why it is not the answer here, and the question handed back. The second gives the answer.

| Pick | What the card says |
|---|---|
| The molecular geometry for the electron geometry | "Linear is the molecular geometry here: where the 2 atoms around xenon sit." Each lone pair is an electron group too. In a counts question, which asks the molecular geometry next, the pick gets the card for the lone pairs left out: "Linear is the electron geometry for 2 electron groups." |
| The electron geometry for the molecular geometry | "Tetrahedral is the electron geometry here: where all 4 electron groups around nitrogen point, lone pairs included." 1 of the 4 corners holds a lone pair. |
| The lone pairs left out | "Trigonal planar would be the molecular geometry if nitrogen had no lone pairs." The lone pair takes 1 of the 4 places, so the 3 atoms sit in the other 3. / "Trigonal planar is the electron geometry for 3 electron groups." |
| The ideal angle where lone pairs make it smaller | "109.5° is the bond angle when all 4 electron groups are bonds." A lone pair pushes harder than a bond. The ask is only "Pick again.", so the card leaves more than one choice for the last try. |
| A squeezed angle where nothing squeezes it | "Less than 109.5° is a bond angle squeezed by lone pairs." No lone pairs, or two lone pairs whose pushes cancel, or three in the flat triangle pushing on the top and bottom bonds equally. |
| Any other pick | What the pick is the answer for (its counts, or the electron geometries with that angle), which count or how many electron groups it needs that the middle atom does not have, and a smaller question: count the groups, pick for these counts, or (counts question) start from the electron geometry and leave out the corners that hold lone pairs. Where the places are not alike the card says where the lone pairs go: on 5 electron groups they take places in the flat triangle ("The 2 lone pairs take 2 of the 3 places in the flat triangle, so name where the 3 atoms sit in the other places."), and 2 lone pairs on 6 groups sit on opposite sides. On 2 bonded atoms and 3 lone pairs the angle cards say the lone pairs take the flat triangle, so the 2 bonds are the top and bottom ones, and ask for the angle between the top bond and the bottom bond. |

## The rule for "known"
- A row is known after 2 questions on it in a row were right on the first try (`KNOWN_AT` in `deck.ts`).
- A miss, or a right answer on the second try, sets the count back to 0 and brings the row back after one other question, or at once when it is the only row left open. The result line says only that the row comes back soon: with several missed rows, the one due first comes first.
- A right answer sends the row 5 questions back, or 3 once it has been missed. Rows not yet asked come before rows answered right, and a missed row that is due comes first. The row just asked is not asked next while another row is open.
- The deck is a pure function of the state and a seeded random source (`draw` in `deck.ts`). The seed is set when the quiz starts.
- Known rows are not asked again. When all 13 are known, "Practice all 13 again" asks every row again.

## What is saved
A known row is saved in the module's list of finished items as `shape:<bonded>,<lone pairs>` (for example `shape:3,1`), through `markSolved`. The home screen's shapes card counts them. The streaks, the schedule and the question on screen are not saved: a reload keeps the known rows and starts the rest from 0.

## Checks
- `tests/shapes.test.ts`: the 13 rows and examples against the table written by hand, the choices, and the deck (order, a miss returns, known after the rule, every row asked, saved ids).
- `tests/shapes-words.test.ts`: the wording scan, every card for every row and wrong pick, and the key-term cards that can open during a question.
- `scripts/check-shapes.mjs desktop` and `phone`: the same with real pointer, touch and key events.
