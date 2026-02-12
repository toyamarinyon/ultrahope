# .workspace-fs Structure

```
.workspace-fs/
├── state.md         # Index: current status, Next/Done, links to other files
├── to-be/           # Spec: what to build (to-be, not as-is)
│   ├── cli.md
│   └── api.md
├── decisions/       # Decisions: how we build and why (ADR-like)
│   ├── authentication.md
│   ├── billing.md
│   ├── billing-meter-design.md
│   ├── billing-model-v2.md
│   ├── billing-free-plan-auto-subscription.md
│   ├── free-plan-daily-limit.md
│   ├── cli-implementation.md
│   ├── infrastructure.md
│   ├── project-structure.md
│   ├── monorepo-tooling.md
│   ├── monolith-migration.md
│   ├── web-design-direction.md
│   ├── web-package.md
│   ├── cli-config-file.md
│   └── model-allowlist.md
└── docs/            # External docs: reference info for libraries/frameworks
    ├── elysiajs/ 
    └── mise/tasks
```

## Naming conventions

- **to-be/** — The intended target state. Write the target spec, not the current as-is state.
- **decisions/** — Records of technical choices and design decisions. Allows tracing “why we did it this way” later.
- **docs/** — Local copies of external resources, saved in a format that is easy for an LLM to reference.

## docs/

- [docs/elysiajs/llms-full.txt](docs/elysiajs/llms-full.txt) — ElysiaJS information used for API implementation
