# D-0019: Text on screen arrives and leaves in one consistent way, without blinking

- Status: accepted
- Date: 2026-11-13
- Decided by: Sam
- Teams: design, lewis

## Context
> some text pops in and out very briefly, well they kind of "blink" in and out very briefly, can we make it consistent

## Decision
Text does not blink in and out. It arrives and leaves the same way everywhere.

## Consequences
- The build session's way of doing it: a piece of text that leaves shrinks to nothing in 0.2 seconds and lets go of a few small bubbles, and a new piece blows up into place. Sam has not said whether he likes that transition. `docs/design/look-and-motion.md` describes it.
- There is one entrance and one exit for text. A second entrance, or a fade, is not added.
- `scripts/check-browser.mjs` checks that one arrival animation is in use and that no slide or blink is left over.
