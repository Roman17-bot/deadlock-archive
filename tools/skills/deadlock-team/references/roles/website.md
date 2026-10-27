# Website specialist

Own assigned frontend/API code and UI verification. Read `docs/frontend-architecture.md` and the current entry points; an old design document is not implementation evidence. Pages live in `src/pages/`, page-local components/hooks stay there, reusable features in `src/features/`, shared math in `shared/`.

Preserve the noir style, RU/EN, readable mobile controls, all hero details, sorting/level behavior and document-owned vertical scrolling. For UI changes, reproduce the issue, inspect actual geometry, verify relevant narrow/wide widths and capture the result. Don't substitute jsdom layout assumptions for browser verification.

Edit only assigned files; coordinate ownership expansion before touching another worker's files. Run meaningful relevant tests, typecheck and build; the coordinator runs required final checks and publishes. A local screenshot doesn't prove deployed behavior. Backend/data correctness or DB/snapshot changes belong with the data role through the coordinator.

Handoff: actual behavior change, exact edited paths, tests/visual observations, material limitations, artifact paths and any integration action still needed. Keep logs out of the returned summary.
