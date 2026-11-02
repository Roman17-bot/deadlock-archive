# Integrate the supplied design-agent prompts

**Goal:** incorporate the user's two follow-up prompts into the existing designer and designcritic without changing the site or installing more tools.

**Architecture:** keep short skill entrypoints and role definitions; put new-page guidance and the weighted review contract in two maintained references. The existing project installer distributes those references. Production integration remains owned by website/coordinator; designcritic returns text without file writes.

**Source:** the two user-supplied Design Agent / Design Critic Agent prompts, 30 October 2026. Baseline: `fd2f89d`.

## Work

- [x] Add a new-page workflow: retain Heritage and shared components, compose a distinct page, inspect only relevant context, check 1440/768/390 px and affected shared components.
- [x] Adopt the user's seven weighted criteria and structured findings: scores are expert judgments, unknown evidence prevents an aggregate score, and serious UX/accessibility defects block acceptance independently of the total.
- [x] Align roles, shared protocol, documentation, UI metadata and the project installer; preserve read-only review, models, MCP settings and production ownership.
- [x] Install the maintained project copies, validate discovery and source parity, exercise installer/team checks, and independently test the new contracts before integrating into main.

## Verification and rulings

- Baseline role check returned the old unscored review format with no weighted matrix or finding IDs/acceptance criteria. This is a contract gap against the new request, not a defect in the earlier design review.
- Reuse the existing isolated checkout on `codex/design-agent-prompts`; do not create another worktree or evidence archive.
- Keep the original prompts in the private archive. Incorporate their decisions without duplicating hundreds of generic lines into every dispatch.
- Impeccable and Microsoft reviewer remain unavailable/skipped as previously documented. The supplied names do not imply installation; the existing React skill is `vercel-react-best-practices`.
- Existing-page layout stays fixed. A genuinely new page may have its own composition inside the established product shell; it does not authorize redesigning other pages.
