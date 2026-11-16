# D-0024: A question is made noticeable, the app shows how to act on the board, and the checks stay on screen

- Status: accepted
- Date: 2026-11-16
- Decided by: Sam
- Teams: learning, design, lewis

## Context
Sam wrote, the same day the drawn dipoles (D-0022) went live:

> lets add some features to make the prompt interactions in the step by step more noticable. For example, when students are asked a question on the module, there should be an illuminated glow, or a cute pointer finger that pulsates a point towards where the user's attention should be at. Also there should be some UI guidance on how to actually fulfil a given request, particularly when users are prompted to manipulate the board in some way. Students should be able to know things like how to connect bonds and elements to one another, and the indicators on how many valence electrons, lone pairs, fulfilled bondings, etc that serve as one of the checks SHOULD be a persistent UI element.

## Decision
- When a student is asked a question, the place their attention should go is made noticeable: with an illuminated glow, or with a cute pointing finger that pulses toward it.
- The interface says how to carry out what a step asks for, above all when the step asks the student to work on the board. A student can tell how to connect atoms with bonds.
- The indicators that serve as checks (how many valence electrons, lone pairs, filled bonds and so on) are a persistent part of the interface.

## Consequences
- How each of the three is built is the build session's design and waits for Sam's yes (D-0026).
- "Persistent" is read as: on screen in every step that has a board, and in free build. The count step shows sample atoms and has no checks yet.
