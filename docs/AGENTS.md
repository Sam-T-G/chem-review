# docs/: how to write and change docs

The lead owns `docs/`. Four folders inside it belong to teams: `docs/chemistry/` (chem), `docs/design/` (design),
`docs/learning/` (learning), `docs/platform/` and `docs/verified.md` (platform).

## Read first
- `docs/README.md`: the map of what goes where.

## Rules
- DOC1 One home for each fact. Link to it from anywhere else. A second copy stops getting updated and ends up wrong.
- DOC2 A living spec says what is true on main today, in the present tense. If it describes work that is not on
  main yet, its first line says so and names the roadmap item. History goes in a decision record or `HANDOFF.md`.
- DOC3 A decision record is append only. To change an accepted one, write a new record and set the old one to
  `superseded` with a "Superseded by" line.
- DOC4 Statuses: `proposed` (not built), `provisional` (built on an agent's reading, Sam has not confirmed it),
  `accepted`, `superseded`, `rejected`. Only the person or role that `docs/org.md` names for that kind of
  decision sets `accepted`.
- DOC5 Quote Sam word for word in a quote block, with the date (in a decision record, the Date line is the date).
  Mark words you cut with `[...]`. Put under "Decision" only what his words say. What an agent added goes under
  "Consequences", named as the agent's.
- DOC6 Every number or claim names its source: a command, a file, or a quote. Mark the rest `[TBD]` and say what
  would settle it.
- DOC7 Voice: plain, literal and specific. Say what a person does or what the code literally does. No em dashes
  inside sentences, no metaphors, slogans or idioms, and no "X, not Y" turns. Define a term the first time it
  appears. The check fails on these words outside quotes and code: `seamless`, `comprehensive`, `robust`,
  `leverage`, `delve`, `showcase`, `elevate`, `unlock`.
- DOC8 Name a file by its full path from the repo root, in backticks. The check then fails when the file moves.
- DOC9 A new doc gets a row in `docs/README.md`. A new folder with rules of its own gets an `AGENTS.md`, a
  `CLAUDE.md` that holds only `@AGENTS.md`, and a line under "scopes" in `docs/ownership.json`.

## Template for a folder's AGENTS.md
A scope is a folder that has its own `AGENTS.md`. The file has at most 60 lines, with these sections in this
order: `## Files` (one bullet per file, starting with its name in backticks), `## Read first`, `## Rules` (each
with an id and its reason), `## Check your work`, `## Update when you change this`.

## Check your work
- `pnpm check:repo`: links, the map, decision fields, ids, voice. `docs/platform/verify.md` explains each code.
- `pnpm docs:index` after you add a decision record or change one's status.

## Update when you change this
- A new doc: the map in `docs/README.md`.
- A new team, folder or path: `docs/ownership.json` and `docs/org.md`.
- A new import between folders: `docs/ownership.json` and `docs/architecture.md`.
