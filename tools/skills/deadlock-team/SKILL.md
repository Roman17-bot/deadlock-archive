---
name: deadlock-team
description: Use when coordinating specialized or repeated Deadlock project tasks, assigning bounded subagents, recovering specialist context, or reviewing unsupported claims and project direction.
---

# Deadlock team

Use named roles with file-backed memory. A process/agent handle is temporary; the role, its workflow and accepted context survive it. Read only the relevant role, not the whole team.

| Role         | Task                                                   | Default      |
| ------------ | ------------------------------------------------------ | ------------ |
| heroes       | abilities, stats, builds, matchups, replays            | Sol / medium |
| items        | purchase choices and interactions                      | Sol / medium |
| mechanics    | equations, stacking and calculations                   | Sol / high   |
| website      | UI/API implementation and verification                 | Sol / medium |
| designer     | visual direction, graphics, icons and custom animation | Sol / medium |
| designcritic | independent visual/UX and design-specificity review    | Sol / medium |
| data         | PostgreSQL, ingestion, patch provenance, Pages sync    | Sol / medium |
| critic       | independent evidence, correctness and direction review | Sol / medium |
| scout        | short lookup, file ownership, one small check          | Luna / low   |

Exact available model IDs and efforts are in `tools/agents/roles.json` in the active checkout. For a narrow lookup, work directly; don't start a team just because roles exist. Usually delegate one or two independent tasks, at most the runtime limit (project default three children). Only the coordinator delegates.

For visual redesign/assets, dispatch `designer` with `deadlock-design`; for independent aesthetic and layout review, dispatch `designcritic` with `deadlock-design-review`. Read `docs/design-brief.md`: preserve the user's existing layout and workflows. Designer outputs concepts/assets inside its private run, website implements accepted production changes, and designcritic checks actual rendered results. A small visual task needs only the relevant roles; do not launch both critics and the full team automatically.

## Dispatch and recovery

1. Recover through `deadlock-project` and `knowledge status`. Locate the original archive via the installed `references/local-profile.json` when needed. Keep implementation in the active checkout.
2. Run `npm run team -- brief ROLE --task "bounded task"` there. Optional `--read PATH`, `--write PATH`, `--depth quick|standard|deep`; `audit` additionally needs `--reason`. Only website/data accept code ownership. The command returns a `spawn` object; it does not start or charge for an agent.
3. Inspect live agents. Reuse a compatible idle specialist with `followup_task` when it retains useful context. Otherwise pass the generated **spawn object** to the actual spawn tool. It explicitly sets both model and effort and uses `fork_turns: none`. If the current tool has no native role selector, this explicit dispatch is the working route. Native TOML roles have fixed defaults; use a fresh explicit generic dispatch for another depth.
4. The worker reads [protocol.md](references/protocol.md), its `references/roles/ROLE.md` and `knowledge/agents/ROLE/CONTEXT.md` in the original archive. Reports go to its unique assigned run folder. The coordinator alone updates shared role context and imports accepted evidence.

Use `scout`/quick for mechanical checks. Escalate only when the task needs diagnosis or unresolved reasoning; an audit uses Astra/high with a stated reason. If a model is unavailable, report that and select an available equivalent explicitly; do not silently inherit an expensive parent.

## Critic triggers

Request a fresh [critic](references/roles/critic.md) at a major milestone, before adopting contested game formulas/build claims, after substantial changes across subsystems, or when the user requests a direction check. Give it requirements, an exact artifact/diff and independent evidence access. It may disagree with the coordinator. One scoped review is normally enough; verified fixes do not need repeated identical reviews. No background schedule is implied.

For memory ownership, report fields and evidence promotion see [protocol.md](references/protocol.md).
