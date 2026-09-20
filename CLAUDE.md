# CLAUDE.md

## Project memory (`.specs/`)

This project uses the `tlc-spec-driven` skill's `.specs/` layout for planning and memory:

- `.specs/STATE.md` — `## Decisions` (project-level architectural decisions, append-only) and `## Handoff` (pause/resume snapshot).
- `.specs/features/[feature]/spec.md` — one spec per feature area, with EARS acceptance criteria and a requirement-traceability table.

**Rule: specs follow the project's actual development state, not the roadmap.** Only create a `.specs/features/[feature]/spec.md` when work on that feature actually starts. Do not pre-create specs for future Trello phases "just in case" — a speculative spec goes stale the moment priorities shift, and nobody will remember to keep it in sync. When a feature moves from Trello's Backlog/TODO into active work, that's the trigger to run the Specify phase for it, not before.

The `/check-project-state` command (`.claude/commands/`) reads `.specs/` + recent PRs + Trello to reconstruct where backend development stopped — run it at the start of a session.
