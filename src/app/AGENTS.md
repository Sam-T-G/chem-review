# src/app/: routes (team shell)

Every file here is a screen (Expo Router). `_layout.tsx` files define navigators.

## Files
- `_layout.tsx`: loads the fonts and sets up the stack.
- `index.tsx`: the home screen. It lists the modules from the registry.
- `lewis.tsx`: hosts the Lewis module and hands it the saved progress. Its `LewisScreen` is the one screen all three routes of the module use.
- `shapes.tsx`: the Lewis module opened on its shapes quiz.
- `exercises.tsx`: the Lewis module opened on its exercises.

## Read first
- `docs/architecture.md`, "A module": what a route gives a module.
- `docs/platform/expo.md`, before using any Expo or React Native API.
- `src/shell/AGENTS.md`: the shell's rules apply here too.

## Rules
- A1 Only routes and layouts live here. Components, hooks and helpers go in `src/shell/`.
- A2 A module's route is `src/app/<id>.tsx`. It waits for the saved progress, renders the module's top component, and passes it `useProgress('<id>')`.
- A3 A route imports its module's top component and that component's types, and nothing else from the module. (`docs/architecture.md`)
- A4 A module's props never change after it opens. In the native apps every changed prop is sent across to the web view again. [D-0003]
- A5 Each screen sets its own title and description.

## Check your work
- `pnpm typecheck && pnpm lint`, then `pnpm verify`.
- `node scripts/check-browser.mjs desktop shell` and `node scripts/check-browser.mjs phone shell` against the served build (`docs/platform/verify.md`).

## Update when you change this
- A new route for a module: `src/modules/registry.ts`, and the steps in `src/modules/AGENTS.md`.
- What a route passes a module: `docs/architecture.md`.
- A new file here: the list above.
