# Roadmap

What is being worked on, what comes next, and what is waiting. The lead orders it. Any team adds an item with the next free id. When an item is finished, move its row to "Done" at the bottom: decision records and handoff entries cite these ids, so a row is never deleted.

## Now

| ID | Team | Item | Notes |
|---|---|---|---|
| W-019 | lewis, platform | Finish the full browser run on commit a8f4cd9: all 20 molecules at both sizes, and the wrong-answer, hint, refused-move, undo, keyboard and free-build checks | The build session was rerunning them against the live site on 2026-11-13. Only the home screen and methane had passed there (`docs/verified.md`) |

## Next

| ID | Team | Item | Notes |
|---|---|---|---|
| W-003 | platform | Try the app on real devices | Simulator and headless browsers only so far. Touch on iOS has never been exercised. Android has never been run (no Android SDK on this Mac) |
| W-018 | platform | Store builds for iOS and Android | They go through EAS, Expo's build and store-upload service, and need an Expo account plus Apple and Google developer accounts. Needs Sam's go-ahead |
| W-005 | platform | Feel the phone vibrate on a drop, a bond, a refused move and a finished step | The calls are wired. A simulator has no motor, so nobody has felt them |
| W-006 | chem | Retune the repulsion strengths so the seesaw's two middle bonds settle under 120° | They settle about 125° apart. The 13-shape test has to keep passing |
| W-011 | design, shell | Move the element ball colors out of the Lewis module to a shared place | Removes the one import exception in `docs/ownership.json` |
| W-012 | platform | Run the browser checks in CI, and the real-input run in Safari's engine | The CI workflow has never run. It runs for the first time on the first push that includes it |
| W-013 | lead | A license file | Sam picks the license |
| W-014 | lead | The name and the icon | Both are placeholders. Sam decides |
| W-015 | platform | Check the iOS "DomWebView" development error in a release build | D-0003 |

## Later

| ID | Team | Item | Notes |
|---|---|---|---|
| W-007 | chem | Molecules with more than one middle atom, odd-electron molecules, typed-in formulas | Ethane and hydrogen peroxide can be built in free build but have no reference answer and no 3D shape. NO and NO2 have no reference answer |
| W-008 | lewis | Rewrite the panel as React components | It is hand-written DOM today and works on every platform. React would make pieces easier to share with other modules |
| W-009 | shell | Accounts and sync | Progress is saved on the device only. Student data is Sam's decision |
| W-010 | lewis | A text alternative for the 3D shape view | Every control and atom has a label and keyboard access. The 3D view has only the shape readout |
| W-016 | lead | Team agent files and a session-start hook | They change Sam's Claude setup, so they need his OK |
| W-017 | lead | A CODEOWNERS file | Useful once a second GitHub account works here |

## Waiting on Sam

- **D-0007 is provisional.** The five-step split, the list of twenty molecules and its order, the free build mode, and bonding by dragging are the build session's reading of D-0006.
- **D-0017 is provisional.** The three-part card for a wrong answer, with the right answer given last.
- **The new eyes (D-0011).** Sam has not seen the drawing that replaced the googly eyes.
- **The bubble transition for text (D-0019).** Sam asked for text to stop blinking. He has not said whether he likes how it arrives and leaves now.
- **Quotes in a public repo.** The decision records quote Sam's chat messages word for word, and this repo is public (D-0014). He has not said whether that is fine.
- **The voice rules.** The full file is on Sam's machine. `docs/AGENTS.md` has a short version. He has not said whether a copy belongs in the repo.

## Done

| ID | Team | Item | Notes |
|---|---|---|---|
| W-001 | lewis, learning | When a student gets something wrong, the app explains the wrong assumption (D-0012, D-0017, D-0018) | Committed on 2026-11-13 as a8f4cd9 |
| W-002 | lead | Land the team structure (D-0016) | Landed on main on 2026-11-13, in the commit after a8f4cd9. Not pushed when this was written |
| W-004 | platform | Host the web build | Live on GitHub Pages since 2026-11-13: https://sam-t-g.github.io/chem-review/ (D-0020). Published by hand with `pnpm pages:deploy` |
