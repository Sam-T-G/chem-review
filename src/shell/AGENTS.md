# src/shell/: the native pieces of the home screen, and saved progress (team shell)

React Native components and hooks that the routes in `src/app/` use. Native UI on phones, the same code on the web.

## Files
- `ModuleCard.tsx`: one module on the home screen. The whole card is the link into the module.
- `MoleculeMark.tsx`: the small water molecule drawn on the module card.
- `Atom.tsx`: an atom with a face, drawn with native views. It can be picked up and springs back.
- `Playground.tsx`: the four floating atoms at the top of the home screen.
- `Sky.tsx`: the bubbles that rise behind the home screen.
- `progress.ts`: `useProgress(moduleId)`, the finished problems per module, saved on the device.

## Read first
- `docs/architecture.md`: "What may import what" and "Saved progress".
- `docs/platform/expo.md`, before using any Expo or React Native API.
- `docs/design/look-and-motion.md`, for anything a student sees.

## Rules
- S1 Fetch the versioned Expo docs before using an Expo or React Native API. Never answer from memory. [D-0002]
- S2 The shell reads the list of modules from `src/modules/registry.ts` and imports no other file under `src/modules/`. One exception is on file until W-011 (`docs/architecture.md`).
- S3 Colors, radii and font names come from `src/theme/tokens.ts` only. [D-0015]
- S4 The storage key `chem-review:progress:<moduleId>` and the shape of what is saved are a contract. Changing either loses students' progress, so it needs a decision record first.
- S5 Animate with Reanimated. It follows the system's reduced-motion setting on its own. [D-0010]
- S6 Anything only a phone can do (its motor, its storage) stays in the shell or the route and reaches a module through a prop. [D-0003]

## Check your work
- `pnpm typecheck && pnpm lint` while you work.
- `pnpm verify`, then `node scripts/check-browser.mjs desktop shell` and `node scripts/check-browser.mjs phone shell` against the served build (`docs/platform/verify.md`).

## Update when you change this
- Saved progress, or what the shell may import: `docs/architecture.md`.
- What the home screen looks like or how it moves: `docs/design/look-and-motion.md`.
- A new file here: the list above.
