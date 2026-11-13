# Chem Review

A general chemistry practice app. One codebase runs on the web now and builds for iOS and Android. "Chem Review" is a working name.

The app is a shell (home screen, navigation, saved progress) that hosts modules. The first module, **Lewis structures and shapes**, has a student work one molecule in five steps on a 3D board:

1. **Count** the valence electrons of each atom, then the total (the charge of an ion included).
2. **Place** the atoms on the board, after answering which atom goes in the middle.
3. **Bond** each outer atom to the middle atom by dragging one atom onto the other.
4. **Check** every atom's electron count, the electron total, and the formal charges.
5. **Shape**: count the electron groups, commit to a shape, then watch the flat drawing lift into 3D.

It has 20 guided molecules and a free build mode with 18 atoms.

**Live demo:** https://sam-t-g.github.io/chem-review/

## Run it

```bash
pnpm install
pnpm web          # web, with live reload
pnpm ios          # iOS Simulator through Expo Go
pnpm android      # Android emulator through Expo Go
pnpm verify       # typecheck + unit tests + production web build (dist/)
```

Browser checks with real mouse and touch input run against the production build:

```bash
pnpm web:build && pnpm web:serve                 # serves dist/ on http://localhost:5210
node scripts/check-browser.mjs desktop           # all 20 guided problems, start to finish
node scripts/check-browser.mjs phone             # the same at 390 x 844 with touch
node scripts/check-browser.mjs desktop extras    # wrong answers, hints, refused moves, undo, keyboard, free build
node scripts/check-browser.mjs phone extras
node scripts/check-browser.mjs desktop shell     # home screen, opening the module, the way back, saved progress
MB_SHOTS=1 node scripts/check-browser.mjs ...    # also saves screenshots to shots/
```

The project uses pnpm. `npx expo ...` works but prints a warning about it; `pnpm exec expo ...` does not.

### Publishing the live demo

The demo is the web build on GitHub Pages, served from the `gh-pages` branch.

```bash
pnpm pages:build     # builds dist-pages/ with every address under /chem-review
pnpm pages:deploy    # the same build, then replaces the gh-pages branch with it
MB_URL=https://sam-t-g.github.io/chem-review node scripts/check-browser.mjs desktop shell   # any of the checks, against the live site
```

GitHub Pages serves a project from a folder named after the repository, so this build sets an address prefix (`WEB_BASE_URL`, read in `app.config.js`, which passes it to Expo as `experiments.baseUrl`). The local build in `dist/` has no prefix. Pushing to `main` does not update the demo: run `pnpm pages:deploy` after a change that should go live.

## The stack, and why

| Piece | Choice | Why |
|---|---|---|
| App framework | Expo SDK 58 (React Native 0.88, React 19.3) with Expo Router | The same routes, screens and saved progress run on web, iOS and Android. The shell is real native UI on phones. |
| Modules with heavy graphics | Web tech (Three.js, HTML, CSS) inside an Expo DOM component | On the web the module renders in place. In the native apps Expo runs the same code in a web view, so a module works on all three platforms the day it is written. A module can be moved to native rendering later, one at a time, if it ever needs it. |
| Chemistry engine | Plain TypeScript in `src/chem/` | No React, no DOM. It runs in tests in milliseconds and can be reused by any module. |
| Animation in the shell | Reanimated 4 | Runs on the UI thread on phones. |
| Design tokens | `src/theme/tokens.ts` | One palette for the native shell and (as CSS variables) for web modules. |
| Type | Nunito for reading, Fredoka for titles, formulas, numbers and buttons | Both are rounded, and Fredoka's heavy weights read well at large sizes. The shell loads them from `@expo-google-fonts`, the web modules from `@fontsource-variable`. |
| Tests | Vitest for the engine and guide, Playwright for real-input browser checks | |

Choices considered and not taken: Flutter (weak 3D, and its web output cannot use Three.js), a web app wrapped in Capacitor (no native shell, so navigation and system features stay web-only), fully native React Native 3D (react-three-fiber on native works through expo-gl, but its WebGPU path still needs patches as of November 2026, and it would have meant rewriting the verified module before it could be tested on a device).

## Layout

| Path | What is in it |
|---|---|
| `src/app/` | Routes. `_layout.tsx` loads fonts, `index.tsx` is the home screen, `lewis.tsx` hosts the Lewis module. |
| `src/shell/` | Native shell pieces: module card, saved progress, and the home screen's drawings (`Atom.tsx` is an atom with a face, `Playground.tsx` the four atoms at the top, `Sky.tsx` the rising bubbles). |
| `src/theme/tokens.ts` | Colors, radii, font names. |
| `src/modules/registry.ts` | The list of modules the home screen shows. |
| `src/modules/lewis/` | The Lewis module: `LewisModule.tsx` (the DOM component), `guide.ts` (every sentence, every step rule, and what each wrong answer is told), `store.ts` (state), `scene.ts` (3D board), `face.ts` (the atoms' faces), `fx.ts` (sparks and rings), `ui.ts` (panel), `styles.css`. |
| `src/chem/` | The engine: `structure.ts` (moves and electron bookkeeping), `solve.ts` (reference structures), `assess.ts` (what is wrong with a drawing), `vsepr.ts` (shapes), `repulsion.ts` (the 3D model), `layout2d.ts` (the flat drawing), `problems.ts`. |
| `tests/` | Unit tests. |
| `scripts/` | `check-browser.mjs` (real-input checks), `gen-elements.mjs` (element data), `make-icons.mjs` (app icons). |

### Look and motion

- **Atoms have faces.** Each ball has a pale patch above its symbol, a light tint of the ball's own color, with two tall dark eyes on it, set close together. The eyes are solid: they have no whites and no pupils. They blink, lean a little toward the pointer, grow when the atom is picked up, and close into two arcs for a moment when it makes a bond. A bonded atom whose outer shell is full gets pink cheeks. The patch color comes from `faceColor` in `palette.ts`. The same face is drawn three ways: in 3D on the board (`face.ts`), in CSS in the panel and the tray (`.mb-ball` in `styles.css`), and with native views on the home screen (`src/shell/Atom.tsx`).
- **Controls press down.** A button, chip or card sits on a darker bottom edge (the `*Lip` colors in `tokens.ts`) and moves down onto it while pressed.
- **Things move while nothing is happening:** atoms bob, electrons glow and jitter, shared electrons slide along their bond, lone pairs swell and shrink, bubbles rise behind the board, the current step's number hops, and the finished 3D model turns slowly after 2.5 seconds without a touch.
- **Things answer the student:** a new atom drops and bounces, a new bond throws sparks and both atoms hop, a refused move makes the atoms involved shake, a wrong count of electron groups draws rings on the board around the groups it was about, a finished step throws paper from the next button and every atom hops in turn. On a phone the same four moments reach the phone's motor through `expo-haptics`.
- **Text arrives and leaves like bubbles, the same way everywhere.** When text on the page changes, each piece that left (a title, a paragraph, a question, a card, a row of the checklist, a hint) sags, shrinks to nothing in 0.2 seconds and lets go of a few small bubbles. Each new piece then blows up into place a little past full size and settles, one piece after another. A piece whose words changed ("1 of 5 atoms on the board" to "2 of 5") counts as one that left and one that arrived, so it gets the same treatment and never blinks. Text that stayed but has to move slides to its new place. A move to another step does this for the whole step in about 0.8 seconds. The tiles of the electron counter, the atom tray and the card for a selected atom arrive and leave the same way. `PIECES` in `ui.ts` lists what counts as a piece. The pieces that leave are moved into a closed shadow root in the effects layer for their last 0.2 seconds, so the tests, the keyboard and screen readers only ever find the new text.
- **Only what changed moves.** The panel and the counter are redrawn as a whole, so `ui.ts` marks everything a redraw left unchanged (`is-same`) and the styles keep it still. Pressing + on carbon pops carbon's number and leaves hydrogen's alone.
- **Reduced motion:** with the system setting on, every loop, bounce and ring above is off. Nothing a student needs is shown only through motion: the rings repeat what the card beside the board says in words.

### Wrong answers

A wrong answer usually comes from a wrong idea, so the app answers the idea. Every wrong answer gets a card with three short parts (a `Coach` in `guide.ts`):

1. **What the answer is.** "6 is carbon's atomic number."
2. **Why that does not answer the question.** "The atomic number counts all 6 of carbon's electrons, and 2 of them are in the inner shell."
3. **What to do next.** "Count only the electrons in carbon's outer shell."

The ideas each step recognizes:

| Step | The wrong answer | What it is taken for |
|---|---|---|
| Count, one atom | the atomic number | every electron counted, inner shells too |
| | the number of that atom in the formula | the count for all of them instead of one |
| | 8 minus the right number | the electrons the atom is short of 8 |
| | 8 (2 for hydrogen) | a full shell |
| Count, the total | any total that fits none of the rows below | told what the total is made of: which atoms bring how many electrons, and what the charge does |
| | the neutral atoms' count | the charge left out |
| | the charge applied the wrong way | a negative charge read as fewer electrons |
| | each element counted once | the subscripts left out |
| | atomic numbers added up | every electron counted |
| Middle atom | hydrogen | hydrogen makes 1 bond (and a formula's first atom is not always the middle) |
| | an atom there are several of | only 1 atom is in the middle |
| Check | more electrons than the molecule has | electrons added by hand to fill a shell |
| | fewer electrons than the molecule has | electrons taken off |
| | full shells, formal charges that can be smaller | full shells taken for a finished drawing (more than one drawing fills every shell) |
| Shape, the groups | each shared pair counted | a double bond counted as 2 groups |
| | only the bonded atoms | lone pairs left out |
| | the lone pairs counted as 1 | each lone pair is its own group |
| | outer atoms' lone pairs counted | only the middle atom's groups set its shape |
| | 1 too many, no lone pairs | the middle atom counted as a group |
| Shape, the name | the arrangement of all the groups | lone pairs counted as corners of the shape |
| | the shape with no lone pairs | lone pairs left out |
| | square planar for 4 bonds | the flat drawing read as the shape |
| | any other shape | told what that shape needs, and what this molecule has |

An answer that matches none of these gets the plain version: it is wrong, and what to count.

- **Pictures.** A wrong count for an atom can come with a picture of that atom's electron shells: gray rings and dots for the inner shells, a colored ring with the valence electrons on it. A wrong total comes with a picture of every atom in the molecule: a row for each kind of atom with one ball per atom and what that kind brings, a row for an ion's charge, and the total. The first miss shows the atoms alone, the second adds each row's sum, the third fills in the total. A wrong group count draws rings on the board around the groups the card is about (the double bonds, the lone pairs, or every group in turn).
- **How, before how many.** A wrong total is never answered with the bare sum (Sam, 2026-11-13). The words say how the total is built ("the nitrogen atom brings 5 and each of the 3 hydrogen atoms brings 1"), then each kind of atom is added up, then the total is given in words ("5 from nitrogen and 3 from hydrogen make 8"). The Hint button says the same two things once every atom's count is right.
- **The answer comes last.** A first miss is told the idea, a second gets the rule or the list of what is there, and the third gets the answer. The shape name is the exception: the student commits to one, the model lifts into 3D, and a wrong pick is told the right shape at once.
- **The card stays up** while the student changes the number, so the picture can be counted from. The next check replaces it.
- **Every claim a card makes is tested against every problem** (`tests/guide.test.ts`): if a card says "3 is the number of atoms bonded to nitrogen", a test checks that it is.
- To add a recognized mistake, add a case to the step's `...Idea` function in `guide.ts`, a test with the exact words, and a line to the table above.

### Adding a module

1. Build it under `src/modules/<id>/`. If it needs canvas, WebGL or CSS, make its top component a DOM component (`'use dom'` on the first line, default export) like `LewisModule.tsx`. Its props must be plain data or async functions.
2. Add a route file `src/app/<id>.tsx` that renders it and passes `useProgress('<id>')`.
3. Add an entry to `src/modules/registry.ts`. The home screen picks it up.

## Where the chemistry comes from

- **Element data** (`src/chem/elements.data.json`) is generated by `scripts/gen-elements.mjs` from Valence's validated `data/elements.json` (group, period, Pauling electronegativity from PubChem).
- **Valence and inner-shell electrons** follow OpenStax Chemistry 2e, section 6.4: valence electrons are the ones in the outermost shell, and the rest are core electrons. The shell picture draws the full inner shells (2, 8, 18, 18) and the valence electrons; a test checks that each atom's shells add up to its atomic number.
- **Lewis structure rules** follow OpenStax Chemistry 2e, sections 7.3 and 7.4: count valence electrons (add for anions, subtract for cations), least electronegative atom in the middle, hydrogen never in the middle, octets where possible, formal charge to pick between drawings, and the three kinds of exception (odd-electron, electron-deficient, hypervalent).
- **Shapes** follow section 7.6: the five electron-group arrangements, their ideal angles, the names for arrangements with lone pairs, lone pairs in equatorial seats of a trigonal bipyramid, and two lone pairs on opposite sides of an octahedron. The group count follows the same section: a single, double or triple bond is one group, and a shape is named for where the atoms are.
- **Measured angles** are shown for two molecules only, both printed in section 7.6: water 104.5° and ammonia 106.8°.
- No citations on screen. The grounding lives here, in code comments and in the tests.

### Expanded octets

Formal charge decides between drawings, and an atom from period 3 onward may take more than 8 electrons to make the formal charges smaller (Sam's call, 2026-11-12). So sulfur dioxide is drawn with two double bonds, sulfate with two, phosphate with one. A drawing that keeps sulfur at 8 with charges of +1 and −1 is sent back with a hint.

The textbook's text shows expanded shells only where the electron count forces them (PCl5, SF6, IF5, XeF4). If a course wants sulfur kept at 8, change `DEFAULT_CONVENTION` in `src/chem/solve.ts` to `'octet'` and drop the three problems in the "Expanded octets with double bonds" group.

### The 3D model's angles

The repulsion model uses made-up strengths (lone pair to lone pair 2.6, lone pair to bond 1.4, bond to bond 1) picked so that the textbook arrangement is the lowest-energy one for all 13 shapes; a test checks that. They are not fitted to measurements, so the app never prints an angle read from the model.

The 3D view marks one bond angle with a dotted arc and a label (two for shapes with two different angles). The label's text comes from the shape table, or from the two measured angles, never from the model. The model only decides whether the arc is drawn: an arc shows while its two bonds really are at that angle, so it goes away while a student pulls the model out of shape. When the outer atoms are different elements (formaldehyde), the label and the panel say "about 120°".

One known gap: in the model's seesaw (SF4) the two middle bonds settle about 125° apart, wider than 120° where the textbook says narrower. The "less than 120°" arc is not drawn for that pair, and the panel still gives both angles in words. Fixing it means retuning the three strengths against the 13-shape test.

## What is verified

Run on 2026-11-13, on the build in this commit, unless a line says otherwise:

- `pnpm verify`: typecheck, 284 unit tests, production web build. `pnpm lint` is clean, and `expo-doctor` passes 20 of 20 checks.
- **Unit tests** cover the bonding rules, the reference structure for 31 species, the checker, the shape table, the repulsion model (every shape settles into the textbook arrangement), the flat layout, the step flow in the store, and the guide's wording (including a scan of every sentence for banned phrasing). One test solves all 20 problems using only the hints the app gives, and another checks that every hinted move is one the board accepts. Every claim a wrong-answer card makes is checked against every problem it can appear in.
- **Browser, real input (Chromium), against the GitHub Pages build served from `/chem-review`:** home screen, opening the module, methane solved start to finish, the back button and saved progress pass at 1360 x 840 with a mouse and at 390 x 844 with touch (32 checks each).
- **Browser, the rest:** `[TBD]` on this commit. The run of all 20 molecules at both sizes, and the wrong-answer, hint, refused-move, undo, keyboard and free-build checks, were last complete before the text transitions were added (desktop wrong-answer checks: 133 of 134, where the one failure was a check that read the wrong line and has since been fixed). They are being rerun against the live site; this line gets the numbers when they finish.
- **Safari's engine (2026-11-12, before the changes listed under iOS below):** the module loads and draws correctly in Playwright's WebKit. The real-input checks have not been run there.
- **iOS (2026-11-12, before the new faces, the wrong-answer cards and the text transitions):** the app runs in the iPhone 17 Pro simulator (iOS 27) through Expo Go. The home screen is native UI (the four atoms, the fonts and the card all draw), and the Lewis module loads inside it with the 3D board drawing. Nothing was tapped or dragged in the simulator, so touch on iOS is not checked.
- **Looked at, not measured:** the motion. Screenshots at both sizes were reviewed for every guided molecule's flat and 3D view, the count step, a wrong answer with a hint, the picker and free build. The text transitions and the rings on the board were reviewed as frames frozen at set moments, never at full speed. No frame rate was measured, and the browser checks run on a software renderer, so they say nothing about speed on a real phone.
- A read-only code review reported 15 defects in the first version; all 15 are fixed. Twelve have an automated test. Three do not: a mouse release that never reaches the page, freeing GPU objects when the board is rebuilt, and one sentence in free build that printed the wrong electron count.

## Not done yet

- **No real device yet.** Simulator and headless browsers only. Android has not been run at all (no Android SDK on this Mac).
- **Hosting is the web demo only.** The web build is live on GitHub Pages (see "Publishing the live demo"). It is published by hand with `pnpm pages:deploy`; nothing deploys on a push. Store builds go through EAS and need an Expo account plus Apple and Google developer accounts.
- **Haptics are untested.** The calls to the phone's motor are wired, but a simulator has no motor, so nobody has felt them.
- **One development-only error on iOS.** When a DOM component first opens, Expo's wrapper sends its props before the native web view has registered, logs "Unable to find the 'DomWebView' view", then sends them again when the view is ready. The module loads normally. Not checked in a release build.
- **The module's panel is hand-written DOM** (`ui.ts`), not React components. It works on every platform as is; rewriting it in React would make it easier to share pieces with other modules.
- **Chemistry gaps:** molecules with more than one middle atom (ethane, hydrogen peroxide) can be built in free build but have no reference answer and no 3D shape; odd-electron molecules (NO, NO2) have no reference answer; no typed-in formulas.
- **Accounts and sync:** progress is saved on the device only.
- **Screen readers:** every control and atom has a label and keyboard access, but the 3D shape view has no text alternative beyond the shape readout.
- **Name and icon** are placeholders.
