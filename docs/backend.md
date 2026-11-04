# Native backend

`backend/Deadlock.Api` — ASP.NET Core 10 (`net10.0`), EF Core 10 и провайдер Npgsql. HTTP API, owner CLI, импорт PostgreSQL, получение игровых данных, официальная история патчей и точная публикация выполняются в C#. Каталога `server/` и Node runtime для API нет. Node 24.15+ остаётся для Vite, npm-запусков и приватного SQLite/FTS5-архива.

## Запуск

```sh
npm ci
npm run dev
```

Команда запускает Vite на `http://127.0.0.1:5173/` и .NET API на `http://127.0.0.1:3001/`, затем открывает Chrome после готовности обоих сервисов. `Ctrl+C` останавливает оба. `npm run dev:api` запускает `dotnet watch`; `npm run dev:web` — только Vite. `API_PORT` меняет порт API, `NO_OPEN=1` отключает открытие браузера, `CHROME_PATH` задаёт путь к Chrome.

Watch работает без интерактивных запросов: если изменение C# требует перезапуска, сервер перезапускается автоматически, без скрытого вопроса в дочернем процессе npm.

Прямой запуск API из корня:

```sh
dotnet run --project backend/Deadlock.Api --no-launch-profile -- serve
```

При другом рабочем каталоге передай `--root <каталог-архива>` или `DEADLOCK_ROOT`. `.env.local` читается из корня; переменные процесса имеют приоритет. Пример настроек — в `.env.example`, настоящие пароли остаются приватными.

## Данные и фоновая проверка

До приёма запросов API проверяет сохранённый пакет и инициализирует хранилище. При настроенном PostgreSQL применяет SQL-миграции и заполняет только пустой архив. Существующие данные БД не заменяются JSON при старте. Перед изменением существующей схемы создаётся резервная копия. Недоступная или неполностью настроенная БД вызывает ошибку; переключение на JSON при сбое БД не происходит. Без DB-конфигурации используется `data/`.

После готовности API `StartupRefresh` запускает одну фоновую проверку. Она готовит героев, предметы, статистику и ресурсы согласованно для нового клиента; отвергает понижение версии и несовместимые источники. Тот же клиент не запускает загрузку игровых assets. Официальная история проверяется независимо и может измениться без смены клиента. Сохранённая версия остаётся доступной во время проверки и при сетевой ошибке.

`DEADLOCK_AUTO_UPDATE=0` отключает стартовую проверку. При настроенной БД сохранённые изменения по умолчанию передаются публикации; `DEADLOCK_AUTO_PUBLISH=0` отключает эту автоматическую публикацию. Это параметры стартового задания, ручные операции сохраняют свой выбор публикации. Постоянного таймера обновлений нет. Игра не запускается.

`history.versions` описывает версии клиента и происхождение сборок. `history.patches` содержит официальные Steam-описания: news GID, URL, дату, локализованные заголовок и текст. GID не равен Steam Build ID или номеру клиента. Сервис сохраняет подготовленные переводы и явно заданные связи, но не выводит связь по близости дат. Незавершённая загрузка имеет приватную контрольную запись в `work/patch-history-backfill.json` и продолжается при следующей проверке.

## HTTP и CLI

Чтение: `/api/health`, `/api/heroes`, `/api/heroes/search`, `/api/items`, `/api/item-statistics`, `/api/mechanics?language=ru|en`, `/api/formulas/<id>?language=ru|en`. Локальная история — `/api/version-history`.

Owner-запросы `/api/update` и `/api/sync` доступны только локально: проверяются Host, Origin, JSON и токен текущей сессии из `/api/update/session`. GitHub credentials браузеру не передаются. Статусы операций доступны через `/api/update/status` и `/api/sync/status`. Обновление и синхронизация не выполняются одновременно.

Существующие `npm run data:update`, `items:refresh`, `db:*`, `data:check` и `data:verify-publication` остаются входными командами. Их Node-файлы вызывают .NET CLI через `scripts/backend.mjs`; бизнес-логика в них не дублируется. Dry-run обновления не меняет публичные файлы, БД или публикацию, но может сохранить приватный кандидат/кеш в `work/`.

CLI собирается отдельно в `work/dotnet-owner/`, тесты — в `work/dotnet-tests/`, проверочная сборка — в `work/dotnet-build/`. Это позволяет запускать команды проверки и синхронизации одновременно с `dotnet watch`, не перезаписывая занятый Windows исполняемый файл API.

```sh
npm run backend:build
npm run backend:test
npm run db:test
npm test
npm run typecheck
npm run data:check
npm run build
```

`db:test` использует отдельную тестовую БД и случайную принадлежащую тесту схему. Команды выше — способы проверки, а не свидетельство уже выполненной проверки или публикации.

## Границы

`Data/` содержит EF-модель текущей версии и Npgsql-транзакции совместимой реляционной схемы; миграции остаются в `db/migrations/`. Полный JSON payload сохраняет дополнительные поля, реляционные строки остаются источником соответствующих значений. `Ingestion/` нормализует героев, предметы и статистику; `Updates/` координирует подготовку и сохранение; `Patches/` получает официальные описания; `Sync/` проверяет публичный пакет и публикацию.

Локальный Vite читает живой API через proxy. Pages читает опубликованный JSON и не подключается к PostgreSQL. Публикуются только разрешённые JSON, портреты, иконки и манифест; исследования, конфигурация и резервные копии приватны. [Команды БД и точная синхронизация](database.md).

## Profiles, statistics and map

Three optional catalogues extend the saved archive: `hero-profiles.json`, `hero-statistics.json`, and `world-map.json`. Read routes are `/api/hero-profiles`, `/api/hero-statistics`, and `/api/world-map`; older archives return 404 for a missing catalogue. The ordinary public manifest, staged save, optimistic PostgreSQL import and export include them. Static builds only read saved files and never collect live statistics.

```sh
npm run references:refresh -- --dry-run --profiles knowledge/agents/heroes/runs/ID/hero-profiles.json --map knowledge/agents/mechanics/runs/ID/world-map.json
npm run references:refresh -- --review work/reference-review/REVIEW_ID
npm run stats:refresh -- --dry-run
npm run stats:refresh
```

Reference dry-run downloads and verifies media into a private review directory without changing working data. Applying that review reuses its approved optimized bytes and preserves the current statistics and other archive data. A curated profile or map import must match the saved current client. Both commands save locally; explicit publication remains `npm run db:sync -- --dry-run`, followed by authorized synchronization.

Statistics have an independent six-hour TTL and bounded private request cache under `work/statistics-cache/`. `stats:refresh --force` bypasses the catalogue TTL but still reuses a fresh identical request cache. One startup check runs after the normal game update; `DEADLOCK_AUTO_UPDATE=0` disables both checks, and `DEADLOCK_AUTO_STATISTICS=0` disables only statistics. Startup publishes changed statistics through the ordinary sync service when configured and `DEADLOCK_AUTO_PUBLISH` is not `0`; unchanged data does not cause a new publication. There is no recurring six-hour background timer. Failed collection preserves the preceding successful catalogue. Manual collection uses a five-minute overall budget and performs analytics requests sequentially, respecting bounded Retry-After delays.

The 15 supported cohorts are normal all/ranked/unranked, 11 named ranked tiers, and Street Brawl without a rank filter. Each contains actual UTC daily observations over 30 calendar days including the partial current day through the last completed UTC hour; the interface derives seven- and thirty-day sums. «Доля выборов» is hero player-match records divided by all recorded hero selections in the same cohort. It is not an exact share of distinct games. Mirrors and repeated player appearances in different matches are separate records. Matchup observations retain directional wins and sample counts; synergies retain one canonical unordered pair. No reverse wins or hidden MMR is inferred. Rank filters describe the average badge of a match, not the individual player's rating.

Deadlock API is a third-party community provider. Its analytics have no client-version filter, round time bounds outward to hours, and may be cached or incomplete. `sourceClientVersion` is explicitly null; requested/effective bounds and actual per-cohort fetch times are retained. Exact version-only statistics are unavailable; a new asset client never silently changes this fact or rechecks older mechanics.

Full hero backgrounds are mechanically optimized with `ffmpeg`: input at most 4 MiB, maximum width 1280 without enlargement, WebP quality75, output at most256 KiB, bounded dimensions and 15-second processing attempts. If ffmpeg is unavailable, the native updater uses the same hero's official smaller card art. Three PNG map layers are saved locally with signature checks. Approved local media roots are `images/`, `portraits/`, and `media/`; snapshot limits remain512files,4MiB perfile,32MiB total. Full art optimization requires ffmpeg on the local machine, not in the static Pages build.

When a game client changes, the native refresh updates profile source art and pinned map geometry, camp timers/rewards, powerup/snack timers and exposed generic configuration together with the candidate. Curated prose/advice retain their own `reviewedClientVersion`; unexposed/historical map rules retain `meta.rulesClientVersion`. Fetching source data does not claim that prose or movement routes were re-reviewed. Routes requiring a new placement review are cleared, and unknown floor, unit composition and per-instance breakable timers remain unknown.
