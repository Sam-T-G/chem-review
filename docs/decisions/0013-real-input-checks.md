# D-0013: A UI change is checked with real pointer, touch and key events at two screen sizes

- Status: accepted
- Date: 2026-11-12
- Decided by: Lead (the build session), following a standing rule of Sam's
- Teams: platform, lewis, shell

## Context
Sam's standing rules for his agents say that a passing build is necessary and never enough, and that a control is never checked by calling `.click()` or `.focus()` from script. Those rules are in his own notes outside this repo, so they are not quoted here. They come from a control on another of his pages that passed a scripted check while no pointer could reach it.

## Decision
A UI change is verified when `scripts/check-browser.mjs` passes at two sizes against the production web build. Every action in those checks is a real pointer or key event sent through the browser.

The two sizes (1360 x 840 with a mouse, 390 x 844 with touch) and the use of the production build are the build session's choices.

## Consequences
- The checks find things by `data-key`, `data-act`, `data-tray` and the `.mb-*` class names. Restyle freely and keep those names.
- `pnpm verify` passing does not verify a UI change.
- Not covered yet: real devices, and the real-input run in Safari's engine (W-003, W-012).
