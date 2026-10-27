export const enPublic: Record<string, string> = {
  'Нет эффектов': 'No effects',
  'Общий вампиризм × усиление. Второй вариант складывает уже усиленные эффекты. Лечение ограничено недостающим HP.':
    'Combined lifesteal × amplification. The second option combines effects after amplifying each one. Healing is capped by missing HP.',
  'Расчёт для одного типа урона при постоянной защите, без лечения и барьеров. Бонусы одного эффекта сначала объедини в одно значение.':
    'For one damage type and constant defense, without healing or barriers. Combine bonuses from a single effect into one value first.',
  'Укажи долю каждого типа урона и итоговые сопротивления цели. Чистый урон проходит без пулевого и спиритического сопротивления.':
    'Enter each damage type’s share and the target’s final resistances. Pure damage bypasses bullet and spirit resistance.',
  'Бонус к урону оружия, общее усиление и отдельные множители вводятся раздельно. Для спиритического урона оставь бонус оружия равным нулю.':
    'Enter weapon damage bonuses, combined amplification and independent multipliers separately. Set the weapon bonus to zero for spirit damage.',
  'Разделяй усиление у того, кто лечит, и у того, кто получает лечение. Healing Booster у получателя усиливает его регенерацию, а не любое входящее лечение.':
    'Keep the healer’s amplification separate from the recipient’s. A recipient’s Healing Booster boosts their regeneration, not all incoming healing.',
  'Сравни два порядка: усиление общего вампиризма и усиление каждого эффекта перед сложением. Если бонус уже включён в указанный процент вампиризма, оставь усиление 0%. Считай пулевой и спиритический вампиризм отдельно.':
    'Compare amplification of combined lifesteal with amplification of each effect before stacking. If the listed lifesteal already includes the bonus, leave amplification at 0%. Calculate bullet and spirit lifesteal separately.',
  'Для эффектов, на которые действуют бонус длительности и сопротивление дебаффам. У аур и постоянно обновляемых эффектов время действия считается отдельно.':
    'For effects affected by duration bonuses and debuff resistance. Auras and continuously refreshed effects have separate timing.',
  'Считай перезарядку способности и предмета отдельно. Частота применений указана без времени на применение, поддержание способности и восстановление ресурсов.':
    'Calculate ability and item cooldowns separately. Cast frequency excludes cast time, channeling and resource recovery.',
  'Выбери одно свойство: радиус или дальность. Бонус дальности способности сам по себе не меняет рывки и падение урона оружия.':
    'Choose one property: radius or range. Ability range bonuses do not automatically change dashes or weapon damage falloff.',
  'Процентный бонус применяется к базовому здоровью и приросту за уровни. Фиксированное здоровье предметов прибавляется после него. Изменения общего максимума здоровья считаются отдельно.':
    'The percentage bonus applies to base health and level growth. Flat item health is added afterward. Effects that change total maximum health are calculated separately.',
  'Укажи базовое значение и коэффициент Spirit для одного свойства способности. Урон, лечение и длительность могут иметь разные коэффициенты.':
    'Enter the base value and Spirit coefficient for one ability property. Damage, healing and duration can have different coefficients.',
  'Усиление меняет дополнительный урон попадания в голову. Расчёт для обычного оружия с такими попаданиями; слабые места существ считаются отдельно.':
    'Amplification changes the bonus damage from headshots. For ordinary weapons that can headshot; creature weak points are calculated separately.',
  'Для обычного движения по земле. Сопротивление ослабляет замедление; расчёт затрагивает часть скорости выше 2 м/с.':
    'For ordinary ground movement. Slow resistance reduces the slow’s strength; the calculation affects speed above 2 m/s.',
  'Урон равномерно уменьшается между двумя границами дистанции. Используй одинаковые единицы для расстояния и обеих границ.':
    'Damage decreases linearly between the two distance limits. Use the same units for the distance and both limits.',
  'Бонусы скорострельности и замедления вводятся отдельно. Очереди, раскрутка и заряженные выстрелы добавляют собственные паузы.':
    'Enter fire rate bonuses and slows separately. Bursts, spin-up and charged shots add their own delays.',
  'Укажи урон и частоту выстрелов. Второй результат учитывает опустошение магазина и перезарядку; точность и попадания в голову меняют средний урон.':
    'Enter shot damage and fire rate. The second result includes emptying the magazine and reloading; accuracy and headshots change average damage.',
  'Снижение и отрицательные сопротивления, %': 'Resistance reduction and negative resistance, %',
  'Общее усиление урона, %': 'Combined damage amplification, %',
  'Например, усиление 20% и штраф 30% дают −10%.':
    'For example, 20% amplification and a 30% penalty give −10%.',
  'Дополнительный фиксированный урон': 'Additional flat damage',
  'Эффекты снижения лечения, %': 'Healing reduction effects, %',
  'Не вводи один и тот же дебафф несколько раз.': 'Do not enter the same debuff more than once.',
  'Герой: 1. Другие цели: 0,6 для пулевого и 0,4 для спиритического вампиризма.':
    'Hero: 1. Other targets: 0.6 for bullet and 0.4 for spirit lifesteal.',
  'У Rat King — 0,75, у остальных обычно 1.': 'Rat King: 0.75; usually 1 for other heroes.',
  'Сопротивление дебаффам, %': 'Debuff resistance, %',
  'Перезарядка после улучшений, с': 'Cooldown after upgrades, s',
  'Сокращение перезарядки, %': 'Cooldown reduction, %',
  'Базовое HP на первом уровне': 'Base HP at level 1',
  'Получено уровней после первого': 'Levels gained after level 1',
  'Прирост HP за уровень': 'HP growth per level',
  'Усиление бонуса попадания в голову': 'Headshot bonus amplification',
  'Множитель бонуса у цели': 'Target headshot bonus multiplier',
  'Замедления движения, %': 'Movement slows, %',
  'Сопротивление замедлению, %': 'Slow resistance, %',
  'Урон по дистанции': 'Damage falloff',
  'Начало снижения урона': 'Falloff start',
  'Конец снижения урона': 'Falloff end',
  'Скорострельность с усилениями и замедлениями': 'Fire rate with bonuses and slows',
  'Бонусы скорострельности, %': 'Fire rate bonuses, %',
  'Замедления стрельбы, %': 'Fire rate slows, %',
  'Попаданий в голову среди всех попаданий, %': 'Headshots among hits, %',
  'Множитель попадания в голову': 'Headshot multiplier',
  'Усиление общего вампиризма': 'Amplification of combined lifesteal',
  'Усиление каждого эффекта': 'Amplification of each effect',
  'Вампиризм до усиления': 'Lifesteal before amplification',
  'Итоговая перезарядка': 'Final cooldown',
  'Общее сокращение перезарядки': 'Total cooldown reduction',
  'Общее замедление': 'Combined slow',
  'Замедление с учётом сопротивления': 'Slow after resistance',
  'Общее замедление стрельбы': 'Combined fire rate slow',
  'Итоговое изменение скорострельности': 'Final fire rate change',
  'Как это считается': 'How this is calculated',
  'Не удалось загрузить свежие данные. Текущая версия сохранена.':
    'Could not load newer data. Your current version has been kept.',
  'Данные сайта обновлены.': 'The site data has been updated.',
  'У тебя уже актуальная версия данных.': 'You already have the latest data.',
  'Данные сохранены. Обновите страницу, чтобы загрузить изменения.':
    'Data saved. Reload the page to load the changes.',
  'Загружаем историю версий…': 'Loading version history…',
  ВЕРСИЯ: 'VERSION',
  'КАК СЧИТАЕМ': 'HOW WE CALCULATE',
  'Как считаем': 'How we calculate',
  'ТАБЛИЦА ГЕРОЕВ': 'HERO TABLE',
  'Характеристики всех героев Deadlock, приросты за уровень и калькулятор для сравнения билдов.':
    'Every Deadlock hero’s stats and level growth, with a calculator to compare builds.',
  'Сравнивай героев на одном уровне.': 'Compare heroes at the same level.',
  'Выбери уровень в таблице, чтобы увидеть, как меняются урон, здоровье и Spirit. В подробностях героя разобраны его оружие и приросты.':
    'Choose a level to see how damage, health and Spirit change. Open a hero’s details for their weapon and stat growth.',
  'Сравни здоровье, урон и скорость стрельбы героев. Посмотри, как они растут с уровнем, а затем рассчитай, что дадут предметы твоему билду.':
    'Compare hero health, damage and fire rate. See how they grow with levels, then calculate what items add to your build.',
  'Калькулятор урона и защиты': 'Damage and defense calculator',
  'Таблица показывает характеристики героя без предметов и активных эффектов. Выбранный уровень применяется ко всем героям.':
    'The table shows hero stats without items or active effects. The selected level applies to all heroes.',
  'Базовые характеристики относятся к первому уровню. Каждый следующий уровень добавляет соответствующий прирост.':
    'Base stats are for level 1. Each following level adds the listed growth.',
  'Урон выстрела учитывает все дробины, попавшие в одну цель. Если снаряды одного выстрела делят общее попадание, урон учитывается один раз.':
    'Shot damage includes every pellet that hits one target. If a shot’s projectiles share a single hit, its damage is counted once.',
  'DPS показывает урон за секунду стрельбы без перезарядки. Попадания в голову, сопротивления и расстояние до цели в него не входят.':
    'DPS is damage per second of firing without reloading. It excludes headshots, resistances and distance to the target.',
  'Spirit может усиливать оружие, скорострельность или восстановление здоровья. Эти прибавки уже включены в значения на выбранном уровне.':
    'Spirit can boost weapon damage, fire rate or health regeneration. These bonuses are already included in stats at the selected level.',
  'Нажми на имя героя, чтобы посмотреть дробь, очереди, раскрутку оружия и другие особенности его стрельбы.':
    'Select a hero’s name for pellet damage, bursts, spin-up and other firing details.',
  'Загружаем механики…': 'Loading mechanics…',
  'Проверь подключение и попробуй ещё раз.': 'Check your connection and try again.',
  '{{count}} формул · версия {{version}}': '{{count}} formulas · version {{version}}',
  'СПРАВОЧНИК МЕХАНИК': 'MECHANICS REFERENCE',
  формул: 'formulas',
  'Версия игры {{version}}': 'Game version {{version}}',
  'Формулы относятся к версии {{reviewed}}. Характеристики героев уже обновлены до {{current}}.':
    'Formulas are for version {{reviewed}}. Hero stats have been updated to {{current}}.',
  'В формулах проценты записаны долями: 30% = 0,30. В калькулятор вводи 30. Результат округляется только при выводе.':
    'Formulas use percentages as fractions: 30% = 0.30. Enter 30 in the calculator. Results are rounded only for display.',
  'Найди нужную механику по названию или выбери тему. В каждом разделе есть формула, объяснение и пример расчёта.':
    'Search for a mechanic or choose a topic. Each section includes a formula, explanation and worked example.',
  'Объяснение и пример': 'Explanation and example',
  'Что учитывать': 'Things to consider',
  'Проверь наличие обновлений и посмотри, что изменилось в новых версиях игры.':
    'Check for updates and see what changed in each game version.',
  'ТЕКУЩАЯ ВЕРСИЯ': 'CURRENT VERSION',
  '{{count}} героев': '{{count}} heroes',
  'Данные от {{date}}': 'Data from {{date}}',
  'Обнови характеристики героев после патча. Можно сразу отправить изменения на сайт для друзей.':
    'Update hero stats after a patch. You can publish the changes for friends at the same time.',
  'Не удалось сохранить в базу данных': 'Could not save to the database',
  'Изменения отправлены. Ожидаем обновление сайта.':
    'Changes sent. Waiting for the site to update.',
  'Сайт пока не обновлён': 'The site has not updated yet',
  'Проверь, есть ли новая версия данных для этого сайта.':
    'Check whether a newer version of the site data is available.',
  'Вышла версия игры {{version}}. Данные для неё ещё не опубликованы.':
    'Game version {{version}} is available. Its data has not been published yet.',
  ПУБЛИКАЦИЯ: 'PUBLICATION',
  'Отправь текущие данные из локальной базы на сайт. Это работает и для исправлений внутри одной версии игры.':
    'Publish the current local database to the site, including corrections within the same game version.',
  'Сайт обновлён': 'Site updated',
  'Ожидаем обновление сайта.': 'Waiting for the site to update.',
  'На сайте уже те же данные. Повторная публикация не нужна.':
    'The site already has the same data. No need to publish again.',
  'На сайте опубликована другая версия данных.': 'The site has a different version of the data.',
  'Сохраняем данные из базы.': 'Saving data from the database.',
  'Отправляем данные на GitHub.': 'Sending data to GitHub.',
  'Данные отправлены. Публикация в очереди.': 'Data sent. Publication is queued.',
  'GitHub Pages обновляет сайт.': 'GitHub Pages is updating the site.',
  'Не удалось дождаться обновления сайта. Проверьте синхронизацию ещё раз.':
    'The site has not updated yet. Check sync again.',
  'Версии игры, даты выхода и изменения в каждом обновлении.':
    'Game versions, release dates and changes in each update.',
  'Не удалось загрузить историю версий.': 'Could not load version history.',
  'Дата выхода': 'Release date',
  'Новые версии будут появляться здесь после обновления данных.':
    'New versions will appear here when the data is updated.',
  'Описание обновления пока недоступно.': 'Update details are not available yet.',
  'Описание обновления не опубликовано. Список изменений доступен в SteamDB.':
    'No update notes were published. SteamDB lists the changes.',
  'Нажми на версию, чтобы посмотреть изменения в SteamDB.':
    'Select the version to view changes on SteamDB.',
  'Нажми на версию, чтобы посмотреть изменения игровых файлов.':
    'Select the version to view game file changes.',
  'Вампиризм каждого эффекта с усилением не должен превышать 100%.':
    'Each amplified lifesteal effect must not exceed 100%.',
  'Данные сохранены локально.': 'Data saved locally.',
  'Проверяем версию игры.': 'Checking the game version.',
  'Локальные данные сохранены. Сайт пока не обновлён. Повторите синхронизацию.':
    'Local data saved. The site has not updated yet. Retry sync.',
  'Обновление не удалось. Предыдущая версия данных сохранена.':
    'Update failed. The previous data has been kept.',
  'Локальные данные сохранены. Публикация в очереди GitHub Actions.':
    'Local data saved. Publication is queued in GitHub Actions.',
  'Не удалось загрузить данные': 'Could not load data',
  'Загружаем данные…': 'Loading data…',
};
