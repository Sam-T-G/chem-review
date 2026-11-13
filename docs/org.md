# Teams and who decides what

A team is a role with folders of its own. One person or one agent session can hold more than one role. It works as one team at a time and says which in its `HANDOFF.md` entry. `docs/ownership.json` is the source for the paths below, and `pnpm who <path>` reads it.

## The structure

```
Sam                 product owner
└─ lead             architecture, roadmap, merges into main
   ├─ product teams build what a student uses
   │  ├─ chem       the chemistry engine            src/chem/
   │  ├─ lewis      the Lewis module                src/modules/lewis/
   │  └─ shell      routes, home screen, progress   src/app/, src/shell/
   ├─ craft teams   own a standard and review the product teams against it
   │  ├─ design     how it looks and moves          src/theme/, docs/design/
   │  └─ learning   what a student reads and in what order   docs/learning/
   └─ platform      checks, build, scripts, CI, hosting      scripts/, tests/, config
```

Each new module gets a new product team named after the module.

## Teams

| Team | Owns | Reviews |
|---|---|---|
| lead | The root files, `docs/` outside the team folders, and `src/modules/AGENTS.md` with its `CLAUDE.md` (the contract every module follows) | Any change that crosses a boundary in `docs/architecture.md`, and every merge into main |
| chem | `src/chem/`, its six test files, `scripts/gen-elements.mjs`, `docs/chemistry/` | Any chemistry fact, number or rule, wherever it appears |
| lewis | `src/modules/lewis/`, `tests/guide.test.ts`, `tests/store.test.ts` | |
| shell | `src/app/`, `src/shell/`, `src/modules/registry.ts`, `app.json` | A new module's route and its registry entry |
| design | `src/theme/`, `assets/`, `scripts/make-icons.mjs`, `docs/design/` | Anything a student sees, and anything that moves |
| learning | `docs/learning/` | Anything a student reads, the problem list and its order |
| platform | `scripts/`, `tests/` outside the team test files, `src/types/`, the config files (`app.config.js` among them), `.github/`, `docs/platform/`, `docs/verified.md` | A new package, script, config or check |

## Who decides what

| Kind of decision | Who decides | Where it is recorded |
|---|---|---|
| What the product is and who it is for. Names. The direction of the look. Money, licenses, student data. A push, a pull request, a deploy, a store release. A chemistry convention where courses differ. Hooks, permissions and agent files. Reversing an accepted decision | Sam | A decision record with his words, status `accepted` |
| Architecture, the boundaries and contracts between teams, the order of the roadmap, how a change is made | Lead | A decision record |
| The step order, the problem list, the rules for words | learning proposes and Sam confirms | A decision record, `provisional` until Sam confirms |
| Details of the look inside the direction Sam set | design | `docs/design/look-and-motion.md`, and a record when Sam has reacted to it |
| Which source a chemistry rule follows | chem, from a cited source | `docs/chemistry/sources.md` and a test |
| How to build something inside one team's folders | That team | The code and the folder's `AGENTS.md`. A record if another team will rely on it |

## When to go up a level

From a team to the lead:

- the change needs a file another team owns, and that folder's rules do not cover it
- two rules or two decisions conflict
- a check fails for a reason outside your folders
- you want to change a boundary or a contract in `docs/architecture.md`

From the lead to Sam: anything in the first row of the table above, any `provisional` decision someone wants to build further on, and any choice where the options differ in a way Sam would see or pay for.

How: write it under "Asks" in your `HANDOFF.md` entry, name who it is for, and carry on with work that does not depend on the answer. If the decision is Sam's, ask him and wait for his answer on that part.

## Review

A change is reviewed by the owner of every path it touches, plus the reviewers `pnpm who` prints for those paths. `pnpm who` also prints an "also ask" line for each team that reviews by what a change contains (the "Reviews" column above): ask each one whose condition fits. The reviewer is a different session or person from the author. The lead merges. `CONTRIBUTING.md` has the steps.
