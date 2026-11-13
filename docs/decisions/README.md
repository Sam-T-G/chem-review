# Decisions

One file per decision: what was chosen, who chose it, and why. Read the index to learn why the repo is the way it is. Write a record when you choose between options that another team has to follow, and whenever Sam says something that sets direction.

## Statuses

| Status | It means |
|---|---|
| `proposed` | Written down and not built. Waiting for the person or role that decides this kind of thing |
| `provisional` | Built on an agent's reading. Sam has not confirmed it. Ask him before building further on it |
| `accepted` | Decided by the person or role that `docs/org.md` names for this kind of decision |
| `superseded` | Replaced. Its "Superseded by" line names the new record |
| `rejected` | Considered and turned down. Kept so nobody proposes it again without new facts |

## Write one

1. Copy [template.md](template.md) to the next number, as `NNNN-short-name.md`.
2. When the decision is Sam's, quote him word for word in a quote block and mark any words you cut with `[...]`. Put under "Decision" only what his words say. What an agent decided or added is named as the agent's, under "Decided by" or "Consequences".
3. Under "Teams", list the teams the decision binds. `pnpm who <path>` shows it to anyone working in those teams' folders.
4. Run `pnpm docs:index` to rewrite the table below.

An accepted record is never rewritten. Only its "Status" and "Superseded by" lines may change, and `pnpm check:repo` enforces that. To change the decision, write a new record and set the old one to `superseded`.

## Index

<!-- index:start -->
| ID | Decision | Status | Decided by | Teams |
|---|---|---|---|---|
| [D-0001](0001-parent-app-with-modules.md) | The app gets its own repo, as the home for an entire parent app | accepted | Sam | lead, shell |
| [D-0002](0002-one-expo-codebase.md) | One Expo codebase for web, iOS and Android | accepted | Lead (the build session), with the stack handed over by Sam | lead, shell, platform |
| [D-0003](0003-web-tech-modules-in-dom-components.md) | A module with heavy graphics is web tech inside an Expo DOM component | accepted | Lead (the build session) | lead, lewis, shell |
| [D-0004](0004-plain-engine-tested-from-the-textbook.md) | The chemistry engine is plain TypeScript, and every rule is tested against the textbook | accepted | Lead (the build session) | chem |
| [D-0005](0005-formal-charge-and-expanded-octets.md) | Formal charge decides between drawings, and period 3 atoms may hold more than 8 | accepted | Sam | chem, learning |
| [D-0006](0006-guide-students-through-the-steps.md) | The app guides a student through the method step by step and shows what each action changes | accepted | Sam | learning, lewis |
| [D-0007](0007-five-steps-twenty-molecules.md) | Five steps, twenty guided molecules, a free build mode, and bonding by dragging one atom onto another | provisional | Lead (the build session), reading D-0006 | learning, lewis |
| [D-0008](0008-no-angle-read-from-the-model.md) | The app never prints an angle read from the 3D model | accepted | Lead (the build session) | chem, lewis |
| [D-0009](0009-cozy-palette-from-the-physics-sims.md) | The look carries over the cozy elements and color palettes of the physics sims, with a more refined UI | accepted | Sam | design |
| [D-0010](0010-the-app-looks-alive.md) | The first design is redone with idle animations, interactive elements and more visual appeal | accepted | Sam | design, lewis, shell |
| [D-0011](0011-faces-with-solid-eyes.md) | The atoms' faces lose their googly eyes and follow a Fall Guys look | accepted | Sam | design, lewis, shell |
| [D-0012](0012-wrong-answers-name-the-idea.md) | When a student gets something wrong, the app explains the wrong assumption and guides them to the right intuition | accepted | Sam | learning, lewis |
| [D-0013](0013-real-input-checks.md) | A UI change is checked with real pointer, touch and key events at two screen sizes | accepted | Lead (the build session), following a standing rule of Sam's | platform, lewis, shell |
| [D-0014](0014-public-repo-push-with-go-ahead.md) | The code is public on GitHub | accepted | Sam | lead, platform |
| [D-0015](0015-one-set-of-design-tokens.md) | One set of design tokens for the native shell and the web modules | accepted | Lead (the build session) | design, lewis, shell |
| [D-0016](0016-teams-scopes-and-doc-channels.md) | Teams own folders, each folder carries its own rules, and each kind of knowledge has one home | accepted | Sam | lead, chem, lewis, shell, design, learning, platform |
| [D-0017](0017-three-part-card-answer-last.md) | A wrong answer gets a card in three parts, and the right answer comes last | provisional | The build session, reading D-0012 | learning, lewis |
| [D-0018](0018-explain-how-a-total-is-built.md) | A wrong electron count is answered with how the count is worked out, before any number | accepted | Sam | learning, lewis |
| [D-0019](0019-text-changes-one-way-without-blinking.md) | Text on screen arrives and leaves in one consistent way, without blinking | accepted | Sam | design, lewis |
| [D-0020](0020-live-demo-on-github-pages.md) | The work is committed, pushed, and published at a live GitHub link | accepted | Sam | lead, platform |
<!-- index:end -->
