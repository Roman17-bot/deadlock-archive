# Statistics layout refinements

Use the existing register's 1920px page boundary, responsive horizontal gutters and Heritage heading treatment. Keep hero subsection navigation and filter workflows; show the actual period once and remove the global selections counter. Match header navigation order across desktop/mobile: Home, Heroes, Items, Map, Mechanics, Updates.

Preserve all daily chart values and the daily path. Week shows daily markers, month one actual marker per seven-day interval, year one per calendar month. Keyboard/pointer access still reaches every daily value; an active daily marker appears as needed. After the user's follow-up, show compact signed changes with `%`, retaining the existing difference of percentages and explicitly exposing both endpoints in its title/accessible description. Do not replace it with relative growth or alter the values for copy. Use larger extrema labels and proportional charts/rows on wide screens.

Correct the search's double focus border by applying one focus ring to its containing field. Keep other keyboard focus indicators.

Website worker owns chart model/Trend and chart tests. Coordinator owns page/header/CSS/integration and page tests. Designer supplies a bounded handoff; fresh independent design critic reviews actual 1920/1440/768/390 views, search focus and sparse-marker interaction. No game-data refresh, database migration, new graphic runtime or unrelated page redesign.

Run focused chart/navigation/page tests, typecheck and production build. Inspect the built UI, then publish through the established main/Pages workflow and verify the deployed code and unchanged public data hash.
