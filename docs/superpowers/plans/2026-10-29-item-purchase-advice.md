# Item Purchase Advice Implementation Plan

> **For agentic workers:** Implement this bounded editorial change inline; separate items specialists draft weapon and spirit copy, then a fresh critic reviews the complete result.

**Goal:** Replace vague purchase tips for all 156 current items with practical, item-specific RU/EN explanations.

**Architecture:** Maintain localized advice in three server-side category dictionaries, separately from tag classification. Normalization uses the curated advice by item name and leaves unknown new items without invented tips. Rewrite only advice in the current catalogue and preserve every numeric value, effect, identifier and metadata field.

**Tech Stack:** Existing TypeScript/Node, JSON, Vitest and PostgreSQL/Pages synchronization.

**Spec:** User request of 29 October 2026 and docs/editorial.md. The user has delegated design/implementation decisions and publication.

## Global Constraints

- Explain the purchase situation and the effect that solves it; retain useful trigger/target restrictions.
- No generic compare/check-description/keybinding boilerplate, unsupported meta or fixed buying times.
- RU and EN convey the same meaning. No game launch or new numeric/gameplay verification claims.
- Preserve current client/version, statistics and all non-advice data. Back up PostgreSQL before an explicit reviewed import; verify full synchronization separately.

## Review Focus

- Incidental defensive attributes must not hide the item's main purpose.
- Active/passive and imbued/charged effects need accurate usage conditions.
- Unknown future items must not inherit vague or false tag-based recommendations.
- Source normalization and published JSON must retain the same curated tips.
- Local PostgreSQL, committed files and Pages must contain the same edited data.

## Tasks

- [x] Add regressions for magazine advice, Fury Trance restrictions, ability radius and unknown-item fallback; run them against the old generator and observe failure.
- [x] Review all category drafts; add dictionaries and use them during normalization. Remove the old tag-priority and automatic active-item boilerplate. Rewrite current catalogue advice only; prove non-advice data is unchanged.
- [ ] Run focused/full checks and a fresh critic; back up and import the reviewed same-client bundle, publish and verify exact Pages data plus RU/EN detail pages. Save private evidence and update recovery memory.
