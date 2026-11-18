# D-0030: A geometry quiz, less guided exercises from a wider pool, electron and molecular geometry told apart, and 3D models for molecules with no center atom

- Status: accepted
- Date: 2026-11-17
- Decided by: Sam
- Teams: lewis, chem, learning, design, shell, platform

## Context
Sam wrote on 2026-11-17, and attached five photos of a class worksheet (four different pages, 20 molecules):

> i want to add two features for review purposes, I want a feature where students are able to be shown a series of geometries and can do a quiz feature to memorize them all and have iterative practice. I want to also add an exercise feature that is less guided but has a wider pool of problems. then I want to also incorporate particularly differentiating between electron and molecular geometry, along with all of the appropriate applications through the entire app stack to make way for this. Use the following molecules for reference [...] . finally lets expand the feature to also enable 3d models for molecules that do not have a center element. feel free to launch appropriate agents to do all of this in parallel so we can iterate quickly and effectively

The worksheet's printed columns are: Molecule, Valence e- count, Lewis Structure (Does it have resonance?), Electron Geometry, Molecular Geometry, 3D Structure with Bond Angles, Bond Polarity (ΔEN), Net Dipole. Its molecules are H2O, CH2Cl2, SiCl4, BF3, PCl3, PCl5, CH3−, SF6, SiCl6 2−, SCl2, SeCl4, CH3+, ICl5, IF, ICl2−, ICl3, CO3 2−, O3, XeF4 and PH2−.

## Decision
- A feature for review shows a student a series of geometries, with a quiz to memorize them all and practice them again and again.
- A second feature for review is an exercise that is less guided and has a wider pool of problems.
- The app tells electron geometry and molecular geometry apart, in every layer that needs to change for it.
- The molecules on the worksheet are the reference.
- 3D models also work for molecules that do not have a center element.
- The work may be done by several agents in parallel.

## Consequences
- How each of these is built is the build sessions' design and waits for Sam's yes: the parts of the module and the routes (D-0031), the pool (D-0032), step 5 and the words (D-0033), the quiz (D-0034), the exercises (D-0035), the board (`D-0036`, written when the board package lands).
- "Molecules that do not have a center element" is read as molecules of two atoms, such as IF on the worksheet. Molecules with more than one middle atom (ethane, hydrogen peroxide) are a different piece of work (W-007). If Sam meant those, that is a new ask.
- The worksheet's handwritten cells are a student's answers and are not a source. The one row the instructor printed (water) is: its ΔEN of 1.4 matches the course's rounded table that the app already prints (D-0021).
