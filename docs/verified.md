# What has been checked

Dated entries, newest first. Each says what was run, on which build, by whom, and what it did not cover. Add an entry when you verify something a reader would otherwise have to take on trust. A claim with no entry here has not been checked.

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
