# D-0001: The app gets its own repo, as the home for an entire parent app

- Status: accepted
- Date: 2026-11-12
- Decided by: Sam
- Teams: lead, shell

## Context
The work began as one demo for Lewis structures and VSEPR. The same day Sam asked for a home for more than that:

> we can do expanded octets, lets make a brand new repo for all of this to have a home for an entire parent app.

## Decision
The work lives in a brand new repo of its own. That repo is the home for a whole parent app, and the Lewis demo is one part of it.

## Consequences
- How the parent app holds its parts is the build session's design, and Sam did not specify it: a shell (home screen, routes, saved progress) hosts modules, each module is one topic a student practices, and `src/modules/registry.ts` lists them. `docs/architecture.md` describes it.
- Each module gets its own team, so two modules can be built at the same time without sharing files.
- "Chem Review" is a working name. Sam has not confirmed the name or the icon (W-014).
