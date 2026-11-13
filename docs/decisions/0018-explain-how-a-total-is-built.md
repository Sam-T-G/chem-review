# D-0018: A wrong electron count is answered with how the count is worked out, before any number

- Status: accepted
- Date: 2026-11-13
- Decided by: Sam
- Teams: learning, lewis

## Context
After trying the first wrong-answer cards, Sam said:

> here's what i mean, when the student gets the valence electron input wrong, it simply tells the student that they are wrong and lists the equation to tell them what numbers to add and multiply to get the right answer, - 5+3x1, what needs to happen is that the module should tell the students how the valence electrons are calculated, not just give them the mathematical depiction of what the right answer is

## Decision
When a student gets the valence electron count wrong, the module tells them how the valence electrons are calculated. A sum written out as numbers is not an explanation.

## Consequences
- The build session's way of doing it, which Sam has not confirmed in detail: the words say which atoms bring how many electrons ("the nitrogen atom brings 5 and each of the 3 hydrogen atoms brings 1"), a picture shows every atom, and the total is given in words on the third miss. `docs/learning/wrong-answers.md` describes it.
- A wrong total is never answered with the bare sum.
- This narrows D-0017: the order of the reveal stays, and each stage now explains before it counts.
