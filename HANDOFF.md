# Handoff

Add your entry on top, under a heading in exactly this form: `## 2026-11-13 (team) What changed`. Say what changed, what you checked and how, what you ask of other teams or of Sam, and the next step.

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
