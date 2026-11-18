# What has been checked

Dated entries, newest first. Each says what was run, on which build, by whom, and what it did not cover. Add an entry when you verify something a reader would otherwise have to take on trust. A claim with no entry here has not been checked.

## 2026-11-18: the shapes quiz, the exercises and the board, all open (lead session)

Run in the worktree `chem-review-review` on the branch `lewis/review-modes`, on the tree that was pushed to main. The web build under test was made at e4c9516; the commits after it change check scripts and docs only. It was served on port 5220. The runs started late on 2026-11-17 and ended after midnight.

- `pnpm verify` exits 0: typecheck, lint, 987 unit tests in 19 files, `check-repo: ok`, and the production web build.
- Browser, real input (headless Chromium with a software renderer), one run at a time under the run's browser lock, 0 failed in each run counted here:
  - `check-browser.mjs`, all 20 guided molecules start to finish: 764 and 747 checks with touch at 390 x 844 (molecules 1 to 10, 11 to 20), 782 and 767 with a mouse at 1360 x 840. New in each run: a pick of "Molecular geometry" on step 5's model ends with that step, and step 6 draws every electron group and has no switch.
  - The extras: 315 with touch, 414 with a mouse. The key terms: 81 and 89. Home screen with three cards, opening each, the way back and saved progress: 152 and 154.
  - `check-board.mjs` (the switch between the two geometries, the two-atom models, turning the model): 162 with touch, 165 with a mouse.
  - `check-shapes.mjs` (the shapes quiz): 163 with touch, 180 with a mouse.
  - `check-exercise.mjs` (the exercises): 99 with touch, 99 with a mouse.
- Runs that failed on the way, and why:
  - Step 6 of SF6 with touch: the bond never answered and a tap timed out, in 2 runs of 4 on this build, and a few times in earlier builds. The check pressed a point 9 px clear of other atoms, inside the board's 10 to 12 px touch slack, so the press sometimes landed on a fluorine in front of sulfur (M-0020). With a 14 px margin SF6 passed 6 runs of 6 under a load average of 30 to 60, and then passed in both full runs above. The entry below this one blames an earlier failure of the same kind on the lead's scroll change: that was not proven (M-0013, corrected).
  - `check-board.mjs` with touch, inside the full batch: 71 passed and 67 failed. One failure was the check still expecting the switch's pick to outlast the model, which the lead changed on purpose (M-0017). The other 66 followed a tap that opened a key-term card, which then covered the controls. Load average 31. Run alone on the same build: 161 passed and that 1 failed, with no page error. After the expectation was corrected: 162 passed, 0 failed.
- Looked at by the lead, in screenshots: step 5 on a phone with four tabs, the back button and the name over the picks; the board builder's screenshots of the switch at both sizes and of HCl, N2, O2, IF and CN− lifted.
- Eleven independent review reports stand behind this tree. `HANDOFF.md` lists what they found and what is still open.
- The live site after the first push (8732a4d), checked against https://sam-t-g.github.io/chem-review: home screen and saved progress, 92 with a mouse and 90 with touch, 0 failed; one molecule start to finish with touch, 80, 0 failed; the extras with a mouse, 400 passed and 12 failed at a load average of 40 to 49, then 408 passed and 1 failed at 25. Every failure was a timing check of the 3D lift ("lift finished", "Flat drawing puts the model back on the board").
- Not checked: a real phone or tablet (W-003), Safari's engine (W-012). Where the switch stands on a phone was looked at for water only. The exercises' third fix round and the lead's last changes have had no second read.
- The machine was shared the whole time with other sessions' compiles and browser runs (load average 10 to 60 on 14 cores).

## 2026-11-17: the two geometry names, with the shapes quiz and the exercises closed (lead session)

Run in the worktree `chem-review-review` on the branch `lewis/review-modes`, on the tree that was pushed to main: the source at 8da9270, which holds main's af57d17 (the net dipole label). The web build under test was made from that source and served on port 5220.

- `pnpm verify` exits 0: typecheck, lint, 882 unit tests in 17 files, `check-repo: ok`, and the production web build.
- Browser, real input (headless Chromium with a software renderer), each run under the run's browser lock:
  - All 20 molecules start to finish. With touch at 390 x 844: 751 checks for molecules 1 to 10 and 731 for 11 to 20, 0 failed. With a mouse at 1360 x 840: 769 checks for molecules 1 to 10 and 751 for 11 to 20, 0 failed.
  - New in each run: the picks for the electron geometry hold the five electron geometries and the molecular geometries of that many groups (6 or 7 picks), the right pick is confirmed as "The electron geometry is ...", and every polar molecule's net dipole label is clear of the panels over the board (main's check).
  - The extras: 409 checks with a mouse and 311 with touch, 0 failed. New in them: water's electron geometry answered "bent" gets the card that says bent is a molecular geometry, lists all five electron geometries and never says "the molecular geometry"; the board rings oxygen's 4 groups; the second miss gives the rule; a two-atom molecule in free build reads "the molecular geometry is linear ... The electron geometry is given as linear too."
  - The key terms: 89 checks with a mouse and 81 with touch, 0 failed.
  - Home screen, opening the module, the way back and saved progress: 92 checks with a mouse and 90 with touch, 0 failed. The home screen shows one card and the module two tabs, because both parts are closed.
- Runs that failed on the way, and why:
  - Phone, molecules 11 to 20, on an earlier build: SF6, BrF5 and XeF4 failed "the electron geometry choices come fully into view". Seven picks took four rows, 220 px in a 221 px panel (measured in the page). With 6 groups the picks now add square planar alone.
  - Phone, molecules 11 to 20, on the next build: PCl5 and SF6 timed out on a tap in step 6. The lead's change to the panel's one-time scroll caused it (M-0013). The change was taken out and the run passed.
  - Both extras runs once failed 2 checks that still expected the old sentences. The check script was corrected.
  - "PCl5: lift finished" failed twice with a mouse (0.96 and 0.99) while two of the lead's own batches ran side by side by mistake: an earlier batch was not stopped, because an unquoted list of process ids is one word in zsh and `kill` refused it without a message. Run alone, the same run passed all 751.
- Looked at by the lead, in screenshots: water at step 5 on desktop with "Bent" marked wrong and its card; xenon difluoride at step 5 on a phone with its 7 picks in 3 rows inside the glow; hydrogen chloride in free build on the 3D model with both geometries "Linear" and "Bond angle: none (2 atoms)".
- Six independent reviews ran before this (chemistry, wording and code, for the quiz and exercises and then for the geometry names). `HANDOFF.md` lists what they found and what is not fixed.
- Not checked: a real phone or tablet (W-003), Safari's engine (W-012). `scripts/check-shapes.mjs` and `scripts/check-exercise.mjs` were not run on this tree, because both parts are closed; their unit tests are in the 882. On a phone the question line of step 5 scrolls out of the panel when the picks take three rows: seen in the screenshot, not fixed.
- The machine was shared the whole time: two fixers, one builder and another session of Sam's ran browser checks too (load average 13 to 25 on 14 cores).

## 2026-11-17: the net dipole label stays clear of the strip of checks on a phone (build session, team lewis)

Run in the main checkout on `main` at c8f14ad with the change uncommitted. Load average 23 to 29 on 14 cores the whole time (`uptime`), from other sessions' browser checks.

- `pnpm verify` exits 0: 455 unit tests, `check-repo: ok`, the production web build.
- Browser, real input, against that build on port 5210. The new check (`netTagClear`) passed everywhere it ran: each polar molecule in step 6 and free build water, at both sizes. It reads the label's box against `.mb-top`, `.mb-ledger` and `.mb-checkbar`.
  - All 20 molecules with touch at 390 x 844: 1197 passed, 8 failed, all of them drawing the bond arrows on PCl5 and XeF4. Those two alone: 58 and 66 checks, 0 failed.
  - All 20 with a mouse: 1257 passed, 2 failed ("lift finished" at 0.97 and 0.96). Alone, CH4 still failed at 0.99 once more. `setInsets` then stopped re-fitting the camera when only `clear` changes, and CH4 alone passed 62 checks.
  - The extras with touch: 267 passed, 0 failed. With a mouse: 351 passed, 1 failed ("Flat drawing puts the model back on the board", read 1.6 s after the press). The same run on the code before this change failed that check and one more (347 passed, 2 failed), so the miss is the load, not this change.
- Looked at by the session: `shots/phone-H2O-polar.png`, the label sits beside the arrowhead below the strip.
- Not checked: a real phone (W-003), Safari's engine (W-012), a full desktop run at normal load.

## 2026-11-17: free build shows electronegativity, each bond's ΔEN and the dipoles, with the key terms (build session, team lewis)

Run in the main checkout on the branch `lewis/key-terms`, on the working tree that holds both the key terms (D-0028) and the free build dipoles (D-0029), before the commit.

- `pnpm verify` exits 0: typecheck, lint, 455 unit tests in 11 files, `check-repo: ok`, and the production web build.
- Browser, real input (headless Chromium with a software renderer), against that build served on port 5210:
  - All 20 molecules start to finish with touch at 390 x 844: 1213 checks, 0 failed. With a mouse at 1360 x 840, run beside the phone run: 1249 passed and 1 failed (XeF4: the model was 0.96 of the way up where the check wants above 0.99). Run alone twice more: CH4 failed the same check at 0.97 while another session's browser checks were running on the machine (M-0007), then 1250 checks, 0 failed.
  - The extras: 349 checks with a mouse and 265 with touch, 0 failed, each run alone. Run side by side once, the desktop run failed "Flat drawing puts the model back on the board" one time and passed alone. Both misses are the 3D model's lift read before it finished, under the load of two runs.
  - The key terms: 79 checks with a mouse and 71 with touch, 0 failed.
  - Home screen, opening the module, the way back and saved progress: 79 checks with a mouse and 77 with touch, 0 failed.
- Looked at by the session that built it, in screenshots: free build water on the flat drawing (desktop) and on the 3D shape (desktop and phone). The arrows point at oxygen, δ+ and δ− sit on the right atoms, and the net dipole points out of oxygen away from the hydrogens.
- Other sessions ran browser checks from their own worktrees during these runs, so the machine was loaded (load average 20 to 34 on 14 cores).
- Not checked: a real phone or tablet (W-003), Safari's engine (W-012), and free build boards other than water in the browser (aluminum fluoride, ozone and ethane are covered by unit tests only).

## 2026-11-16: the glow and the hand, the strip of checks, one-move controls, aim points (build session, team lewis)

Run in the main checkout on the branch `lewis/prompts-and-checks`, on the working tree on top of 292b38b before it was committed. `pnpm verify` was run once more on that tree just before the commit and passed with the same numbers. The browser checks were not rerun after that.

- `pnpm verify` exits 0: typecheck, lint, 418 unit tests in 10 files, `check-repo: ok`, and the production web build.
- Browser, real input (headless Chromium with a software renderer), against that build served on port 5210:
  - All 20 molecules solved start to finish at 1360 x 840 with a mouse (1192 checks) and at 390 x 844 with touch (1152 checks), 0 failed. New in each run: the glow is on the control or the atoms the next action needs at every step, read from the page itself; the three checks are over the board from the place step on and end at "pass pass pass"; each atom shows its electron count in the place step; the label beside a bond's arrow names the atom it points at; the net dipole has its aim points, and every second polar molecule sets its net dipole with a tap on one.
  - The extras pass at both sizes (333 checks with a mouse, 252 with touch). New in them: a swipe across a bond cuts it and a swipe across bare board changes nothing; an atom carried to the Clear button comes off the board, and the button says so while the atom is carried; in free build an atom dropped on another is bonded to it; Clear from the 3D view and from step 7, and Undo after it putting the step, the view and the answers back; the hand acting out the first drag, and the atom it carries keeping its face.
  - Home screen, opening the module, the way back and saved progress pass at both sizes (76 checks with a mouse, 74 with touch).
- A second session read the new code and reported eight findings. `HANDOFF.md` lists them. All eight were acted on before these runs. The fixes have had no second read.
- Looked at by the session that built it, in screenshots at both sizes: the glow and the hand on a question, the hand acting out a bond, the strip in each state, the bin, the swipe's line, the aim points with their labels.
- Not checked: a real phone or tablet (W-003), Safari's engine (W-012), frame rate on a real device, and whether a student finds the hand's demonstration and the aim points clear. The hand's demonstration and the glow were seen as still frames, never at full speed.
- Reduced motion, one look on the development server with the browser's setting on, at the bond step of carbon dioxide: both atoms are ringed, the hand points at the outer atom and stays where it is, neither the hand's poke nor the glow's pulse runs, and the page reports no error. The full runs did not have that setting on.

## 2026-11-16: steps 6 and 7 with the dipoles drawn (build session, team lewis)

Run in the main checkout, on the working tree that was committed on top of 49d0d69 the same day.

- `pnpm verify` exits 0: typecheck, lint, 397 unit tests in 10 files, `check-repo: ok`, and the production web build.
- Browser, real input (headless Chromium with a software renderer), against that build served on port 5210. Every dipole arrow in these runs is drawn with real mouse or touch events, and the script works out where each arrow should point from the atoms' places on screen and the slides' electronegativities, never from the app:
  - All 20 molecules solved start to finish through step 7 at 1360 x 840 with a mouse (670 checks) and at 390 x 844 with touch (670 checks), 0 failed. Each polar bond's arrow and each of the 9 net dipoles is drawn.
  - The extras pass at both sizes (233 checks with a mouse, 184 with touch). New in them: an arrow drawn the wrong way round on C–O, an arrow drawn on the nonpolar C–H bond, a bond's arrow drawn on the flat drawing, a net dipole drawn the opposite way (the board redraws it within 12° of where it was drawn), a net dipole drawn while it points at the viewer (no try counted, a message, and the model turns back), and at desktop size the bond arrow and the net dipole from the keyboard on formaldehyde.
  - Home screen, opening the module, the way back and saved progress pass at both sizes (50 checks each).
- A second session read the new code and reported ten findings. `HANDOFF.md` lists them. All ten were acted on before these runs. The fixes themselves have had no second read.
- Not checked: a real phone or tablet (W-003), Safari's engine (W-012), frame rate, and whether 35° is the right tolerance for a student's hand. The check for turning the model drags on the empty corner of the board, which worked with a mouse and with touch in Chromium. It was not tried in another browser.
- Not checked here: the live site. The deploy came after this entry was written.

## 2026-11-13: the team structure (lead session)

Run before landing, on the branch `lead/team-structure` on top of commit a8f4cd9, in its own worktree with its own install. The landed commit holds the same files.

- `pnpm verify` exits 0: typecheck, lint, 341 unit tests in 9 files (the 284 on main, plus 57 for the repo checks), `check-repo: ok`, and the production web build. The build lists four static routes (index, lewis, the sitemap and not-found), so the rule files in `src/app/` are not picked up as screens.
- Browser, real input (Chromium), against this branch's build served on port 5211: home screen, opening the module, methane solved start to finish, the back button and saved progress pass at desktop size with a mouse and at phone size with touch (32 checks each). The rest of the browser checks were not run: this branch changes no file that goes into the app, and the build session is running them on the same commit (W-019).
- A fresh agent session was given one file to read, `src/chem/vsepr.ts`, and nothing else. The root `AGENTS.md` and `src/chem/AGENTS.md` arrived in its context without being opened, through the `CLAUDE.md` beside each, and it quoted rule C6 word for word. So in Claude Code a folder's rules load when a file in that folder is read. No other agent tool was tried.
- The same session then prepared for a task as team lewis using only the repo's own files: 15 files, 607 lines, and it answered seven questions about owners, reviewers, docs, checks, imports, a provisional decision and the handoff heading, each with a file and line. The ten points where it was slowed down are fixed.
- Two more review sessions read the first draft. One read the checker's code: 14 findings. Most are fixed with a new test. Two are fixed without one (git variables set by a hook, and tables in the docs that disagreed with `docs/ownership.json`). Three limits are written down in `docs/platform/verify.md` instead of fixed. The other read the wording and the facts in the docs: 30 findings, all acted on, among them eight decision records that credited Sam with details the build session chose.
- Not run in the main checkout: another session had uncommitted work there when this landed, so `pnpm verify` was not run in that folder.
- Those three reviews ran before the branch was moved onto a8f4cd9. Nothing written after them has had a second independent read: the fixes, three decision records (D-0018 to D-0020), two mistake entries, and the updates to the look, wrong-answer, hosting and roadmap docs.
- Not run: the CI workflow. It runs for the first time on the first push that includes it (W-012).

## 2026-11-13: the redesign, commit a8f4cd9 (build session)

Moved here from the README as the build session wrote it for commit a8f4cd9. A line dated 2026-11-12 was checked on the build before the redesign. The lead session did not rerun any of this except where its own entry above says so.

- `pnpm verify`: typecheck, 284 unit tests, production web build. `pnpm lint` is clean, and `expo-doctor` passes 20 of 20 checks.
- **Unit tests** cover the bonding rules, the reference structure for 31 species, the checker, the shape table, the repulsion model (every shape settles into the textbook arrangement), the flat layout, the step flow in the store, and the guide's wording (including a scan of every sentence for banned phrasing). One test solves all 20 problems using only the hints the app gives, and another checks that every hinted move is one the board accepts. Every claim a wrong-answer card makes is checked against every problem it can appear in.
- **Browser, real input (Chromium), against the GitHub Pages build served from `/chem-review`:** home screen, opening the module, methane solved start to finish, the back button and saved progress pass at 1360 x 840 with a mouse and at 390 x 844 with touch (32 checks each).
- **Browser, the rest, run against the live site on 2026-11-13** (https://sam-t-g.github.io/chem-review/, which serves this commit; `MB_URL` set to that address for `scripts/check-browser.mjs`): all 20 molecules solved start to finish at 1360 x 840 with a mouse and at 390 x 844 with touch (274 checks each); the wrong-answer, hint, refused-move, undo, keyboard and free-build checks (134 on desktop, 128 on phone); and the home-screen checks again at both sizes (32 each). Every check passed. This closes W-019.
- **Safari's engine (2026-11-12, before the changes listed under iOS below):** the module loads and draws correctly in Playwright's WebKit. The real-input checks have not been run there.
- **iOS (2026-11-12, before the new faces, the wrong-answer cards and the text transitions):** the app runs in the iPhone 17 Pro simulator (iOS 27) through Expo Go. The home screen is native UI (the four atoms, the fonts and the card all draw), and the Lewis module loads inside it with the 3D board drawing. Nothing was tapped or dragged in the simulator, so touch on iOS is not checked.
- **Looked at, not measured:** the motion. Screenshots at both sizes were reviewed for every guided molecule's flat and 3D view, the count step, a wrong answer with a hint, the picker and free build. The text transitions and the rings on the board were reviewed as frames frozen at set moments, never at full speed. No frame rate was measured, and the browser checks run on a software renderer, so they say nothing about speed on a real phone.
- A read-only code review reported 15 defects in the first version; all 15 are fixed. Twelve have an automated test. Three do not: a mouse release that never reaches the page, freeing GPU objects when the board is rebuilt, and one sentence in free build that printed the wrong electron count.
