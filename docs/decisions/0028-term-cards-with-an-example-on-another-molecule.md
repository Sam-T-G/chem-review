# D-0028: A highlighted word opens a card with a meaning, an example worked on another molecule, a picture and one thing to keep in mind

- Status: provisional
- Date: 2026-11-16
- Decided by: The build session, reading D-0027
- Teams: learning, design, lewis, chem

## Context
D-0027 says what Sam wants and leaves the how open. These are the build session's choices, for him to confirm.

## Decision
**Which words (D-0027).**
- 29 terms have a card: valence electrons, electron shell, group and period, atomic number, ion, Lewis structure, middle atom and outer atoms, bond, single, double and triple bonds, lone pair, full shell, formal charge, resonance structures, more than 8 electrons, electron group, shape of a molecule, bond angle, electronegativity, ΔEN, polar and nonpolar, polar bond, δ+ and δ−, bond dipole, net dipole, dipoles that cancel, polar molecule, sigma bond, pi bond, hybridization.
- Each of the 11 shape names (linear to square planar) has a card too, which makes 40.
- `TERMS` in `src/modules/lewis/guide.ts` lists the words in the app's text that open each card.

**Where a word is highlighted.**
- A term is highlighted the first time it appears on a screen. A wrong answer's card and the hints each keep their own list, so a student who is stuck on one finds its words highlighted in it.
- A highlighted word is a button inside the sentence: a pale blue mark with a dotted line under it.
- Words inside buttons, headings, the lines about gestures, the electron counter and the strip of checks are left plain.
- Six words every student has met by the end of the Lewis structure (valence electrons, shell, ion, Lewis structure, middle atom, bond) are highlighted up to the check step and in free build, and plain in steps 5 to 7.
- "Bond" at the start of "Bond each hydrogen atom to carbon" is the verb and stays plain, and so is "bond" after "should" or "to". "Cancel" opens its card only in a sentence about dipoles or arrows.

**The card.**
- A card has the term's name, another name for it or how its symbol is said, what the term means, an example with a picture, one thing to keep in mind, and buttons for related terms.
- On a wide screen the card opens beside the panel, level with its word, and covers none of the panel. On a phone it comes up from the bottom edge as a sheet, and the rest of the screen is dimmed.
- It closes with Escape, with its close button, with a second press on the word, or with a press anywhere else. A press anywhere else still does what it would have done. On a phone a tap on the dimmed screen closes it and reaches nothing behind it.
- A related term's button turns the card to that term. A press on the first word then brings its own card back.
- A card closes when the step or the molecule changes. The pointing hand stays away while a card is open.

**A card never works on the molecule on screen.** A card explains a term. The answers stay with the questions (L3 in `src/modules/lewis/AGENTS.md`).
- No example molecule is a guided problem. The 26 examples are in `SAMPLES` in `src/modules/lewis/guide.ts`.
- A card that gives an atom's own numbers, or that draws every dot of a molecule, uses atoms from other columns of the periodic table than the atoms of the molecule on screen. Atoms in one column have the same number of valence electrons, so chlorine's 7 would give away fluorine's. With water on screen, the valence electrons card counts nitrogen's shells.
- The cards about electronegativity use a bond between two atoms the molecule on screen does not have, with a ΔEN that is not the ΔEN of any of its bonds. Step 2 asks which atom is the least electronegative, and step 6 asks for the subtraction.
- The cards about shape, bond angles and dipoles show a molecule of another shape. The cards about electron groups and hybridization show a middle atom with another number of groups.
- In a guided step a card links only to terms that step or an earlier one uses. Free build links to everything.
- A word in a sentence opens its card in whatever step the sentence appears, so every card has to be safe in every step. In the count step the sentences, the wrong answers' cards and the hints can open eight cards (valence electrons, shell, group, atomic number, ion, Lewis structure, bond, full shell), and a test holds all eight to the rule about columns.
- The cards for resonance and for more than 8 electrons are opened only from a sentence that uses the words, which the app shows after the structure is finished or in a hint. No card links to them, and neither names an atom of a guided problem. The resonance card shows ozone, or the nitrate ion when the molecule on screen is bent with one double bond as ozone is.
- The cards for single, double and triple bonds, resonance and more than 8 electrons draw atoms and lines without dots.

**Where the facts come from.** The definitions follow the key terms of OpenStax Chemistry 2e, chapters 2, 6, 7 and 8, and the course's chapter 7 and 8 slides. `docs/chemistry/sources.md` has the list. Every example sentence takes its numbers from the engine in `src/chem/`, and `tests/terms.test.ts` holds each one to an answer written by hand.

## Consequences
- The words are `termCard`, `termPieces` and `SAMPLES` in `src/modules/lewis/guide.ts`. The highlighted words, the card and its five kinds of picture are in `src/modules/lewis/ui.ts`. A highlighted word carries `data-term`, and the browser checks find it by that.
- Not built: a list of all the terms, highlighted words in the electron counter, in the strip of checks or on the board, and a card that points at the student's own board.
- The glossary is the Lewis module's. Another module that uses the same terms would need the cards moved to a place both can read, which is the lead's call.
- The wording of all 40 cards, the choice of examples and the look of the highlight and the card are the build session's. Nobody has tried them with a student or on a real phone (W-003).
