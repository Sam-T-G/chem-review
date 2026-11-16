# D-0026: A glow and a pointing hand show the next action, a strip of checks stays over the board, bonds are cut with a swipe, and the net dipole is aimed at dots

- Status: provisional
- Date: 2026-11-16
- Decided by: The build session, reading D-0024 and D-0025
- Teams: learning, design, lewis

## Context
D-0024 and D-0025 say what Sam wants and leave the how open. These are the build session's choices, for him to confirm.

## Decision
**Where to look next (D-0024).**
- One place on screen is "the next action" at any moment: a question in the panel, an atom in the row under the board, atoms on the board, or the button that leads to the next step. `cue()` in `src/modules/lewis/store.ts` decides which.
- That place gets a butter-yellow glow that pulses. A control in the panel gets a rounded frame, an atom gets a ring.
- A pointing hand (a white glove with a grape cuff) points at a question in the panel from the left, where there is room beside the panel. On a phone the panel fills the width, so questions there get the glow only.
- On the board the hand acts out the drag a step needs: an atom from the row onto the board, an outer atom onto the middle atom, a bond's arrow, the net dipole. It stops after the student's first try.
- A demonstration never shows an answer. For a bond's question the atoms and the "Nonpolar, no arrow" button both glow, and the hand takes the three answers in turn: the arrow one way, the arrow the other way, the button. Which comes first differs from molecule to molecule. The net dipole is acted out toward each aim point in turn.
- The hand stays away while the student has a finger or the mouse button down.

**How to act on the board (D-0024).** The place, bond and check steps and free build each list the moves the board takes, one line per gesture, with a small picture of the hand: drag, swipe or tap.

**The checks stay on screen (D-0024).**
- On a phone the strip lies over the board's top rim and keeps half its height clear, so the board loses little height to it.
- A strip of three chips sits under the electron counter in every step that has a board, and in free build: the electron total, full shells with a count ("2 of 3"), and formal charges. Each has a mark: passed, wrong, or waiting.
- They are the same three checks as the list in step 4 and carry its sentences for a screen reader. While atoms are still off the board, the electron total shows as waiting, where the list calls it wrong. Before the check step an ion's total waits too, until its charge has been dealt with.
- Each atom's electron count ("6 of 8") is beside it from the moment the atom is on the board. Before, it showed in steps 3 and 4 only.
- The counter adds pairs to its electron numbers: "4 pairs" in bonds, and "4 lone pairs" once every atom has a full shell.

**One-move controls (D-0025).**
- A swipe that starts on the bare board cuts one line of each bond it crosses.
- While an atom is carried, the Clear button turns into a bin and says "Drop here to take it off". An atom dropped there comes off the board. Dragging an atom off the edge of the board still works.
- In free build, and in the bond and check steps, an atom dropped from the row onto an atom on the board is bonded to it in the same move. The place step leaves that to the bond step.
- Electrons are still changed with a tap on the atom and a button.
- Clear works from the 3D view and from the later steps. It empties the board and brings the flat board back, and a guided molecule goes back to the place step. Undo straight after it puts back the atoms, the step, the view and the answers.

**The dipole drawing (D-0025).**
- While a bond's arrow is held over an atom, a label beside the arrowhead says "points at oxygen".
- The net dipole has aim points: small dots beyond each outer atom, beyond each lone pair of the middle atom, toward the middle of the outer atoms, and straight away from it. That last one is the empty space on the far side of the molecule.
- An arrow dragged within 13° of a dot snaps to it, and a label says where it points ("toward a lone pair", "away from the 2 hydrogen atoms"). A tap on a dot sets the arrow there. A free direction between the dots still counts.
- The judging does not change: within 35° of the net dipole on screen is right (D-0023).

## Consequences
- The glow and the hand are drawn in the layer over the page (`.mb-fx`) and placed on every frame, so no control's own styles or animations change. A control that can be the next action carries a `data-cue` name.
- A swipe that starts on an atom or on an electron is still a drag of that atom or electron. A student who wants to cut a short bond has to start on bare board.
- The 13°, the hand's timing, the wording of every label and the look of the hand are the build session's. Nobody has tried them with a student or on a real phone (W-003).
- Carried by `src/modules/lewis/ui.ts` (the layer, the strip, the how-to lines, the bin), `src/modules/lewis/scene.ts` (the swipe, the aim points, the labels), `src/modules/lewis/store.ts` (`cue`, `clearBoard`), `src/modules/lewis/guide.ts` (`howTo`, `checkChips`, `aimWords`), their tests, and `scripts/check-browser.mjs`.
