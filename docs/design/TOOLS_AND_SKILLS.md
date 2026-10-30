# Инструменты и навыки дизайна

Проверено30октября2026. Исходное состояние — [INITIAL_AUDIT.md](INITIAL_AUDIT.md). Приложение, интерфейс, игровые данные и корневые зависимости не заменяются при установке этой системы.

## Роли и границы

Дизайнер создаёт художественное направление, оригинальные исходники, SVG/Canvas/WebGL/3D и рабочие анимации в назначенном частном run. Website/координатор внедряет принятые изменения. Designcritic независимо рассматривает результат и возвращает текст без записи файлов; координатор сохраняет доказательства. Дополнительная техническая песочница не возникает из названия роли: [Codex наследует разрешения родителя](https://learn.chatgpt.com/docs/agent-configuration/subagents).

Навыки загружаются по задаче. Не следует одновременно читать все руководства или менять текущий React/Vite/CSS ради чужих примеров. Нет обязанности использовать3D, скролл-движок или готовую библиотеку. Устройство разделов и Heritage остаются опорой. Процедуры — в [creative direction](CREATIVE_DIRECTION.md) и [design review](DESIGN_REVIEW.md).

## Установленные навыки

Все находятся в `.agents/skills`, как рекомендует [проектная структура Codex](https://learn.chatgpt.com/docs/customization/overview). Полные SHA, происхождение, лицензии и хеши229внешних файлов — в `tools/design/skills-lock.json`. Две поддерживаемые роли имеют отдельные исходники в `tools/skills`; `npm run design:install` синхронизирует их проектные копии. Их частный local-profile игнорируется Git.

| Навык | Назначение и когда читать | Источник / лицензия |
|---|---|---|
| deadlock-design | Основное направление и передача конкретной графики/движения | Собственные поддерживаемые инструкции |
| deadlock-design-review | Независимая художественная/UX-проверка | Собственные поддерживаемые инструкции |
| frontend-design | Типографика, композиция и осмысленная индивидуальность | [Anthropic](https://github.com/anthropics/skills/tree/ca45fc496a3436251f191354091d557da31c15b5/skills/frontend-design), Apache-2.0 |
| web-design-guidelines | Соответствующая задаче доступность и UI code review | [Vercel](https://github.com/vercel-labs/agent-skills/tree/1a2c79d4e6c4a2283dc2c614b6538cbe1ed5ca62/skills/web-design-guidelines), MIT по README; актуальные внешние правила получать при проверке |
| vercel-react-best-practices | Обнаруженная проблема React-загрузки/рендера | [Vercel](https://github.com/vercel-labs/agent-skills/tree/1a2c79d4e6c4a2283dc2c614b6538cbe1ed5ca62/skills/react-best-practices), MIT; Next/RSC советы не универсальны для Vite |
| ui-ux-pro-max | Адресный локальный поиск по UX/типографике/палитрам | [UI UX Pro Max](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill/tree/28b3b8dee8c976df4fa3e94aed4e092ad43fcb03), MIT; Python stdlib, выдача не отменяет brief |
| shader-dev | Только реальная задача GLSL/WebGL | [MiniMax](https://github.com/MiniMax-AI/skills/tree/60aaae52bb2af8162732751a4332f62a5fef518b/skills/shader-dev), MIT |

Anthropic/Vercel/MiniMax установлены штатным `skill-installer` по точным refs с проектным `--dest`. Для UI Pro Max использована проверенная статическая структура SKILL+настоящие `src/.../scripts,data`, а не symlink-заглушки; единственная адаптация текста — `.claude/skills` → `.agents/skills`. Исходные LICENSE сохранены; у Vercel отдельного LICENSE в этом ref нет, поэтому сохранён полный README с его MIT-декларацией без придуманного copyright.

Существующие глобальные frontend-design/WDG не удалены и не заменены новыми. Это проектные версии с зафиксированным происхождением. CLI `skills/list` проверяет обнаружение, но обновление каталога инструментов уже открытого чата может потребовать следующего хода/переподключения MCP.

### Проверенные команды и пропуски

- `npx skills add anthropics/skills --skill frontend-design -a codex`: формат совместим, но для установки использован штатный helper с фиксированным SHA, без выполнения внешнего CLI. Для React правильный selector — `vercel-react-best-practices`, а не имя каталога `react-best-practices`.
- `npx ui-ux-pro-max-cli init --ai codex`: пакет публикует executable `uipro`; проверенная npm2.15.0 и исходная cli2.5.0 расходятся. В опубликованной версии нет обещанного README `--dry-run`. Поэтому выбран узкий статический вариант, без глобального init.
- `npx impeccable install --providers=codex --scope=project`: актуальный [Impeccable4.8.0](https://github.com/pbakaus/impeccable/tree/df3a4abe7d0840d5f60324812c432e00b66a4e75) имеет навык `impeccable`, нативный engine и catalog network; `--no-hooks` отключает хуки, но не engine. Полезный документированный engine-free режим не установлен, поэтому runtime пропущен, а не объявлен установленным набором Markdown. Он Apache-2.0; ручное копирование не устраняет зависимость.
- [Microsoft frontend-design-review](https://github.com/microsoft/skills/tree/41138f3cb4825d1ba9812d35358d5513be08c20e/.github/skills/frontend-design-review) прочитан и пропущен: дублирует отдельного критика, содержит Figma/Storybook-процесс и противоречащие проекту соглашения об AI-disclaimer/шрифтах. Полезные задачи уже покрыты проектным rubric и Vercel.
- Весь каталог навыков не установлен. Shader skill не запускает игру и не добавляет WebGL в сайт.

## Браузерные инструменты

В `.codex/config.toml` сохранены прежние роли и добавлены два проектных stdio MCP: Microsoft `@playwright/mcp@0.0.83` и Google `chrome-devtools-mcp@1.12.0` (оба Apache-2.0). Конфиг использует обычный поддерживаемый Windows `cmd /d /c npx --yes --ignore-scripts` с точными версиями; локальная проверка исполняет именно эти команды. Это не глобальная установка пакетов или изменение пользовательского конфига.

Отдельный `tools/design-runtime/package.json`/lock позволяет установить и проверить те же инструменты без изменения зависимостей сайта. Установка выполняется с `--ignore-scripts`; приложение их не импортирует. Playwright MCP стабильной версии содержит Playwright/core alpha1.64.0 — это ограничение явно сохраняется. DevTools runtime опубликован bundled; установка из Git с prepare-скриптами не использовалась. npm audit этого набора не обнаружил известных уязвимостей на дату проверки.

Оба запускают отдельные headless/isolated профили без личных cookies и открытого debug-port. DevTools требует Chrome149+ для allowed URL patterns (проверен установленный Chrome156), отключает usage statistics, CrUX, update checks и config discovery. Разрешены локальные HTTP и WebSocket адреса для Vite; первоначальная блокировка HMR была исправлена добавлением локальных ws patterns. Playwright origin list документированно не является полноценной границей безопасности и не покрывает redirects. Эти фильтры не подменяют OS-права.

Доступны навигация, snapshot, screenshot, console, выбор контролов и размеры экрана; DevTools дополнительно даёт trace, network и media/device emulation. Набор Codex ограничен нужными tool allowlists, arbitrary-code-unsafe/upload/install не включены. Схемы брать из `tools/list`, а не старых примеров: текущий Playwright использует `target`, screenshot требует `scale`; DevTools требует pageId.

```powershell
npm run design:install
npm run design:check
npm run design:discovery
npm run design:test
npm ci --prefix tools/design-runtime --ignore-scripts
npm run design:mcp:check -- playwright
npm run design:mcp:check -- devtools
```

Проверки MCP обращаются только к локальному HTTP-сайту; его запускает обычный `npm run dev`. Результаты по умолчанию в игнорируемом outputs/design-tools. `design:discovery` вызывает локальный Codex app-server без модельного хода, различает ошибки проекта и старые предупреждения других пользовательских навыков. Root фактически проверяет MCP stdio; это не утверждение, что текущий чат мгновенно получил новые tool namespaces. Настройки штатно перечитываются при переподключении/следующем сеансе.

## Каталог для следующих дизайнерских задач

Ни одна из этих библиотек не добавлена в приложение. Перед конкретным использованием проверить версию, peer dependencies, лицензию выбранного материала и стоимость. Это библиотеки/компоненты/референсы, а не автоматически установленные Agent Skills.

| Инструмент | Вид и подходящее применение | Условия для нашего стека |
|---|---|---|
| [React Bits](https://github.com/DavidHDev/react-bits) | Готовые React эффекты и компоненты; разбирать отдельный приём | MIT+Commons Clause: не обычная MIT; отдельные ограничения на перепродажу/перераспространение компонентов/инструментов. Выбирать CSS-реализацию под задачу |
| [Magic UI](https://github.com/magicuidesign/magicui) | Копируемые UI/animation компоненты, MIT | Обычно Tailwind/shadcn/Motion; адаптировать нужный элемент к обычному CSS, не переносить весь стек или Pro-материалы |
| [Motion Primitives](https://github.com/ibelick/motion-primitives) | Небольшие React-паттерны движения, MIT | Не заменять ими автоматически существующий WAAPI; проверить зависимости примера |
| [Motion](https://github.com/motiondivision/motion) | React/JS библиотека для сложной анимации, MIT | Рассматривать для state/layout-сценария, где существующей реализации недостаточно; проверить React peer range |
| [GSAP](https://github.com/greensock/GSAP) | Timeline/choreography и SVG, Standard License | Не называть MIT; читать [действующую лицензию](https://gsap.com/standard-license). Требуются cleanup/matchMedia и осмысленная причина относительно WAAPI |
| [Lenis](https://github.com/darkroomengineering/lenis) | Smooth-scroll движок, MIT | Не включать по умолчанию в таблицах/каталоге; нативная прокрутка и reduced motion остаются важнее эффекта |
| [Three.js](https://github.com/mrdoob/three.js) | JS3D renderer, MIT | Только отдельная оправданная сцена; lazy loading, fallback и ресурсы вне основного каталога |
| [React Three Fiber](https://github.com/pmndrs/react-three-fiber) | React renderer для Three.js, MIT | Официальный README: v9 соответствует React19, v8 — React18; проверить актуальные peers перед установкой |
| [Drei](https://github.com/pmndrs/drei) | Helpers для R3F, MIT | Выбирать конкретные helpers, согласовать версии fiber/three |
| [r3f-scroll-rig](https://github.com/14islands/r3f-scroll-rig) | Связь DOM и spatial scene, MIT | Только специальная интерактивная сцена, не перенос/перехват привычных областей справочника |
| [OGL](https://github.com/oframe/ogl) | Минимальный WebGL renderer, Unlicense | Альтернатива для компактного процедурного эффекта; интеграция с React/cleanup остаются нашей ответственностью |
| [Codrops](https://github.com/codrops) | Творческие примеры/обучение и отдельные репозитории | Это не одна библиотека/skill; у каждого demo свои зависимости, assets и лицензия. Изучать приём, не копировать сайт целиком |

Для задачи сначала решить, достаточно ли SVG/CSS/Canvas или существующей WAAPI. Новая зависимость,3D и графический asset имеют собственную небольшую границу интеграции и измеримый бюджет. Источники этого каталога проверялись непосредственно в указанных репозиториях.
