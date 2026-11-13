# D-0015: One set of design tokens for the native shell and the web modules

- Status: accepted
- Date: 2026-11-12
- Decided by: Lead (the build session)
- Teams: design, lewis, shell

## Context
The shell is React Native and the modules are web tech (D-0003). Two palettes kept by hand would end up different.

## Decision
Colors, radii and font names are defined once, in `src/theme/tokens.ts`. The native shell reads them directly. Web modules get the colors as CSS variables through `cssVars()`.

## Consequences
- A color, a radius or a font name is written in that file and nowhere else.
- Known exception: the element ball colors are in the Lewis module's `palette.ts`, and the home screen's atoms in the shell import them from there. They should move to a shared place (W-011).
