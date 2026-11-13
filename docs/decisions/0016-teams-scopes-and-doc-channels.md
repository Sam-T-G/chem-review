# D-0016: Teams own folders, each folder carries its own rules, and each kind of knowledge has one home

- Status: accepted
- Date: 2026-11-13
- Decided by: Sam
- Teams: lead, chem, lewis, shell, design, learning, platform

## Context
> [...] i want to set up a proper industry level environment in the repo so that multiple teams can work under an industry structure and heirarchy. i want rules set in place for any agent to properly get efficient context within any subspace scope while also distilling all of our design decisions in proper channels so that any agent and team member can quickly get up to speed AND update documentation.

Before this, the README held the layout, the look, the chemistry sources, the list of what was checked and the list of what was not done, and one CLAUDE.md held every rule. An agent working in one folder loaded all of it. A decision Sam made in chat was written down wherever the agent happened to be writing.

The lead session drafted the structure below on a branch and told Sam what it holds, what was checked, and that landing it meant one commit merged into main. Sam's answer:

> land it

## Decision
Sam asked for the structure and said to land it. What it consists of is the lead session's design:

1. Seven roles: a lead and six teams (chem, lewis, shell, design, learning, platform). `docs/ownership.json` gives every path to one team, and `docs/org.md` says who decides what.
2. Each team folder has an `AGENTS.md` of at most 60 lines: the files, the reading list, the rules, the fast check and the docs to update. The root `AGENTS.md` (at most 80 lines) points to them. A `CLAUDE.md` beside each one imports it, so Claude Code and other tools load the same text.
3. Imports between folders are limited to what `docs/architecture.md` lists, so a team can change the files inside its folder without anyone else having to read them.
4. Each kind of knowledge has one home, listed in `docs/README.md`: decisions, living specs, the roadmap, the handoff, the record of checks, the mistakes log.
5. `pnpm check:repo` enforces 1 to 4 and is part of `pnpm verify`.

## Consequences
- More files: 62 new ones, most under 60 lines.
- A change that adds a file, a folder, a doc or a decision fails the check until the matching doc line exists.
- The README now holds only what the app is, how to run it, and which file to read next. Its other sections moved to the docs listed in `docs/README.md`.
- Left out, each waiting on Sam: team agent files and a session-start hook (W-016), and CODEOWNERS (W-017).
