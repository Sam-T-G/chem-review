# D-0020: The work is committed, pushed, and published at a live GitHub link

- Status: accepted
- Date: 2026-11-13
- Decided by: Sam
- Teams: lead, platform

## Context
> commit and push and push to a live github link

## Decision
The redesign is committed and pushed to the public repo, and the web build is published at a live GitHub link.

## Consequences
- The build session published it on GitHub Pages: https://sam-t-g.github.io/chem-review/, served from the `gh-pages` branch. That branch holds the built site only and is replaced on every deploy.
- Publishing is by hand, with `pnpm pages:deploy`. A push to `main` does not update the demo. `docs/platform/expo.md` has the commands.
- Sam's words covered that commit, that push and that deploy. The lead's working rule still asks him before each later one (R9 in the root `AGENTS.md`).
- Store builds for iOS and Android are not part of this (W-018).
