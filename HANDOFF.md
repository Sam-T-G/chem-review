# Handoff

Add your entry on top, under a heading in exactly this form: `## 2026-11-13 (team) What changed`. Say what changed, what you checked and how, what you ask of other teams or of Sam, and the next step.

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
