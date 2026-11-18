# Mistakes

What went wrong, what it cost, and the rule or check that catches it next time. Add the entry before the fix. The best prevention is a check in `scripts/`. Newest last.

## M-0001 The first look was quiet, and Sam asked for a redesign

- Date: 2026-11-12. Team: design.
- What happened: the first build was a clean, quiet panel beside a 3D board. It passed every check. Sam called it "uninspired" and asked for idle animations, interactive elements and visual appeal.
- Cost: the module's look and the home screen were redesigned the same day.
- Prevention: D-0010, and the list "A first version has these in it" in `docs/design/look-and-motion.md`. Design reviews anything a student sees before it is called done.

## M-0002 Eyes with whites and pupils that followed the pointer read as creepy

- Date: 2026-11-13. Team: design.
- What happened: the redesign gave each atom white eyes with dark pupils that tracked the pointer. Sam: "i think the googly eyes are a little creepy, can we go for like a fall guys aesthetic".
- Cost: the faces were redrawn in the three places that draw them.
- Prevention: D-0011. A character in this app starts from solid eyes.

## M-0003 A linked node_modules let one worktree reinstall another checkout's packages

- Date: 2026-11-13. Team: lead.
- What happened: the session building the team structure made a worktree and linked its `node_modules` to the main checkout's to save an install. `pnpm exec vitest` in the worktree found that the installed packages did not match the worktree's older lockfile and reinstalled them, through the link, into the main checkout. Three packages another session had added there (expo-haptics, @expo-google-fonts/fredoka, @fontsource-variable/fredoka) were missing for about 45 seconds.
- Cost: no source file changed. A build or check in the main checkout could have failed in that window. The main checkout was reinstalled from its own lockfile, the three packages were confirmed to resolve again, and the other session was told.
- Prevention: every checkout and worktree gets its own install (`CONTRIBUTING.md`, step 2). `pnpm check:repo` fails with `DEPS-LINK` when `node_modules` is a link.

## M-0004 Changing one atom's count also animated the count beside it

- Date: 2026-11-13. Team: lewis. Logged by the lead session from Sam's message and the build session's README.
- What happened: Sam: "when i click up to increment the amount of carbons, the number assigned to hydrogen also has the incrementing animation". The panel and the counter were redrawn as a whole, so every number replayed its animation.
- Cost: a fix the same day.
- Prevention: the rule "Only what changed moves" in `docs/design/look-and-motion.md`. `scripts/check-browser.mjs` checks that an explanation already on screen does not move again. `scripts/check-browser.mjs` also checks the counter's own numbers: after + on carbon, carbon's number animates and hydrogen's does not, and after a new bond the two counter tiles that changed animate and the total does not.

## M-0005 Some text blinked in and out when the page changed

- Date: 2026-11-13. Team: lewis. Logged by the lead session from Sam's message and the build session's README.
- What happened: Sam: "some text pops in and out very briefly, well they kind of "blink" in and out very briefly, can we make it consistent". Before the fix, text had more than one entrance animation.
- Cost: every text change in the module was moved to one transition the same day.
- Prevention: D-0019. `scripts/check-browser.mjs` checks that one arrival animation is in use, with no leftover slide or blink.

## M-0006 A tap on text that was still arriving could land on the wrong control

- Date: 2026-11-13. Team: lewis. Found by the build session's phone run of `scripts/check-browser.mjs`, on the build with steps 6 and 7.
- What happened: D-0019 made every piece of text inflate into place, starting at 0.4 of its size. The molecule picker got the same entrance. While a piece is growing, its buttons are moving, so a tap aimed at one row of the picker can land on the row beside it. In the phone run of all 20 molecules, 3 taps on the picker opened the wrong molecule (NO2−, ClF3 and SO2 were asked for). The same entrance was already on the live site at commit a8f4cd9, where the phone run happened to pass.
- Cost: no report from a student. A fast tap in the first half second after a step opens could have picked the wrong answer.
- Prevention: a piece that is arriving takes no taps until it has stopped moving (`settle` in `src/modules/lewis/ui.ts`, and the rule in `docs/design/look-and-motion.md`). `scripts/check-browser.mjs` checks that a piece takes no taps while it arrives and takes them once it has, and every one of its picker taps checks that the molecule asked for is the one that opened.

## M-0007 One session killed every headless browser on the machine, including another session's check run

- Date: 2026-11-17. Team: platform.
- What happened: two full desktop runs in the main checkout each failed one "lift finished" check (XeF4 at 0.96, then CH4 at 0.97): the 3D model had not finished rising after the fixed wait. The load average was about 30 on 14 cores, and `ps -Ao pcpu,comm -r` showed a headless Chromium at about 660% CPU. The session took it for a browser left behind by its own stopped runs and ran `pkill -f chrome-headless-shell`. Later it found that other sessions were running browser checks from their own worktrees at the same time (`node scripts/check-shapes.mjs phone`, from `chem-review-quiz`), so the browser it killed was most likely theirs.
- Cost: another session's check run was probably cut off without warning. The two timing failures in the main checkout came from sharing the machine, not from the change under test. The run after that passed (1250 checks).
- Prevention: before killing a browser, find its parent with `ps -o ppid= -p <pid>` and `lsof -a -p <ppid> -d cwd`, and kill only the processes of your own run. Before reading a timing failure in these checks, look at the load average and at `pgrep -fl check-`, and say in the handoff when another session's checks were running.

## M-0008 A rule the slides give for ozone was coded as a check on a number, so it fired for other molecules

- Date: 2026-11-17. Team: chem.
- What happened: `src/chem/polarity.ts` made a bond with ΔEN 0 polar when its two atoms carry unlike formal charges. The slides give that rule for ozone, where the atoms are the same element. The code tested `ΔEN === 0`, which is also true of P–H, C–S, C–I and N–Cl on the course's rounded table, so PH2− came out polar. The builder's own tests passed, because they expected what the engine returned.
- Cost: none reached a student. A reviewer who worked all 43 pool molecules by hand found it before the pool was used.
- Prevention: the rule now needs the two atoms to be the same element, with a test for a middle atom whose unlike neighbours have equal table values (`tests/polarity.test.ts`). A new pool or rule gets a row-by-row review by someone who did not write it, working each answer by hand from `docs/chemistry/sources.md`.

## M-0009 A rule added for one worksheet molecule (CH3+) let stripped atoms pass in free build

- Date: 2026-11-17. Team: chem.
- What happened: `src/chem/assess.ts` learned to accept a middle atom that is short of a full shell when its best drawing is short (CH3+ holds 6). With no target molecule the charge is read off the board, so an oxygen with its lone pairs removed, CH2 2+ and BH2+ each matched their own best drawing and were called complete.
- Cost: none reached a student. The same review found it.
- Prevention: with no target, the rule needs the middle atom at exactly 6 electrons and a formal charge of at most +1. `tests/assess.test.ts` holds six stripped boards that must stay incomplete. A rule that loosens a check gets tests for what must still fail.

## M-0010 A wrong-answer card named the answer to the next question

- Date: 2026-11-17. Team: lewis, learning.
- What happened: step 5 asks for the electron geometry, then the molecular geometry, whose first pick is final. For xenon difluoride, picking linear for the electron geometry got "Linear is where the 2 atoms bonded to xenon sit: the molecular geometry." The package's test checked that no early card names the electron geometry, the open question. Nothing checked the question after it.
- Cost: none reached a student. The wording review caught it before the push.
- Prevention: `tests/guide.test.ts` holds every electron geometry card, for every problem and pick, to never say "the molecular geometry". `scripts/check-browser.mjs` checks the same on water. When two questions follow each other, a card for the first is tested against the answer of the second.

## M-0011 The question built to tell the two geometries apart could not be answered with the wrong kind of name

- Date: 2026-11-17. Team: lewis, learning.
- What happened: Sam asked for the app to tell electron geometry and molecular geometry apart. The electron geometry question offered the five electron geometries only, so a student could not answer "bent" for water. Of 80 possible wrong picks over the 20 molecules, 1 was a molecular geometry.
- Cost: caught in review before the push. The first build would have shipped a question that tests the count of groups and little else.
- Prevention: the picks now hold the molecular geometries that the same number of groups can make (`geometryPicks`, D-0033), with a card for that mistake. For a feature that exists to separate two ideas, list the mistake it must catch and test that a student can make it.

## M-0012 Free build threw on a finished triiodide ion

- Date: 2026-11-17. Team: lewis.
- What happened: `netReason` in `guide.ts` read the first polar bond to say why the dipoles cancel. In I3− no bond is polar by ΔEN, and the dipoles that cancel come from formal charges, so the list was empty and the panel threw. The code had been live since steps 6 and 7 landed. A reviewer printing free build lines for 27 boards found it.
- Cost: a student who built I3− in free build got a panel that stopped updating. No report.
- Prevention: the sentence now covers that case, with a test (`tests/guide.test.ts`, the triiodide ion). The free build tests need boards beyond the guided molecules: ions, molecules with no polar bond, and atoms of one element with unlike formal charges.

## M-0013 A fix made from a reviewer's reasoning, with no run behind it, broke taps on a phone

- Date: 2026-11-17. Team: lead, lewis.
- What happened: a code reviewer traced a path in which the panel's one-time scroll to a question undoes the panel's scroll to a new explanation. The reviewer had no browser and said so. The lead changed the scroll to be decided once, on the first frame after the question arrives. On a phone the answer buttons of step 6 arrive in view and are then pushed down by text that is still growing above them, and the old code scrolled them back. With the change they stayed half hidden, and the phone run timed out on a tap for PCl5 and SF6.
- Cost: two rounds of browser checks, about 90 minutes, on the day Sam asked for the release as soon as possible. Nothing reached a student.
- Prevention: a finding that was traced and never run gets a browser check that shows the fault before any code changes. If the check cannot show it, the finding goes to `HANDOFF.md` as open and the code stays. The change was taken out, and CODE2-1 is listed as open.

