# How a change is made

For people and for agents. `AGENTS.md` has the rules. This is the path a change takes from start to main.

## 1. Find the owner

```bash
pnpm who src/modules/lewis/guide.ts   # the team, reviewers, rule files, docs, fast check, decisions
pnpm who --teams                      # every team and what it does
```

Read the rule files it prints, then the docs it prints. If the change needs a file another team owns, read that folder's `AGENTS.md` too and name that team as reviewer, or ask that team to make the change (an "Asks" line in `HANDOFF.md`).

## 2. Take a branch, and a worktree if the checkout is in use

- Branch name: `<team>/<short-name>`, for example `chem/retune-seesaw`.
- One writer per checkout. If another person or session is editing this checkout, make your own:

```bash
git worktree add ../chem-review-<short-name> -b <team>/<short-name>
CI=true pnpm --dir ../chem-review-<short-name> install --frozen-lockfile < /dev/null
```

- Every worktree gets its own install. Never link `node_modules` from another checkout: pnpm will reinstall the other checkout's packages through the link (M-0003). `pnpm check:repo` fails when `node_modules` is a link.
- When the branch is merged: `git worktree remove ../chem-review-<short-name>`.

## 3. Make the change

- Write the failing test first.
- Stay inside what `docs/architecture.md` lets your folder import.
- If you choose between options that another team has to follow, write the decision record now (`docs/decisions/README.md`).

## 4. Check it

`docs/platform/verify.md` lists the checks in the order you run them: your team's fast check while you work, `pnpm verify` before you call it done, and the browser checks at both sizes for anything a student sees or touches. Look at the result yourself.

## 5. Update the docs in the same change

| If you changed | Update |
|---|---|
| Anything | A new entry at the top of `HANDOFF.md` |
| A file in a team folder | What that folder's `AGENTS.md` lists under "Update when you change this" |
| A file, folder or team that is new | `docs/ownership.json`, and the "Files" list in the folder's `AGENTS.md` |
| What one folder may import from another | `docs/ownership.json` and `docs/architecture.md`, with the lead |
| Something on the roadmap | `docs/roadmap.md`: move the row to "Done" when it is finished |
| What has been verified | A dated entry in `docs/verified.md` |

`pnpm check:repo` fails on most of these when the doc is missing.

## 6. Write the handoff entry

At the top of `HANDOFF.md`, under a heading in exactly this form: `## 2026-11-13 (team) What changed`. Say what changed, what you checked and how, what you ask of other teams or of Sam, and the next step.

## 7. Commit

- An agent session commits when Sam has asked it to, on its own branch.
- Message: `<team>: <what changed>`, with the reason in the body. No trailers that name an AI.

## 8. Review and merge

- Reviewers: the owner of every path the change touches, the reviewers `pnpm who` prints for those paths, and each team on its "also ask" lines whose condition fits the change. The reviewer is a different session or person from the author.
- The reviewer reads `git diff main...<branch>`, runs the checks, and writes each finding with its file and line.
- The lead merges into main with a squash, so main has one commit for each change.
- Until Sam says a push no longer needs his go-ahead each time, review happens on local branches (D-0014). When he has allowed a push, open a pull request: the template is `.github/pull_request_template.md`, and `.github/workflows/verify.yml` runs the checks.

## 9. What needs Sam

A push, a pull request, a deploy, a store release, money, a license, student data, a hook, a permission, an agent file, a name, the direction of the look, a chemistry convention where courses differ, and reversing an accepted decision. `docs/org.md` has the full table. Write the ask in `HANDOFF.md` and carry on with work that does not depend on the answer.
