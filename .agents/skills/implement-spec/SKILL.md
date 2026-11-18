---
name: implement-spec
description: "Implement the result of /to-spec and /to-tickets in code."
disable-model-invocation: true
---

You have been provided a spec. This spec should have tickets associated with it, describing how to implement the spec.

Use the local tracker configured in `docs/agents/issue-tracker.md`. Record supplied identifiers without inventing issue numbers or board states.

Read `AGENTS.md`, `docs/agents/issue-tracker.md` and `docs/agents/time-opencode.md` before execution. Project rules take precedence over this skill. The goal is the entire spec implemented on the **issue branch in the main checkout**, with every ticket resolved and evidence recorded under `.scratch/<feature-slug>/`.

The tickets are not a list of steps. They are a **task graph** with blocking relationships between them. This means there is always a **frontier** of tickets which are ready to be grabbed.

Communication to and from subagents should be sparse. Communicate primarily through **context pointers**: to the spec, tickets, research notes, and previous commits. Don't duplicate information already available via pointers.

The orchestrator coordinates at most two specialists concurrently and one writer per file. Specialists inspect Git and request mutations from the orchestrator. All agents share the main checkout and issue branch; additional worktrees and per-specialist branches are outside this workflow.

## Steps

1. Read the spec and tickets to understand the task graph.

2. If exploration is required, the orchestrator assigns it to a specialist. Save notes under the feature directory so later agents can consult them.

3. Have the orchestrator create or resume the issue branch in the main checkout according to `docs/convencoes.md`, preserving preexisting work. Initialize or resume `spec.md`, `tasks.md` and `handoff.md`. Record supplied issue identifiers; a clear direct request does not require board access or an issue number.

4. The orchestrator assigns each ticket to a developer with contract revision, files, dependencies and acceptance criteria. Each developer confirms the shared checkout and branch, implements the ticket and uses `tdd` when test-first development is applicable or requested. Return changed paths, checks and remaining risks; request Git mutations from the orchestrator.

5. Once a developer completes, the orchestrator checks the result in the shared branch, updates task records and coordinates corrections. There is no per-agent merge step.

6. Recompute the **frontier** and assign newly unblocked tickets within the protocol's concurrency and file ownership limits. Keep the developer session for corrections.

7. Once all tickets are complete, run applicable delivery checks and independent review in a fresh session. If using `code-review`, the orchestrator coordinates its required agents within the protocol limits. Resolve blockers and repeat affected checks and review.

8. Have the educator document the final diff and evidence. The orchestrator performs the required commits and push on the issue branch and follows the project's PR workflow, preserving human approval before merge. Record actual local and remote outcomes separately.

9. Update tickets, `tasks.md` and `handoff.md` with the actual outcome, Git references and next action. Clean up temporary artifacts and processes owned by the task, preserving feature records and preexisting work.
