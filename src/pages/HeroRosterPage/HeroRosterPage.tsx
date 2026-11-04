import { useState } from 'react';
import type { HeroSnapshot } from '../../../shared/types';
import { aggregateHeroStats, windowDays } from '../../../shared/hero-reference';
import { useI18n } from '../../i18n';
import { asset, format, formatDate } from '../../lib/format';
import {
  loadHeroProfiles,
  loadHeroStatistics,
  referenceMedia,
} from '../../services/heroReferenceApi';
import { useReference } from '../../features/heroes/useReference';
import { HeroNavigation } from '../../features/heroes/HeroNavigation';
import './HeroRosterPage.css';

export function HeroRosterPage({ data }: { data: HeroSnapshot }) {
  const { language } = useI18n();
  const en = language === 'en';
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(data.heroes[0]?.id);
  const [arriving, setArriving] = useState(false);
  const profiles = useReference(loadHeroProfiles);
  const statistics = useReference(loadHeroStatistics);
  const scope = statistics.data?.scopes.find(
    (s) => s.mode === 'all' && s.gameMode === 'normal' && s.rankMin === null && s.rankMax === null,
  );
  const days = scope ? windowDays(scope, 7) : [];
  const stats = aggregateHeroStats(days);
  const heroes = data.heroes.filter((h) =>
    `${h.name} ${h.aliases}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()),
  );
  const hero = data.heroes.find((h) => h.id === selected) ?? data.heroes[0];
  const profile =
    profiles.data?.clientVersion === data.meta.clientVersion
      ? profiles.data.heroes.find((p) => p.heroId === hero?.id)
      : undefined;
  const periodEnd = scope?.to.slice(0, 10);
  const periodStart = periodEnd
    ? new Date(Date.parse(`${periodEnd}T00:00:00Z`) - 6 * 86400000).toISOString().slice(0, 10)
    : undefined;
  const pick = (id: number) => {
    if (selected !== id) {
      setSelected(id);
      setArriving(true);
    }
  };
  return (
    <div className="hero-roster-page expansion-surface">
      <HeroNavigation active="roster" />
      <h1>{en ? 'Choose a hero' : 'Выбери героя'}</h1>
      <p className="roster-criterion">
        {en
          ? 'Win rate · last 7 days · normal matches · all ranks. Green: ≥50%; red: <50%. A dash means no matches.'
          : 'Победы · последние 7 дней · обычные матчи · все ранги. Зелёный: ≥50%; красный: <50%. Прочерк — нет матчей.'}
      </p>
      {statistics.error && (
        <p role="alert">
          {en ? 'Match statistics could not load.' : 'Не удалось загрузить статистику матчей.'}{' '}
          <button onClick={statistics.retry}>{en ? 'Retry' : 'Повторить'}</button>
        </p>
      )}
      {periodStart && periodEnd && scope && (
        <p className="roster-criterion">
          {formatDate(periodStart)} — {formatDate(periodEnd)} · UTC · {en ? 'Updated' : 'Обновлено'}
          : {formatDate(scope.updatedAt)}
        </p>
      )}
      {profiles.error ? (
        <p role="alert">
          {en
            ? 'Hero artwork and descriptions could not load.'
            : 'Не удалось загрузить иллюстрации и описания героев.'}{' '}
          <button onClick={profiles.retry}>{en ? 'Retry' : 'Повторить'}</button>
        </p>
      ) : profiles.data && profiles.data.clientVersion !== data.meta.clientVersion ? (
        <p role="status">
          {en
            ? 'Hero artwork and descriptions are being updated for this version.'
            : 'Иллюстрации и описания героев обновляются для этой версии.'}
        </p>
      ) : null}
      <div className="expansion-roster">
        <section aria-label={en ? 'Hero portraits' : 'Портреты героев'}>
          <div className="roster-search">
            <label htmlFor="roster-search">{en ? 'Find a hero' : 'Найти героя'}</label>
            <input
              id="roster-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {query && (
              <button onClick={() => setQuery('')}>{en ? 'Clear search' : 'Очистить поиск'}</button>
            )}
          </div>
          <div className="expansion-portraits">
            {heroes.map((h) => {
              const rate = stats.find((s) => s.heroId === h.id)?.winRate;
              return (
                <div className="roster-plate" key={h.id}>
                  <button
                    className="expansion-portrait"
                    aria-pressed={hero?.id === h.id}
                    onMouseEnter={() => pick(h.id)}
                    onFocus={() => pick(h.id)}
                    onClick={() => pick(h.id)}
                    aria-label={`${en ? 'Preview' : 'Показать'} ${h.name}`}
                  >
                    <img src={asset(h.portrait)} alt="" loading="lazy" />
                    <span>{h.name}</span>
                    <strong
                      className={
                        rate == null
                          ? 'roster-rate'
                          : `roster-rate ${rate >= 50 ? 'is-positive' : 'is-negative'}`
                      }
                    >
                      {rate == null ? '—' : `${format(rate, 1)}%`}
                    </strong>
                  </button>
                  <a
                    aria-label={`${en ? 'Details' : 'Подробнее'} ${h.name}`}
                    className="roster-detail-link"
                    href={`#/heroes/${h.slug}`}
                  >
                    {en ? 'Details' : 'Подробнее'}
                    <span className="sr-only"> {h.name}</span>
                  </a>
                </div>
              );
            })}
          </div>
          {!heroes.length && (
            <p>
              {en ? 'No heroes found.' : 'Герои не найдены.'}{' '}
              <button onClick={() => setQuery('')}>{en ? 'Reset search' : 'Сбросить поиск'}</button>
            </p>
          )}
        </section>
        {hero && (
          <aside
            className="expansion-dossier"
            key={hero.id}
            data-arriving={arriving || undefined}
            aria-label={en ? 'Hero preview' : 'Обзор героя'}
          >
            <p className="roster-selected" role="status">
              {en ? 'Selected' : 'Выбран'}: {hero.name}
            </p>
            <h2>{hero.name}</h2>
            <img
              className="hero-roster-art"
              src={
                profile
                  ? referenceMedia(profile.art.background || profile.art.card)
                  : asset(hero.portrait)
              }
              alt=""
            />
            {profile && <p>{profile.summary[language]}</p>}
            <div className="roster-actions">
              <a href={`#/heroes/${hero.slug}`}>
                {en ? 'Open hero dossier' : 'Открыть досье героя'}
              </a>
              <a href={`#/mechanics?hero=${hero.slug}`}>
                {en ? 'Build calculator' : 'Калькулятор билда'}
              </a>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
