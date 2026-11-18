# Roadmap

What is being worked on, what comes next, and what is waiting. The lead orders it. Any team adds an item with the next free id. When an item is finished, move its row to "Done" at the bottom: decision records and handoff entries cite these ids, so a row is never deleted.

## Now

| ID | Team | Item | Notes |
|---|---|---|---|
| | | Nothing is being built. The open findings from the reviews of 2026-11-17 are listed in the lead's entry of 2026-11-17 in `HANDOFF.md` | |
| W-029 | lewis, design | On a phone, the middle atom's δ+ on PCl5 and SF6 (and ClF3's net dipole label once) can land on another atom when the turning model leaves no clear place | Known failure of the tag check at phone size, about 1 run in 3 for those molecules. Shipped open on Sam's word, 2026-11-18. `HANDOFF.md`, the lewis entry of 2026-11-18 |

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

- **D-0031 to D-0036 are provisional** (2026-11-17). Sam asked for the shapes quiz, the exercises, the two geometry names and 3D models for two-atom molecules (D-0030). How each is built is the build sessions' design: the parts and routes (D-0031), the pool of 43 molecules (D-0032), step 5 and the words (D-0033), the quiz (D-0034), the exercises (D-0035), the switch on the lifted model and the two-atom model (D-0036).
- **The shapes quiz across visits.** A shape marked known is not asked again on a later visit unless the student presses "Practice all 13 again". Sam asked for the quiz so students "memorize them all and have iterative practice": he may want known shapes to come back after a gap.
- **The electron geometry of a molecule of two atoms.** The app answers linear for HCl and IF, because there is no middle atom. A course that treats one atom as the middle atom would answer tetrahedral (1 bond and 3 lone pairs). Sam's instructor's key settles it (D-0032, D-0033).
- **"Molecules that do not have a center element"** was read as molecules of two atoms. Molecules with more than one middle atom (ethane) are W-007.
- **Answers that differ from the handwritten worksheet.** The pool's answers come from the textbook rules and the course's rounded electronegativity table. Several handwritten cells on Sam's worksheet differ (CH3+, CO3 2−, IF's net dipole, ΔEN from another table). `docs/chemistry/sources.md` lists the conventions where courses differ.
- **D-0007 is provisional.** The five-step split, the list of twenty molecules and its order, the free build mode, and bonding by dragging are the build session's reading of D-0006.
- **D-0017 is provisional.** The three-part card for a wrong answer, with the right answer given last.
- **D-0021 is provisional.** Polarity and bonding as steps 6 and 7 of each guided molecule, and a molecule counting as finished after step 7. Sam asked for the features and named his chapter 7 and 8 slides. Where they go is the build session's choice.
- **D-0023 is provisional.** Sam asked for a part where a student draws a line and is assessed on where the dipole points (D-0022). Which lines, the 35° that counts as right, and the button for a nonpolar bond are the build session's choices.
- **D-0026 is provisional.** Sam asked for the glow or pointing finger, the how-to guidance, the persistent checks (D-0024), one-move controls, a clearer dipole drawing and Clear in 3D (D-0025). The hand, the strip of three chips, the swipe that cuts a bond, the bin and the aim points are the build session's way of doing it.
- **The new eyes (D-0011).** Sam has not seen the drawing that replaced the googly eyes.
- **The bubble transition for text (D-0019).** Sam asked for text to stop blinking. He has not said whether he likes how it arrives and leaves now.
- **Quotes in a public repo.** The decision records quote Sam's chat messages word for word, and this repo is public (D-0014). He asked for a push on 2026-11-16 with the quotes as they were. He has not said whether they should be tidied.
- **The voice rules.** The full file is on Sam's machine. `docs/AGENTS.md` has a short version. He has not said whether a copy belongs in the repo.

## Done

| ID | Team | Item | Notes |
|---|---|---|---|
| W-023 | lead, shell | Parts of the Lewis module: the contract in `parts.ts`, three routes, three home-screen cards, three saved lists (D-0030, D-0031) | On main on 2026-11-17. Both parts are open: `OPEN_PARTS` in `src/modules/lewis/parts.ts` and `OPEN` in `src/modules/registry.ts` list them. Provisional (D-0031) |
| W-026 | lewis, design | The 3D model shows either geometry, a two-atom molecule gets a symmetric model, four tabs fit on a phone (D-0036) | On main on 2026-11-17, after a review and the lead's fixes to where the switch is offered (M-0017). Provisional (D-0036). Open: the switch can sit close to a tag or an atom on a phone (`HANDOFF.md`) |
| W-027 | lewis, learning, design | The shapes quiz (D-0034) | On main and open on 2026-11-17, after two fix rounds from three reviews and a check of each round. Provisional (D-0034) |
| W-028 | lewis, learning, design | The exercises (D-0035) | On main and open on 2026-11-17, after three fix rounds from three reviews and a check of each round. Provisional (D-0035) |
| W-022 | lewis, learning, design, chem | Key terms are highlighted, and each opens a card with its meaning, an example and a picture (D-0027, D-0028) | On main as 63c3a57 and c8f14ad, pushed and deployed on 2026-11-17 (`HANDOFF.md`, the free build entry) |
| W-024 | chem | The exercise pool, the electron geometry on every problem, two-atom molecules in the engine (D-0032) | On main on 2026-11-17, with four fixes from a row-by-row chemistry review (`HANDOFF.md`) |
| W-025 | lewis, learning | Step 5 asks for the electron geometry and the molecular geometry, and the two names are used in every sentence (D-0033) | On main on 2026-11-17. Three reviews, then the lead's fixes: the picks for the electron geometry hold molecular geometries too, and no card names the molecular geometry early. Provisional (D-0033) |
| W-001 | lewis, learning | When a student gets something wrong, the app explains the wrong assumption (D-0012, D-0017, D-0018) | Committed on 2026-11-13 as a8f4cd9 |
| W-002 | lead | Land the team structure (D-0016) | Landed on main on 2026-11-13, in the commit after a8f4cd9. Not pushed when this was written |
| W-004 | platform | Host the web build | Live on GitHub Pages since 2026-11-13: https://sam-t-g.github.io/chem-review/ (D-0020). Published by hand with `pnpm pages:deploy` |
| W-020 | lewis, chem, learning | Steps 6 and 7: polar bonds and the net dipole, sigma and pi bonds, hybridization (D-0021). In step 6 a student draws each bond's dipole and the net dipole (D-0022, D-0023) | Committed on 2026-11-16. Sam asked for the commit, a push and a deploy of the live demo in one message that day. The numbers are in the 2026-11-16 entry of `docs/verified.md` |
| W-021 | lewis, design, learning | The next action glows and a hand points at it, how-to lines for the board, the checks stay on screen, one-move controls, aim points for the net dipole, Clear in 3D (D-0024, D-0025, D-0026) | Committed on 2026-11-16. Sam asked for the commit, a push and a deploy of the live demo in one message that day. The numbers are in the newest 2026-11-16 entry of `docs/verified.md` |
| W-019 | lewis, platform | Finish the full browser run on commit a8f4cd9: all 20 molecules at both sizes, and the wrong-answer, hint, refused-move, undo, keyboard and free-build checks | Run against the live site on 2026-11-13, every check passed. The numbers are in the a8f4cd9 entry of `docs/verified.md` |
