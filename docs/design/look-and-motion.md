# Look and motion

What the app looks like and how it moves, as built. The direction is Sam's (D-0009, D-0010, D-0011, D-0019). The details below are design's, and the section "Not settled, not checked" lists what Sam has not seen.

## Palette and type

- The palette carries over from Sam's physics sims (D-0009). Every color has a name in `src/theme/tokens.ts`, and a color is written in that file and nowhere else (D-0015). The build session's names for them: blueberry-milk sky, mint board, grape controls, butter electrons, strawberry for mistakes.
- Nunito is for reading. Fredoka is for titles, formulas, numbers and buttons. Both are rounded, and Fredoka's heavy weights read well at large sizes. The shell loads them from `@expo-google-fonts`, the web modules from `@fontsource-variable`.
- The element ball colors are in `src/modules/lewis/palette.ts`, shared by the 3D board and the panel so an oxygen looks the same in both. `ink` there is the label color that reads on that ball.

## A first version has these in it

Design's working rule for any screen a student uses, written after M-0001. Sam asked for one redesign (D-0010) and has not said this list is a rule for every screen.

1. Idle animation: something moves while nothing is happening.
2. Something reacts to the pointer or a touch.
3. An animation on each drop, bond, refused move and finished step.
4. Fredoka for titles, numbers and buttons, and buttons with a thick bottom edge.
5. The words stay plain and literal. Only the drawing and the motion are playful.

## What is on screen

- **Atoms have faces.** Each ball has a pale patch above its symbol, a light tint of the ball's own color, with two tall dark eyes on it, set close together. The eyes are solid, without whites or pupils (D-0011). They blink, lean a little toward the pointer, grow when the atom is picked up, and close into two arcs for a moment when it makes a bond. A bonded atom whose outer shell is full gets pink cheeks. The patch color comes from `faceColor` in `src/modules/lewis/palette.ts`. The same face is drawn three ways: in 3D on the board (`src/modules/lewis/face.ts`), in CSS in the panel and the tray (`.mb-ball` in `src/modules/lewis/styles.css`), and with native views on the home screen (`src/shell/Atom.tsx`).
- **Controls press down.** A button, chip or card sits on a darker bottom edge (the `*Lip` colors in the tokens) and moves down onto it while pressed.
- **Things move while nothing is happening:** atoms bob, electrons glow and jitter, shared electrons slide along their bond, lone pairs swell and shrink, bubbles rise behind the board, the current step's number hops, and the finished 3D model turns slowly after 2.5 seconds without a touch.
- **Things react to the student:** a new atom drops and bounces, a new bond throws sparks and both atoms hop, a refused move makes the atoms involved shake, a wrong count of electron groups draws rings on the board around the groups it was about, a finished step throws paper from the next button and every atom hops in turn. On a phone, a drop, a bond, a refused move and a finished step also make the phone vibrate, through `expo-haptics`.
- **Dipoles are arrows on the board (D-0021).** In steps 6 and 7 each polar bond has an arrow beside it that points at the δ− atom, with a short cross near its start, and δ+ and δ− sit beside the atoms. A polar molecule gets a thicker blue arrow through the middle atom of the 3D model, labeled net dipole. It is the sum of the bond arrows as the model has them, so it swings when a student pulls an atom aside. When the net dipole points along one bond it is drawn beside that bond. The bond-angle marks are hidden in these two steps, because the net dipole runs along the same line as an angle's label. The arrows are an SVG layer over the board, drawn in `src/modules/lewis/scene.ts` from what `src/modules/lewis/ui.ts` passes in.
- **A student draws the arrows (D-0022, D-0023).** In step 6 the pointer turns into a crosshair over an atom an arrow can start on, and that atom grows a little. While the student drags, an arrow runs from that atom to the pointer and stops at the edge of the atom under it. A right arrow throws sparks and both atoms hop. A wrong arrow is redrawn in strawberry and stays until the next one is started, and its atoms shake. The net dipole is dragged out of the middle atom as a thicker blue arrow. Before it is asked for, the model turns until the net dipole lies across the screen, and the slow turn of an untouched model is off until the arrow is right. An atom picked with a tap or the keyboard as the start of an arrow gets a white and grape ring on the 3D model.
- **The next action glows, and a hand points at it (D-0024, D-0026).** A butter-yellow glow pulses around the place of the next action: a rounded frame around a control, a ring around an atom. The pointing hand is a white glove with a grape cuff and an ink outline. It pokes at a question from the left edge of the panel with a small ring spreading from its fingertip, and on the board it acts out a drag: it comes down on the atom, presses, carries a see-through copy of the atom to where it goes, and lets go. For an arrow it draws a line behind itself. The hand is smaller beside small atoms, so it fits a phone. Both are drawn in the layer over the page by `src/modules/lewis/ui.ts` and placed on every frame.
- **The checks are a strip of chips under the counter (D-0024, D-0026).** Three pills, each with a round mark: green with a check, strawberry with a cross, or an empty ring. A chip pops once when it turns green. On a narrow stage the names shorten to Electrons, Shells and Charges.
- **The bin, the cut and the aim points (D-0025, D-0026).** While an atom is carried, the Clear button grows, turns strawberry and shows a label above it. A swipe across the board leaves a dotted strawberry line, and a cut bond throws a few sparks. The net dipole's aim points are small white dots with a blue edge. The one the arrow has snapped to grows and turns butter yellow, and a dark label beside it says where it points.
- **Text arrives and leaves the same way everywhere (D-0019).** When text on the page changes, each piece that left (a title, a paragraph, a question, a card, a row of the checklist, a hint) sags, shrinks to nothing in 0.2 seconds and lets go of a few small bubbles. Each new piece then blows up into place a little past full size and settles, one piece after another. A piece whose words changed ("1 of 5 atoms on the board" to "2 of 5") counts as one that left and one that arrived, so it gets the same treatment and never blinks. Text that stayed but has to move slides to its new place. A move to another step does this for the whole step in about 0.8 seconds. The tiles of the electron counter, the atom tray and the card for a selected atom arrive and leave the same way.
- **Only what changed moves (M-0004).** The panel and the counter are redrawn as a whole, so `src/modules/lewis/ui.ts` marks everything a redraw left unchanged (`is-same`) and the styles keep it still. Pressing + on carbon pops carbon's number and leaves hydrogen's alone.

## Rules for motion

- **A piece that is arriving takes no taps (M-0006).** While a piece is growing into place its buttons are moving, so `settle` in `src/modules/lewis/ui.ts` switches its pointer events off until its entrance animation has ended, with a 1.2 second limit. The molecule picker waits the same way. Keep any new entrance short: a step's last piece takes taps about 0.7 seconds after the step opens.
- **Reduced motion.** With the system setting on, every loop, bounce and ring above is off. CSS has one rule for it at the end of `src/modules/lewis/styles.css`, the 3D scene checks `this.reduced`, and Reanimated follows the system setting without extra code.
- Nothing a student needs is shown only through motion. The rings repeat what the card beside the board says in words.
- A CSS loop inside a region that `src/modules/lewis/ui.ts` redraws starts from `--now`, so a redraw does not restart it.
- A one-shot animation (a pop, a rise, a shake) in such a region goes in `ONE_SHOT` in that file, with a `data-k` when the element has twins, so a redraw moves only what changed.
- Text has one way in and one way out. `PIECES` in that file lists what counts as a piece of text. Do not add a second entrance or a fade for text (D-0019).
- A box whose contents change in place (a list, a row group, a tile) needs `data-k` and an empty `data-kv`, or every change inside it replays the whole box.
- The pieces that leave are moved into a closed shadow root for their last 0.2 seconds, so the tests, the keyboard and screen readers only ever find the new text.

## Not settled, not checked

- Sam has not seen the solid eyes that replaced the googly ones (D-0011).
- Sam asked for a glow or a cute pointing finger (D-0024). He has not seen this hand, the glow's color, or how long the hand's demonstration runs (D-0026).
- Sam asked for text to stop blinking and be consistent (D-0019). He has not said whether he likes the bubble transition the build session chose.
- The motion was looked at in screenshots and never measured. The text transitions and the rings were reviewed as frames frozen at set moments, never at full speed. No frame rate has been taken, and the browser checks run on a software renderer, so they say nothing about speed on a real phone (W-003).
- Nobody has felt the phone vibrate. A simulator has no motor (W-005).
