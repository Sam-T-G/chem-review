# D-0006: The app guides a student through the method step by step and shows what each action changes

- Status: accepted
- Date: 2026-11-12
- Decided by: Sam
- Teams: learning, lewis

## Context
From Sam's first message about the app:

> First and foremost I want to GUIDE students to building proper sequential knowledge on how to properly tackle the problems, starting with being able to identify number of electrons, drawing individual dot structures, making connections, double bonds, etc. the idea is to also have an orchestrated experience where the app visually guides them into being able to see what is going on and how their actions impact any given configuration.

> They should be able to tinker with models to get from what they are given, physically plop down elements on to a 3d canvas, parse proper relevant information, then be able to fiddle with the app to be able to get a representation of what they want.

## Decision
- The app guides a student through the method in sequence: identifying the number of electrons first, then dot structures, connections and double bonds.
- The app shows what is going on and how each of the student's actions changes the structure.
- Students put the elements on a 3D canvas themselves and can tinker with the model.

## Consequences
- The names of the steps, the problem list and a separate free build mode are the build session's choices, and Sam has not confirmed them (D-0007).
- What the app says when an answer is wrong has its own records (D-0012, D-0017).
- `docs/learning/guided-steps.md` describes the steps as built.
