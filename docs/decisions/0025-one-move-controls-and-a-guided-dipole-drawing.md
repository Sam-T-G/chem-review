# D-0025: Atoms and bonds are added and removed in one move, the dipole drawing is guided, and the board can be cleared in 3D

- Status: accepted
- Date: 2026-11-16
- Decided by: Sam
- Teams: learning, design, lewis

## Context
Sam sent two more messages while D-0024 was being built. The first:

> we need to also refine the user controls on adding and removing elements, as well as the flexibility of the overall sim. for example there should be more intuitive and easy to access controls to add and remove elements, to detach connections withough having to click once on a given element then having to click remove button. Additionally, we should really consider more thoguhtful implementation and guidance on the drawing segment, sometimes its not very clear on how that works and how users should draw a given dipole. also at times the line should be drawn into negative space or should be a line to the lone pair in some configurations should it not? how would the user convey that and we should find an elegant user experience to be able to intuitively carry that task out

The second:

> small note we should also add a feature to be able to clear the board in 3d mode as well as currently we have to go back to the flat mode to reset

## Decision
- The controls for adding and removing atoms are easier to reach and more intuitive. A connection can be detached without a click on the element followed by a click on a remove button.
- The dipole drawing gets more guidance, so that it is clear how the drawing works and how a student draws a given dipole.
- A dipole's line can point into empty space or at a lone pair where the molecule calls for that, and a student has an intuitive way to say so.
- The board can be cleared from the 3D view.

## Consequences
- Which gestures do this, and how a student aims the net dipole at a lone pair or into empty space, are the build session's design and wait for Sam's yes (D-0026).
- "The flexibility of the overall sim" is not spelled out in his message. The build session read it as the same list: more can be done on the board directly, and from more places. A wider meaning is a question for Sam.
