# Item search and loading

User delegated implementation decisions. Improve both property-panel and catalogue search with RU/EN player vocabulary; recognize exact slang before normal word-prefix search so stun does not match incidental descriptions of immunity. Preserve category/tier/property filtering and existing item tags. Normalize casing, punctuation, whitespace and ё. Reuse tokenized item text for repeated result counts.

Website specialist owns loading/cache/skeletons and mechanics mismatch banner removal. Root owns search. Reuse successful item requests for at most60seconds; deduplicate in-flight requests without coupling subscriber cancellation. Start detail statistics concurrently, validate coherent versions, preserve retry/error handling and omit statistics transfer on catalogue. Skeletons use theme colors, accessibility status/busy and reduced motion. Remove only the public warning, preserve formula review metadata.

Verification: semantic search regressions, cache/retry/abort/expiry and loading UI tests; full suite/typecheck/data checks/build; fresh critic; mobile/desktop browser QA and publication. No game launch, data refresh, DB import or numeric changes. Publish the committed UI using existing GitHub Pages workflow and verify the live page.
