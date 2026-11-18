# src/modules/lewis/: the Lewis structures and shapes module (team lewis)

A student works one molecule in seven steps on a 3D board, or builds freely. Web tech (Three.js, HTML, CSS) inside
one DOM component.

## Files
- `LewisModule.tsx`: the DOM component. Its props are the module's contract with the shell.
- `guide.ts`: every sentence a student reads, every step rule, and what the app says about each wrong answer. Pure functions. Learning design reviews it.
- `store.ts`: the state and every action a student can take. Decides when a move is allowed in the current step.
- `scene.ts`: the 3D board. It owns no chemistry: it reports gestures and redraws what it is given.
- `ui.ts`: everything on screen that is not the 3D board, rebuilt as HTML strings.
- `styles.css`: the panel's CSS. Design reviews it.
- `palette.ts`: the element ball colors and the faces' patch color, shared by the board and the panel. Design reviews it.
- `face.ts`: the atoms' faces on the 3D board.
- `fx.ts`: sparks, rings on the board, and the glow around electrons.
- `font.ts`: registers the module's fonts.
- `contract.ts`: the mode names and the prefixes of saved ids, the only values a route may import. No imports of its own.
- `parts.ts`: the contract a part of the module follows, and the list of parts. The shapes quiz is in `shapes/` and the exercises are in `exercise/`, each with its own `AGENTS.md`.

## Read first
- `docs/learning/guided-steps.md`: the steps, the problems, the rules for words. Read it for any change.
- `docs/learning/wrong-answers.md`, when you change what the app says about a wrong answer.
- `docs/design/look-and-motion.md`, when you change what a student sees or how it moves.
- `src/modules/AGENTS.md`: the rules every module follows.

## Rules
- L1 Every sentence a student reads lives in `guide.ts` and follows the voice rules (R6 in the root `AGENTS.md`). `tests/guide.test.ts` scans every line.
- L2 A hint must be a move the board accepts. `nextMove()` tries the move before suggesting it. Keep that.
- L3 When a student's answer is wrong, the card names the mistake behind it and says how the answer is worked out before giving any number. Never give the answer before the last try (the two exceptions are the shape name and step 6's polar-or-nonpolar question, where the first pick is final). Every claim a card makes has a test against every problem it can appear in. [D-0012, D-0017, D-0018, D-0021]
- L4 Chemistry lives in `src/chem/`. `store.ts` only decides when a move is allowed and what to say when it is refused.
- L5 Colors, radii and font names come from `src/theme/tokens.ts` only. [D-0015]
- L6 Follow "Rules for motion" in `docs/design/look-and-motion.md`: reduced motion, `--now`, `ONE_SHOT`, `data-k`, and one way in and out for text (`PIECES`). [D-0010, D-0019]
- L7 Keep `data-key`, `data-act`, `data-tray`, `data-cue`, `data-term` and the `.mb-*` class names. The browser checks find things by them, and `cue()` in `store.ts` names the next action by its `data-cue`. [D-0013, D-0026]
- L8 Angle labels come from the shape table or the two measured angles, never from the 3D model. [D-0008]
- L9 The step split, the problem list, the drag gesture and the card's three parts are provisional. Work inside them can go on. Ask Sam before changing them. Steps 6 and 7 are provisional too, and so are how the dipoles are drawn, how the next action is shown, and the key terms' cards. [D-0007, D-0017, D-0021, D-0023, D-0026, D-0028]
- L10 A key term's card never works on the molecule on screen: no number, pick or drawing the current molecule asks for. `tests/terms.test.ts` holds every card to that for all twenty problems. [D-0028]

## Check your work
- `pnpm exec vitest run guide store terms` while you work.
- `pnpm verify`, then the browser checks at both sizes (`docs/platform/verify.md`). A UI change is not done without them.

## Update when you change this
- The steps, the problem list or the rules for words: `docs/learning/guided-steps.md`. What the app says about a wrong answer: `docs/learning/wrong-answers.md`.
- What a student sees or how it moves: `docs/design/look-and-motion.md`.
- The component's props: `docs/architecture.md` and `src/app/lewis.tsx`, with the shell team.
- A new file here: the list above.
