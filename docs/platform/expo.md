# Expo, pnpm and builds

This is an Expo and React Native app (D-0002). The web build ships first. Lay out every screen for a 390 x 844 phone as well, because the iOS and Android apps use the same code.

## Expo changes with every release

Expo ships breaking changes in every SDK release. An API remembered from an older version may be renamed, moved or gone. Before writing code that touches an Expo, EAS or React Native API:

1. Read the major version of the `expo` package in `package.json`.
2. Fetch the matching versioned docs: `https://docs.expo.dev/versions/v<major>.0.0/`
3. For anything else, fetch https://docs.expo.dev/llms.txt, an index of all Expo docs with corrections to common mistakes. Follow its links to the page you need. Never answer from memory.

## Commands

```bash
pnpm exec expo install <package>  # always this, never pnpm add: it picks versions that match the SDK
pnpm start                        # dev server (web, iOS, Android)
pnpm web                          # web, with live reload
pnpm ios                          # iOS Simulator through Expo Go
pnpm android                      # Android emulator through Expo Go
pnpm exec expo-doctor             # diagnose dependency and config problems
pnpm exec expo install --fix      # fix package versions that do not match the SDK
```

`npx expo ...` works and prints a warning that the project uses pnpm. `pnpm exec expo ...` prints no warning.

## Rules

- **From an agent's shell, pnpm can wait on a prompt forever.** Put `CI=true` in front and `< /dev/null` at the end: `CI=true pnpm install --frozen-lockfile < /dev/null`. In your own terminal the plain command works.
- **Every checkout and every worktree gets its own install**, with the command above. Never link one `node_modules` to another. On 2026-11-13, pnpm 11.5.1 reinstalled packages before a `pnpm exec` because the installed ones did not match the lockfile, and it did so through a link into another checkout (M-0003).
- **Routes.** Expo Router handles all navigation. Every file in `src/app/` is a screen, and `_layout.tsx` files define navigators. Components, hooks and helpers live outside `src/app/`. Docs: https://docs.expo.dev/router/introduction.md
- **Native folders are generated.** If `ios/` and `android/` do not exist, Expo generates them (Continuous Native Generation). Never create or edit them by hand. Native behavior is configured in `app.json` and config plugins.
- **Expo Go only has its bundled native modules.** After adding a library with native code, the app needs a development build: `pnpm exec expo run:ios` or `pnpm exec expo run:android` locally, or `eas build --profile development`.
- **Prefer Expo's own modules** over third-party libraries. Docs: https://docs.expo.dev/versions/latest/index.md
- **Playwright is pinned** to 1.64.1 in `package.json`, so it reuses the browsers already downloaded on this Mac.

## The live demo (D-0020)

The web build is live on GitHub Pages: https://sam-t-g.github.io/chem-review/. It is served from the `gh-pages` branch, which holds the built site only and is replaced on every deploy. Never base work on that branch.

```bash
pnpm pages:build     # builds dist-pages/ with every address under /chem-review
pnpm pages:deploy    # the same build, then replaces the gh-pages branch with it
MB_URL=https://sam-t-g.github.io/chem-review node scripts/check-browser.mjs desktop shell   # any browser check, against the live site
```

- GitHub Pages serves a project from a folder named after the repository, so this build sets an address prefix (`WEB_BASE_URL`, read in `app.config.js`, which passes it to Expo as `experiments.baseUrl`). The local build in `dist/` has no prefix.
- A push to `main` does not update the demo. Run `pnpm pages:deploy` after a change that should go live, with Sam's go-ahead (R9).

## Store builds (not set up)

Store builds go through EAS, Expo's build and store-upload service (`eas build`, `eas submit`), and over-the-air updates through `eas update`. Run the EAS CLI as `pnpm dlx eas-cli@latest <command>`. They need an Expo account plus Apple and Google developer accounts, and Sam's go-ahead (W-018). Docs: https://docs.expo.dev/eas/index.md
