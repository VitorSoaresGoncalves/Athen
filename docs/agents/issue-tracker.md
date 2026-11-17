# Issue tracker: Local Markdown

Real, team-facing work for this project is tracked externally in **YouTrack**.
The team maintains YouTrack manually, independently of agent execution. Board access,
assignment and issue status are not gates for agents to execute a request. Record
identifiers and information supplied by the user without inventing them; when no
issue is supplied, use a descriptive slug and mark the work as a direct request.
See [branch and review conventions](../convencoes.md#branches-e-revisão).
Within this repo, the agent issue/spec surface that the engineering skills read from
and write to is local markdown under `.scratch/`.

## Conventions

- One feature per directory: `.scratch/<feature-slug>/`
- The spec is `.scratch/<feature-slug>/spec.md`
- Implementation issues are one file per ticket at `.scratch/<feature-slug>/issues/<NN>-<slug>.md`, numbered from `01`, never a single combined tickets file
- Triage state is recorded as a `Status:` line near the top of each issue file (see `triage-labels.md` for the role strings)
- Comments and conversation history append to the bottom of the file under a `## Comments` heading

## OpenCode delivery records

The OpenCode team reuses this feature directory and spec. Its orchestrator maintains
`tasks.md` (assignments and evidence) and `handoff.md` (resumption context) alongside
the spec, following the [team protocol](time-opencode.md). These records do not
replace individual issue files or YouTrack states. Initialize them only for a
concrete task; templates live under [templates/](templates/).

## When a skill says "publish to the issue tracker"

Create a new file under `.scratch/<feature-slug>/` (creating the directory if needed).

## When a skill says "fetch the relevant ticket"

Read the file at the referenced path. The user will normally pass the path or the issue number directly.

## Wayfinding operations

Used by `/wayfinder`. The **map** is a file with one **child** file per ticket.

- **Map**: `.scratch/<effort>/map.md` (the Notes / Decisions-so-far / Fog body).
- **Child ticket**: `.scratch/<effort>/issues/NN-<slug>.md`, numbered from `01`, with the question in the body. A `Type:` line records the ticket type (`research`/`prototype`/`grilling`/`task`); a `Status:` line records `claimed`/`resolved`.
- **Blocking**: a `Blocked by: NN, NN` line near the top. A ticket is unblocked when every file it lists is `resolved`.
- **Frontier**: scan `.scratch/<effort>/issues/` for files that are open, unblocked, and unclaimed; first by number wins.
- **Claim**: set `Status: claimed` and save before any work.
- **Resolve**: append the answer under an `## Answer` heading, set `Status: resolved`, then append a context pointer (gist + link) to the map's Decisions-so-far in `map.md`.
