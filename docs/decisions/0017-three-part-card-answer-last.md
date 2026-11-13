# D-0017: A wrong answer gets a card in three parts, and the right answer comes last

- Status: provisional
- Date: 2026-11-13
- Decided by: The build session, reading D-0012
- Teams: learning, lewis

## Context
D-0012 says the app explains the wrong assumption behind a wrong answer and guides the student to the right intuition. It does not say how. The build session designed the following while building W-001. Sam has not seen it.

## Decision
- The app works out which mistake most likely produced the answer, such as counting carbon's inner-shell electrons.
- The card has three short parts: what the answer is, why that does not answer the question, and what to do next.
- On the first miss the card names the mistake. On the second it gives the rule or lists what is on the board. On the third it gives the answer.
- The shape name is the exception: the student commits to one, the model lifts into 3D, and after a wrong pick the app gives the right shape at once.
- An answer that matches no known mistake gets the plain version: it is wrong, and what to count.

## Consequences
- `docs/learning/wrong-answers.md` lists the mistakes each step recognizes.
- Every claim a card makes is tested against every problem.
- This stays until Sam says otherwise. Adding a recognized mistake to the list can go on. Changing the card's parts or the order of the reveal waits for him.
