# .workspace-fs Structure

## Core layout (operational view)

```
.workspace-fs/
├── tasks/                     # Task board
│   ├── AGENTS.md
│   ├── active/
│   ├── backlog/
│   ├── blocked/
│   └── done/
├── decisions/                 # ADR-like decision records
│   ├── AGENTS.md
│   └── ...
└── docs/                      # External documentation references and reference notes
    ├── elysiajs/
    └── mise/tasks
```

## Index and update rule

- Current state is derived by inspecting the filesystem:
  - `tasks/active`, `tasks/backlog`, `tasks/blocked`, `tasks/done`
- Any update to leaf files under `tasks/` should be reflected in commit history and follow `tasks/AGENTS.md` rules.

## Inspection commands

- Full task board snapshot: `find .workspace-fs/tasks -maxdepth 2 -type f | sort`
- Active: `find .workspace-fs/tasks/active -maxdepth 1 -type f | sort`
- Backlog: `find .workspace-fs/tasks/backlog -maxdepth 1 -type f | sort`
- Blocked: `find .workspace-fs/tasks/blocked -maxdepth 1 -type f | sort`
- Done: `find .workspace-fs/tasks/done -maxdepth 1 -type f | sort`

## Naming conventions

- `tasks/` — operational status tracking (`active`/`backlog`/`blocked`/`done`) by directory only.
- `decisions/` — decisions and rationale (why we did it this way).
- `docs/` — local copies of external resources in a model-friendly format.

## docs/

- `docs/elysiajs/llms-full.txt` — ElysiaJS information used for API implementation
