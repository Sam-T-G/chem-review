# Chem Review: rules for everyone who works here

A general chemistry practice app: one Expo codebase for web, iOS and Android. A shell (home screen, routes, saved
progress) hosts modules, and the first module is Lewis structures and shapes. "Chem Review" is a working name.
This file is for people and for agents of any kind.

## Start of every session
1. Read the newest entries in `HANDOFF.md` and the "Now" table in `docs/roadmap.md`.
2. Run `pnpm who <path>` for the file or folder you will change. It prints the team that owns it, who reviews it,
   the rule files that apply, the docs for that area, the fast check, and the decisions that bind that team.
3. Read those first. Open another doc when a rule points you to it.
4. Work as one team at a time, and name that team in your handoff entry.

## Where things are
| Folder | Team | What it holds |
|---|---|---|
| `src/chem/` | chem | The chemistry rules as plain TypeScript |
| `src/modules/lewis/` | lewis | The Lewis module: 3D board, panel, step flow |
| `src/app/`, `src/shell/` | shell | Routes, home screen, saved progress |
| `src/theme/` | design | Colors, type, spacing |
| `tests/`, `scripts/` | platform | Unit tests, real-input browser checks, repo checks |
| `docs/` | lead | Decisions, specs, roadmap. `docs/README.md` says what goes where |

Two teams own a standard instead of a code folder and review against it: design (anything a student sees) and
learning (anything a student reads). `docs/org.md` has the teams, who decides what, and when to go up a level.
`docs/architecture.md` has how the parts connect.

## Rules
- R1 Done means `pnpm verify` exits 0 and you looked at the result yourself. A change a student can see or touch
  also needs the browser checks at both sizes (`docs/platform/verify.md`). [D-0013]
- R2 Stay in your team's folders. For a change in another team's folder, follow that folder's `AGENTS.md` and name
  that team as reviewer, or write the request under "Asks" in `HANDOFF.md` and let that team do it.
- R3 Import only what `docs/architecture.md` allows. `pnpm check:repo` enforces it.
- R4 One writer per checkout. If someone else is editing this checkout, work in your own worktree with its own
  install (`CONTRIBUTING.md`, step 2). [M-0003]
- R5 Every chemistry fact on screen comes from a cited source and has a test with the expected answer written from
  that source. No citations on screen. [D-0004]
- R6 Words a student reads are plain and literal, and so are docs. The rules are DOC7 in `docs/AGENTS.md`. Sam's
  full voice file is on his own machine, at `~/.claude/skills/prose-voice/SKILL.md`.
- R7 A choice between options that another team has to follow gets a decision record in the same change. Quote
  Sam word for word when the choice is his, and say so when it is yours. Never rewrite an accepted record:
  supersede it. (`docs/decisions/README.md`)
- R8 A `provisional` decision is an agent's reading that Sam has not confirmed. Work inside what it already built
  can go on. Ask Sam before you change it or build a new feature on it.
- R9 Ask Sam before you push, open a pull request, deploy, publish, spend money, add a hook, a permission or an
  agent file, or share anything outside this machine. (`docs/org.md`, "Who decides what")
- R10 Every number or claim in a doc names its source: a command, a file, or Sam's words with the date. Mark the
  rest `[TBD]` and say what would settle it.
- R11 When something goes wrong, add it to `docs/mistakes.md` before the fix, with the rule or check that catches
  it next time.
- R12 Never delete, skip or loosen a test or a check so that it passes.
- R13 Fetch the versioned Expo docs before using any Expo or React Native API (`docs/platform/expo.md`). [D-0002]
- R14 No commit trailers and no pull request lines that name an AI.

## End of every session
- Add an entry at the top of `HANDOFF.md`: the team, what changed, what you checked and how, asks for other teams
  or for Sam, and the next step. `pnpm check:repo` fails when files changed and there is no new entry.
- Update the docs that your folder's `AGENTS.md` lists under "Update when you change this", in the same change as
  the code.
- Stop any server and close any browser you opened.

## Changing this file
The lead owns it. Change one rule at a time, by id, and cite the decision, mistake or measured number behind it.
The limit is 80 lines, and a folder's `AGENTS.md` is limited to 60. A rule that matters in one folder only goes in
that folder's file. A rule that a check now enforces can be shortened to the name of the check.
