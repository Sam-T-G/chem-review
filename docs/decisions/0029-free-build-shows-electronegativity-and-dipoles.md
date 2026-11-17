# D-0029: Free build shows electronegativity, each bond's ΔEN and the dipoles, with nothing asked

- Status: accepted
- Date: 2026-11-17
- Decided by: Sam
- Teams: lewis, learning, design

## Context
Sam wrote on 2026-11-17:

> check the chemistry review module we made, i want to also import the dipole and electronegativity features into the free build

Free build asks no questions, so the build session asked how step 6 should come over. The options were: show the results live as the student builds; run step 6's drawing exercise on whatever was built; or both, with a switch. Sam picked "Show them live": each atom's electronegativity, each bond's ΔEN with polar or nonpolar and δ+ and δ−, the bond dipole arrows and the net dipole on the 3D model, updated on every edit, with nothing to answer.

## Decision
- Free build shows the electronegativity table for every element on the board, and one line per kind of bond worked from that table, as soon as the bond exists.
- Each polar bond's arrow, with δ+ and δ−, is drawn on the board as soon as the molecule has one middle atom.
- Once every shell is full, the panel says whether the whole molecule is polar and why. On the 3D shape of a polar molecule the net dipole is drawn, and the angle marks step aside for it, as in step 6.
- Free build asks nothing about polarity: no drawing, no picks.

## Consequences
- The wording is the build session's (`FREE_POLAR_WORDS`, `freeBondLine`, `freeNetLine`, `bondKindsOn` in `src/modules/lewis/guide.ts`), not yet read by Sam. So are two choices inside it: a ΔEN above 2.0 reads "Ionic", and a tapped atom or bond in free build shows its electronegativity or ΔEN. Guided steps 2 and 6 ask those, so the guided cards still do not show them.
- Molecules with more than one middle atom get the bond lines but no arrows and no verdict (W-007).
- Checked by `tests/guide.test.ts` ("free build: electronegativity and dipoles") and the free build part of `scripts/check-browser.mjs` extras.
