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
