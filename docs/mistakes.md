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
- Prevention: the rule "Only what changed moves" in `docs/design/look-and-motion.md`. `scripts/check-browser.mjs` checks that an explanation already on screen does not move again. `[TBD: whether a check covers the counter's own numbers]`.

## M-0005 Some text blinked in and out when the page changed

- Date: 2026-11-13. Team: lewis. Logged by the lead session from Sam's message and the build session's README.
- What happened: Sam: "some text pops in and out very briefly, well they kind of "blink" in and out very briefly, can we make it consistent". Before the fix, text had more than one entrance animation.
- Cost: every text change in the module was moved to one transition the same day.
- Prevention: D-0019. `scripts/check-browser.mjs` checks that one arrival animation is in use, with no leftover slide or blink.
