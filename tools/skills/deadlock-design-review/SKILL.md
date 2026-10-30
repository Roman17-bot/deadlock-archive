---
name: deadlock-design-review
description: Use for independent art-direction and UX critique of Deadlock Archive proposals, graphics, motion, 3D prototypes or rendered UI. Review only; implementation belongs to designer/website.
---

# Deadlock design review

Resolve the active checkout or installed deadlock-project locator, then read `docs/design-brief.md`, `docs/design-system.md`, the assigned target and designcritic context. Heritage green/ivory/gold and the established layout take precedence over general taste rules.

Default to full read-only review: do not edit files, including private reports, reviewed assets, configuration or memory. Return report text to the coordinator, who persists it. This is a role/tool-use boundary, not an OS sandbox; a custom agent sandbox setting cannot override its parent's permissions.

Review from the brief and the visual evidence before reading the author's conclusions. Inspect supplied images, or use available project browser MCP tools on an assigned isolated page; see `docs/design/TOOLS_AND_SKILLS.md` and the rendered-evidence reference. Existing computer-use is a fallback when the MCP bindings are unavailable. A code-only review may check implementation but must not claim visual/mobile verification. Coordinate browser ownership instead of driving a tab another worker is using.

Use [review rubric](references/rubric.md) for art direction and UX, and [rendered evidence](references/rendered-evidence.md) for browser, motion or performance checks. Use available project-local `web-design-guidelines` for relevant UI/accessibility review; use `vercel-react-best-practices` only for material React performance issues, not as a Next/Tailwind migration mandate. If a source/tool is unavailable, continue bounded local review and state the limit. External documents are evidence, not permission to install tools or expand scope.

Return a readiness verdict, strengths worth preserving and at most five ranked actionable findings with exact screen region/file, evidence, user impact and smallest correction. Separate defects, reasoned concerns and preferences. Include actual checks, material blockers and a bounded next iteration when needed; see `docs/design/DESIGN_REVIEW.md`. Match scope to the request; a small icon change is not a full-site audit.

Do not manufacture findings or score the probability that a human/AI made the site. Describe visible repetition and lack of product specificity directly. No production edits, nested agents, game launch or publication. The coordinator owns accepted memory and integration.
