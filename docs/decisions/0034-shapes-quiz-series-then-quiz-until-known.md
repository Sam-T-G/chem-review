# D-0034: The shapes quiz shows the 13 rows one at a time, then asks four kinds of question until each row is right on the first try twice in a row

- Status: provisional
- Date: 2026-11-17
- Decided by: The QUIZ build session (2026-11-17), reading Sam's ask of the same day. The lead's record of that ask is D-0030.
- Teams: lewis, learning, design

## Context
Sam asked on 2026-11-17:

> i want to add two features for review purposes, I want a feature where students are able to be shown a series of geometries and can do a quiz feature to memorize them all and have iterative practice. [...]

In the same message he asked for electron geometry and molecular geometry to be told apart everywhere. The lead built the `Part` contract (`src/modules/lewis/parts.ts`) and an empty shapes part. How the series and the quiz work is this session's design, for Sam to confirm.

Options looked at for the practice:
- A fixed order through the 13 rows, asked once each. Turned down: nothing brings a missed row back, so it is a test and not practice.
- A row is known after one right answer. Turned down: a lucky pick from four or five choices counts.
- A full spaced-repetition schedule over days. Turned down for now: the quiz keeps its schedule only while the page is open, and the saved list holds only which rows are known.

## Decision
**The series.** The 13 rows of the shape table (`ALL_CASES` in `src/chem/vsepr.ts`), in table order, 2 to 6 electron groups. Each card shows one guided molecule as a 3D model with its angle marks (13 different molecules: CO2, BF3, SO2, CH4, NH3, H2O, PCl5, SF4, ClF3, XeF2, SF6, BrF5, XeF4), and both geometries, the counts, the bond angle, the example's formula and name, a line on how the two geometries differ for this row, and why the angle is what it is. Back, Next, the arrow keys, and a list of all 13 grouped by electron geometry move between cards. A two-way switch under the model, "Electron geometry" and "Molecular geometry", hands the board `groupsView` `all` or `atoms`.

**Four kinds of question, mixed.** The model is shown and the student names the electron geometry; the model is shown and the student names the molecular geometry; the counts are given in words and the student names both; both names are given and the student picks the bond angle. The board shows nothing during the counts and angle questions, because the model would answer them. A row is asked a different kind each time it comes back. A model question shows any guided or exercise molecule with the row's counts and one kind of outer atom.

**Choices.** All 5 electron geometries; 6 molecular geometries (the answer, the electron geometry, the shape with no lone pairs, the others with as many atoms or groups); 5 bond angles (the answer, the angle with no lone pairs, the others of the same electron geometry), never one that two bonds of the row really make (180° across a trigonal bipyramid or an octahedron, `alsoAngles`; fix round 1, 2026-11-17). Two tries on each part, then the answer.

**Known.** A row is known after 2 questions on it in a row were right on the first try. A miss, or a right answer on the second try, sets the count back to 0 and brings the row back after one other question. A right answer sends the row 5 questions back (3 once the row has been missed). Rows not yet asked come before rows answered right, and a missed row that is due comes first. Known rows are not asked again and are saved as `shape:<bonded>,<lone pairs>`. "Practice all 13 again" asks every row again and leaves the saved list alone.

**Nothing on screen gives the answer while a question is open.** No angle marks, no readout, no geometry's name in a heading, no switch. The choices are plain text. A key term stays plain, and the module will not open it or link to it, when its card states the answer, works the question's molecule or a molecule with the row's counts, or draws a model with the same answer; during an angle question also any card on what lone pairs do to an angle. A missed electron part of a counts question keeps its answer back until the molecular part is answered. (Fix round 1, 2026-11-17: the earlier rule walked related links and missed cards that state the counts.)

**Wrong answers** name the idea behind the pick: the electron geometry given for the molecular geometry and the other way round, the lone pairs left out, the ideal angle given where lone pairs make it smaller, an angle squeezed where nothing squeezes it. `docs/learning/shapes-quiz.md` has the words.

## Consequences
- The rules are in `src/modules/lewis/shapes/deck.ts`, the words in `src/modules/lewis/shapes/words.ts`, and `tests/shapes.test.ts` and `tests/shapes-words.test.ts` hold both to the table written by hand from OpenStax Chemistry 2e, 7.6. `scripts/check-shapes.mjs` checks it with real input.
- The quiz's own feedback is written in its words file. `shapeFeedback` in `src/modules/lewis/guide.ts` gives the answer in its first card, which a two-try quiz cannot use, and the quiz needs the two names in every card.
- The schedule and the streaks live only while the page is open. A reload keeps the known rows and starts the rest from 0.
- Open for Sam: the rule of 2, the four kinds, the 13 examples, and whether known rows should come back now and then for review.
