# Project agent team implementation plan

> **For agentic workers:** Use superpowers:executing-plans for inline implementation and bounded independent forward tests.

**Goal:** Reusable specialists with private durable context and economical dispatch.

**Architecture:** One registry drives task briefs and native role configuration. A shared skill links role-specific workflows; private memory remains in the original repository. No agent process or paid API is started by helper scripts.

**Tech stack:** Existing Node ESM, JSON, Markdown, TOML, Vitest; no dependencies.

**Spec:** `docs/superpowers/specs/2026-10-27-project-agent-team-design.md`

## Constraints and review focus

- Preserve the site, PostgreSQL, public snapshots and global main-model settings.
- Keep research and role memory private; reject traversal/symlink escapes.
- Reinitialization/installation must preserve durable user content and sibling skills.
- Every generated dispatch selects both model and effort; quick tasks stay cheap.
- Worktrees resolve the existing evidence archive instead of creating a partial index.
- A runtime agent handle is not a persistent role or proof of a capability.

## Task 1: Registry, CLI and private memory

- [ ] Write failing functional tests for role profiles, read-only brief, context bounds, worktree archive resolution, safe paths, idempotent init and scoped install.
- [ ] Implement `scripts/agents/` and `tools/agents/roles.json`; wire package commands.
- [ ] Verify focused tests and TOML configuration, then initialize the original private role folders.

## Task 2: Skill, workflows and integration

- [ ] Record baseline recovery (scout found no reusable definitions/memory/policy), then author the shared skill and seven role workflows with positive output contracts.
- [ ] Install and validate the skill; add pointers in AGENTS.md and deadlock-project.
- [ ] Run independent realistic retrieval, routing and critic exercises; adjust only demonstrated issues.
- [ ] Run full suite/typecheck/data/build checks and final review. Commit, reconcile the original checkout, retain reusable native definitions and private records; publish only maintained code/docs/configuration.
