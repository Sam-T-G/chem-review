# D-0036: The lifted model has a switch between the electron geometry and the molecular geometry, and a molecule of two atoms lifts as a level pair

- Status: provisional
- Date: 2026-11-17
- Decided by: the build session for package BOARD (team lewis), on Sam's asks of 2026-11-17 (D-0030)
- Teams: lewis, design, learning

## Context
Sam wrote on 2026-11-17 (the lead's record of the whole ask is being written in the same run):

> [...] I want to also incorporate particularly differentiating between electron and molecular geometry, along with
> all of the appropriate applications through the entire app stack to make way for this. [...] finally lets expand
> the feature to also enable 3d models for molecules that do not have a center element. [...]

 The lead read the second ask as molecules of two atoms (IF, HCl, N2,
O2). How the board does both is this session's design. Sam has not seen it.

Before this change the lifted model always drew the middle atom's lone pairs, and `enterShape()` in
`src/modules/lewis/scene.ts` treated one atom of a two-atom molecule as the middle atom: it sat at the model's
center with lobes on its lone pairs, and the other atom hung off one side.

Options looked at for the switch:
- Always show it, with a line saying the two geometries are the same when the middle atom has no lone pair. Turned
  down: the switch would change nothing on screen for 11 of the 20 guided molecules (the middle atom has no lone
  pair in CH4, CO2, CH2O, HCN, NH4+, CO3 2−, BF3, PCl5, SF6, SO4 2− and PO4 3−, by the shapes in
  `src/chem/problems.ts`), and a control that changes nothing looks broken.
- On a phone, a row of its own above the dock. Turned down after measuring it: at 390 x 844 it moved the dock's top
  up 52 px and shrank oxygen in water from a 20.8 px radius to 15.4 (`scripts/check-board.mjs phone`).

## Decision
1. `SceneInput.groupsView` is `'all'` (the default) or `'atoms'`. With `'atoms'` the middle atom's lone pairs (their
   lobes and their dots) shrink and fade out over 0.45 seconds, instantly under reduced motion. The electron groups
   keep their places, so no atom moves. Outer atoms' lone pairs, the bonds and the bonds' electrons stay.
2. The switch has two choices, "Electron geometry" and "Molecular geometry" (`GROUPS_VIEW_WORDS` at the end of
   `src/modules/lewis/guide.ts`), with `data-key`s `groups-all` and `groups-atoms`. It shows only on the lifted
   model (guided: `store.onModel()`, after the shape pick; free build: the 3D shape), and only when the middle atom
   has at least one lone pair. The student's pick is kept in `State.groupsView` across molecules and modes. The
   shapes quiz and the exercises get `'all'` and set their own through their part's `scene()`.
3. Where the dock's row is wider than 820 px the switch sits in the dock's middle. Narrower, it stands at the left
   edge of the board above Undo as two stacked buttons, where the lifted model, which is as wide as the board is
   tall, leaves room. It costs the model no height there.
4. A molecule of two atoms (`assess(s).topology` is a star with one outer atom) lifts with neither atom in the middle:
   both on one level line through the model's center, the middle of the gap between the balls at the center, the
   camera turned so the line lies across the screen with the atoms on the sides they had on the board. Each atom's
   lone pairs fan out behind it the way an outer atom's do, as mirror images of each other. No lobes, no angle arc,
   no switch. The slow turn and a drag on the board turn it.
5. On a polar two-atom molecule the net dipole runs the length of the bond on its upper side, from the δ+ atom to
   the δ− atom, with its label above the arrow's middle. The bond's own arrow stays on the lower side.

## Consequences
- The switch never appears before the lift, so it cannot answer step 5's questions, which are asked on the flat
  drawing. If package FLOW moves a geometry question after the lift, the switch would show the answer: FLOW checks
  that when it merges.
- A middle atom with no lone pair shows no switch, so a student only sees that the two geometries match by reading
  the panel. The learning team may want a line there [TBD: Sam].
- Touch drags turned the model by `PointerEvent.movementX`, which a touch can leave at 0. The orbit now turns by the
  distance from the pointer's last place.
- Checked by `scripts/check-board.mjs` at both sizes, and `tests/board.test.ts` for the words and the state.
