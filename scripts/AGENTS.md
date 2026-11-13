# scripts/: checks and tools (team platform)

Node scripts, run by hand or from `package.json`. They import nothing from `src/`.

## Files
- `check-browser.mjs`: the real-input browser checks. Every action is a real pointer or key event.
- `check-repo.mjs`: `pnpm check:repo`, the repo's structure rules.
- `who.mjs`: `pnpm who <path>`, the team, reviewers, rule files, docs and fast check for a path.
- `lib/repo.mjs`: the functions behind the two scripts above. `tests/repo.test.ts` tests it.
- `shot.mjs`: a helper that opens the app in headless Chromium and saves screenshots.
- `deploy-pages.mjs`: builds the web app for GitHub Pages and replaces the `gh-pages` branch with it. A deploy needs Sam's go-ahead.
- `gen-elements.mjs`: writes `src/chem/elements.data.json` from Valence's data. Team chem.
- `make-icons.mjs`: draws the app icons into `assets/images/`. Team design.

## Read first
- `docs/platform/verify.md`: every check and every failure code.
- The usage comment at the top of the script.

## Rules
- SC1 A rule that must hold every time goes in a check here, with a failing and a passing test. A rule that is only written in an `AGENTS.md` can be skipped without anything failing.
- SC2 A failure message says what is wrong and what fixes it, in one line, so the person who hits it needs no other doc.
- SC3 Never loosen a check so that it passes. Fix what it found, or take the rule to the lead.
- SC4 The browser checks use real pointer, touch and key events. Never `.click()` or `.focus()` from script. [D-0013]
- SC5 A script that opens a browser or a server closes it before it exits.
- SC6 A new package goes through the platform team and `pnpm exec expo install` (`docs/platform/expo.md`).
- SC7 Scripts are plain `.mjs` files that Node runs as they are. There is no build step.

## Check your work
- `pnpm exec vitest run repo && pnpm check:repo` for the repo checks.
- `pnpm verify`.
- For `check-browser.mjs`: run it at both sizes against the served build.

## Update when you change this
- A new check or failure code: the table in `docs/platform/verify.md`, and a test in `tests/repo.test.ts`.
- A new script: the list above, and a line in `package.json` if people will run it.
- What a browser check covers: an entry in `docs/verified.md`.
