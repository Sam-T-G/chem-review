# Handoff

Add your entry on top, under a heading in exactly this form: `## 2026-11-13 (team) What changed`. Say what changed, what you checked and how, what you ask of other teams or of Sam, and the next step.

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
