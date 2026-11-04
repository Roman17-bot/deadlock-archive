import { useState } from 'react';
import type { HeroSnapshot } from '../../../shared/types';
import { statsAtLevel } from '../../../shared/heroes';
import { HeroAbilities } from '../../features/hero-calculator/HeroAbilities';
import { DemoPlayer } from '../../features/heroes/DemoPlayer';
import { useReference } from '../../features/heroes/useReference';
import { useItems } from '../../features/items/useItems';
import { buyTime } from '../../features/items/model';
import {
  loadHeroProfiles,
  loadHeroStatistics,
  referenceMedia,
} from '../../services/heroReferenceApi';
import { useI18n } from '../../i18n';
import { asset, format, formatDate } from '../../lib/format';

export function HeroDetailPage({ data, slug }: { data: HeroSnapshot; slug: string }) {
  const { language } = useI18n();
  const en = language === 'en';
  const profiles = useReference(loadHeroProfiles);
  const stats = useReference(loadHeroStatistics);
  const items = useItems(undefined, undefined, true);
  const [tab, setTab] = useState<'play' | 'lore'>('play');
  const [level, setLevel] = useState(1);
  const [demo, setDemo] = useState<{ id: number | 'weapon'; title: string }>();
  const hero = data.heroes.find((h) => h.slug === slug);
  const profile =
    profiles.data?.clientVersion === data.meta.clientVersion
      ? profiles.data.heroes.find((h) => h.heroId === hero?.id)
      : undefined;
  if (!hero)
    return (
      <div className="hero-reference-page">
        <h1>{en ? 'Hero not found' : 'Герой не найден'}</h1>
      </div>
    );
  const natural = statsAtLevel(hero, level);
  const heroLink = (id: number) => {
    const linked = data.heroes.find((h) => h.id === id);
    return linked ? (
      <a className="hero-inline-link" href={`#/heroes/${linked.slug}`}>
        <img src={asset(linked.portrait)} alt="" loading="lazy" />
        {linked.name}
      </a>
    ) : null;
  };
  const synergies = (stats.data?.synergies.rows ?? [])
    .filter((r) => r.heroId1 === hero.id || r.heroId2 === hero.id)
    .filter((r) => r.matches >= 100)
    .sort((a, b) => b.wins / b.matches - a.wins / a.matches)
    .slice(0, 5);
  const counters = (stats.data?.matchups.rows ?? [])
    .filter((r) => r.heroId === hero.id && r.matches >= 100)
    .sort((a, b) => a.wins / a.matches - b.wins / b.matches)
    .slice(0, 5);
  const purchases =
    items.statistics?.meta.clientVersion === data.meta.clientVersion
      ? items.statistics.items
          .flatMap((item) => {
            const row = item.heroes.find((h) => h.heroId === hero.id);
            const info = items.catalog?.items.find((i) => i.id === item.itemId);
            return row && info ? [{ ...row, info }] : [];
          })
          .sort((a, b) => b.matches - a.matches)
          .slice(0, 8)
      : [];
  return (
    <div className="hero-reference-page">
      <a className="item-back" href="#/heroes/roster">
        ← {en ? 'All heroes' : 'Все герои'}
      </a>
      <header className="hero-dossier-heading">
        {profile && (
          <img className="hero-dossier-art" src={referenceMedia(profile.art.background)} alt="" />
        )}
        <div>
          <p className="hero-eyebrow">
            {en ? 'HERO DOSSIER' : 'ДОСЬЕ ГЕРОЯ'} · {data.meta.clientVersion}
          </p>
          <h1>{hero.name}</h1>
          <p>{profile?.summary[language]}</p>
          <a className="button" href={`#/mechanics?hero=${hero.slug}`}>
            {en ? 'Build calculator' : 'Калькулятор билда'}
          </a>
        </div>
      </header>
      {profiles.error ? (
        <p role="alert">
          {en ? 'Hero story could not be loaded.' : 'Не удалось загрузить описание героя.'}{' '}
          <button onClick={profiles.retry}>{en ? 'Retry' : 'Повторить'}</button>
        </p>
      ) : profiles.data && !profile ? (
        <p role="status">
          {en
            ? 'The hero story is being updated for this version.'
            : 'Описание героя обновляется для этой версии.'}
        </p>
      ) : null}
      <div className="hero-detail-tabs" aria-label={en ? 'Dossier sections' : 'Разделы досье'}>
        <button aria-pressed={tab === 'play'} onClick={() => setTab('play')}>
          {en ? 'Gameplay' : 'Игра за героя'}
        </button>
        <button aria-pressed={tab === 'lore'} onClick={() => setTab('lore')}>
          {en ? 'Story & connections' : 'История и связи'}
        </button>
      </div>
      {tab === 'lore' ? (
        <section className="hero-lore hero-panel">
          <h2>{en ? 'Behind the name' : 'История героя'}</h2>
          <p>
            {profile?.lore[language] ||
              (en ? 'The story is not available yet.' : 'История пока недоступна.')}
          </p>
          <h3>{en ? 'Connections' : 'Связи с героями'}</h3>
          {profile?.relationships.length ? (
            <ul>
              {profile.relationships.map((r) => (
                <li key={r.heroId}>
                  {heroLink(r.heroId)} — {r.description[language]}
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">
              {en
                ? 'No confirmed connections are listed yet.'
                : 'Подтверждённые связи пока не добавлены.'}
            </p>
          )}
        </section>
      ) : (
        <>
          <div className="hero-detail-grid">
            <section className="hero-panel">
              <h2>{en ? 'Weapon & attributes' : 'Оружие и характеристики'}</h2>
              <label className="hero-level">
                {en ? 'Level' : 'Уровень'}{' '}
                <input
                  type="range"
                  min="1"
                  max="36"
                  value={level}
                  onChange={(e) => setLevel(Number(e.target.value))}
                />
                <output>{level}</output>
              </label>
              <dl className="hero-attributes">
                {[
                  [en ? 'Health' : 'Здоровье', format(natural.health)],
                  [en ? 'Health regeneration / s' : 'Регенерация / с', format(natural.regen)],
                  [en ? 'Spirit power' : 'Спирит', format(natural.spirit)],
                  [en ? 'Damage / projectile' : 'Урон / снаряд', format(natural.bulletDamage)],
                  [en ? 'Damage / shot' : 'Урон / выстрел', format(natural.shotDamage)],
                  [en ? 'Weapon DPS' : 'Урон оружия / с', format(natural.dps)],
                  [en ? 'Magazine' : 'Магазин', format(hero.weapon.clipSize)],
                  [en ? 'Reload / s' : 'Перезарядка / с', format(hero.weapon.reloadSeconds)],
                  [en ? 'Move speed / m/s' : 'Скорость / м/с', format(hero.base.moveSpeed)],
                  [en ? 'Stamina' : 'Выносливость', format(hero.base.stamina)],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
              <p className="hero-caption">
                {en
                  ? 'Base attributes, no items. Weapon DPS excludes reloads, range falloff and target resistance.'
                  : 'Базовые характеристики без предметов. Урон в секунду без перезарядки, падения урона на дистанции и сопротивлений цели.'}
              </p>
              <button
                className="hero-demo-button"
                onClick={(event) => {
                  event.currentTarget.focus();
                  setDemo({ id: 'weapon', title: en ? 'Primary attack' : 'Обычная атака' });
                }}
              >
                ▷ {en ? 'Watch primary attack' : 'Посмотреть обычную атаку'}
              </button>
            </section>
            <section className="hero-panel">
              <h2>{en ? 'In practice' : 'На практике'}</h2>
              {profile?.reviewedClientVersion != null &&
              profile.reviewedClientVersion !== data.meta.clientVersion ? (
                <p>
                  {en
                    ? 'Tips are being reviewed for this version.'
                    : 'Советы обновляются для этой версии.'}
                </p>
              ) : profile?.tips.length ? (
                <ul className="hero-tips">
                  {profile.tips.map((tip, index) => (
                    <li key={index}>{tip[language]}</li>
                  ))}
                </ul>
              ) : (
                <p>{en ? 'Tips are being prepared.' : 'Советы готовятся.'}</p>
              )}
              <p className="hero-caption">
                {en
                  ? 'Use the ability upgrades below to compare their effects at your level.'
                  : 'Выбирай улучшения способностей ниже, чтобы сравнить их действие на своём уровне.'}
              </p>
            </section>
          </div>
          <HeroAbilities
            data={data}
            hero={hero}
            level={level}
            items={[]}
            rules={data.calculatorRules}
            context={{}}
            onDemo={(id, title) => setDemo({ id, title })}
          />
          <section className="hero-panel hero-pair-section">
            <h2>
              {en
                ? 'Team combinations & difficult matchups'
                : 'Сочетания в команде и сложные противники'}
            </h2>
            <p className="hero-caption">
              {en
                ? 'Observed results in normal ranked and unranked matches; at least 100 appearances per pair. Team composition and player skill also affect results.'
                : 'Результаты обычных ranked и unranked матчей; не менее 100 наблюдений на пару. На результат также влияют состав команды и мастерство игроков.'}
            </p>
            {stats.data && (
              <p className="hero-caption">
                {formatDate(stats.data.matchups.from)} — {formatDate(stats.data.matchups.to)} · UTC
              </p>
            )}
            {stats.error ? (
              <p role="alert">
                {en ? 'Match statistics unavailable.' : 'Статистика матчей недоступна.'}{' '}
                <button onClick={stats.retry}>{en ? 'Retry' : 'Повторить'}</button>
              </p>
            ) : (
              <div className="hero-detail-grid">
                <div>
                  <h3>{en ? 'Higher win rates together' : 'Чаще побеждают вместе'}</h3>
                  <ul className="hero-pair-list">
                    {synergies.map((row) => (
                      <li key={`${row.heroId1}-${row.heroId2}`}>
                        {heroLink(row.heroId1 === hero.id ? row.heroId2 : row.heroId1)}
                        <span>
                          {format((row.wins / row.matches) * 100, 1)}%
                          <small>
                            {format(row.matches)} {en ? 'matches' : 'матчей'}
                          </small>
                        </span>
                      </li>
                    ))}
                  </ul>
                  {!synergies.length && (
                    <p>{en ? 'Not enough observations yet.' : 'Пока недостаточно наблюдений.'}</p>
                  )}
                </div>
                <div>
                  <h3>{en ? 'Lower win rates against' : 'Сложнее побеждать против'}</h3>
                  <ul className="hero-pair-list">
                    {counters.map((row) => (
                      <li key={row.enemyHeroId}>
                        {heroLink(row.enemyHeroId)}
                        <span>
                          {format((row.wins / row.matches) * 100, 1)}%
                          <small>
                            {format(row.matches)} {en ? 'matches' : 'матчей'}
                          </small>
                        </span>
                      </li>
                    ))}
                  </ul>
                  {!counters.length && (
                    <p>{en ? 'Not enough observations yet.' : 'Пока недостаточно наблюдений.'}</p>
                  )}
                </div>
              </div>
            )}
          </section>
          <section className="hero-panel">
            <h2>{en ? 'Frequently bought items' : 'Частые предметы'}</h2>
            {items.statistics && (
              <p className="hero-caption">
                {formatDate(items.statistics.meta.from)} — {formatDate(items.statistics.meta.to)} ·{' '}
                {en ? 'Normal ranked + unranked' : 'Обычные ranked + unranked'}
              </p>
            )}
            {items.error || items.statisticsState === 'error' ? (
              <p role="alert">
                {en ? 'Item statistics unavailable.' : 'Статистика предметов недоступна.'}{' '}
                <button onClick={items.retry}>{en ? 'Retry' : 'Повторить'}</button>
              </p>
            ) : !purchases.length ? (
              <p>{en ? 'No purchase data yet.' : 'Данных о покупках пока нет.'}</p>
            ) : (
              <ul className="hero-popular-items">
                {purchases.map((row) => (
                  <li key={row.info.id}>
                    <a
                      href={`#/items/${row.info.slug}?returnTo=${encodeURIComponent(`#/heroes/${hero.slug}`)}`}
                    >
                      <img src={asset(row.info.icon)} alt="" loading="lazy" />
                      <strong>{row.info.localizedName[language] || row.info.name}</strong>
                    </a>
                    <span>
                      {format(row.matches)} {en ? 'matches with item' : 'матчей с предметом'}
                    </span>
                    <small>
                      {en ? 'Average purchase' : 'Среднее время покупки'} ·{' '}
                      {buyTime(row.averageBuyTimeSeconds)}
                    </small>
                  </li>
                ))}
              </ul>
            )}
            <p className="hero-caption">
              {en
                ? 'Frequency describes observed purchases; it is not a recommended build order.'
                : 'Частота описывает реальные покупки, а не рекомендуемый порядок сборки.'}
            </p>
          </section>
        </>
      )}
      {demo && (
        <DemoPlayer
          title={demo.title}
          video={profile?.videos.find((v) => v.abilityId === demo.id)}
          onClose={() => setDemo(undefined)}
        />
      )}
    </div>
  );
}
