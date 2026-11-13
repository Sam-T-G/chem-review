# src/theme/: design tokens (team design)

The one place where colors, radii, spacing and font names are defined, for the native shell and the web modules.

## Files
- `tokens.ts`: `color`, `radius`, `space`, `font`, and `cssVars()`, which hands the colors to web modules as CSS variables.

## Read first
- `docs/design/look-and-motion.md`: the palette, the type, and what Sam has said about the look.

## Rules
- T1 Plain TypeScript only: no packages, and no imports from outside this folder. `pnpm check:repo` enforces it.
- T2 No color, radius or font name is written anywhere else in `src/`. Add a token here and use it. [D-0015]
- T3 The palette carries over from Sam's physics sims. A new hue, or a change of direction, is his decision. [D-0009]
- T4 Keep a note of the contrast beside a text color, as `ink2` has, so the next person can see it was checked.
- T5 A token's name becomes a CSS variable (`grapeDeep` becomes `--grape-deep`). Renaming one means changing every use in `src/modules/` in the same change.

## Check your work
- `pnpm typecheck && pnpm lint`, then `pnpm verify`.
- Look at it. The browser checks save screenshots at both sizes when run with `MB_SHOTS=1` (`docs/platform/verify.md`).

## Update when you change this
- A color, the type, or a rule of the look: `docs/design/look-and-motion.md`.
- A change Sam asked for or reacted to: a decision record with his words.
- A new file here: the list above.
