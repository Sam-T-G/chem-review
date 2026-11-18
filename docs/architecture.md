# Architecture

How the parts fit, what each may import, and the contracts between them. `pnpm check:repo` enforces the import rules from `docs/ownership.json`. Change this doc and that file in the same change.

## The parts

```
src/app/                  routes (Expo Router): the home screen and one route per module    shell
src/shell/                native pieces of the home screen, and saved progress              shell
src/modules/registry.ts   the list of modules the home screen shows                         shell
src/modules/<id>/         one module, built with web tech                                   that module's team
src/chem/                 the chemistry engine                                              chem
src/theme/                colors, radii, spacing, font names                                design
```

A route renders a module. A module calls the engine's functions and draws what they return. The engine imports nothing from modules, screens or drawing code.

## The stack

| Piece | Choice | Why |
|---|---|---|
| App framework | Expo SDK 58 (React Native 0.88, React 19.3) with Expo Router | The routes, the screens and the saved progress are written once for web, iOS and Android. On phones the shell is native UI (D-0002) |
| Modules with heavy graphics | Web tech (Three.js, HTML, CSS) inside an Expo DOM component | On the web the module renders in place. In the native apps Expo runs the same code in a web view, so a module is written once for all three platforms (D-0003) |
| Chemistry engine | Plain TypeScript in `src/chem/` | It imports nothing from React or the DOM, so it runs in tests in milliseconds and any module can use it (D-0004) |
| Animation in the shell | Reanimated 4 | Runs on the UI thread on phones |
| Design tokens | `src/theme/tokens.ts` | One palette for the native shell and, as CSS variables, for web modules (D-0015) |
| Tests | Vitest for the engine and the guide, Playwright for real-input browser checks | (D-0013) |

Only the web build and the iOS Simulator have been tried so far (W-003). D-0002 lists the stacks that were considered and turned down.

## What may import what

| Folder | May import from | Packages |
|---|---|---|
| `src/chem/` | itself | none |
| `src/theme/` | itself | none |
| `src/modules/<id>/` | itself, `src/chem/`, `src/theme/` | any |
| `src/modules/registry.ts` | `src/chem/` | `expo-router` |
| `src/shell/` | itself, `src/theme/`, `src/chem/`, `src/modules/registry.ts`, `assets/` | any |
| `src/app/` | itself, `src/shell/`, `src/theme/`, `src/modules/`, `assets/` | any |
| `src/types/` | nothing in the repo | any |
| `scripts/` | itself | any |

- A module never imports another module or the shell, so a module team can change any file inside its folder without reading another team's code.
- The shell reads the list of modules from `src/modules/registry.ts` and imports no other file under `src/modules/`.
- Scripts import nothing from `src/`. Tests may import anything.
- By convention, a route imports only its module's top component, the types its props need, and the plain values in the module's `contract.ts` (a file with no imports of its own). The check enforces the folder (`src/modules/`), and a reviewer checks the rest.
- A new folder under `src/` fails the check until it has an owner and a row here.
- One exception is on file in `docs/ownership.json`: the home screen's atoms in the shell import the element ball colors from the Lewis module's `palette.ts` (W-011).

## Contracts

A contract is what one team promises another. Changing one needs the lead and a decision record.

### A module (D-0001, D-0003)

- It lives in `src/modules/<id>/`, and its top component is `<Name>Module.tsx` with a default export.
- If it needs canvas, WebGL or CSS, the top component is a DOM component: `'use dom'` on the first line.
- Its props are plain data or async functions, and they do not change after the module opens. The `Props` interface at the top of `src/modules/lewis/LewisModule.tsx` is the pattern: the mode it opens in, what is already finished, a call for each newly finished item, a call to leave, and a call each time the phone should vibrate (a drop, a bond, a refused move, a finished step).
- A route file `src/app/<id>.tsx` renders it and passes it `useProgress('<id>')`.
- An entry in `src/modules/registry.ts` puts it on the home screen.
- A module can have more than one card and route. The Lewis module has three: `/lewis` (the guided molecules), `/shapes` (the shapes quiz) and `/exercises`. All three render `LewisScreen` in `src/app/lewis.tsx` with a start mode (D-0031).
- Anything only a phone can do (its motor, its storage) stays in the shell or the route and reaches the module through a prop.

### A part of the Lewis module (D-0031)

A part is a mode of the Lewis module with its own panel and its own rules for the board: the shapes quiz (`src/modules/lewis/shapes/`) and the exercises (`src/modules/lewis/exercise/`). `src/modules/lewis/parts.ts` is the contract. `ui.ts` asks the part for each region of the screen, for what the board draws, for where the next action is and for the key terms whose card may not open while an answer is open, and hands it the presses and key strokes it does not know. `store.ts` asks the part's `state.ts` what is on the board. A part keeps to its own folder and changes the state with `update()`. Changing `Part` needs the lead. A student can open a part only when it is listed in `OPEN_PARTS` (`parts.ts`) and its card is listed in `OPEN` (`src/modules/registry.ts`): a part that is built but still has review findings to fix stays out of both, its tab is not drawn, and its route opens the guided steps.

### Saved progress

`useProgress(moduleId)` in `src/shell/progress.ts` returns the finished problem ids, whether they have loaded, and a function that records more. The ids are saved on the device under the key `chem-review:progress:<moduleId>`. The Lewis module's three cards each have a list (`lewis`, `shapes`, `exercises`). Inside the module they are one list, and an id's prefix says which card it belongs to: none for a guided problem, `shape:` for a row of the shape table, `ex:` for an exercise. A change to the key or to the shape of what is saved loses students' progress, so it needs a decision record first.

### The engine (D-0004)

Pure functions over plain data. A `Structure` is never changed in place: every move returns a new one. Each rule has a test with the expected answer written from the textbook.

### Tokens (D-0015)

`src/theme/tokens.ts` exports the colors, radii, spacing and font names, and `cssVars()` hands the colors to web modules as CSS variables.

### The names the browser checks use (D-0013)

`scripts/check-browser.mjs` finds things by `data-key`, `data-act`, `data-tray` and the `.mb-*` class names. Those names are a contract between a module and platform: restyle freely and keep them.
