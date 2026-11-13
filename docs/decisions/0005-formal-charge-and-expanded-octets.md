# D-0005: Formal charge decides between drawings, and period 3 atoms may hold more than 8

- Status: accepted
- Date: 2026-11-12
- Decided by: Sam
- Teams: chem, learning

## Context
Two conventions are taught for center atoms from period 3 on, such as the sulfur in SO2 or sulfate. One keeps the center at 8 electrons when the count allows (octet first). The other makes the formal charges as small as possible first and lets the center go past 8 (formal charge first, an expanded octet). The textbook's text shows expanded shells only where the electron count forces them (PCl5, SF6, IF5, XeF4).

The build session had built both and asked Sam which one his course uses:

> **Expanded octets:** free build accepts both the octet-first and the formal-charge-first drawing (SO₂ either way) and says which one it is. Tell me if your course uses only one.

Sam's answer:

> we can do expanded octets, [...]

## Decision
The app uses the formal-charge-first drawing: formal charge decides between drawings, and an atom from period 3 onward may take more than 8 electrons to make the formal charges smaller. In code this is `DEFAULT_CONVENTION = 'charge'` in `src/chem/solve.ts`.

Sam's five words name expanded octets. Reading them as "use the formal-charge-first drawing for every such molecule" is the build session's reading of his answer to its question.

## Consequences
- Sulfur dioxide is drawn with two double bonds, sulfate with two, phosphate with one. A drawing that keeps sulfur at 8 with charges of +1 and -1 is sent back with a hint.
- Three guided problems (the "Expanded octets with double bonds" group) depend on this.
- If a course wants the center kept at 8, the change is `DEFAULT_CONVENTION` to `'octet'` and dropping those three problems. That is a new decision, and it is Sam's.
