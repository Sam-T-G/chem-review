# src/modules/: one folder per module (the lead owns this file)

A module is one topic a student practices. Each module has its own folder and its own team. The home screen reads
the list of modules from `registry.ts`.

## Files
- `registry.ts`: every module the app offers, with its id, route, title, summary and problem count. Team shell.
- `lewis/`: the Lewis structures and shapes module. It has its own `AGENTS.md`.

## Read first
- `docs/architecture.md`, "Contracts": what a module promises the shell.

## Rules
- MD1 A module imports from its own folder, `src/chem/` and `src/theme/`, and nothing else in `src/`. It never imports another module or the shell. (`docs/architecture.md`)
- MD2 A module that needs canvas, WebGL or CSS has a DOM component on top: `'use dom'` on the first line, and a default export. [D-0003]
- MD3 Its props are plain data or async functions, and they do not change after the module opens. [D-0003]
- MD4 Chemistry rules go in `src/chem/`, where every module can use them. A module only decides when a move is allowed in its flow and what to say.
- MD5 Every sentence a student reads sits in one file of the module, as pure functions, with a test that scans the wording. The Lewis module's `guide.ts` is the pattern.
- MD6 A new module's first version has the five things listed under "A first version has these in it" in `docs/design/look-and-motion.md`. [D-0010]

## Add a module
1. Build it under `src/modules/<id>/`, with an `AGENTS.md` and a `CLAUDE.md` (template in `docs/AGENTS.md`).
2. Add a route file `src/app/<id>.tsx` that renders it and passes `useProgress('<id>')`.
3. Add an entry to `registry.ts`. The home screen picks it up.
4. In `docs/ownership.json`, add a team for the module, its paths under "owners" and its folder under "scopes". Add the team to `docs/org.md`.
5. Add its browser checks to `scripts/check-browser.mjs`, with the platform team.

## Check your work
- `pnpm check:repo` (boundaries, owners, scope files), then `pnpm verify`.

## Update when you change this
- The contract every module follows: `docs/architecture.md`, with a decision record.
- A new module: steps 4 and 5 above, and a row in `docs/roadmap.md` while it is being built.
