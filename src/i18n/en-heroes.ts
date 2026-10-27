export const enHeroes: Record<string, string> = {
  'Приросты учитывают усиление от Spirit': 'Growth includes bonuses from Spirit',
  'ВЕРСИЯ ИГРЫ': 'GAME VERSION',
  ОБНОВЛЕНО: 'UPDATED',
  'Версия игры': 'Game version',
  'Урон выстрела указан для одной цели. Дробины складываются при попадании в неё; особенности оружия описаны в подробностях героя. DPS — урон в секунду без перезарядки. На первом уровне Spirit может быть равен нулю.':
    'Shot damage is shown against one target. Pellets add together when they hit it; hero details explain special weapon behavior. DPS is damage per second without reloading. Spirit can be zero at level one.',
  'Уровень {{level}}': 'Level {{level}}',
  'Урон и магазин': 'Damage and magazine',
  'Урон одного тика': 'Damage per tick',
  'Урон одной дробины': 'Damage per pellet',
  'Дробин в выстреле': 'Pellets per shot',
  'Выстрелов в очереди': 'Shots per burst',
  'Урон полной очереди': 'Full burst damage',
  Магазин: 'Magazine',
  'ед.': 'units',
  'Все {{count}} дробин должны попасть в одну цель: {{count}} × {{damage}} = {{total}} урона за выстрел.':
    'All {{count}} pellets must hit one target: {{count}} × {{damage}} = {{total}} damage per shot.',
  'В таблице один выстрел наносит цели {{damage}} урона. Несколько снарядов одного выстрела не складывают урон по этой же цели.':
    'The table counts {{damage}} damage per shot against one target. Multiple projectiles from the same shot do not add damage against that target.',
  'Один выстрел — часть очереди, а не урон всей очереди. Показаны обычные попадания всех выстрелов по одной цели.':
    'One shot is part of the burst, not the damage of the whole burst. Values assume every ordinary shot hits one target.',
  'Отдельная порция урона от связи с целью — тик; в таблице он считается выстрелом. Учтена одна цель, без отскоков и других целей.':
    'One separate portion of tether damage is a tick; the table treats it as a shot. Values cover one target, without bounces or other targets.',
  'Скорость и DPS': 'Fire rate and DPS',
  'Расчётный DPS': 'Calculated DPS',
  'Тиков в секунду': 'Ticks per second',
  'Выстрелов в секунду': 'Shots per second',
  'DPS при полной раскрутке': 'DPS at full spin',
  'DPS — урон за секунду непрерывной стрельбы без перезарядки. Предметы, активные способности, особые режимы, попадания в голову, сопротивления и снижение урона от дистанции не учтены.':
    'DPS is damage per second of continuous fire without reloading. Items, active abilities, special modes, headshots, resistance and distance falloff are excluded.',
  'Скорость учитывает паузы между выстрелами внутри очереди и между очередями; урон одного выстрела умножается на среднее число выстрелов в секунду.':
    'The rate includes pauses between shots within a burst and between bursts; single-shot damage is multiplied by the average shots per second.',
  'Оружие наносит урон лучом: перед началом есть задержка {{delay}} с. Показанный DPS описывает стрельбу после неё.':
    'The weapon deals beam damage: firing starts after a {{delay}} s delay. The displayed DPS describes firing after that delay.',
  'Основной DPS и таблица показывают начало стрельбы. Полная раскрутка ускоряет огонь; время на раскрутку в её DPS не включено.':
    'The main DPS and table describe the start of firing. Full spin increases fire rate; its DPS excludes the time spent spinning up.',
  'Каждая единица Spirit добавляет {{scale}}% к скорострельности. На выбранном уровне естественная мощь даёт +{{bonus}}%; этот бонус уже включён в DPS один раз.':
    'Each point of Spirit adds {{scale}}% fire rate. At this level, natural Spirit gives +{{bonus}}%; this bonus is already included in DPS once.',
  'Рост за уровень': 'Growth per level',
  'Каждый уровень после первого увеличивает характеристики на указанные значения. Spirit — спиритическая мощь; у некоторых героев она дополнительно усиливает оружие или восстановление здоровья.':
    'Each level after the first increases these stats by the listed amounts. Spirit is Spirit Power; for some heroes it also increases weapon damage or health regeneration.',
  'Урон за уровень': 'Damage per level',
  'Здоровье за уровень': 'Health per level',
  'Spirit за уровень': 'Spirit per level',
  'Восстановление за уровень': 'Regeneration per level',
  'Естественный прирост +{{spirit}} Spirit за уровень добавляет по {{scale}} урона за единицу мощи: ещё +{{extra}} к одному попаданию.':
    'Natural growth of +{{spirit}} Spirit per level adds {{scale}} damage per Spirit: another +{{extra}} to one hit.',
  'Прямой прирост +{{direct}} и прибавка от Spirit +{{extra}} дают +{{total}} к урону одного попадания за уровень.':
    'Direct growth of +{{direct}} and the +{{extra}} Spirit contribution give +{{total}} damage per hit per level.',
  'Одна дробина получает +{{growth}} урона за уровень. При попадании всех {{count}} дробин прирост выстрела — +{{total}}.':
    'One pellet gains +{{growth}} damage per level. When all {{count}} pellets hit, shot damage grows by +{{total}}.',
  'Каждая единица Spirit добавляет {{scale}} HP/с к восстановлению. Естественный прирост +{{spirit}} мощи даёт ещё +{{extra}} HP/с за уровень; итоговый прирост — +{{total}} HP/с за уровень.':
    'Each Spirit point adds {{scale}} HP/s regeneration. Natural growth of +{{spirit}} Spirit adds another +{{extra}} HP/s per level; total growth is +{{total}} HP/s per level.',
  'Показаны снаряды от обычных взмахов меча.':
    'Values describe projectiles from ordinary sword swings.',
  'Прицеливание охватывает конус; здесь сравнивается урон по одной цели.':
    'Targeting covers a cone; this comparison uses damage against one target.',
  'Показано прямое попадание по одной цели. Дополнительные отскоки не учитываются.':
    'Values describe a direct hit against one target. Additional bounces are excluded.',
  'Показан обычный выстрел без заряда. Заряженная атака и взрывная область требуют отдельного расчёта; их DPS здесь не показан.':
    'Values describe an ordinary uncharged shot. The charged attack and explosion area need a separate calculation; their DPS is not shown here.',
  'Естественное восстановление здоровья равно нулю. Восстановление от активных способностей здесь не учитывается.':
    'Natural health regeneration is zero. Healing from active abilities is excluded.',
  'Пузырьковый снаряд: показано прямое попадание по одной цели.':
    'A bubble projectile: values describe a direct hit against one target.',
  'Показана обычная винтовка. При превращении в волка оружие меняется; эти значения к форме волка не относятся.':
    'Values describe the base rifle. Transforming into a wolf changes the weapon; these values do not apply to wolf form.',
  'Показан обычный выстрел. Командование фигурами требует отдельного расчёта.':
    'Values describe an ordinary shot. Commanding pieces needs a separate calculation.',
  'Показан обычный выстрел без усиленного альтернативного режима и бонусов Sketchbook.':
    'Values describe an ordinary shot without the empowered alternate mode or Sketchbook bonuses.',
};
