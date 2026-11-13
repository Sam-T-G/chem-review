# D-0010: The first design is redone with idle animations, interactive elements and more visual appeal

- Status: accepted
- Date: 2026-11-12
- Decided by: Sam
- Teams: design, lewis, shell

## Context
The first build was a clean, quiet panel beside a 3D board. It worked and passed its checks. Sam's reaction:

> i mena it works but the design, ui, and presentation is uninspired. really rethink and redesign, i want idle animations, and interactive elements including other visual appeals

## Decision
The design, the UI and the presentation are rethought and redone. The app has idle animations, interactive elements and other visual appeal.

## Consequences
- How design carried this out is in `docs/design/look-and-motion.md`: what moves while nothing is happening, what reacts to the pointer, and what animates on a drop, a bond, a refused move and a finished step.
- That doc also lists five things every new screen starts with. The list is design's reading of this decision. Sam asked for one redesign and has not said it is a rule for every screen.
- Every loop and bounce stops under the system's reduced-motion setting, and nothing a student needs is shown only through motion. That is the build session's rule.
- A new module or screen with no idle animation repeats M-0001.
