# Handoff

Add your entry on top, under a heading in exactly this form: `## 2026-11-13 (team) What changed`. Say what changed, what you checked and how, what you ask of other teams or of Sam, and the next step.

## 2026-11-17 (lead) The two geometry names go to main first; the shapes quiz and the exercises are merged and closed

**State.** Sam wrote on 2026-11-17: "lets expedite the feature to differentiate between the different geometries. I want that finalized and pushed to live ASAP". Earlier the same day he wrote "once all the agents are done, commit and push to main". So this push holds everything that is merged on `lewis/review-modes`, with the two parts that still have review findings closed to students:
- **Open:** step 5 asks for the electron geometry and then the molecular geometry, every sentence uses the two names, the key terms have a card for each (D-0033), and free build has plain lines for a molecule of two atoms. Under it: the pool of 43 molecules with the electron geometry on every problem (D-0032).
- **Closed:** the shapes quiz (D-0034) and the exercises (D-0035). Their code and tests are in the tree. `OPEN_PARTS` in `src/modules/lewis/parts.ts` and `OPEN` in `src/modules/registry.ts` keep their tabs and cards off the screen (D-0031).
- **Not in the tree:** the 3D board package (the switch between all groups and atoms only, the two-atom model, four tabs on a phone). It is still being built on `lewis/board-3d`.

**Changed by the lead, on top of the packages' own entries below**
- Merged `chem/exercise-pool`, `lewis/exercises`, `lewis/shapes-quiz`, `lewis/geometry-names` and main (c8f14ad) into `lewis/review-modes`. Fixed what the merges broke in the tests: the exercise tests' own table of worked molecules now covers PH2− and the 23 molecules the chem package added, and one test problem gained the `geometry` field.
- `src/chem/vsepr.ts`: `alsoAngles`, the angles a row of the shape table holds besides its label (180° across a trigonal bipyramid or an octahedron). The quiz and the exercises must never offer one as a wrong answer. Source and test: `docs/chemistry/sources.md`, `tests/vsepr.test.ts`.
- `src/modules/lewis/parts.ts`, `ui.ts`: `Part.blockedTerms`, the key terms a part will not open a card for; the module also leaves links to them out of every card. `OPEN_PARTS`, above.
- Step 5, after three reviews of the geometry names package (`guide.ts`, `store.ts`, `ui.ts`):
  - The picks for the electron geometry hold the molecular geometries that the same number of groups can make (`geometryPicks`), and a pick of one gets its own card. Before, "bent" could not be picked for water's electron geometry (M-0011).
  - No card for the electron geometry names the molecular geometry, the next question (M-0010).
  - The right-answer lines say which geometry they name. The step's title and the finished line use both names in full.
  - The same wrong pick pressed again is not a new try.
- Free build: the net line for the triiodide ion no longer throws (M-0012), two atoms of one element with unlike formal charges read polar in both lines, and the two-atom line gives the straight line as the reason for the molecular geometry only.
- Docs: D-0030 (Sam's ask), D-0031 (parts, routes, saved lists, the switch), `docs/architecture.md`, `docs/roadmap.md`, `docs/mistakes.md` (M-0008 to M-0013), `docs/chemistry/sources.md`, D-0033 and the two learning docs for the step 5 changes.

**Checked.** The entry dated 2026-11-17 (the two geometry names) in `docs/verified.md`.

**Reviews.** Six independent review reports are in `~/Documents/Claude/chem-review-review-modes-2026-11-17/reports/` on Sam's machine: `REVIEW-CHEMWORDS`, `REVIEW-COPY`, `REVIEW-CODE` (the quiz and the exercises) and `REVIEW-CHEM2`, `REVIEW-COPY2`, `REVIEW-CODE2` (the geometry names). The chemistry reviewers worked all 43 pool molecules, the 13 rows of the shape table and the 34 sample molecules of the cards by hand.

**Not fixed in this push, from those reports**
- The panel's one-time scroll to a question can undo the panel's own scroll to a new explanation on a phone (CODE2-1, a traced path that nobody has run). The lead's first fix for it broke taps in step 6 on a phone and was taken out (M-0013).
- Step 5: the second miss and the second hint give the rule "4 is tetrahedral" while the count is on screen (COPY2-2). The generic card names no wrong idea for a full shell read as 4 groups or the middle atom counted as a group (COPY2-5). The third-miss card gives the answer with no reason (COPY2-13). Step 5's table lists the molecular geometry before the electron geometry (COPY2-15).
- Key-term cards: the "More than 8 electrons" note leaves out leftover electrons going on the middle atom (CHEM2-1), the hybridization note is wrong for sulfate and phosphate (CHEM2-2), the "Bond dipoles cancel" note says the outer atoms must be one element (CHEM2-3), and the bond angle note says lone pairs always squeeze the bonds (COPY-8).
- Steps 6 and 7 wording that was already live: ozone's card says its dipoles differ in size (CHEMWORDS-3), ions with no polar bonds are told their dipoles cancel (CHEMWORDS-6), "nothing cancels the 2 C–Cl dipoles" (CHEMWORDS-8).
- The quiz and the exercises: every finding assigned in `briefs/FIX-QUIZ.md` and `briefs/FIX-EXERCISE.md` of the same folder. The fixes are on `lewis/shapes-quiz` and `lewis/exercises`.

**Asks**
- Sam: the four items dated 2026-11-17 under "Waiting on Sam" in `docs/roadmap.md`. The first to settle is whether the course calls HCl's electron geometry linear or tetrahedral.
- shell: `src/shell/progress.ts` saves over a whole list when reading it failed or its JSON was bad (a reviewer's note, not in this change). `src/app/lewis.tsx` imports the value `PART_IDS` from the module's store, which `docs/architecture.md` does not allow for a route (CODE-7).
- lewis: `store.mergeSolved` keeps any saved id that starts with `shape:` or `ex:`, so a stale id would be counted on a card (CODE-5). Clear on the lifted model and then Undo leaves an exercise's structure part open (CODE-4).

**Next step.** Merge the two fixers' branches and the board package, review the fixes' diffs, put both parts in `OPEN_PARTS` and `OPEN`, run `scripts/check-shapes.mjs` and `scripts/check-exercise.mjs` at both sizes, and push again.

## 2026-11-17 (lead) Hooks for the shapes quiz and the exercises, and a parallel build that is paused

**State.** On the branch `lewis/review-modes`, in the worktree `chem-review-review`, local only. Sam asked for the work on 2026-11-17 (D-0030 quotes him) and wrote "pause all for now i need to go home" a few minutes after five builders started. They were stopped while still reading, so their five worktrees are clean and nothing of theirs is built. The main checkout was not touched: another session was working there the same day (free build dipoles, D-0029).

**Changed** (commit `be3fa65`, on top of `63c3a57`, a snapshot of the main checkout's uncommitted work)
- `src/modules/lewis/parts.ts`: the contract for a part of the module, a mode with its own panel. Stub parts in `src/modules/lewis/shapes/` and `src/modules/lewis/exercise/`.
- `src/modules/lewis/store.ts` and `ui.ts`: four modes, the part hooks, `update()`, `markSolved()`, saved ids with a prefix (`shape:`, `ex:`).
- `src/modules/lewis/LewisModule.tsx`: a `start` prop. `src/app/lewis.tsx`, `shapes.tsx`, `exercises.tsx`: three routes on one screen, three saved lists. `src/modules/registry.ts`: three cards.
- `src/chem/exercises.ts` (a stub pool with its final exports), `ALL_CASES` in `src/chem/vsepr.ts`, `geometryChoices()` and `geometryFeedback()` in `guide.ts` as stubs, `SceneInput.groupsView` declared in `scene.ts`.
- Not committed: D-0030, D-0031, `docs/architecture.md`, `docs/roadmap.md` (W-023 to W-028).

**Checked.** `pnpm verify` on `be3fa65`: exit 0, 455 unit tests. Browser, desktop, port 5220: the `shell` run 78 passed and 1 failed, the first two guided molecules 130 passed and 2 failed. All three failures were "lift finished" at 0.96 to 0.99 while the other session's browser checks were using the machine. `phone shell` failed with a tap that timed out after "finish methane, then go back": four tabs at 390 px are the likely cause, and nobody has looked.

**Asks**
- Sam: the three readings under "Waiting on Sam" in `~/Documents/Claude/chem-review-review-modes-2026-11-17/RESUME.md`.
- `pnpm check:repo` prints 10 REF problems here until D-0032 to `D-0036` are written by the builders.

**Next step.** `~/Documents/Claude/chem-review-review-modes-2026-11-17/RESUME.md` has the steps: bring the baseline up to date with the main checkout, relaunch the five builders from `LAUNCH.md`, merge, review, verify.
## 2026-11-17 (chem) What changed: four fixes from the chemistry review of the exercise pool

**State.** Committed on the branch `chem/exercise-pool` (fix round 1 of package CHEM). D-0032 stays provisional.

**Changed**
- `src/chem/polarity.ts`: the formal-charge rule for a ΔEN of 0 now needs two atoms of the same element (it fired for P–H, C–S, C–I, N–Cl). Like outer atoms share their formal charges equally before the arrows are sized, so ozone's two arrows are equal and its net dipole runs along the bisector for either drawing.
- `src/chem/assess.ts`: in free build `shortCenter` also needs the middle atom at exactly 6 (two short of 8) with a formal charge of at most +1, so OH2 4+, CH2 2+, CH 3+, NH2 3+, BH2+ and BeH+ with their unshared electrons taken off are short again. With a target species nothing changed.
- Tests first: `tests/assess.test.ts` (8 new), `tests/polarity.test.ts` (2 new), and the PH2− row in `tests/exercises.test.ts` flipped from polar to nonpolar (the old value applied the ozone rule to P–H).
- Docs: `docs/chemistry/sources.md` (CH3+ citation and two-atom electron geometry marked [TBD], the ozone rule, five course-dependent conventions in the known gaps), D-0032 (decision and consequences).

**Checked.** Each new test failed on the old code (assess: `complete` was true; polarity: arrows 10 and 20 for ozone, PH2− polar) and passes now. `pnpm verify` exits 0.

**Asks.**
- Lewis: the `'charges'` reason now only comes from bonds between atoms of one element; the guide's sentence for it still reads right. PH2− shows nonpolar in exercises.
- Sam: IF's electron geometry (linear in the app; tetrahedral if the course treats iodine as a middle atom) and the conventions listed in the known gaps.

**Next.** Read OpenStax 7.3 to settle the CH3+ citation. Sam checks IF against the instructor's key.

## 2026-11-17 (chem) What changed: the exercise pool, the electron geometry on every problem, and two-atom molecules in the engine

**State.** Committed on the branch `chem/exercise-pool` (package CHEM of the review-modes run). Sam asked for it on 2026-11-17 (the lead's record of that ask is not on this branch); how it is built here is D-0032, provisional.

**Changed**
- `src/chem/exercises.ts`: `EXERCISES` holds 43 molecules in six `EXERCISE_SETS`: the worksheet's 20 in the sheet's order (six are the guided problems' own objects), 8 two-atom molecules, then single bonds, double bonds, ions, and fewer or more than 8 electrons. `hasResonance` counts only drawings with the same bonds and charges.
- `src/chem/problems.ts`: `Problem.geometry` (the electron geometry) is required, and set on all 20 guided problems.
- `src/chem/vsepr.ts`: aliases `ElectronGeometry` and `MolecularGeometry`; the `ShapeInfo` comment says what the counts mean for two atoms.
- `src/chem/assess.ts`: `shortCenter` lets a middle atom finish short when the electron count leaves no other drawing and it has no unshared electrons (CH3+). A named atom of a two-atom molecule gets no room past 8.
- `tests/exercises.test.ts` (new, 279 tests) and `drawn()` in `tests/helpers.ts`. Docs: D-0032, `docs/chemistry/sources.md`, `src/chem/AGENTS.md`, `tests/AGENTS.md`.

**Checked.** `pnpm verify` exits 0. With the baseline `assess.ts` four of the new tests fail (CH3+ and I=F), so they test the change.

**Asks.**
- Lead: add `{ "path": "tests/exercises.test.ts", "team": "chem" }` to `docs/ownership.json`; it falls under the EXERCISE package's `tests/exercise*.test.ts` pattern by name.
- Lewis: code that compares an atom's count with its target will still call carbon in CH3+ short; read `AtomReport.status` or the issues. For two atoms, `ShapeInfo.groups` is not an electron-group count that sets the geometry, so do not print it as one. SCl2, HCl, N2, O2, F2, O3, NO3−, BeCl2, BCl3, CCl4, NF3 are also term-card samples (`SAMPLES` in `src/modules/lewis/guide.ts`): the L10 rule needs those cards to pick another example when one of these is the exercise on screen.
- Sam: CH3− (nonpolar) and PH2− (polar) follow the app's rules literally; see the known gaps in `docs/chemistry/sources.md`.

**Next.** Learning reads the names and set titles. Sam confirms D-0032.
## 2026-11-17 (lewis) The exercises: one molecule worked as the worksheet's row, part by part, with no steps and no hints

**State.** Built on the branch `lewis/exercises` in the worktree `chem-review-exercise`, package EXERCISE of the
review-modes run. Committed on that branch only. Sam's ask is D-0030 and is quoted in D-0035; how it is built is this session's
design and is provisional (D-0035).

**Changed**
- `src/modules/lewis/exercise/`: `sheet.ts` (each part's answer from the engine's finished structure, and the picks),
  `state.ts` (the checks, locks, reset on a board change, the next-molecule rule, saved ids), `words.ts` (every
  sentence), `terms.ts` (which key terms stay plain), `part.ts` (the panel, counter, strip of checks, cue, presses,
  keys, angle labels), `exercise.css`, `AGENTS.md` (EX3 to EX5).
- `tests/exercise.test.ts`, `tests/exercise-words.test.ts`, `tests/exercise-terms.test.ts`, `tests/exercise-pool.ts`:
  69 tests over the pool and the 20 worksheet molecules plus 8 of two atoms, answers worked by hand.
- `scripts/check-exercise.mjs`: the real-input browser check of the exercises.
- Docs: `docs/learning/exercises.md` (new, in the map), D-0035, the lists in `tests/AGENTS.md` and `scripts/AGENTS.md`.
- No file outside these. The part contract was enough: no part hook was added.

**Checked.** `pnpm verify` exit 0 (524 tests). `node scripts/check-exercise.mjs desktop` and `phone` against the
build served on port 5233: see the report for the numbers. Screenshots looked at: the empty sheet, a wrong-answer
card and the finished sheet with the model, at both sizes.

**Asks**
- shell or lewis (owner of `src/modules/lewis/ui.ts`): `window.__mb.cue().cue` returns `store.cue()`, which is null
  in a part's mode. Return `PARTS[s.mode]?.cue?.(s) ?? null` there for a part, as `render` does, so a check can read
  a part's cue. `scripts/check-exercise.mjs` reads the glows instead until then.
- lewis (owner of `ui.ts`): outside the guided steps a key term's card opens with no molecule (`termCard(id, null,
  null)`), so in the exercises `src/modules/lewis/exercise/terms.ts` keeps plain every term whose card could give a
  part away. Passing the exercise's molecule there would let more terms open.
- chem: `src/chem/polarity.ts` calls a bond polar from formal charges whenever ΔEN is 0, so P–H in PH2− is polar
  and the ion's dipoles "do not cancel". The slides use that rule only for two atoms of one element (ozone).
  `tests/exercise-pool.ts` keeps PH2− in `ENGINE_GAPS` with a test that fails once the engine is fixed.
- lead: add `docs/ownership.json` rows for `tests/exercise*.ts` (team lewis, review learning) and cite the lead's record of Sam's request in
  D-0035 once that record is on the branch (the repo check fails on a decision id that is not in `docs/decisions/`).

**Next.** Run the exercise tests against the full pool at the merge, and Sam's answer on D-0035.
## 2026-11-17 (lewis) The shapes quiz: a series of all 13 shapes, then a quiz that brings missed ones back until each is known

**State.** Built by the QUIZ session on the branch `lewis/shapes-quiz`, in its own worktree, on top of be3fa65 (the lead's part hooks). Sam asked for the feature on 2026-11-17 (the lead's record of the ask is D-0030). How it works is this session's design: D-0034, provisional.

**Changed** (all inside the files the QUIZ package owns)
- `src/modules/lewis/shapes/deck.ts` (new): the 13 rows, one guided example per row (13 different molecules), the choices, a seeded random source, and the deck: a missed row comes back after one other question, a row is known after 2 questions on it in a row are right on the first try, known rows are saved with `markSolved('shape:<bonded>,<lone pairs>')`.
- `src/modules/lewis/shapes/words.ts` (new): every sentence the quiz shows, the wrong-answer cards (the electron geometry given for the molecular geometry and the other way round, the lone pairs left out, the ideal angle where lone pairs squeeze it, a squeezed angle where nothing does), and `blockedTerms`, which leaves a key term plain while a question is open when its card or a related card states the answer.
- `src/modules/lewis/shapes/state.ts`, `part.ts`, `shapes.css`: the series (card, readout, how the two geometries differ, why the angle is what it is, list of all 13 by electron geometry, the switch under the model that hands the board `groupsView`), and the quiz (13 dots for progress, the question, plain-text choices, the cards, the result with the model's angle marks, the known list, a burst when a row becomes known and when all 13 are).
- `tests/shapes.test.ts`, `tests/shapes-words.test.ts` (new, 49 tests), `scripts/check-shapes.mjs` (new).
- Docs: `docs/learning/shapes-quiz.md` (new), D-0034, the map line in `docs/README.md`, the file lists in `src/modules/lewis/shapes/AGENTS.md`, `tests/AGENTS.md`, `scripts/AGENTS.md`.

**Not done here, on purpose.** `groupsView` is passed to the board but this worktree's `scene.ts` does not draw it yet (package BOARD/GUIDED does). No part hook was added: nothing in `ui.ts`, `store.ts`, `guide.ts`, `scene.ts` or `parts.ts` changed. The quiz writes its own wrong-answer words instead of `shapeFeedback`, whose first card gives the answer.

**Checked.** `pnpm verify` exits 0 (504 unit tests, 49 of them new; `check-repo: ok`; web export). Against the served build on port 5232, each run under the shared browser lock: `node scripts/check-shapes.mjs desktop` 103 passed, 0 failed; `phone` 107 passed, 0 failed; `node scripts/check-browser.mjs desktop 0 2` 132 passed, 0 failed. Screenshots looked at by eye at both sizes: a series card, an open question, a wrong-answer card, the known screen. On a phone the model stays in view above the switch, and the choices of the longest question (the bond angle) fit under the board without scrolling once the dots wait for the answer.

**Found and fixed on the way.** "counts the the lone pair" on the series cards (the scan now fails on a doubled word). On a phone the choices sat below the fold and could not glow as a whole: the choices now come straight after the question, the definition and the how-to line follow them, and the dots and the question number are hidden on a narrow screen while a question is open (the heading says how many are known). On a phone the result scrolled out of view: the result and "known" lines now come first once a question is finished.

**Asks.**
- Lead: owners for the two new test files in `docs/ownership.json` (team lewis; reviewers chem and learning); D-0030 is cited in code spans because it is not in this worktree, drop the backticks after the merge; a `docs/verified.md` entry from the numbers above.
- Lead (seen, not mine): at 390 px wide the four mode tabs cover the Modules back button in the top bar (`topbar()` in `src/modules/lewis/ui.ts` and its styles).
- GUIDED: when `groupsView: 'atoms'` is drawn, `node scripts/check-shapes.mjs` still only checks that the flag is passed. A check that the lone pairs disappear belongs with the drawing.
- Sam: the rule of 2, the four kinds of question, the 13 examples (D-0034).

**Next.** Merge, then look at the switch with the real drawing of `groupsView`.
## 2026-11-17 (lewis) The net dipole label stays clear of the strip of checks on a phone

Sam wrote on 2026-11-17: "fix the net dipole label on phone". On a phone the board reaches under the lower half of the strip of checks (see `measure()` in `ui.ts`), and the "net dipole" label past the arrowhead landed there, hidden.

**Changed**
- `src/modules/lewis/scene.ts`: `Insets` gains `clear`, the line where the panels over the board end. When the label past the arrowhead would sit above that line, it moves beside the arrowhead, on the side the arrow leans toward (the other side when that runs off screen), and below the line.
- `src/modules/lewis/ui.ts`: `measure()` passes `clear`.
- `scripts/check-browser.mjs`: `netTagClear()`; every polar molecule in step 6 and free build water check that the label is shown and overlaps none of `.mb-top`, `.mb-ledger`, `.mb-checkbar`.

**Checked.** The entry dated 2026-11-17 (net dipole label) in `docs/verified.md`.

**Asks.** None. The δ+ tag over an atom's electron count on the flat drawing, from the entry below, is still open.

**Next step.** Sam looks at step 6 on a phone.

## 2026-11-17 (lewis) Free build shows electronegativity, each bond's ΔEN and the dipoles

**State.** Built in the main checkout on the branch `lewis/key-terms`, on top of the key terms work. On 2026-11-17 Sam wrote "commit push deploy". Another session had already committed the same working tree as 63c3a57 (the snapshot that `lewis/review-modes`, `lewis/board-3d`, `lewis/exercises`, `lewis/geometry-names`, `lewis/shapes-quiz` and `chem/exercise-pool` start from), so this commit sits on top of that snapshot and holds only the docs that came after it. main moves from 63d657d through 63c3a57 to this commit, and those branches keep their history.

Sam wrote on 2026-11-17: "check the chemistry review module we made, i want to also import the dipole and electronegativity features into the free build". Asked how, he picked "Show them live" over running step 6's drawing exercise in free build. D-0029 quotes both.

**Changed**
- `src/modules/lewis/guide.ts`: `FREE_POLAR_WORDS`, `freeBondLine` (one kind of bond, with "Ionic" above 2.0 and the ozone case), `freeNetLine`, and `bondKindsOn` (each pair of elements once, for any board, chains too).
- `src/modules/lewis/ui.ts`: `freePolar()` adds to the free build panel the electronegativity table for the elements on the board, a row per kind of bond, and the net dipole line once every shell is full. `dipolesFor()` draws the polar bonds' arrows with δ+ and δ− in free build, and the net dipole on the 3D shape of a finished polar molecule (`freeNetShown`), where the angle marks then step aside. A tapped atom shows its electronegativity and a tapped bond its ΔEN, in free build only. The polarity line that sat under the 3D shape is now the net dipole line.
- `src/modules/lewis/styles.css`: `.mb-h3` and `.mb-pol`.
- `tests/guide.test.ts`: five tests for free build (water, Al–F ionic, ozone, ethane, polar and nonpolar lines), and the scan of every sentence now reads the free build lines for all twenty problems and those three boards.
- `scripts/check-browser.mjs`, extras: in free build, the table, the O–H line, water's verdict, both arrows on the flat drawing and no net dipole, a tapped oxygen's electronegativity, the net dipole on the 3D shape, and "Fill every shell" once oxygen is short.
- Docs: D-0029, `docs/learning/guided-steps.md`, `docs/design/look-and-motion.md`, `docs/chemistry/sources.md`.

**Found on the way.** With the middle atom one electron short, the engine gives no polarity, and the first draft then said dipoles are added up only for molecules with one middle atom, which is false for water. It now says to fill every shell. The browser check caught it.

**Checked.** The entry dated 2026-11-17 in `docs/verified.md`.

**Asks**
- Sam: the wording of the free build lines, "Ionic" for a ΔEN above 2.0, and the electronegativity on a tapped atom's card (D-0029, Consequences).
- Whoever ran browser checks from another worktree at about 16:10 on 2026-11-17: this session killed every headless Chromium on the machine then, taking one for its own leftover (M-0007). A run of yours may have stopped with "Target page, context or browser has been closed". Run it again.
- design: on a phone the "net dipole" label above the 3D model sits under the strip of checks. Guided step 6 does the same (`shots/phone-H2O-polar.png`), so it is older than this change. On the flat drawing a δ+ tag can cover an atom's electron count.

**Next step.** Sam reads the free build lines and the key terms cards on the live site and confirms or changes D-0028 and the wording in D-0029.
## 2026-11-17 (lewis) Step 5 asks for the electron geometry and then the molecular geometry, and every sentence uses the two names

**State.** Package FLOW of the review-modes run, on the branch `lewis/geometry-names` in the worktree `chem-review-flow`. Committed on that branch only; nothing pushed.

Sam asked on 2026-11-17 for the app to tell electron geometry and molecular geometry apart through the whole app, and for 3D models of molecules with no middle atom (D-0030). How the guided steps, the cards and free build carry it is this session's design (D-0033, provisional).

**Changed**
- `src/modules/lewis/guide.ts`: `groupsQuestion`, `geometryQuestion` and `shapeQuestion` hold step 5's three questions (they were inline in `ui.ts`). `geometryFeedback` is real: it names the wrong idea (the molecular geometry's own name, the bonded atoms alone, each shared pair counted as a group, or what the pick goes with), gives the rule on the second miss and the answer on the third. Its signature is the lead's, with two optional arguments added at the end (`tries`, the board's group facts). `shapeFeedback`, step 6's reasons, the hints, `finishedLine`, the shape-name cards and the dipole cards say "electron geometry" or "molecular geometry". New card `electron-geometry`; the card with id `shape` is now "Molecular geometry". `plainTerms(step, namesOpen)` keeps the names of the geometries plain in step 5 until the molecular geometry is picked. `twoAtomsLine`, and `shapeReadout`, `netReason` and `bondKindsOn` handle a molecule of two atoms.
- `src/modules/lewis/store.ts`: `ShapeState` gains `geometry`, `geometryRight`, `geometryTries`, `geometryFeedback`, `geometryCoach`; `pickGeometry()`; `pickShape()` waits for the electron geometry; `cue()` names `geometry`; hints follow the open question and start again after each right answer.
- `src/modules/lewis/ui.ts`: `stepShape` asks the three questions (chips `geo-<name>`, `data-cue="geometry"`), `readout` rows are Molecular geometry, Electron geometry, Electron groups, Bond angle (no groups row and no drag line for two atoms), the board rings the groups a wrong electron geometry is about, and free build says plainly when a molecule has two atoms. One change in the shared cue code: once a question has arrived, if its choices are cut off at the edge of the panel, the panel scrolls them into view once (`cueBrought` in `controlGlow`); on a phone the five electron geometry names take three rows and were cut off. Not touched: `topbar()`, `dock()`, the `groupsView` line, `scene.ts`, `styles.css`.
- Tests: `tests/guide.test.ts`, `tests/store.test.ts`, `tests/terms.test.ts`. `scripts/check-browser.mjs`: the guided run answers the electron geometry with real input and checks the readout rows; `extras` adds a wrong electron geometry for CO2 and H2O and hydrogen chloride in free build; `terms` opens the two new cards.
- From the lead's two notes (CHEM's findings): `geometryFeedback` and `shapeFeedback` have their own lines for a molecule of two atoms, with no middle atom and no group count; every card's example skips the molecule on screen (`pick()` in `src/modules/lewis/guide.ts`), with a second example for each card and 8 new samples. `tests/terms.test.ts` checks it for every guided problem and every entry of `EXERCISES`.
- Docs: D-0033, `docs/learning/guided-steps.md`, `docs/learning/wrong-answers.md`.

**Checked.** `pnpm verify` and the browser runs at both sizes; the numbers are in the report at `/Users/sam/Documents/Claude/chem-review-review-modes-2026-11-17/reports/FLOW.md`.

**Asks.** Chem: cite a source for "the electron geometry of a molecule of two atoms is linear" in `docs/chemistry/sources.md`, or tell Sam that some texts give HCl's chlorine a tetrahedral electron-pair geometry. Lead: the QUIZ and EXERCISE parts can pass `tries` and `groupFacts(s)` to `geometryFeedback` to get the second and third miss and the double-bond case.

**Next.** Sam to confirm D-0033: the electron geometry asked before the molecular geometry, the three tries, and the two-atom wording.

## 2026-11-16 (lewis) Key terms are highlighted, and each opens a card with its meaning, an example and a picture

**State.** Built on the branch `lewis/key-terms`, on top of 63d657d. Not committed: Sam asked for the feature and has not asked for a commit, a push or a deploy (R9).

Sam asked on 2026-11-16 for key terms that a student may not know to be highlighted, so that a click on one explains it with clear examples and clarifications. D-0027 quotes him. Which words, what each card says and how it looks are this session's design (D-0028, provisional).

**Changed**
- `src/modules/lewis/guide.ts`: the key terms section at the end. `TERMS` lists 29 terms and the words that open each. `termPieces` cuts a sentence into plain text and terms. `termCard` builds a card: name, meaning, example, one thing to keep in mind, a picture and related terms. `SAMPLES` holds the 26 molecules the examples use. The 11 shape names have cards too.
- `src/modules/lewis/ui.ts`: `rich()` turns the first use of a term on a screen into a button. The card opens beside the panel on a wide screen and as a sheet on a phone. Five kinds of picture are drawn as SVG: an atom's shells, a column of the periodic table, flat Lewis drawings, two bonded atoms with their electronegativities, and a molecule in its 3D shape.
- `src/modules/lewis/styles.css`: the highlight, the card and the pictures.
- `tests/terms.test.ts` (new) and the scan of every sentence in `tests/guide.test.ts`, which now reads every card for every problem.
- `scripts/check-browser.mjs`: a `terms` run, and two checks in every molecule's run (the valence electrons card in step 1, the ΔEN card in step 6).
- Docs: D-0027, D-0028, `docs/learning/guided-steps.md` ("Key terms"), `docs/design/look-and-motion.md`, `docs/chemistry/sources.md`, `docs/roadmap.md` (W-022), `docs/platform/verify.md`, L7 and L10 in `src/modules/lewis/AGENTS.md`.

**The rule the cards follow.** A card never works on the molecule on screen (L10). Its example is another atom or molecule, picked for each problem so that no card states a number, a pick or a drawing the molecule asks for. `tests/terms.test.ts` checks that for every card with each of the twenty problems on screen.

**Checked.** The entry dated 2026-11-16 for this change in `docs/verified.md` has the numbers.

**Review.** A second session read the new code and reported twelve findings and two gaps in the checks. What was done about each:
- Three cards counted an atom from the same column as an atom on screen (chlorine's 7 with fluorine on screen). Every card that gives an atom's electrons or draws all of a molecule's dots now picks its example by column, and a test holds them to it.
- The card for more than 8 electrons named sulfur, phosphorus, chlorine and xenon, and could be reached from "formal charges" at the start of step 4. It names no atom now, and no card links to it.
- The resonance card drew ozone, which has the nitrite ion's bond pattern, and was one link from "formal charges". It shows the nitrate ion when the molecule on screen is bent, and no card links to it.
- The full shell card opens in step 1 from a wrong answer's card, and its note named boron. The note names no atom now. The test that said five cards open in the count step now reads every sentence the count step can show: eight cards open, and all eight are held to the rule about columns. A second test does the same for the middle-atom question.
- "Their pushes cancel", about lone pairs, opened the card about dipoles. "Cancel" now opens it only in a sentence about dipoles or arrows.
- "The atom it should bond to" highlighted the verb. "Bond" after "should", "to", "can", "could", "will" or "must" stays plain.
- The polar bond card said a bond between 2 atoms of one element is nonpolar, which the app's own ozone case contradicts. It now says ΔEN is 0 and neither atom pulls harder.
- The hybridization card left out d orbitals. It names them now.
- After a move to a related term, a press on the first word closed the card and the word stayed marked as open. The press now brings the word's own card back.
- The card did not follow its word when the panel scrolled. It is placed again on every scroll of the panel. No check covers this.
- After a press on bare board the keyboard was left on nothing. It goes back to the word.
- "Polar molecule" is never a highlighted word, only a related term of "polar". Left as it is, and a test says so.
- Gap: the checks counted a picture's parts. They now read which atom δ−, each arrow, the formal charge and the net dipole sit on, and which line is σ.
- Gap: the matcher was tested on typed sentences. `tests/guide.test.ts` now runs it over every sentence the guide can show.
The fixes were read by the session that made them only.


**Found on the way.**
- The first version of the electronegativity cards picked its bond only by ΔEN. With chlorine trifluoride on screen the card gave chlorine's electronegativity and said fluorine has the largest, which answers step 2's question about the middle atom. The hint in step 2 highlights "electronegative", so the card was one press away. The bond is now two atoms the molecule does not have, and the note gives the trend across the periodic table without naming an element.
- A picture inside a centered grid cell ignored `max-width: 100%`, so the two widest pictures ran past the card's edge. The cell now has one column of `minmax(0, 1fr)`.
- The browser check measured a card while it was still growing into place. It now waits until the card's animations have finished.
- A card check placed before the arrows of step 6 made phosphorus pentachloride fail at phone size, about every second run. An untouched 3D model starts to turn slowly after 2.5 seconds, the card took that long, and the check then dragged at atoms that were moving. The card check now comes after the arrows. The app is unchanged: a student who opens a card drags afterwards at what they see.

**Asks**
- Sam: D-0028 is provisional. The choices to look at are the list of 40 terms, the wording of each card, the examples, the blue highlight and the card's look.
- Sam: a card teaches the general rule with another example, so a student can work out their own answer from it the way they could from a textbook. The group card, for example, shows the periodic table that the first hint of step 1 shows. Say if a card should hold more back.
- learning, chem: the 40 cards were written and read by the session that built them. `docs/chemistry/sources.md` names one sentence that goes past its sources (ozone's two equal bonds).
- design: a highlighted word is a button, so a term of two or three words does not break across lines.
- platform: none of this has been on a real phone (W-003).

**Next step.** Sam looks at it on localhost:8081. On his word: commit, push and deploy.

## 2026-11-16 (lewis) The next action glows, the checks stay on screen, bonds are cut with a swipe, and the net dipole has aim points

**State.** Committed on 2026-11-16, on top of 292b38b, when Sam wrote "commit and push and deploy to the live link" for the second time that day. It was built on the branch `lewis/prompts-and-checks`. The push and the deploy follow this commit.

Sam sent three messages on 2026-11-16. D-0024 and D-0025 quote them in full. In short: make a question noticeable with a glow or a cute pointing finger, show how to work the board, keep the checks on screen, let atoms and bonds be added and removed in one move, make the dipole drawing clearer (an arrow may point into empty space or at a lone pair), and let the board be cleared from the 3D view. How each is built is this session's design (D-0026, provisional).

**Changed**
- Where to look next: `cue()` in `src/modules/lewis/store.ts` names the place of the next action. `src/modules/lewis/ui.ts` draws a glow there and a pointing hand, in the layer over the page. On the board the hand acts out the drag a step needs until the student has tried it once.
- How-to lines under the instruction of the place, bond and check steps and in free build (`howTo`, `howToFree`).
- A strip of three checks under the electron counter in every step that has a board (`checkChips`), each atom's electron count beside it from the place step on, and pairs beside the counter's numbers.
- A swipe across a bond cuts one of its lines. An atom carried to the Clear button comes off the board. In free build and in the bond and check steps, an atom dropped from the row onto another atom is bonded to it.
- Clear works from the 3D view and from steps 5 to 7: the flat board comes back, and a guided molecule returns to the place step. Undo straight after it puts back the atoms, the step, the view and every answer.
- Step 6: a label beside a bond's arrow says which atom it points at. The net dipole has aim points (outer atoms, lone pairs, the middle of the outer atoms, and straight away from it) that the arrow snaps to, each with a label, and a tap on one sets the arrow.
- Words changed: the bond step's instruction now states the goal ("Bond each oxygen atom to carbon."), and the how-to line under it says how. The place step's instruction moved from `src/modules/lewis/ui.ts` into `src/modules/lewis/guide.ts`.

**Checked.** The entry dated 2026-11-16 for this change in `docs/verified.md` has the numbers.

**Review.** A second session read the new code and reported eight findings. All were acted on:
- The hand acted out a dipole arrow on a nonpolar bond (C–H), where the right answer is the button. Now the atoms and the "Nonpolar, no arrow" button both glow, and the hand takes the three answers in turn, starting with a different one from molecule to molecule.
- Undo after a Clear in steps 5 to 7 brought back the atoms only. Now it brings back the step, the view and the answers, and the keyboard's focus moves to Undo when Clear switches itself off.
- The atom the hand carries had lost its eyes to the confetti's style rule.
- The glow could be drawn on an atom that was scrolled out of free build's row on a phone.
- The strip could read "3 of 4" beside a passed mark for a loose piece with an unpaired electron.
- An aim point stayed lit after the mouse left the board.
- The browser checks read what the layer meant to draw. They now read the glows and the hand from the page.
- A mouse button let go outside the window could keep the hand hidden until the next press.

**Found on the way.**
- A swipe whose sample point landed exactly on a bond's line did not cut it. Fixed in `swipe()` in `src/modules/lewis/scene.ts`.
- The first full run marked the electron total wrong for every negative ion in steps 2 and 3, before the student could have done anything about it: the ion's extra electrons are added in step 4. The strip now shows that check as waiting until then.
- On a phone the strip of checks took a fifth of the board's height, and the atoms got smaller. The strip now lies over the board's top rim there and keeps half its height clear.
- The first version of the glow animated a large blurred shadow, and a timing check elsewhere started to fail in the software-rendered browser. The glow's light is now a second box whose opacity pulses.
- In a headless browser the atoms keep sliding toward the middle of the board for several seconds after a bond, because the 3D loop runs slower than real time there. A check that reads an atom's place and then acts on it waits for the atoms to stop (`atomsAtRest()` in `scripts/check-browser.mjs`). The existing drags read the place right before each drag and are not affected.
- Three checks waited a fixed time for something that takes longer under load (a count fading in, the picture of the shells scrolling into view, two glows fading in). They now look until it has happened, with a limit.

**Asks**
- Sam: D-0026 is provisional. To look at: the hand and the glow, the three chips and their names, the swipe that cuts a bond, the bin, and the aim points for the net dipole.
- Sam: electrons are still changed with a tap on the atom and a button. A drag for electrons was left out to keep this change small.
- Sam: "the flexibility of the overall sim" in his second message was read as the list that followed it. If he meant more, that is a new ask.
- design, learning: the hand, the glow and every new label were reviewed by the session that built them only.
- platform: none of this has been on a real phone (W-003). The swipe and the bin were driven with a mouse and with touch in headless Chromium.

**Next step.** Sam looks at it on localhost:8081. On his word: commit, push and deploy.

## 2026-11-16 (lewis) Step 6: a student draws the dipole arrows, and steps 6 and 7 are committed

**State.** Committed on 2026-11-16, on top of 49d0d69, when Sam wrote "commit and push and deploy to the live link". The commit also holds the steps 6 and 7 work from 2026-11-13 (D-0021, W-020), which sat uncommitted in this checkout and never had a handoff entry. The push and the deploy follow this commit.

Sam asked on 2026-11-16, after opening the build with the buttons: "for the sigma pi bonds and polar dipole segment i wanted a segment where students can draw a line and be assesed of where the dipole goes towards" (D-0022). How the drawing works is this session's design (D-0023, provisional).

**Changed**
- Step 6, one bond: the student drags an arrow from one atom of the bond to the other, and the arrow points at the atom where they let go. A button, "Nonpolar, no arrow", answers a bond with no dipole. These replace the three buttons from 2026-11-13. A tap on each atom, or Enter on each atom, draws the same arrow.
- Step 6, the net dipole: after "polar" or "nonpolar", a polar molecule gets one more question. The student drags out of the middle atom of the 3D model, and an arrow within 35° of the net dipole on screen is right. The model turns to a side view first. The left and right arrow keys and Enter do it from the keyboard. The step is finished when the arrow is right.
- A wrong arrow stays on the board in the mistake color, its atoms shake, and the card names what it does. `docs/learning/wrong-answers.md` has the new rows.
- `src/chem/polarity.ts` has `netAsSeen`, which adds the bond dipoles as the viewer sees them. `judgeNetArrow` in `src/modules/lewis/guide.ts` decides right, wrong (and which wrong idea) or "seen end-on".
- From 2026-11-13, first committed here: `src/chem/polarity.ts`, `src/chem/orbitals.ts`, steps 6 and 7 in the guide, the store, the panel and the board, `tests/polarity.test.ts`, and the step 6 and 7 parts of `scripts/check-browser.mjs`.
- Decision records D-0021 (provisional), D-0022 (accepted, Sam's words) and D-0023 (provisional).

**Checked.** The 2026-11-16 entry in `docs/verified.md` has the numbers: `pnpm verify`, and every browser check at both sizes, with each arrow drawn by a real drag.

**Review.** A second session read the new code before the commit and reported ten findings. All ten were acted on: a tap that slid a few pixels on a front atom could commit an arrow to the atom hidden behind it, the crosshair cursor never showed on the 3D model, the first miss for an arrow at the δ+ atom printed both electronegativities, a wrong net dipole no longer matched the model after the model was pulled out of shape, open hints changed to the bond hints once the net dipole was right, the keyboard's focus stayed on an atom that had been switched off, the keyboard could set the net dipole while the model was still lifting, an outer atom in front of the middle atom blocked the net dipole, the card for an arrow against a single bond arrow said "arrows", and three gaps in the checks. Nobody has re-read the fixes. The unit tests and the browser checks ran on them.

**Asks**
- Sam: D-0023 is provisional. The choices to confirm: an arrow per kind of bond, the "Nonpolar, no arrow" button, the net dipole as a second drawing, and 35° as close enough.
- Sam: D-0021 is still provisional. His message names "the sigma pi bonds and polar dipole segment" and does not say whether steps 6 and 7 are where it belongs.
- Sam: nothing is drawn in step 7. If he wants a drawing for sigma and pi bonds too, that is a new ask.
- learning, design, chem: this change touches all three review areas (words a student reads, what a student sees, a new chemistry function). The one review so far was of the code.
- platform: the arrows were drawn with a mouse and with touch in headless Chromium only. A real phone has not been tried (W-003). On the 3D model, turning uses the pointer event's `movementX`, which this session did not check in Safari.

**Next step.** Push, deploy with `pnpm pages:deploy`, and run the browser checks against the live site. Then Sam's answers on D-0021 and D-0023.

## 2026-11-13 (lead) Team structure, folder rule files and doc channels

**State.** Landed on main in the commit that adds this file, on top of a8f4cd9. Sam said "land it" on 2026-11-13 (D-0016). It is not pushed: a push needs his go-ahead (R9).

Sam asked for it on 2026-11-13: "[...] i want to set up a proper industry level environment in the repo so that multiple teams can work under an industry structure and heirarchy".

**Changed**
- Teams and owners: `docs/ownership.json` gives every path to one of seven roles, and `docs/org.md` says who decides what. `pnpm who <path>` prints the team, the reviewers, the rule files, the docs, the fast check and the decisions for a path.
- Folder rule files: an `AGENTS.md` (60 lines at most) in `src/chem/`, `src/modules/`, `src/modules/lewis/`, `src/app/`, `src/shell/`, `src/theme/`, `tests/`, `scripts/` and `docs/`, each with a `CLAUDE.md` that imports it. The root `AGENTS.md` (80 lines at most) points to them. Every rule that was in the root `CLAUDE.md` at a8f4cd9 moved to the folder it is about.
- Doc channels under `docs/`: 20 decision records, living specs for architecture, chemistry, learning, design and platform, a roadmap, a record of what was checked, and a mistakes log. `docs/README.md` is the map.
- The decision records: 12 record a decision of Sam's, with his words quoted and only his words under "Decision". 8 record the build session's choices, 2 of them `provisional` because they are Sam's to confirm (D-0007, D-0017).
- `README.md` now holds only what the app is, the live demo's address, how to run it, and which file to read next. Its other sections moved: the stack to `docs/architecture.md`, the layout to each folder's "Files" list, look and motion to `docs/design/look-and-motion.md`, wrong answers to `docs/learning/wrong-answers.md`, adding a module to `src/modules/AGENTS.md`, the chemistry to `docs/chemistry/sources.md`, what is verified to `docs/verified.md`, not done yet to `docs/roadmap.md`, publishing the demo to `docs/platform/expo.md`.
- The Expo rules that were the root `AGENTS.md` moved to `docs/platform/expo.md`.
- Checks: `scripts/check-repo.mjs` with `scripts/lib/repo.mjs` and `tests/repo.test.ts` (57 tests). `pnpm verify` now runs lint and the repo check as well. `docs/platform/verify.md` lists every failure code.
- Process: `CONTRIBUTING.md`, `.github/pull_request_template.md`, `.github/workflows/verify.yml`, and `.gitattributes` (when two branches each add a handoff entry, git keeps both).

**Checked.** See the lead session's 2026-11-13 entry in `docs/verified.md`: `pnpm verify` (341 unit tests) and the shell browser checks at both sizes, on the branch before landing.

**A mistake on the way.** M-0003: a linked `node_modules` let pnpm in the lead's worktree reinstall the main checkout's packages. It was repaired within a minute, no source file changed, and the build session was told.

**Asks**
- Sam: a push. The first push that includes `.github/workflows/verify.yml` runs CI for the first time (W-012).
- Sam: the decision records quote his chat messages word for word, typos included, and the repo is public (D-0014). Fine as is, or should the quotes be tidied or shortened before the push?
- Sam: D-0007 and D-0017 are `provisional`. The step split, the list of twenty molecules, free build, bonding by dragging, and the three-part card with the answer last are the build session's choices.
- Sam: the voice rules are in a file on his machine. `docs/AGENTS.md` (DOC7) has a short version. Should a fuller copy go in the repo?
- Build session (lewis, chem): when this landed, the main checkout held uncommitted work, with new files `src/chem/orbitals.ts`, `src/chem/polarity.ts` and `tests/polarity.test.ts`. `pnpm verify` now fails there until each new file has a bullet in its folder's "Files" list (`src/chem/AGENTS.md`, `tests/AGENTS.md`) and the test has an owner in `docs/ownership.json`. `pnpm check:repo` prints the exact lines. New notes go in the docs under `docs/`, and the README stays short.

**Next step.** The lead reviews the build session's next change against the rules here, as the first change made under them. Then the items under "Now" and "Waiting on Sam" in `docs/roadmap.md`.
