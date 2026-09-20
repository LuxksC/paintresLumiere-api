# CLAUDE.md

## Project memory (`.specs/`)

This project uses the `tlc-spec-driven` skill's `.specs/` layout for planning and memory:

- `.specs/STATE.md` — `## Decisions` (project-level architectural decisions, append-only) and `## Handoff` (pause/resume snapshot).
- `.specs/features/[feature]/spec.md` — one spec per feature area, with EARS acceptance criteria and a requirement-traceability table.

**Rule: specs follow the project's actual development state, not the roadmap.** Only create a `.specs/features/[feature]/spec.md` when work on that feature actually starts. Do not pre-create specs for future Trello phases "just in case" — a speculative spec goes stale the moment priorities shift, and nobody will remember to keep it in sync. When a feature moves from Trello's Backlog/TODO into active work, that's the trigger to run the Specify phase for it, not before.

The `/check-project-state` command (`.claude/commands/`) reads `.specs/` + recent PRs + Trello to reconstruct where backend development stopped — run it at the start of a session.

## Commit message format

`PL-{id} {type}: {description}`

- `{id}` — the Trello card's number (e.g. the card at `.../211-backend-update-project-docs` is `PL-211`).
- `{type}` — `feat`, `fix`, `refactor`, `docs`, `chore`, etc.
- `{description}` — brief, imperative, describing what was done.

Example: `PL-75 feat: add tenants table and tenant_id column`

## Multi-tenancy

**Every new table is born with a `tenant_id`.** Decided when introducing multi-tenancy (Trello #75) — adding it later means a data migration on tables that may already hold transactional data. `products` and `users` already have it (`.specs/features/multi-tenant-admin/spec.md`, AD-004 in `.specs/STATE.md`).
