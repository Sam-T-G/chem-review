# D-0003: A module with heavy graphics is web tech inside an Expo DOM component

- Status: accepted
- Date: 2026-11-12
- Decided by: Lead (the build session)
- Teams: lead, lewis, shell

## Context
The Lewis module needs a 3D board (Three.js), HTML and CSS. Sam asked for "high levels of visual polish, animations, optimization, capability, etc" and for a path to iOS and Android (D-0002). Native 3D in React Native was not ready for that (the third option in D-0002).

## Decision
A module that needs canvas, WebGL or CSS is written with web tech, and its top component is an Expo DOM component (`'use dom'` on the first line). On the web it renders in place. In the native apps Expo runs the same code in a web view.

## Consequences
- A module is written once for all three platforms. Only the web and the iOS Simulator have been tried (W-003).
- The module's props cross into the web view, so they are plain data or async functions, and they do not change after the module opens (each changed prop is sent across again).
- The shell around the module stays native. Anything only a phone can do (its motor, its storage) stays in the shell or the route and reaches the module through a prop.
- A module can move to native rendering later, one at a time, if it ever needs it.
- On iOS in development, a DOM component logs one "Unable to find the 'DomWebView' view" error when it first opens, then loads. Not yet checked in a release build (W-015).
