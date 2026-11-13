# D-0002: One Expo codebase for web, iOS and Android

- Status: accepted
- Date: 2026-11-12
- Decided by: Lead (the build session), with the stack handed over by Sam
- Teams: lead, shell, platform

## Context
Sam wants the web first and native apps later, and left the stack open:

> i want to make a chemistry review app that is web hosted first, but will later have an ios and android native app.

> [...] the stack is flexible, i want something that is easily translatable to ios and android in the future but also have high levels of visual polish, animations, optimization, capability, etc

The build session turned down three other stacks. These are its reasons as it wrote them in the README. It recorded no source for them: `[TBD: check each against the tool's own docs before relying on it]`.

- Flutter: weak 3D, and its web output cannot use Three.js.
- A web app wrapped in Capacitor: no native shell, so navigation and system features stay web-only.
- Fully native React Native 3D: react-three-fiber on native works through expo-gl, but its WebGPU path still needed patches in November 2026, and it would have meant rewriting the checked module before it could be tried on a device.

## Decision
Expo SDK 58 (React Native 0.88, React 19.3) with Expo Router. The routes, the screens and the saved progress are written once for web, iOS and Android, and on phones the shell is native UI. Reanimated 4 animates the shell. pnpm is the package manager. Vitest runs the unit tests and Playwright the browser checks.

## Consequences
- Only the web build and the iOS Simulator (through Expo Go) have been tried so far. No phone, and no Android at all (W-003).
- Expo changes its APIs every SDK release, so anyone using an Expo or React Native API fetches the versioned docs first (`docs/platform/expo.md`).
- Packages are added with `pnpm exec expo install`, so their versions match the SDK.
- Store builds go through EAS, Expo's build and store-upload service, and need accounts Sam has not set up (W-004).
- Sam has run the result and has not objected to the stack. He can still overturn it.
