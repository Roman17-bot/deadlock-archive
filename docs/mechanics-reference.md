# Deadlock — формулы и механики

**Проверено 25 октября 2026 г.. Клиент 6819, SourceRevision 11162696.**

Согласующиеся независимые наблюдения принимаются как рабочие правила. Происхождение, условия и конкретные расхождения сохранены. Это проверка файлов и опубликованных наблюдений; игра не запускалась.

Проценты в уравнениях — доли: 30% = 0,30. В калькулятор вводи обычные проценты. HP и эффективное HP различаются; округление применяется только при выводе.

## Содержание

- [Проценты: сумма, произведение и убывающее сложение](#stacking)
- [Сопротивления и снижение сопротивлений](#resistance)
- [Стак внутри эффекта и отдельный источник — разные вещи](#source-grouping)
- [Эффективное здоровье: сколько исходного урона выдержит герой](#ehp)
- [Смешанный урон: нет единственного EHP без состава атаки](#mixed-ehp)
- [Урон оружия: уровни, Spirit и Weapon Damage](#weapon-base)
- [Линейное масштабирование способности](#spirit-scaling)
- [Несколько траекторий и правило hit-once](#hit-once)
- [Попадание в голову: масштабируется бонусная часть](#headshots)
- [Падение урона по дистанции](#falloff)
- [Усиления урона: различай пулы и новые попадания](#damage-amps)
- [Debuff resistance уменьшает время применимого статуса](#debuff-duration)
- [Сопротивление, иммунитет и очищение](#control-types)
- [Замедления и сопротивление замедлению](#movement-slow)
- [Anti-heal уменьшает и обычное лечение, и вампиризм](#anti-heal)
- [Лечение: кто усиливает и кто получает](#direct-heal)
- [Регенерация и лечение со временем](#regen)
- [Вампиризм: отдельные каналы и эффективность цели](#lifesteal)
- [Вампиризм с heal amp: две проверяемые модели](#lifesteal-amp)
- [Перезарядка способности и частота применений](#cooldown)
- [Увеличение длительности тоже складывается убывающе](#duration)
- [Увеличение радиуса и дальности](#range)
- [Максимальное HP: базовый бонус и плоское здоровье](#max-health)
- [Скорострельность и замедление стрельбы](#fire-rate)
- [DPS, точность, крит и спорный тайминг очередей](#dps)
- [Перезарядка магазина и по одному патрону](#reload)
- [Покрытие баффа и перекрывающиеся дебаффы](#uptime)

<a id="stacking"></a>
## Проценты: сумма, произведение и убывающее сложение

**Математика при указанных условиях · Основы**

`Σx = x₁ + x₂ + …;   P(x) = 1 − ∏(1 − xᵢ)`

- xᵢ — отдельный применимый источник; в уравнении 30% = 0,30.
- ∏ означает перемножить все скобки. P пустого списка = 0.

Убывающее сложение применяет новый процент к ещё не занятой доле. При текущем результате p новый источник x добавляет x × (1 − p). Порядок разных источников внутри одного такого пула не меняет результат.

Это операция для конкретного стата, а не универсальный закон всех баффов. Weapon Damage обычного пула складывается суммой; сопротивления, CDR и некоторые другие статы имеют свои правила.

Процентные пункты и проценты различаются: переход с 30% на 40% — это +10 п.п.; оставшийся урон меняется с 70% на 60%, то есть уменьшается примерно на 14,29%.

**Пример.** 30% и 20%: 1 − 0,70 × 0,80 = 44%. Обычная сумма дала бы 50%, а два положительных множителя 1,3 × 1,2 дали бы+56% — три разных результата.

**Границы применения:**

- До объединения надо установить тип стата, условие действия и независимость источников.
- Несколько стаков одного эффекта не обязательно являются разными источниками.

Источники: [Mekahippie: независимый разбор diminishing, 2024](https://www.reddit.com/r/DeadlockTheGame/comments/1hb8b7z/heres_how_deadlocks_diminishing_returns_work_for/), [Раздельные типы модификаторов](https://github.com/SteamTracking/GameTracking-Deadlock/blob/17462b250a0ca80e7f80102f2c83cc3eecff5f12/DumpSource2/schemas/client/EModifierValue.h).

<a id="resistance"></a>
## Сопротивления и снижение сопротивлений

**Рабочее правило по источникам · Защита**

`R⁺ = P(r₁,…);   S⁻ = P(s₁,…);   R = R⁺ − S⁻;   D = D₀ × (1 − R)`

- rᵢ ≥ 0 — положительный источник выбранного типа сопротивления.
- sᵢ ≥ 0 — величина shred или отрицательного innate без знака минус.
- Bullet и Spirit считаются раздельно.

Сначала отдельно объединяются положительные резисты, затем отдельно отрицательные резисты и shred. Из первого результата вычитается второй. Нельзя перемножать все положительные и отрицательные числа одним списком.

Отрицательное сопротивление увеличивает входящий урон и не обрезается на нуле. По документированному правилу врождённые отрицательные резисты тоже входят в отрицательный пул; для этого края прямое объяснение старше остальных измерений.

**Пример.** Резисты 40%;20% дают 52%. Shred25%;20% даёт 40%. Итоговый резист 12%: из 1000 урона проходит 880. Pocket−15% и предмет+30% в двухпуловой модели дают 15%, а не 19,5%.

**Границы применения:**

- Один тип урона за один расчёт; Pure не приобретает bullet/spirit резисты.
- Конкретные защиты, piercing, барьеры и ограничения урона могут иметь отдельную стадию.
- Вводи каждый отрицательный источник отдельно положительной величиной:15;10, а не−15;−10.

Источники: [Wiki: сопротивления, закреплённая редакция](https://deadlock.wiki/index.php?title=Damage_Resistance&oldid=197376), [Mekahippie: независимый разбор diminishing, 2024](https://www.reddit.com/r/DeadlockTheGame/comments/1hb8b7z/heres_how_deadlocks_diminishing_returns_work_for/), [CoreDump742: измерения, октябрь 2026](https://www.reddit.com/r/DeadlockGame/comments/1xbhphj/theorycraft_is_the_crit_bonus_scale/), [Bluedragon2513: отдельные проверки 23 октября](https://www.reddit.com/r/DeadlockGame/comments/1xbhphj/comment/19rijhefuq35u/), [Nailcliper: отрицательный innate Pocket](https://www.reddit.com/r/DeadlockTheGame/comments/1gmlzfk/daily_item_discussion_42116_spirit_armor/), [Раздельные типы модификаторов](https://github.com/SteamTracking/GameTracking-Deadlock/blob/17462b250a0ca80e7f80102f2c83cc3eecff5f12/DumpSource2/schemas/client/EModifierValue.h).

<a id="source-grouping"></a>
## Стак внутри эффекта и отдельный источник — разные вещи

**Рабочее правило по источникам · Защита**

`r_источника = base + активный внутренний бонус; затем R⁺ = P(r_источника,…)`

- Формула внутри источника определяется конкретным эффектом.
- Consumed component отсутствует в текущем инвентаре.

Bullet Resilience в проверенных наблюдениях даёт 30% плюс 15% при выполненном условии как 45% одного источника. Затем этот источник объединяется с другими предметами.

Не переносим такое сложение на любой условный бафф: для Frenzy опубликовано другое поведение. Аналогично линейные стаки одного debuff сначала собираются до собственного лимита и только потом участвуют в общем пуле.

**Пример.** Resilience45% и Battle Vest18%: 1 − 0,55 × 0,82 = 54,9%. Ошибочное разбиение на 30%;15%;18% даёт 51,21%.

**Границы применения:**

- В обычном EHP-калькуляторе введи 45 одним числом при активном условии.
- Резист, включающийся только на части полоски HP, нельзя распространять на всё здоровье.

Источники: [Файлы оружия, способностей и предметов](https://github.com/SteamTracking/GameTracking-Deadlock/blob/17462b250a0ca80e7f80102f2c83cc3eecff5f12/game/citadel/pak01_dir/scripts/abilities.vdata), [Независимый тест условных резистов, март 2026](https://forums.playdeadlock.com/threads/frenzy-conditional-resist-is-inconsistent-with-resilience.115272/), [CoreDump742: измерения, октябрь 2026](https://www.reddit.com/r/DeadlockGame/comments/1xbhphj/theorycraft_is_the_crit_bonus_scale/), [Отдельное исследование Baba и shred](https://www.reddit.com/r/DeadlockTheGame/comments/1x5nkp1/shredding_spirit_resist_baba_hate/).

<a id="ehp"></a>
## Эффективное здоровье: сколько исходного урона выдержит герой

**Математика при указанных условиях · Защита**

`EHP = HP / (1 − R);   ΔEHP = EHP − HP`

- HP — фактическое максимальное здоровье в рассматриваемом состоянии.
- R — уже рассчитанное итоговое сопротивление выбранному типу.

Сопротивление не прибавляет настоящее HP к полоске. EHP показывает эквивалентный запас против конкретного входящего урона до его уменьшения защитой.

Модель предполагает постоянное сопротивление, отсутствие лечения, уклонения, исполнения и дополнительных защит. Если есть известный независимый множитель получаемого урона m, знаменатель становится (1 − R) × m.

**Пример.** 1000 HP при 44% сопротивления:1000 / 0,56 = 1785,71 EHP. Настоящее HP остаётся 1000; эквивалентная прибавка против этого урона 785,71. При−15%:869,57 EHP.

**Границы применения:**

- При 100% или большем сопротивлении простая конечная модель не определена; калькулятор объясняет ошибку.
- Для условной защиты разбей HP на участки и сложи HP_участка / множитель_участка.
- Нельзя автоматически добавить барьер к HP и применить к сумме один резист.

Источники: [Mekahippie: независимый разбор diminishing, 2024](https://www.reddit.com/r/DeadlockTheGame/comments/1hb8b7z/heres_how_deadlocks_diminishing_returns_work_for/), [Wiki: сопротивления, закреплённая редакция](https://deadlock.wiki/index.php?title=Damage_Resistance&oldid=197376).

<a id="mixed-ehp"></a>
## Смешанный урон: нет единственного EHP без состава атаки

**Математика при указанных условиях · Защита**

`EHP_mix = HP / [w_b × (1−R_b) + w_s × (1−R_s) + w_p];   w_b+w_s+w_p=1`

- w_b, w_s, w_p — доли исходного Bullet, Spirit и Pure урона.
- R_b, R_s — итоговые сопротивления соответствующих типов.

Удельный урон каждого типа сначала уменьшается своим сопротивлением, затем результаты складываются. Складывать Bullet EHP и Spirit EHP нельзя.

Это модель фиксированной смеси. Реальное комбо может менять состав, резисты и условия между попаданиями; тогда нужны отдельные события по времени.

**Пример.** 2000 HP,60% Bullet при 40% резиста и 40% Spirit при 20%: знаменатель 0,6×0,6 + 0,4×0,8 = 0,68. EHP смеси 2941,18.

**Границы применения:**

- Сумма долей должна быть 100%.
- В этой модели Pure имеет множитель 1; специальные all-damage эффекты задаются отдельно.

Источники: [Wiki: сопротивления, закреплённая редакция](https://deadlock.wiki/index.php?title=Damage_Resistance&oldid=197376), [Раздельные типы модификаторов](https://github.com/SteamTracking/GameTracking-Deadlock/blob/17462b250a0ca80e7f80102f2c83cc3eecff5f12/DumpSource2/schemas/client/EModifierValue.h).

<a id="weapon-base"></a>
## Урон оружия: уровни, Spirit и Weapon Damage

**Рабочее правило по источникам · Урон**

`d_base = d₀ + B × g + S × k;   d_weapon = d_base × (1 + ΣW)`

- B = LVL − 1, обычные Boons0…35.
- g — прямой прирост одной пули/дробины за Boon.
- k — нативный Spirit-коэффициент оружия; W — применимые обычные Weapon Damage bonuses в долях.

Сначала получаем собственную базу оружия на данном уровне и Spirit. Затем применяем сумму обычного Weapon Damage пула, включая соответствующий investment bonus.

Приросты не одинаковы для всех героев. У Vindicta, Grey Talon и Solomon в 6819 есть Spirit-вклад в пулю; у Warden Spirit изменяет темп. Эквивалентные EFireRate и ERoundsPerSecond Warden не являются двумя отдельными усилениями.

**Пример.** Nurse Harrow при 10 Boons:14,858 + 10×0,37436 =18,6016. При Weapon Damage46%+20%:18,6016×1,66 =30,878656 до других слоёв.

**Границы применения:**

- Дополнительный proc, flat post-scale и альтернативный заряд не включаются в базу без отдельного правила.
- Значения старого предмета из исторического гайда не являются текущими входами.

Источники: [Файлы героя: база, приросты и коэффициенты](https://github.com/SteamTracking/GameTracking-Deadlock/blob/17462b250a0ca80e7f80102f2c83cc3eecff5f12/game/citadel/pak01_dir/scripts/heroes.vdata), [Файлы оружия, способностей и предметов](https://github.com/SteamTracking/GameTracking-Deadlock/blob/17462b250a0ca80e7f80102f2c83cc3eecff5f12/game/citadel/pak01_dir/scripts/abilities.vdata), [CoreDump742: измерения, октябрь 2026](https://www.reddit.com/r/DeadlockGame/comments/1xbhphj/theorycraft_is_the_crit_bonus_scale/), [Mekahippie: независимый разбор diminishing, 2024](https://www.reddit.com/r/DeadlockTheGame/comments/1hb8b7z/heres_how_deadlocks_diminishing_returns_work_for/).

<a id="spirit-scaling"></a>
## Линейное масштабирование способности

**Рабочее правило по источникам · Урон**

`X = X₀ + Σflat_upgrade + (k₀ + Σscale_upgrade) × S`

- X — конкретное свойство: например, урон, лечение или длительность.
- S — стат, названный в scaling function; не всегда Spirit.
- EAddToScale добавляет к коэффициенту, обычный flat upgrade — к базе.

Считай каждое свойство умения отдельно. Наличие значка Spirit не означает, что все части умения получают один множитель.

После расчёта raw damage применяются соответствующий тип защиты и остальные условия попадания. Несколько тиков или целей — отдельные события.

**Пример.** Kelvin Ice Grenade: база 60, T1+30, коэффициент 0,6, T3+0,8. При 100 Spirit:60+30+(0,6+0,8)×100 =230. При итоговом 20% Spirit Resist проходит 184.

**Границы применения:**

- Специальные scale functions, required upgrades, округление, Brawl и отключённые функции требуют своего адаптера.
- Не подставляй уже усиленное значение tooltip как неусиленную базу повторно.

Источники: [Файлы оружия, способностей и предметов](https://github.com/SteamTracking/GameTracking-Deadlock/blob/17462b250a0ca80e7f80102f2c83cc3eecff5f12/game/citadel/pak01_dir/scripts/abilities.vdata), [Параметры и функции масштабирования](https://github.com/SteamTracking/GameTracking-Deadlock/blob/17462b250a0ca80e7f80102f2c83cc3eecff5f12/DumpSource2/schemas/client/CitadelAbilityProperty_t.h), [CoreDump742: измерения, октябрь 2026](https://www.reddit.com/r/DeadlockGame/comments/1xbhphj/theorycraft_is_the_crit_bonus_scale/), [Отдельное исследование Baba и shred](https://www.reddit.com/r/DeadlockTheGame/comments/1x5nkp1/shredding_spirit_resist_baba_hate/).

<a id="hit-once"></a>
## Несколько траекторий и правило hit-once

**Рабочее правило по источникам · Урон**

`Обычные дробины: D_залпа = Σd_попавших;   hitOnce: D_залпа_по_цели = d при любом попадании`

- P — число raw траекторий, не число гарантированных повреждений одной цели.
- HitOnce = m_bHitOnceAcrossAllBullets.

Для обычного дробовика все попавшие дробины дают отдельные слагаемые. При hit-once попадание любой траектории даёт полный одиночный урон по этой цели; три пути не дают тройного урона.

Это исправляет прежнюю гипотезу таблицы 24 октября. Raw число траекторий сохраняется в примечаниях для понимания оружия.

**Пример.** Baba:8,8, три пути, hitOnce=true →8,8 по одной цели, а не 26,4. Drifter:19,5 и три пути →19,5, а не 58,5. Rat King:две обычные пули по 6 →12.

**Границы применения:**

- Baba/Drifter проверены сильнее, чем перенос правила на все специальные режимы.
- Violet rawP=1; дополнительные custom пути 4/8 не являются множителем обычного урона.

Источники: [Описание полей оружия](https://github.com/SteamTracking/GameTracking-Deadlock/blob/17462b250a0ca80e7f80102f2c83cc3eecff5f12/DumpSource2/schemas/client/CCitadelWeaponInfo.h#L18), [Файлы оружия, способностей и предметов](https://github.com/SteamTracking/GameTracking-Deadlock/blob/17462b250a0ca80e7f80102f2c83cc3eecff5f12/game/citadel/pak01_dir/scripts/abilities.vdata), [Bluedragon2513: отдельные проверки 23 октября](https://www.reddit.com/r/DeadlockGame/comments/1xbhphj/comment/19rijhefuq35u/), [Wiki: урон оружия, редакция со спорной записью крита](https://deadlock.wiki/index.php?title=Weapon_Damage&oldid=194393).

<a id="headshots"></a>
## Попадание в голову: масштабируется бонусная часть

**Рабочее правило по источникам · Урон**

`C = 1 + (c − 1) × q_out × q_in;   D_head = D_body × C`

- c — множитель конкретного оружия на данной дистанции.
- q_out — CritDamageBonusScale атакующего;0,7 означает 70% бонусной части.
- q_in — CritDamageReceivedScale цели; это не обычный bullet resist.

Для обычного оружия текущая база часто 1,65, но есть исключения: у Rat King1,35. Сначала отнимаем единицу, изменяем только добавочную часть, потом возвращаем обычный урон.

Свежие измерения двух авторов поддерживают эту запись; одна из закреплённых wiki-редакций записывает исходящий crit scale иначе и даёт другой ответ для Vyper. Для работы принимаем модель измерений.

**Пример.** Vyper:1+0,65×0,7 =1,455. По Seven с incoming scale0,45:1+0,65×0,7×0,45 =1,20475. Body100 →120,475 до обычного сопротивления.

**Границы применения:**

- У оружия с CanCrit=false множитель не применяется.
- Graves и специальные handlers требуют отдельной проверки; один raw флаг не гарантирует обычный headshot.
- NPC weakpoints и бонусы против NPC не сворачиваются в это правило автоматически.

Источники: [Файлы героя: база, приросты и коэффициенты](https://github.com/SteamTracking/GameTracking-Deadlock/blob/17462b250a0ca80e7f80102f2c83cc3eecff5f12/game/citadel/pak01_dir/scripts/heroes.vdata), [Описание полей оружия](https://github.com/SteamTracking/GameTracking-Deadlock/blob/17462b250a0ca80e7f80102f2c83cc3eecff5f12/DumpSource2/schemas/client/CCitadelWeaponInfo.h#L18), [Valve: обычный headshot 1.65, 21.11.2025](https://forums.playdeadlock.com/threads/11-21-2025-update.90383/), [CoreDump742: измерения, октябрь 2026](https://www.reddit.com/r/DeadlockGame/comments/1xbhphj/theorycraft_is_the_crit_bonus_scale/), [Bluedragon2513: отдельные проверки 23 октября](https://www.reddit.com/r/DeadlockGame/comments/1xbhphj/comment/19rijhefuq35u/), [Wiki: урон оружия, редакция со спорной записью крита](https://deadlock.wiki/index.php?title=Weapon_Damage&oldid=194393).

<a id="falloff"></a>
## Падение урона по дистанции

**Модель: есть ограничения проверки · Урон**

`t = clamp((x−a)/(b−a),0,1);   F = F_a + (F_b−F_a) × t;   D = D₀ × F`

- a,b — начало и конец falloff; x — пройденная дистанция.
- F_a,F_b — масштабы на границах.

Линейная рабочая модель применяется к проверенному bias0,5. Перед началом урон равен стартовому масштабу, после конца — конечному, пока снаряд вообще может долететь.

Порог и остаточный урон индивидуальны: у Drifter конец 0,6, у Sinclair0,3, у Graves0,5. Нельзя ставить всем 10%.

**Пример.** При порогах 590 и 1300 units, масштабе 1→0,1 середина 945 units даёт 0,55. Из 100 остаётся 55 до других защит.

**Границы применения:**

- Для другого bias эта интерполяция не подтверждена.
- При совпадающих порогах с одинаковыми scales берётся постоянный scale.
- Прямая дистанция между героями может отличаться от пути через портал.

Источники: [Описание полей оружия](https://github.com/SteamTracking/GameTracking-Deadlock/blob/17462b250a0ca80e7f80102f2c83cc3eecff5f12/DumpSource2/schemas/client/CCitadelWeaponInfo.h#L18), [Файлы оружия, способностей и предметов](https://github.com/SteamTracking/GameTracking-Deadlock/blob/17462b250a0ca80e7f80102f2c83cc3eecff5f12/game/citadel/pak01_dir/scripts/abilities.vdata), [Wiki: урон оружия, редакция со спорной записью крита](https://deadlock.wiki/index.php?title=Weapon_Damage&oldid=194393), [Valve: обычный headshot 1.65, 21.11.2025](https://forums.playdeadlock.com/threads/11-21-2025-update.90383/).

<a id="damage-amps"></a>
## Усиления урона: различай пулы и новые попадания

**Рабочее правило по источникам · Урон**

`D = [d_base × (1+W) × (1+ΣA) + flat_post] × ∏(1+M) × F × C × (1−R)`

- A — только эффекты подтверждённого additive пула, штрафы со знаком минус.
- M — отдельные подтверждённые multiplicative amps.
- flat_post — плоское добавление на своей стадии.

Названия «усиление» или «снижение урона» не определяют формулу. В raw существуют отдельные increases, multipliers, target amplification, post-armor reduction и новые damage instances.

Для Inhibitor−30% и Fire Scarabs−20% опубликован тест additive штрафа 50%, вопреки общему направлению патча 22 мая. Принимаем это как указанную рабочую модель с конфликтом; защиту Rat King из другого modifier type к ней не приписываем.

Для независимых постоянных множителей порядок алгебраически не меняет ответ. Это не доказывает порядок игровых событий: on-hit shred может усиливать только следующие попадания, proc — создавать отдельный урон.

**Пример.** База 100, Weapon Damage50%, additive amp20% и штраф 30%, flat10:100×1,5×0,9+10 =145. Отдельный amp25% →181,25; при резисте 20% →145.

**Границы применения:**

- Калькулятор принимает уже установленные пулы, а не угадывает их по названию предмета.
- Не складывай все damage reductions одной суммой и не перемножай их все автоматически.

Источники: [Раздельные типы модификаторов](https://github.com/SteamTracking/GameTracking-Deadlock/blob/17462b250a0ca80e7f80102f2c83cc3eecff5f12/DumpSource2/schemas/client/EModifierValue.h), [Wiki: усиление урона, закреплённая редакция](https://deadlock.wiki/index.php?title=Damage_amplification&oldid=203362), [Опубликованный тест Inhibitor + Scarabs](https://forums.playdeadlock.com/threads/damage-reduction-stacking.148395/), [Valve: изменения total damage reduction, 22.05.2026](https://store.steampowered.com/news/app/1422450/view/1833334318572828), [Valve: shred действует на последующие попадания, 30.01.2026](https://forums.playdeadlock.com/threads/01-30-2026-update.102822/).

<a id="debuff-duration"></a>
## Debuff resistance уменьшает время применимого статуса

**Рабочее правило по источникам · Контроль**

`R_d = P(r₁,…);   t_target = t_base × (1+U) × (1−R_d)`

- t_base — длительность после плоских апгрейдов и применимого scaling.
- U — уже объединённый бонус длительности атакующего.
- R_d — сопротивление дебаффам цели.

Разные применимые источники debuff resist складываются убывающе. Усиление длительности атакующего и сопротивление цели — разные слои, поэтому их множители перемножаются.

Проверяй конкретный modifier: duration reducible/extendible, аура, linger и fuse не равны одному таймеру. Постоянно обновляющаяся аура может удерживать эффект почти непрерывно даже при коротком отдельном статусе.

**Пример.** 25% и 22% debuff resist →41,5%. Статус 4 с без увеличения длится 2,34 с. Если база 4 с, длительность+20% и один DR25%:4×1,2×0,75 =3,6 с.

**Границы применения:**

- Нельзя автоматически сокращать все таймеры умения и сохранять тот же totalDoT.
- Покупка Dispel Magic не даёт старый passive DR из исторического Debuff Remover.
- Универсальная chain-CC система не доказана одним полем schema.

Источники: [Независимые авторы о debuff resist, август 2026](https://www.reddit.com/r/DeadlockTheGame/comments/1vq87x1/stacking_debuff_resistance_on_wraith_is_actually/), [Valve: debuff resist diminishing, 08.05.2025](https://store.steampowered.com/news/app/1422450/view/524216645064852902), [Mekahippie: независимый разбор diminishing, 2024](https://www.reddit.com/r/DeadlockTheGame/comments/1hb8b7z/heres_how_deadlocks_diminishing_returns_work_for/), [Флаги длительности и применимости](https://github.com/SteamTracking/GameTracking-Deadlock/blob/17462b250a0ca80e7f80102f2c83cc3eecff5f12/DumpSource2/schemas/client/CCitadelModifierVData.h), [Файлы оружия, способностей и предметов](https://github.com/SteamTracking/GameTracking-Deadlock/blob/17462b250a0ca80e7f80102f2c83cc3eecff5f12/game/citadel/pak01_dir/scripts/abilities.vdata).

<a id="control-types"></a>
## Сопротивление, иммунитет и очищение

**Параметры и флаги из файлов игры · Контроль**

`Resistance → короче применимый статус;   Immunity/Suppression → запрет или подавление;   Purge → удалить разрешённый modifier`

- У каждого эффекта собственные состояния, flags и исключения.

Эти операции нельзя заменить числом 100% debuff resistance. Сопротивление не удаляет уже существующий дебафф. Иммунитет может подавить состояние, пока таймер модификатора продолжает идти.

Очищение удаляет только разрешённые эффекты. Unstoppable имеет отдельные masks и unpurgeable buff; Dispel Magic — отдельный active. Нельзя обещать снятие любого ультимейта только по слову purge.

**Пример.** Если aura повторно накладывает короткий slow, уменьшение каждого экземпляра не обязательно освобождает героя внутри самой ауры.

**Границы применения:**

- Проверяй disable и конкретный modifier, а не только название умения.
- Damage immunity не равна CC immunity.

Источники: [Файлы оружия, способностей и предметов](https://github.com/SteamTracking/GameTracking-Deadlock/blob/17462b250a0ca80e7f80102f2c83cc3eecff5f12/game/citadel/pak01_dir/scripts/abilities.vdata), [Флаги длительности и применимости](https://github.com/SteamTracking/GameTracking-Deadlock/blob/17462b250a0ca80e7f80102f2c83cc3eecff5f12/DumpSource2/schemas/client/CCitadelModifierVData.h), [Раздельные типы модификаторов](https://github.com/SteamTracking/GameTracking-Deadlock/blob/17462b250a0ca80e7f80102f2c83cc3eecff5f12/DumpSource2/schemas/client/EModifierValue.h).

<a id="movement-slow"></a>
## Замедления и сопротивление замедлению

**Модель: есть ограничения проверки · Контроль**

`S = P(s₁,…);   Q = Σqᵢ;   S_eff = S × (1−Q);   v = 2 + (v₀−2) × (1−S_eff)`

- sᵢ — обычные процентные movement slows.
- qᵢ — применимые slow-resistance бонусы; в этой рабочей модели они аддитивны.
- v₀ ≥ 2 м/с — скорость до этих замедлений.

Обычные slows уменьшающе объединяются. Затем slow resistance уменьшает силу slow, а не его длительность. Рабочая модель уменьшает часть скорости выше 2 м/с.

Независимость совпадающего описания Wiki и Guru не установлена, поэтому эта модель отмечена слабее, чем DR или CDR. Она пригодна для оценки, но не является замером текущей физики.

**Пример.** Slow30% и 25% →47,5%. Slow resist25%+35% →60%. Эффективный slow19%. Из 10 м/с:2+8×0,81 =8,48 м/с.

**Границы применения:**

- Поддерживаются только 0…100% slow resist; за 100% нельзя получать вымышленное ускорение.
- Не применяется к stun/root, dash penalties, воздуху, спринту, Urn limits и movement overrides.

Источники: [Wiki: движение и slow resistance](https://deadlock.wiki/Slow_Resistance), [Deadlock Guru: совпадающее описание замедлений](https://deadlock.guru/wiki/mechanics/movement-slow/), [Настройки игры: lifesteal и ограничения](https://github.com/SteamTracking/GameTracking-Deadlock/blob/17462b250a0ca80e7f80102f2c83cc3eecff5f12/DumpSource2/convars.txt), [Раздельные типы модификаторов](https://github.com/SteamTracking/GameTracking-Deadlock/blob/17462b250a0ca80e7f80102f2c83cc3eecff5f12/DumpSource2/schemas/client/EModifierValue.h).

<a id="anti-heal"></a>
## Anti-heal уменьшает и обычное лечение, и вампиризм

**Рабочее правило по источникам · Лечение**

`A = P(a₁,…);   M_anti = ∏(1−aᵢ);   H_after = H_before × M_anti`

- aᵢ — разные применимые семейства anti-heal.
- Receive и regen penalties одного источника обслуживают разные routes и не считаются двумя anti-heal.

Применимый anti-heal ослабляет соответствующее восстановление HP: direct heal, regen и healing от lifesteal. Несколько разных источников уменьшающе складываются; две копии одного и того же debuff не становятся автоматически двумя независимыми источниками.

Current Healbane и Toxic Bullets имеют 35% receive и 35% regen penalties каждый. Это не 70% с одного предмета. Барьер, изменение maxHP и специальная external regen без reduction — отдельные механики.

**Пример.** Healbane35% + Toxic35% →57,75% reduction. Heal200 с outgoing amp20%:200×1,2×0,65×0,65 =101,4 HP до ограничения недостающим здоровьем.

**Границы применения:**

- Для одинаковых копий сначала установи семейство эффекта; точная политика refresh/strongest может быть особой.
- Pocket T3 Affliction использует отдельный DisableHealing, а не обычное сложение процентов.
- Fountain/external regen может иметь явное исключение NO_REDUCTION.

Источники: [Файлы оружия, способностей и предметов](https://github.com/SteamTracking/GameTracking-Deadlock/blob/17462b250a0ca80e7f80102f2c83cc3eecff5f12/game/citadel/pak01_dir/scripts/abilities.vdata), [Типы лечения в схеме](https://github.com/SteamTracking/GameTracking-Deadlock/blob/17462b250a0ca80e7f80102f2c83cc3eecff5f12/DumpSource2/schemas/client/EHealingTypes.h), [Раздельные типы модификаторов](https://github.com/SteamTracking/GameTracking-Deadlock/blob/17462b250a0ca80e7f80102f2c83cc3eecff5f12/DumpSource2/schemas/client/EModifierValue.h), [Wiki: лечение и его модификаторы](https://deadlock.wiki/Healing), [Разные игроки: Toxic + Healbane, июнь 2026](https://www.reddit.com/r/DeadlockTheGame/comments/1tvbr69/does_toxic_bullets_healing_reduction_stack_with/), [Другие авторы: складывание anti-heal, апрель 2026](https://www.reddit.com/r/DeadlockTheGame/comments/1s93kp5/anti_heal_stacks_or_no/).

<a id="direct-heal"></a>
## Лечение: кто усиливает и кто получает

**Рабочее правило по источникам · Лечение**

`H_potential = H₀ × M_cast × M_receive × M_anti;   H_actual = min(HP_missing, max(0,H_potential))`

- M_cast — применимое исходящее усиление от источника лечения.
- M_receive — отдельный применимый множитель получателя.
- Вводятся уже объединённые множители своих групп.

Сначала установи владельца лечения и тип эффекта. Healing Booster в 6819 даёт 20% outgoing cast и 20% regen, но не универсальное receive amp. Booster у получателя сам по себе не означает+20% к любому чужому direct heal.

Self-heal совмещает caster и receiver, что часто скрывает эту разницу. Если исходное число уже усилено, второй раз тот же бонус не применяется. Полного универсального правила объединения нескольких разных positive heal amps источники не устанавливают.

**Пример.** Heal250, исходящее усиление 20%, anti-heal35%:потенциально 195. Если не хватает 100 HP, реально восстановится 100, остальное — overheal.

**Границы применения:**

- Барьер имеет собственные amp статы.
- Receive и regen являются разными ветками; не умножай Booster cast20 и regen20 в 1,44 на каждом тике без отдельного правила.

Источники: [Файлы оружия, способностей и предметов](https://github.com/SteamTracking/GameTracking-Deadlock/blob/17462b250a0ca80e7f80102f2c83cc3eecff5f12/game/citadel/pak01_dir/scripts/abilities.vdata), [Раздельные типы модификаторов](https://github.com/SteamTracking/GameTracking-Deadlock/blob/17462b250a0ca80e7f80102f2c83cc3eecff5f12/DumpSource2/schemas/client/EModifierValue.h), [Типы лечения в схеме](https://github.com/SteamTracking/GameTracking-Deadlock/blob/17462b250a0ca80e7f80102f2c83cc3eecff5f12/DumpSource2/schemas/client/EHealingTypes.h), [Wiki: лечение и его модификаторы](https://deadlock.wiki/Healing).

<a id="regen"></a>
## Регенерация и лечение со временем

**Математика при указанных условиях · Лечение**

`H(t) = rate × t × M_применимой_ветки, с ограничением HP_missing`

- rate — корректная скорость HP/с после базы/flat/OOC/scaling для данного эффекта.

При постоянных условиях полученное HP равно скорости восстановления, умноженной на время. Но усиление totalheal, rate и duration — не одно и то же: длиннее HoT не всегда означает больше восстановления.

У Victor нативный regen1,5+0,08×Spirit. При естественных 38,5 Spirit наLVL36 получается 4,58 HP/с без предметов. Nurse Harrow имеет 0 базовой regen; чужой лечащий эффект не создаёт у неё нативную regen автоматически.

**Пример.** Постоянная применимая regen10 HP/с за 5 с дала бы 50 HP; при одном anti-heal35% —32,5 HP, если всё это время здоровье недостающее.

**Границы применения:**

- OOC regen, fountain и внешние источники имеют отдельные правила.
- Количество тиков, очередность medic heals и начальный/конечный тик конкретного HoT проверяются отдельно.

Источники: [Файлы героя: база, приросты и коэффициенты](https://github.com/SteamTracking/GameTracking-Deadlock/blob/17462b250a0ca80e7f80102f2c83cc3eecff5f12/game/citadel/pak01_dir/scripts/heroes.vdata), [Файлы оружия, способностей и предметов](https://github.com/SteamTracking/GameTracking-Deadlock/blob/17462b250a0ca80e7f80102f2c83cc3eecff5f12/game/citadel/pak01_dir/scripts/abilities.vdata), [Раздельные типы модификаторов](https://github.com/SteamTracking/GameTracking-Deadlock/blob/17462b250a0ca80e7f80102f2c83cc3eecff5f12/DumpSource2/schemas/client/EModifierValue.h), [Типы лечения в схеме](https://github.com/SteamTracking/GameTracking-Deadlock/blob/17462b250a0ca80e7f80102f2c83cc3eecff5f12/DumpSource2/schemas/client/EHealingTypes.h).

<a id="lifesteal"></a>
## Вампиризм: отдельные каналы и эффективность цели

**Рабочее правило по источникам · Лечение**

`L = P(l₁,…);   H₀ = D_eligible × L × k_target × e_hero`

- Bullet и Spirit lifesteal — отдельные пулы.
- D_eligible — подходящий фактически нанесённый урон, до вычисления healing.
- k_target =1 по героям; обычные nonhero коэффициенты 0,6 Bullet /0,4 Spirit.

Сначала объединяется применимый lifesteal одного канала. Источник, работающий только по отмеченной цели или для одного умения, не становится глобальным lifesteal для всех попаданий.

Затем применяются ограничения эффективности цели/героя и соответствующая ветка healing/anti-heal. У Rat King в raw отдельная эффективность 0,75; её нельзя принять за+75% бонуса.

**Пример.** 13% и 28% →37,36%. От 200 подходящего урона герою:74,72 HP до других healing-модификаторов. Для обычного Bullet nonhero:44,832; Spirit nonhero:29,888.

**Границы применения:**

- Урон в барьер, overkill, summons и структуры требуют отдельной применимости.
- Fixed Melee Lifesteal heal не является процентом глобального bullet lifesteal.
- Не смешивай ability-inherent healing и общий LS без проверки source/scope.

Источники: [Wiki: вампиризм](https://deadlock.wiki/Lifesteal), [Valve: diminishing lifesteal, 10.10.2024](https://forums.playdeadlock.com/threads/10-10-2024-update.36958/), [Mekahippie: независимый разбор diminishing, 2024](https://www.reddit.com/r/DeadlockTheGame/comments/1hb8b7z/heres_how_deadlocks_diminishing_returns_work_for/), [Настройки игры: lifesteal и ограничения](https://github.com/SteamTracking/GameTracking-Deadlock/blob/17462b250a0ca80e7f80102f2c83cc3eecff5f12/DumpSource2/convars.txt), [Файлы героя: база, приросты и коэффициенты](https://github.com/SteamTracking/GameTracking-Deadlock/blob/17462b250a0ca80e7f80102f2c83cc3eecff5f12/game/citadel/pak01_dir/scripts/heroes.vdata), [Раздельные типы модификаторов](https://github.com/SteamTracking/GameTracking-Deadlock/blob/17462b250a0ca80e7f80102f2c83cc3eecff5f12/DumpSource2/schemas/client/EModifierValue.h).

<a id="lifesteal-amp"></a>
## Вампиризм с heal amp: две проверяемые модели

**Модель: есть ограничения проверки · Лечение**

`Модель A: D × P(lᵢ) × (1+a);   модель B: D × P(lᵢ × (1+a))`

- a — применимое исходящее усиление, если значения LS ещё не учитывают его.
- A усиливает общий heal после pooling; B сначала усиливает каждый LS input.

Распространённое объяснение используетA. Однако у нескольких raw LS properties стоит EHealingOutput scaling, что допускаетB. Доступные наблюдения не различают их достаточно надёжно.

Калькулятор показывает обе оценки, когда задан amp, и не скрывает разницу. При amp0 ответы совпадают. Если вводишь уже усиленные значения LS, оставь outgoing amp0.

**Пример.** 13%+28%, amp20%, damage200: A=89,664 HP; B=87,9168 HP до anti-heal и missingHP cap.

**Границы применения:**

- Это локализованное расхождение очередности; сама формула diminishing LS остаётся рабочей.
- Если усиленный отдельный источник достигает 100%, модельB за областью поддерживаемых значений.

Источники: [Файлы оружия, способностей и предметов](https://github.com/SteamTracking/GameTracking-Deadlock/blob/17462b250a0ca80e7f80102f2c83cc3eecff5f12/game/citadel/pak01_dir/scripts/abilities.vdata), [Параметры и функции масштабирования](https://github.com/SteamTracking/GameTracking-Deadlock/blob/17462b250a0ca80e7f80102f2c83cc3eecff5f12/DumpSource2/schemas/client/CitadelAbilityProperty_t.h), [Wiki: вампиризм](https://deadlock.wiki/Lifesteal), [Wiki: лечение и его модификаторы](https://deadlock.wiki/Healing).

<a id="cooldown"></a>
## Перезарядка способности и частота применений

**Рабочее правило по источникам · Темп**

`C = P(c₁,…);   T_final = T_upgraded × (1−C);   ideal_rate = 1/T_final`

- T_upgraded — cooldown после плоских апгрейдов нужного свойства.
- cᵢ — разные подходящие источники CDR одного timer type.

Несколько обычных CDR бонусов уменьшающе складываются. Процент сокращает время, поэтому 20% CDR не равно+20% частоты: при неизменных прочих условиях частота увеличивается в 1/0,8=1,25 раза.

Ability, item, ultimate, charge-recharge, delay между charges и parry — разные таймеры. Обычный ability CDR не сокращает item active, если у него EItemCooldown.

**Пример.** 60 с, CDR20% и 5%:итог 24%; cooldown45,6 с. Если плоский талант сначала сделал базу 50 с, получится 38 с. Dispel45 с с подходящим itemCDR25% →33,75 с.

**Границы применения:**

- Момент старта cooldown, cast/channel time, ресурсы и charges ограничивают реальную частоту.
- Reset и уменьшение оставшегося таймера — отдельные операции.
- Не назначаем недоказанный универсальный cap или floor.

Источники: [Wiki: перезарядка способности](https://deadlock.wiki/Ability_Cooldown), [Valve: diminishing CDR, 18.07.2024](https://forums.playdeadlock.com/threads/07-18-2024-update.11831/), [Mekahippie: независимый разбор diminishing, 2024](https://www.reddit.com/r/DeadlockTheGame/comments/1hb8b7z/heres_how_deadlocks_diminishing_returns_work_for/), [Файлы оружия, способностей и предметов](https://github.com/SteamTracking/GameTracking-Deadlock/blob/17462b250a0ca80e7f80102f2c83cc3eecff5f12/game/citadel/pak01_dir/scripts/abilities.vdata), [Раздельные типы модификаторов](https://github.com/SteamTracking/GameTracking-Deadlock/blob/17462b250a0ca80e7f80102f2c83cc3eecff5f12/DumpSource2/schemas/client/EModifierValue.h).

<a id="duration"></a>
## Увеличение длительности тоже складывается убывающе

**Рабочее правило по источникам · Темп**

`U = P(u₁,…);   t_final = t_upgraded × (1+U)`

- uᵢ — независимые действующие duration bonuses.

Для обычных применимых duration bonuses рабочее правило — убывающий положительный бонус, а не произведение(1+u). Это согласуется с независимым объяснением и направлением патча Valve.

Current Duration Extender даёт 20%, Superior28%. Wiki местами показывает старые 22%: для численных входов используем raw6819. Поглощённый компонент не остаётся вторым предметом.

**Пример.** 28% и 15% →1−0,72×0,85=38,8%. База 10 с становится 13,88 с. Это не 14,72 с от 1,28×1,15.

**Границы применения:**

- Умение должно разрешать duration scaling данного modifier.
- Flat duration, Spirit duration, channel и projectile lifetime требуют своего порядка/свойства.

Источники: [Wiki: длительность (числа предметов местами устарели)](https://deadlock.wiki/Ability_Duration), [Valve: diminishing duration/range, 06.12.2024](https://forums.playdeadlock.com/threads/12-06-2024-update.50599/), [Mekahippie: независимый разбор diminishing, 2024](https://www.reddit.com/r/DeadlockTheGame/comments/1hb8b7z/heres_how_deadlocks_diminishing_returns_work_for/), [Файлы оружия, способностей и предметов](https://github.com/SteamTracking/GameTracking-Deadlock/blob/17462b250a0ca80e7f80102f2c83cc3eecff5f12/game/citadel/pak01_dir/scripts/abilities.vdata), [Флаги длительности и применимости](https://github.com/SteamTracking/GameTracking-Deadlock/blob/17462b250a0ca80e7f80102f2c83cc3eecff5f12/DumpSource2/schemas/client/CCitadelModifierVData.h).

<a id="range"></a>
## Увеличение радиуса и дальности

**Рабочее правило по источникам · Темп**

`U_range = P(r₁,…);   range_final = range_upgraded × (1+U_range)`

- range_upgraded — уже выбранная база конкретного свойства в метрах.

Проценты обычного range/radius бонуса объединяются убывающе. Но cast range, explosion radius, ширина, высота и максимальный путь снаряда — разные свойства.

Raw отдельно содержит TECH_RANGE_PERCENT и TECH_RADIUS_PERCENT. Даже совпадающие 30% не гарантируют, что любое число дистанции умения читает этот stat.

**Пример.** 30% и 5% →33,5%. Радиус 20 м становится 26,7 м при применимости обоих источников.

**Границы применения:**

- Не изменяет автоматически оружейный falloff или дальность dash.
- LOS и ограничения по высоте не выводятся из одного радиуса.

Источники: [Wiki: радиус и дальность](https://deadlock.wiki/Range), [Valve: diminishing duration/range, 06.12.2024](https://forums.playdeadlock.com/threads/12-06-2024-update.50599/), [Mekahippie: независимый разбор diminishing, 2024](https://www.reddit.com/r/DeadlockTheGame/comments/1hb8b7z/heres_how_deadlocks_diminishing_returns_work_for/), [Файлы оружия, способностей и предметов](https://github.com/SteamTracking/GameTracking-Deadlock/blob/17462b250a0ca80e7f80102f2c83cc3eecff5f12/game/citadel/pak01_dir/scripts/abilities.vdata), [Раздельные типы модификаторов](https://github.com/SteamTracking/GameTracking-Deadlock/blob/17462b250a0ca80e7f80102f2c83cc3eecff5f12/DumpSource2/schemas/client/EModifierValue.h).

<a id="max-health"></a>
## Максимальное HP: базовый бонус и плоское здоровье

**Рабочее правило по источникам · Характеристики**

`HP_max = ceil[(HP₀ + B × g_HP) × (1+b_base) + HP_flat]`

- b_base — применимый уже объединённый бонус на базовое здоровье+прирост.
- HP_flat — сумма обычных добавлений, не масштабируемых этим base bonus.
- ceil — округление вверх до целого в принятой модели.

База героя и здоровье от Boons входят в base-health часть. Обычное плоское здоровье предметов добавляется после её усиления. Нельзя повторно умножать плоский itemHP на base bonus.

Vitality investment берётся как текущий итог соответствующего порога вложений. Это не сумма исторических процентов за каждый когда-либо купленный tier.

**Пример.** База 800,10 Boons по 49, base bonus20%, flat210:ceil((800+490)×1,2+210)=1758 HP.

**Границы применения:**

- Glass Cannon total max-health penalty, no-scale bonus, HP steal и override имеют другие типы; эта простая формула их не моделирует.
- Текущее HP после изменения максимального — отдельное правило.

Источники: [Wiki: базовое и добавочное здоровье](https://deadlock.wiki/Bonus_Health), [Deadlock Shop: независимая реализация характеристик](https://deadlockshop.app/), [Deadlock Meta: вложения в категорию](https://www.deadlockmeta.dev/en/mechanics/investment-bonus), [Файлы героя: база, приросты и коэффициенты](https://github.com/SteamTracking/GameTracking-Deadlock/blob/17462b250a0ca80e7f80102f2c83cc3eecff5f12/game/citadel/pak01_dir/scripts/heroes.vdata), [Файлы оружия, способностей и предметов](https://github.com/SteamTracking/GameTracking-Deadlock/blob/17462b250a0ca80e7f80102f2c83cc3eecff5f12/game/citadel/pak01_dir/scripts/abilities.vdata), [Раздельные типы модификаторов](https://github.com/SteamTracking/GameTracking-Deadlock/blob/17462b250a0ca80e7f80102f2c83cc3eecff5f12/DumpSource2/schemas/client/EModifierValue.h).

<a id="fire-rate"></a>
## Скорострельность и замедление стрельбы

**Модель: есть ограничения проверки · Темп**

`H=Σhᵢ; Q=P(sᵢ); z=max(−0,50,H−Q); f=f₀×(1+z) при z≥0; f=f₀/(1−z) при z<0`

- hᵢ — обычные положительные fire-rate bonuses.
- sᵢ — отдельные fire-rate slows; не movement slows.

Положительные бонусы и замедления стрельбы объединяются разными пулами. Нативное изменение base cycle относится к другой стадии.

Отрицательная ветка 1/(1−z) описана текущей wiki, но независимый свежий timing test не найден. В калькуляторе и справочнике это рабочая оценка с пониженной уверенностью.

**Пример.** Базовые 10 выстр./с и бонусы 20%+30% →15. Бонус 38%, slows25%+28% →Q46%, z−8%; модель даёт 10/1,08=9,25926.

**Границы применения:**

- Не переносится автоматически на burst, spin-up, charged или channel оружие.
- −50% в этой conversion-модели не означает ровно половину частоты.

Источники: [Wiki: темп огня](https://deadlock.wiki/index.php?title=Fire_Rate&oldid=192243), [Отдельные измерения fire-rate buffs/slows](https://www.reddit.com/r/DeadlockTheGame/comments/1i07acp/is_it_just_me_or_does_attack_speed_need_to_be_looked_at/), [Настройки игры: lifesteal и ограничения](https://github.com/SteamTracking/GameTracking-Deadlock/blob/17462b250a0ca80e7f80102f2c83cc3eecff5f12/DumpSource2/convars.txt), [Раздельные типы модификаторов](https://github.com/SteamTracking/GameTracking-Deadlock/blob/17462b250a0ca80e7f80102f2c83cc3eecff5f12/DumpSource2/schemas/client/EModifierValue.h).

<a id="dps"></a>
## DPS, точность, крит и спорный тайминг очередей

**Модель: есть ограничения проверки · Темп**

`DPS = D_залпа × f;   expected = DPS × p_hit × [1+h×(C−1)]`

- h — доля headshots среди попавших; p_hit — доля попаданий.
- В таблице f = N / [cycle + (N−1)×intra] — сравнительная модель.

DPS — не урон одного попадания и не точное время убийства. Если промахи уже учтены в фактическом damage, не умножай на точность ещё раз.

Для burst обнаружены три разные трактовки: schemaN/cycle, принятая модельN/[cycle+(N−1)intra] и API N/[cycle+Nintra]. Без независимого timing-теста не выбираем молча новую как истину. Сохраняем в таблице явную сравнительную модель.

Для обычного магазина усреднённая оценка с перезарядкой: m×D/(m/f+reload). Начало первого выстрела, перекрытие reload и особые режимы могут менять точную границу цикла.

**Пример.** D10, f5/с, магазин 10, reload2 с →50 DPS во время огня и 25 DPS в непрерывной модели с reload. Seven rawN3/cycle0,2625/intra0,084 даёт по трём трактовкам 11,42857;6,96864;5,83090 выстр./с.

**Границы применения:**

- У hitOnce сначала используй правильный урон одной цели, у spin-up выбери старт/полную раскрутку.
- Это не engine-measured DPS и не гарантированный TTK.

Источники: [Описание полей оружия](https://github.com/SteamTracking/GameTracking-Deadlock/blob/17462b250a0ca80e7f80102f2c83cc3eecff5f12/DumpSource2/schemas/client/CCitadelWeaponInfo.h#L18), [Реализация расчётного DPS в API](https://github.com/deadlock-api/deadlock-api/blob/902a603c444796943cb8db268143aeb11c747fab/api/src/services/assets/versions/items/build.rs#L733), [Файлы оружия, способностей и предметов](https://github.com/SteamTracking/GameTracking-Deadlock/blob/17462b250a0ca80e7f80102f2c83cc3eecff5f12/game/citadel/pak01_dir/scripts/abilities.vdata).

<a id="reload"></a>
## Перезарядка магазина и по одному патрону

**Модель: есть ограничения проверки · Темп**

`Обычная: T=T_reload;   по одному патрону: T≈initial_delay+n×T_round;   один reduction q: T≈T₀×(1−q)`

- n — сколько патронов требуется вставить.
- m_reloadDuration у single-bullet reload означает одну операцию, а не полный магазин.

Читай тип перезарядки. Abrams и Silver вставляют патроны по одному; Nurse Harrow имеет обычную перезарядку магазина. Одно и то же имя raw duration не означает одну и ту же операцию.

Одна обычная Reload Reduction20% соответствует примерно 80% исходного времени. Для нескольких разных reload modifiers универсальное сложение здесь не установлено.

**Пример.** Abrams:0,705 с initial delay +9×0,3525 с =3,8775 с. Silver:0,5+7×0,3=2,6 с. Nurse полный reload1,9 с; один reduction10% даёт 1,71 с в обычной модели.

**Границы применения:**

- Active Reload, instant ammo refill, отмена и активный режим имеют отдельные таймеры.
- Число дробин не равно расходу патронов.

Источники: [Описание полей оружия](https://github.com/SteamTracking/GameTracking-Deadlock/blob/17462b250a0ca80e7f80102f2c83cc3eecff5f12/DumpSource2/schemas/client/CCitadelWeaponInfo.h#L18), [Файлы оружия, способностей и предметов](https://github.com/SteamTracking/GameTracking-Deadlock/blob/17462b250a0ca80e7f80102f2c83cc3eecff5f12/game/citadel/pak01_dir/scripts/abilities.vdata), [Wiki: виды перезарядки](https://deadlock.wiki/Reload), [Наблюдения длительности перезарядки](https://www.reddit.com/r/DeadlockTheGame/comments/1fe8z6d/we_all_did_that/).

<a id="uptime"></a>
## Покрытие баффа и перекрывающиеся дебаффы

**Математика при указанных условиях · Темп**

`uptime = min(1, duration / period);   overlap = длина объединения интервалов`

- period — реальное время между началами применений, а не всегда число cooldown.

Если один и тот же эффект регулярно применяется каждыеPсекунд и живётTсекунд, при постоянных условиях покрытие времени равноmin(1,T/P). Период надо определить по механике старта cooldown, cast и ресурсам.

Сумма длительностей двух одновременно наложенных станов не равна общему времени контроля. На временной оси складываются только неперекрытые участки. У refresh и queue свои правила.

**Пример.** Бафф 6 с каждые 10 с →60% покрытия. Станы[0;2] и[1;3] контролируют 3 с, а не 4 с.

**Границы применения:**

- Это математическая модель по известному расписанию, а не обещание стака конкретных CC.
- Ауры, сопротивление длительности и непредсказуемое попадание меняют интервалы.

Источники: [Флаги длительности и применимости](https://github.com/SteamTracking/GameTracking-Deadlock/blob/17462b250a0ca80e7f80102f2c83cc3eecff5f12/DumpSource2/schemas/client/CCitadelModifierVData.h), [Параметры и функции масштабирования](https://github.com/SteamTracking/GameTracking-Deadlock/blob/17462b250a0ca80e7f80102f2c83cc3eecff5f12/DumpSource2/schemas/client/CitadelAbilityProperty_t.h).
