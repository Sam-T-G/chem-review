# D-0009: The look carries over the cozy elements and color palettes of the physics sims, with a more refined UI

- Status: accepted
- Date: 2026-11-12
- Decided by: Sam
- Teams: design

## Context
> Use the physics sims we worked on for inspiration on design as I want to carry over those cozy elements and color palettes, but I want to refine the UI to be much more design and user friendly focused.

## Decision
The design takes the cozy elements and the color palettes of Sam's physics sims, and the UI is refined to be easier to use.

## Consequences
- The colors are named in `src/theme/tokens.ts` and nowhere else (D-0015).
- The names for the colors are the build session's, from the comment at the top of that file: blueberry-milk sky, mint board, grape controls, butter electrons, strawberry for mistakes. No file here records which sim each color came from: `[TBD: compare the tokens with the physics sims' palette]`.
- D-0010 and D-0011 build on this look.
