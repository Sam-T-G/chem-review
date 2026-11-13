# Chem Review

General chemistry practice app. One Expo (React Native) codebase for web, iOS and Android. "Chem Review" is a working name.

Read `README.md` for the layout and what is verified. Read `AGENTS.md` before touching any Expo or React Native API: fetch the versioned docs, do not answer from memory.

## Verify before calling anything done

```bash
pnpm verify                                   # typecheck + unit tests + web build (dist/)
pnpm web:serve                                # serves dist/ on :5210, in another terminal
node scripts/check-browser.mjs desktop        # every guided problem, real mouse input
node scripts/check-browser.mjs phone          # same at 390 x 844, real touch input
node scripts/check-browser.mjs desktop extras # wrong answers, hints, refusals, undo, keyboard, free build
node scripts/check-browser.mjs phone extras
node scripts/check-browser.mjs desktop shell  # home screen, open module, back, saved progress
```

A UI change is not verified until the browser checks pass on both sizes. Never check a control with `.click()` from script; the checks use real pointer and key events.

## Rules

- `src/chem/` is the chemistry engine: pure TypeScript, no React, no DOM, no Three.js. Keep it that way. Every rule in it has a test with the expected answer written from the textbook, not from the code.
- Every chemistry claim on screen must be right and sourced (OpenStax Chemistry 2e 6.4, 7.3, 7.4, 7.6). Never print a number the app did not get from a cited source. No citations on screen.
- Every sentence a student reads lives in `src/modules/lewis/guide.ts` and follows Sam's voice rules (`~/.claude/skills/prose-voice/SKILL.md`). `tests/guide.test.ts` scans every line for banned shapes.
- A wrong answer gets a `Coach` from `guide.ts`: `lead` says what the answer is, `why` says why that does not answer the question, `ask` hands the question back. Never state the answer before the last try (the shape name is the one exception). Every claim in a `lead` needs a test that it is true for every problem it can appear in. README "Wrong answers" lists the recognized ideas. An explanation says how the answer is built before it says the answer: never answer a wrong total with the bare sum.
- A hint must be a move the board accepts. `nextMove()` tries the move before suggesting it; keep that.
- Colors, radii and font names come from `src/theme/tokens.ts` only.
- Motion: every loop or bounce must stop under `prefers-reduced-motion` (CSS has one rule at the end of `styles.css`; the scene checks `this.reduced`; Reanimated follows the system setting on its own). A CSS loop inside a region that `ui.ts` redraws starts from `--now` so a redraw does not restart it. A one-shot animation (a pop, a rise, a shake) in such a region goes in `ONE_SHOT` in `ui.ts`, with a `data-k` when the element has twins, so a redraw moves only what changed. Text has one way in and one way out: the pieces listed in `PIECES` in `ui.ts` deflate when they leave or change and inflate when they arrive. Do not add a second entrance or a fade for text. A box whose contents change in place (a list, a row group, a tile) needs `data-k` and an empty `data-kv`, or every change inside it replays the box.
- The browser checks find things by `data-key`, `data-act`, `data-tray` and the `.mb-*` class names. Restyle freely, but keep those names.
- Angle labels on the 3D model come from the shape table or the two measured angles (`angleMarks` in `guide.ts`), never from the model.
- Install packages with `pnpm exec expo install <name>`, not `pnpm add`, so versions match the Expo SDK. `npx` works too, with a warning that the project uses pnpm.
- pnpm is non-interactive here: prefix installs with `CI=true` and feed `< /dev/null`, or it can wait on a prompt forever.
- Formal charge decides between drawings, and period 3 atoms may take more than 8 (`DEFAULT_CONVENTION = 'charge'` in `src/chem/solve.ts`, Sam's call 2026-11-12).
- No commit trailers naming an AI.
