# Checks

What each check proves, when to run it, and what to do when it fails. Nothing is done until the checks for its kind of change pass and you have looked at the result yourself.

## The checks, in the order you run them

| Step | Command | What it proves | When |
|---|---|---|---|
| 1 | The fast check that `pnpm who <path>` prints | The unit tests for your area pass | While you work |
| 2 | `pnpm verify` | Typecheck, lint, every unit test, the repo's structure rules, and a production web build in `dist/` | Before you call anything done |
| 3 | The browser checks below | A student can do it with a real mouse and a real finger | Any change to what a student sees or touches |

## Browser checks (D-0013)

They run against the production build, so build and serve it first.

```bash
pnpm web:build && pnpm web:serve              # serves dist/ on http://localhost:5210, in another terminal
node scripts/check-browser.mjs desktop        # every guided problem, start to finish, real mouse input
node scripts/check-browser.mjs phone          # the same at 390 x 844, real touch input
node scripts/check-browser.mjs desktop extras # wrong answers and wrong arrows, hints, refused moves, undo, the bin, cutting a bond, keyboard, free build, Clear in 3D
node scripts/check-browser.mjs phone extras
node scripts/check-browser.mjs desktop shell  # home screen, opening the module, the way back, saved progress
node scripts/check-browser.mjs phone shell
MB_SHOTS=1 node scripts/check-browser.mjs ... # also saves screenshots to shots/
```

- A UI change is not verified until these pass at both sizes.
- Never check a control with `.click()` or `.focus()` from script. Every action in these checks is a real pointer or key event.
- The checks find things by `data-key`, `data-act`, `data-tray` and the `.mb-*` class names. Restyle freely and keep those names.
- Stop the server and close any browser you opened when you are done.

## Repo checks: `pnpm check:repo`

Part of `pnpm verify`. It reads `docs/ownership.json` and prints one line per problem. `tests/repo.test.ts` has a failing and a passing case for every code. A scope is a folder that has its own `AGENTS.md`.

| Code | It means | Fix |
|---|---|---|
| `CONFIG` | `docs/ownership.json` is missing, broken, lacks a field, or names a team, doc or path that does not exist. It is reported alone, because every other check reads that file | Fix the entry |
| `DEPS-LINK` | `node_modules` is a link to another folder (M-0003) | Delete the link and run `CI=true pnpm install --frozen-lockfile < /dev/null` |
| `OWNER` | A file has no owning team | Add its path to "owners" |
| `SCOPE` | A scope has no `AGENTS.md`, one lacks a required section, or an `AGENTS.md` sits in a folder that is not listed under "scopes" | Write the file from the template in `docs/AGENTS.md`, or list the folder |
| `AGENTS-PAIR` | The `CLAUDE.md` beside an `AGENTS.md` is missing or holds more than `@AGENTS.md` | Make it that one line. The rules go in `AGENTS.md` |
| `AGENTS-SIZE` | The root `AGENTS.md` is over 80 lines, or a folder's is over 60 | Move detail into the area's doc and link it |
| `FILES` | A file under a scope folder has no bullet under "## Files" that starts with its name, or a listed name is gone. A file in a subfolder is listed by its path from the scope folder | Add or remove the bullet |
| `IMPORT` | A file imports from a folder or package its folder may not use, or a file under `src/` has no import rule | Follow `docs/architecture.md`. To change a rule, ask the lead |
| `LINK` | A doc links to, or names in backticks, a path that does not exist (exact upper and lower case). Decision records, `HANDOFF.md` and the mistakes log are history and are not checked | Fix the path |
| `DOCMAP` | A doc under `docs/` is not linked from `docs/README.md` | Add it to the map |
| `DECISION` | A decision record lacks a field or a section, two records share a number, or the index is out of date | Fill the field, renumber, or run `pnpm docs:index` |
| `DECISION-FROZEN` | An accepted decision record was rewritten, renamed or deleted | Restore it and write a new record that supersedes it |
| `REF` | A `D-`, `M-` or `W-` id points at nothing, has the wrong number of digits, or is defined twice | Fix the id, or add the record, the mistake or the roadmap row |
| `HANDOFF` | `HANDOFF.md` is missing or empty, or an entry heading is not `## YYYY-MM-DD (team) Title` with a real team | Fix the heading |
| `CHANGE-HANDOFF` | Files differ from the base branch and `HANDOFF.md` has no new entry | Add your entry at the top |
| `CHANGE-BASE` | The check cannot find the branch to compare with, or where this branch left it | Fix the name, fetch the full history, or pass `--no-change` |
| `VOICE-DASH`, `VOICE-WORD` | A doc has an em dash inside a sentence, or a word Sam's voice rules rule out | Reword it |

The two `CHANGE` checks and `DECISION-FROZEN` compare the working tree with `origin/main`, or with `main` when there is no remote. `--base <ref>` picks another base, and `--no-change` skips them. On `main` itself with no remote there is nothing to compare with, so they only see work that is not committed yet. Do the work on a branch.

Entries in `HANDOFF.md` are not checked for order. When two branches each add an entry, git keeps both (`.gitattributes`), in whatever order the merge gives.

## CI

`.github/workflows/verify.yml` runs `pnpm verify` on every pull request and on every push to main. It has never run: it runs for the first time on the first push that includes it (W-012). The browser checks are not in CI yet.

## What no check covers

- A real phone or tablet. Touch on iOS has never been exercised and Android has never been run (W-003).
- The real-input run in Safari's engine. The module loads and draws in Playwright's WebKit, and that is all that was tried (W-012).
- Speed. No frame rate has been measured, and the browser checks run on a software renderer.
- Whether the phone vibrates when it should (W-005).
- An import that comes after a template string nested inside another template string. The import check reads the top of each file correctly and can lose its place after such a string.
- An import exception in `docs/ownership.json` for a file that is not in the repo. Nothing flags it.
- Committed work on `main` when there is no remote. There is nothing to compare it with.
