# Plain language website copy

> **For agentic workers:** Use superpowers:executing-plans for the coordinated edit. The user has delegated design decisions and requested the changes directly.

**Goal:** Make the public RU/EN reference read naturally, with clear game explanations and no repeated research disclaimers, raw identifiers or source lists.

**Architecture:** Edit presentation and curated display copy; preserve numeric data, calculation rules, private evidence and synchronization behavior. Keep patch links in version history. Keep conditions needed to understand a result, such as DPS excluding reloads.

**Tech Stack:** Existing React/TypeScript/i18next, Vite, Node and PostgreSQL.

## Tasks

- [x] Inspect all public text surfaces and source-backed formula copy. Check a public editorial skill as a reference; do not install remote executable code.
- [x] Website specialist: simplify all hero notes and register text, remove raw-source disclosure and source links, update RU/EN and existing hero-detail assertions. Ownership: `src/pages/HeroesPage`, `src/i18n/en-heroes.ts`, `tests/hero-details.test.tsx`.
- [x] Coordinator: simplify home, layout, methodology, mechanics, calculator, update and sync text; remove public provenance/status/source furniture while preserving useful numerical explanations and error states. Rewrite displayed formula prose where necessary without changing equations, examples or source records.
- [x] Review every new RU/EN string. Record concise editorial rules for future work in project instructions.
- [x] Run existing tests and required checks, inspect desktop/mobile in both languages, obtain a bounded independent critic review, address findings.
- [ ] Publish the finished change, verify CI/Pages, reconcile the original checkout without losing user edits, and record the accepted decision privately.

## Review focus

- No raw weapon class names or confidence/provenance boilerplate in rendered hero/formula details.
- Useful calculation assumptions, level growth and special weapon behavior remain understandable.
- RU and EN, mobile controls, search, sort, calculator and patch links still work.
- Public and local versions use the same display copy; the private archive and raw data remain intact.
- No claim that verification occurred when it did not; no formula or number changes as part of editing.
