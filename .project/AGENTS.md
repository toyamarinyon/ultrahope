# .project Structure

## Core layout (operational view)

```
.project/
├── tasks/                     # Task board
│   ├── AGENTS.md
│   ├── active/
│   ├── backlog/
│   ├── blocked/
│   └── done/
├── tests/                     # Executable/manual test scenarios and result logs
│   ├── AGENTS.md
│   ├── scenarios/
│   ├── reports/
│   └── templates/
├── decisions/                 # ADR-like decision records
│   ├── AGENTS.md
│   └── ...
└── docs/                      # External documentation references and reference notes
    ├── nextjs/
    ├── polar/
    ├── privacy-policy-review/
    ├── privacy-policy-review2/
    ├── terms-of-use-review/
    └── auth-monitoring-runbook.md
```

## Index and update rule

- Current state is derived by inspecting the filesystem:
  - `tasks/active`, `tasks/backlog`, `tasks/blocked`, `tasks/done`
- Any update to leaf files under `tasks/` should be reflected in commit history and follow `tasks/AGENTS.md` rules.

## Inspection commands

- Full task board snapshot: `find .project/tasks -maxdepth 2 -type f | sort`
- Active: `find .project/tasks/active -maxdepth 1 -type f | sort`
- Backlog: `find .project/tasks/backlog -maxdepth 1 -type f | sort`
- Blocked: `find .project/tasks/blocked -maxdepth 1 -type f | sort`
- Done: `find .project/tasks/done -maxdepth 1 -type f | sort`

## Naming conventions

- `tasks/` — operational status tracking (`active`/`backlog`/`blocked`/`done`) by directory only.
- `tests/` — scenario definitions, shared templates, and execution reports.
- `decisions/` — decisions and rationale (why we did it this way).
- `docs/` — local copies of external resources in a model-friendly format.

## docs/

- `docs/nextjs/` — Next.js reference
- `docs/polar/` — Polar SDK reference and OAT scope documentation
- `docs/privacy-policy-review/` — Privacy policy review (1st round)
- `docs/privacy-policy-review2/` — Privacy policy review (2nd round, developer UX focus)
- `docs/terms-of-use-review/` — Terms of use review
- `docs/auth-monitoring-runbook.md` — Auth incident response runbook
