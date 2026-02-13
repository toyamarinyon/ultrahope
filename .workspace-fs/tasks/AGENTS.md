# tasks Directory

## Purpose

- Maintain working status of operational tasks in directory partitions:
  - `active`: work in progress
  - `backlog`: planned or pending
  - `blocked`: waiting on dependencies or external constraints
  - `done`: completed and verified

## Update contract

- Active tasks should be actionable and include owner, expected completion date, and next action.
- Backlog items should be small and actionable with context and acceptance criteria.
- Blocked items must include blocker explanation and unblock condition.
- Done items should keep completed outcomes and links to artifacts; avoid deleting completed task files.
- File naming should be short and easy to find.
- A task MAY include one or more `related_decisions` links to ADR documents when relevant.
- File/document links in task files MUST use repository-root-relative paths (for example, `./.workspace-fs/decisions/authentication.md`), not absolute filesystem paths.
- `status`, `created_at`, `updated_at` are not required in file content; use directory location for status and `git log` for temporal history.

## Naming rules

- Use short slugs such as `core-web-unify-openapi-plan.md`.
- Keep names descriptive and stable.

## Quick commands

- Current board snapshot (all task files): `find tasks -maxdepth 2 -type f | sort`
- Active tasks: `find tasks/active -maxdepth 1 -type f | sort`
- Backlog tasks: `find tasks/backlog -maxdepth 1 -type f | sort`
- Blocked tasks: `find tasks/blocked -maxdepth 1 -type f | sort`
- Done tasks: `find tasks/done -maxdepth 1 -type f | sort`
