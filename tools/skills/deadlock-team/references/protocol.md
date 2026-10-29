# Shared work and memory contract

The original repository holds private evidence and `knowledge/agents/<role>/CONTEXT.md`. Active worktrees hold implementation. `npm run team -- status` shows resolved locations; `context ROLE` reads at most6000 characters. If the archive cannot be found, return the missing locator/path; do not create an incomplete archive. A timestamp/old client match is not a live patch check.

Run `npm run knowledge -- status` and subsequent knowledge queries with the tool's **workdir set to the original archive root supplied in the brief**. Implementation searches/tests run in the active checkout. If the checkout reports a missing index, rerun the read in the supplied archive workdir; that is a location error, not absence of evidence.

The parent supplies a bounded task, read scope, explicit write ownership and unique `runs/<id>/` directory. Workers write their report there; only website/data may edit assigned implementation files. Read-only roles may still write their own report. The designer may create assets and prototypes inside its assigned private run directory; the coordinator or website role integrates production changes. The designcritic independently reviews the exact design artifact and returns actionable findings, without editing production. These are workflow boundaries, not separate OS sandboxes. Don't change another worker's files, shared context, index, credentials, Git refs or deployments. Don't spawn children. An implementation task's tests and relevant skills still apply.

Return a short handoff with these fields:

- **Result:** answer or concrete change, including actual before/after behavior when relevant.
- **Evidence:** exact paths/symbols or original URLs, version and source/review dates. Identify independent sources; mirrors count as one lineage.
- **Verification:** commands or observations actually performed and their outcomes. Say when a replay/video was only linked, a formula only modeled, or deployment only queued.
- **Uncertainty:** conflicting models, missing inputs, historical evidence and untested assumptions. Corroborated community models can be used as working truth while retaining their status and assumptions.
- **Artifacts / next:** report path and the next useful action, or “none”. Put long detail in the report rather than returning raw logs.

Use compact queries before raw source files: `knowledge status`, then bounded `entity`, `formula`, `search --limit`. PostgreSQL is current local site data when configured; SQLite is the private evidence index. Reuse tested `shared/mechanics.ts` or the calculator with stated assumptions. Never launch the game without fresh user permission. Never turn a collected video link into a claim that the replay was watched.

After verification, the coordinator updates the role's short CONTEXT with accepted pointers, dated decisions and unresolved questions (target <=6000 characters). It promotes useful reports to dated `knowledge/research/` documents with evidence/status, then runs `knowledge:import` if needed. Draft role runs are intentionally outside the index. Preserve previous findings as dated history, not competing “current” copies. Record only durable decisions in the decision CLI. Do not store entire chats, tokens or passwords.

The coordinator verifies important claims rather than treating agreement between agents as evidence. It owns publication and distinguishes DB/files/index/GitHub/Pages outcomes. Existing user authorization applies; the team doesn't grant new permissions.
