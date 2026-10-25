export const enData: Record<string, string> = {
  'Уровень 1: базовые значения. Уровни 2–36: по одному стандартному Boon. B = LVL − 1.':
    'Level 1 shows base values. Levels 2–36 add one standard Boon each. B = LVL − 1.',
  'У каждого героя собственные прибавки к HP, Spirit и урону. Нативные Spirit-скейлы оружия и регенерации учитываются при изменении уровня.':
    'Each hero has individual HP, Spirit and damage growth. Native Spirit scaling for weapons and regeneration is included when changing the level.',
  'Урон выстрела по одной цели: сумма попавших обычных дробин; для hit-once оружия один полный урон независимо от числа попавших траекторий. Очередь не считается одним выстрелом.':
    'Single-target shot damage sums ordinary pellets that hit; hit-once weapons deal one full hit regardless of the number of trajectories that connect. A burst is not treated as one shot.',
  'DPS — расчётная модель непрерывной стрельбы без перезарядки: shots/s = burst / (cycle + (burst−1) × intraBurst). Она не является замером игрового движка.':
    'DPS uses a continuous-fire model without reloading: shots/s = burst / (cycle + (burst−1) × intraBurst). This is not a measurement of engine behavior.',
  'Нет предметов, активных способностей, усиленных режимов, хедшотов, сопротивлений и падения урона от дистанции. У раскручивающегося оружия показан стартовый DPS.':
    'Items, active abilities, empowered modes, headshots, resistance and distance falloff are excluded. Spinning weapons show their initial DPS.',
  'Прирост урона и регенерации включает встроенные бонусы от естественного прироста Spirit. Округление применяется только при отображении.':
    'Damage and regeneration growth include native bonuses from natural Spirit growth. Values are rounded only for display.',
  'Исходные файлы игры · фиксированная ревизия': 'Game source files · pinned revision',
  'Версия игрового клиента': 'Game client version',
  'Проектильные взмахи меча; HitOnceAcrossAllBullets=true, без бонусов способностей.':
    'Projectile sword swings; HitOnceAcrossAllBullets=true, without ability bonuses.',
  'Hit-once: несколько траекторий дают один полный урон по одной цели за выстрел. Число траекторий не умножает этот урон. Рабочее правило по schema и наблюдениям игроков; специальные режимы отдельно.':
    'Hit-once: multiple trajectories deal one full hit to the same target per shot. Trajectory count does not multiply that damage. A working rule based on the schema and player observations; special modes require separate analysis.',
  'Три визуальных снаряда, HitOnceAcrossAllBullets=true. Сам флаг не доказывает, что полный урон залпа нужно делить на три; raw и альтернативные модели сохранены.':
    'Three visual projectiles, HitOnceAcrossAllBullets=true. The flag alone does not prove that full volley damage should be divided by three; raw values and alternative models are retained.',
  'Оружие является лучом; базовый DPS здесь после начальной задержки WindUpTime=0.3 с, без неё.':
    'A beam weapon; base DPS excludes the initial WindUpTime=0.3 s delay and describes firing after it.',
  'Прицеливание оружия использует конус; указана одна цель, без бонусов способностей.':
    'The weapon uses cone targeting; values describe one target without ability bonuses.',
  'Указано одно прямое попадание; дополнительные отскоки не включены.':
    'One direct hit is shown; additional bounces are excluded.',
  'Обычная атака без заряда; заряженная атака: raw m_flChargedBulletDamage=48, charge_up_time=0.8 с. Её DPS не выводится как 48/обычный cycle_time.':
    'Ordinary uncharged attack; the charged attack has raw m_flChargedBulletDamage=48, charge_up_time=0.8 s. Its DPS is not calculated as 48 divided by the normal cycle_time.',
  'Основной незаряженный выстрел; заряд и взрывная область не включены в сравнение.':
    'The primary uncharged shot; charge and explosion area are excluded from this comparison.',
  'Три траектории взмаха; HitOnceAcrossAllBullets=true. Полный урон одной цели и raw m_flBulletDamage требуют различать; в JSON сохранены оба прочтения без заявления о проверке в игре.':
    'Three swing trajectories; HitOnceAcrossAllBullets=true. Full single-target damage and raw m_flBulletDamage must be distinguished; both interpretations are preserved in the JSON without claiming in-game verification.',
  'Тики tether-оружия: урон за один тик; указана одна цель, без рикошета/нескольких целей.':
    'Tether weapon ticks: damage per tick against one target, without ricochets or multiple targets.',
  'К прямому приросту урона 0.85/Boon добавляется 0.08×SP, при SP +1.6/Boon.':
    'Direct damage growth of 0.85/Boon also gains 0.08×SP, with SP growing by 1.6/Boon.',
  'Очередь из 3 выстрелов; урон одного выстрела отличается от урона полной очереди.':
    'A 3-shot burst; single-shot damage differs from full burst damage.',
  'DPS меняется по мере раскрутки; отдельно приведён DPS при полной раскрутке.':
    'DPS changes during spin-up; fully spun-up DPS is listed separately.',
  'В колонке DPS показан старт стрельбы. При полной раскрутке: 72.38 урона/с на уровне 1.':
    'The DPS column shows initial firing. Fully spun up: 72.38 damage/s at level 1.',
  'Базовое восстановление HP равно 0; прямой оружейный выстрел указан без активных способностей.':
    'Base HP regeneration is 0; direct weapon shot damage excludes active abilities.',
  'В raw задан intra_burst_cycle_time при burst_shot_count=1; явная модель исключает эту задержку.':
    'Raw data defines intra_burst_cycle_time with burst_shot_count=1; this explicit model excludes that delay.',
  'Очередь из 5 выстрелов; урон одного выстрела отличается от урона полной очереди.':
    'A 5-shot burst; single-shot damage differs from full burst damage.',
  'Используются пузырьковые снаряды; указано прямое попадание по одной цели.':
    'Bubble projectiles; values describe a direct hit against one target.',
  'Указана исходная винтовка; превращение в волка меняет оружие (зависимый citadel_weapon_werewolf_claws).':
    'The base rifle is shown; wolf transformation changes the weapon to the dependent citadel_weapon_werewolf_claws.',
  'Очередь из 2 выстрелов; урон одного выстрела отличается от урона полной очереди.':
    'A 2-shot burst; single-shot damage differs from full burst damage.',
  'Указан обычный выстрел; командование фигурами и m_bSuppressBulletOnBishopFire исключены.':
    'An ordinary shot is shown; commanding pieces and m_bSuppressBulletOnBishopFire are excluded.',
  'К прямому приросту урона 0.4/Boon добавляется 0.14×SP, при SP +1.1/Boon.':
    'Direct damage growth of 0.4/Boon also gains 0.14×SP, with SP growing by 1.1/Boon.',
  'Восстановление HP дополнительно получает +0.08×SP; эффективный прирост +0.088 HP/с за Boon.':
    'HP regeneration also gains +0.08×SP; effective growth is +0.088 HP/s per Boon.',
  'В колонке DPS показан старт стрельбы. При полной раскрутке: 70.18 урона/с на уровне 1.':
    'The DPS column shows initial firing. Fully spun up: 70.18 damage/s at level 1.',
  'К прямому приросту урона 0.495/Boon добавляется 0.022×SP, при SP +1.1/Boon.':
    'Direct damage growth of 0.495/Boon also gains 0.022×SP, with SP growing by 1.1/Boon.',
  '4 базовых / 8 усиленных вспомогательных траекторий; HitOnceAcrossAllBullets=true. Не умножать damage на 4 или 8; raw primary m_iBullets=1.':
    '4 base / 8 empowered auxiliary trajectories; HitOnceAcrossAllBullets=true. Do not multiply damage by 4 or 8; raw primary m_iBullets=1.',
  'Обычный выстрел без усиленного альтернативного режима и бонусов Sketchbook.':
    'An ordinary shot without the empowered alternate mode or Sketchbook bonuses.',
  'ERoundsPerSecond и EFireRate представляют одну Spirit-зависимость скорости огня; не суммировать их как два независимых бонуса.':
    'ERoundsPerSecond and EFireRate represent the same Spirit-dependent fire rate scaling; do not add them as two independent bonuses.',
  'Скорострельность растёт от Spirit. EFireRate и ERoundsPerSecond — два представления одного скейла, не два складываемых бонуса.':
    'Fire rate grows with Spirit. EFireRate and ERoundsPerSecond are two representations of one scaling relationship, not two additive bonuses.',
};
