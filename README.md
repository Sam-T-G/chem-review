# Chem Review

A general chemistry practice app. One codebase for web, iOS and Android: it runs on the web and in the iOS Simulator today. "Chem Review" is a working name.

**Live demo:** https://sam-t-g.github.io/chem-review/

The app is a shell (home screen, navigation, saved progress) that hosts modules. The first module, **Lewis structures and shapes**, has a student work one molecule in seven steps on a 3D board: count the valence electrons, place the atoms, bond them, check every atom, see the molecule's shape, find its polar bonds and whether their dipoles cancel, then count its sigma and pi bonds and name the middle atom's hybridization. It has 20 guided molecules and a free build mode with 18 atoms.

## Run it

```bash
pnpm install
pnpm web          # web, with live reload
pnpm ios          # iOS Simulator through Expo Go
pnpm android      # Android emulator through Expo Go
pnpm verify       # typecheck, lint, unit tests, repo checks, production web build (dist/)
```

The project uses pnpm. The browser checks with real mouse and touch input are in [docs/platform/verify.md](docs/platform/verify.md).

## Work on it

| Start here | For |
|---|---|
| `AGENTS.md` | The rules for everyone who works here, people and agents |
| `pnpm who <path>` | Which team owns a file or folder, and what to read before changing it |
| `CONTRIBUTING.md` | How a change is made, checked, reviewed and merged |
| `HANDOFF.md` | What the last sessions did and what is half done |
| [docs/README.md](docs/README.md) | The map of the docs: decisions, the spec for each area, the roadmap, what has been checked |

## Where it stands

- What has been checked, and how, is in [docs/verified.md](docs/verified.md). It has not been tried on a real phone, and Android has never been run.
- The live demo is published by hand: [docs/platform/expo.md](docs/platform/expo.md) has the commands. What is planned and what is waiting is in [docs/roadmap.md](docs/roadmap.md).
- Why it is built the way it is: [docs/decisions/README.md](docs/decisions/README.md).
