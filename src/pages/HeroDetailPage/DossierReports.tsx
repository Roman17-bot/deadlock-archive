import { useState } from 'react';
import type { Hero, HeroSnapshot } from '../../../shared/types';
import { asset, format, formatDate } from '../../lib/format';
import { loadHeroStatistics } from '../../services/heroReferenceApi';
import { useReference } from '../../features/heroes/useReference';
import { useItems } from '../../features/items/useItems';
import { buyTime } from '../../features/items/model';
import type { Language } from '../../i18n';
import { ChevronDown, Swords, Target, Users } from '../../components/ui/ArchiveIcon/ArchiveIcons';

export function DossierHeroLink({ hero, label = hero.name }: { hero: Hero; label?: string }) {
  return (
    <a className="hero-inline-link" href={`#/heroes/${hero.slug}`}>
      <img src={asset(hero.portrait)} alt="" loading="lazy" />
      {label}
    </a>
  );
}

export function DossierMatchups({
  hero,
  data,
  en,
}: {
  hero: Hero;
  data: HeroSnapshot;
  en: boolean;
}) {
  const stats = useReference(loadHeroStatistics);
  const roster = new Map(data.heroes.map((entry) => [entry.id, entry]));
  const opponents = (stats.data?.matchups.rows ?? [])
    .filter(
      (row) =>
        row.heroId === hero.id &&
        roster.has(row.enemyHeroId) &&
        row.matches >= (stats.data?.matchups.minMatches ?? 100),
    )
    .map((row) => ({ id: row.enemyHeroId, matches: row.matches, rate: row.wins / row.matches }))
    .sort((a, b) => a.rate - b.rate || b.matches - a.matches);
  const allies = (stats.data?.synergies.rows ?? [])
    .filter((row) => row.heroId1 === hero.id || row.heroId2 === hero.id)
    .map((row) => ({
      id: row.heroId1 === hero.id ? row.heroId2 : row.heroId1,
      matches: row.matches,
      wins: row.wins,
    }))
    .filter((row) => roster.has(row.id) && row.matches >= (stats.data?.synergies.minMatches ?? 100))
    .map((row) => ({ ...row, rate: row.wins / row.matches }))
    .sort((a, b) => b.rate - a.rate || b.matches - a.matches)
    .slice(0, 5);
  const columns = [
    {
      kind: 'allies',
      title: en ? 'Wins more often with' : 'С кем чаще побеждает',
      icon: Users,
      rows: allies,
    },
    {
      kind: 'difficult',
      title: en ? 'Difficult opponents' : 'Сложные соперники',
      icon: Swords,
      rows: opponents.filter((row) => row.rate < 0.5).slice(0, 5),
    },
    {
      kind: 'favorable',
      title: en ? 'Favorable opponents' : 'Чаще побеждает против',
      icon: Target,
      rows: opponents
        .filter((row) => row.rate > 0.5)
        .sort((a, b) => b.rate - a.rate || b.matches - a.matches)
        .slice(0, 5),
    },
  ];
  return (
    <section className="dossier-section" aria-labelledby="dossier-matchups-title">
      <div className="dossier-section-heading">
        <h2 id="dossier-matchups-title">{en ? 'Allies and opponents' : 'Союзники и соперники'}</h2>
        {stats.data && (
          <span className="hero-caption">
            {formatDate(stats.data.matchups.from)} — {formatDate(stats.data.matchups.to)}
          </span>
        )}
      </div>
      {stats.error ? (
        <p role="alert" className="dossier-notice">
          {en ? 'Match statistics unavailable.' : 'Статистика матчей недоступна.'}{' '}
          <button onClick={stats.retry}>{en ? 'Retry' : 'Повторить'}</button>
        </p>
      ) : !stats.data ? (
        <p className="hero-caption" aria-busy="true">
          {en ? 'Loading matchups…' : 'Загружаем матчапы…'}
        </p>
      ) : (
        <div className="dossier-matchup-grid">
          {columns.map(({ kind, title, icon: Icon, rows }) => (
            <section className="dossier-matchup" data-kind={kind} key={kind}>
              <h3>
                <Icon size={20} />
                {title}
              </h3>
              {rows.length ? (
                <ul className="hero-pair-list">
                  {rows.map((row) => (
                    <li key={row.id}>
                      <DossierHeroLink hero={roster.get(row.id)!} />
                      <span>
                        <strong>{format(row.rate * 100, 1)}%</strong>
                        <small>
                          {format(row.matches, 0)} {en ? 'matches' : 'матчей'}
                        </small>
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="dossier-matchup-empty">
                  {en ? 'No qualifying results.' : 'Пока нет подходящих результатов.'}
                </p>
              )}
            </section>
          ))}
        </div>
      )}
    </section>
  );
}

export function DossierPurchases({
  hero,
  data,
  language,
}: {
  hero: Hero;
  data: HeroSnapshot;
  language: Language;
}) {
  const en = language === 'en';
  const items = useItems(undefined, undefined, true);
  const [expanded, setExpanded] = useState(false);
  const stats =
    items.statistics?.meta.clientVersion === data.meta.clientVersion ? items.statistics : undefined;
  const catalog = new Map(items.catalog?.items.map((item) => [item.id, item]));
  const purchases = (stats?.items ?? [])
    .flatMap((item) => {
      const row = item.heroes.find((record) => record.heroId === hero.id);
      const info = catalog.get(item.itemId);
      return row && row.matches > 0 && info ? [{ ...row, info }] : [];
    })
    .sort((a, b) => b.matches - a.matches || a.info.id - b.info.id)
    .slice(0, 24);
  const headings = en
    ? ['Item', 'Matches with item', 'Average purchase', 'Win rate']
    : ['Предмет', 'Матчей с предметом', 'Среднее время покупки', 'Винрейт'];
  return (
    <section className="dossier-section" aria-labelledby="dossier-purchases-title">
      <div className="dossier-section-heading">
        <h2 id="dossier-purchases-title">{en ? 'Frequently bought items' : 'Частые предметы'}</h2>
        {stats && (
          <span className="hero-caption">
            {formatDate(stats.meta.from)} — {formatDate(stats.meta.to)}
          </span>
        )}
      </div>
      {items.error || items.statisticsState === 'error' ? (
        <p role="alert" className="dossier-notice">
          {en ? 'Item statistics unavailable.' : 'Статистика предметов недоступна.'}{' '}
          <button onClick={items.retry}>{en ? 'Retry' : 'Повторить'}</button>
        </p>
      ) : items.statisticsState === 'loading' ? (
        <p className="hero-caption" aria-busy="true">
          {en ? 'Loading purchases…' : 'Загружаем покупки…'}
        </p>
      ) : purchases.length ? (
        <>
          <div className="dossier-ledger-scroll">
            <table className="dossier-ledger" aria-labelledby="dossier-purchases-title">
              <thead>
                <tr>
                  {headings.map((heading) => (
                    <th key={heading} scope="col">
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {purchases.slice(0, expanded ? 24 : 12).map((row) => (
                  <tr key={row.info.id} className={row.info.category}>
                    <td>
                      <a
                        href={`#/items/${row.info.slug}?returnTo=${encodeURIComponent(`#/heroes/${hero.slug}`)}`}
                      >
                        <img src={asset(row.info.icon)} alt="" loading="lazy" />
                        <strong>{row.info.localizedName[language] || row.info.name}</strong>
                      </a>
                    </td>
                    {[
                      format(row.matches, 0),
                      buyTime(row.averageBuyTimeSeconds),
                      `${format((row.wins / row.matches) * 100, 1)}%`,
                    ].map((value, index) => (
                      <td key={headings[index + 1]}>
                        <span className="dossier-ledger-metric">
                          <span className="dossier-ledger-mobile-label" aria-hidden="true">
                            {headings[index + 1]}
                          </span>
                          <span>{value}</span>
                        </span>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {purchases.length > 12 && (
            <button
              type="button"
              className="dossier-more-items"
              aria-expanded={expanded}
              onClick={() => setExpanded((current) => !current)}
            >
              {expanded
                ? en
                  ? 'Show fewer items'
                  : 'Свернуть список'
                : en
                  ? `Show ${purchases.length - 12} more items`
                  : `Показать ещё ${purchases.length - 12}`}
              <ChevronDown size={18} />
            </button>
          )}
        </>
      ) : (
        <p className="hero-caption">
          {en ? 'No purchase data yet.' : 'Данных о покупках пока нет.'}
        </p>
      )}
    </section>
  );
}
