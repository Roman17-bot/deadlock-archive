import { useMemo, useState } from 'react';
import type { HeroSnapshot } from '../../../shared/types';
import { aggregateHeroStats, windowDays } from '../../../shared/hero-reference';
import { useI18n } from '../../i18n';
import { asset, format } from '../../lib/format';
import { loadHeroStatistics } from '../../services/heroReferenceApi';
import { useReference } from '../../features/heroes/useReference';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { Search, X, ChevronRight } from '../../components/ui/ArchiveIcon/ArchiveIcons';
import { HeroShowcase } from './HeroShowcase';
import './HeroRosterPage.css';

export function HeroRosterPage({ data }: { data: HeroSnapshot }) {
  const { language } = useI18n();
  const en = language === 'en';
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(data.heroes[0]?.id);
  const [arriving, setArriving] = useState(false);
  const showPreview = useMediaQuery('(min-width: 1101px)');
  const statistics = useReference(loadHeroStatistics);
  const rates = useMemo(() => {
    const scope = statistics.data?.scopes.find(
      (s) =>
        s.mode === 'all' && s.gameMode === 'normal' && s.rankMin === null && s.rankMax === null,
    );
    return new Map(
      aggregateHeroStats(scope ? windowDays(scope, 7) : []).map((s) => [s.heroId, s.winRate]),
    );
  }, [statistics.data]);
  const heroes = data.heroes.filter((h) =>
    `${h.name} ${h.aliases}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()),
  );
  const hero = data.heroes.find((h) => h.id === selected) ?? data.heroes[0];
  const pick = (id: number) => {
    if (showPreview && selected !== id) {
      setSelected(id);
      setArriving(true);
    }
  };
  return (
    <div className="hero-roster-page expansion-surface">
      <div className="breadcrumbs roster-breadcrumbs">
        <a href="#/">{en ? 'Archive' : 'Архив'}</a>
        <ChevronRight size={12} />
        <a href="#/heroes">{en ? 'Hero register' : 'Реестр героев'}</a>
        <ChevronRight size={12} />
        <span>{en ? 'Heroes' : 'Герои'}</span>
      </div>
      <header className="roster-heading">
        <div className="section-kicker">{en ? 'HERO REGISTER' : 'РЕЕСТР ГЕРОЕВ'}</div>
        <h1>
          {en ? 'Heroes' : 'Герои'}
          <span className="title-star" aria-hidden="true">
            ✦
          </span>
        </h1>
      </header>
      <div className="roster-folder">
        <svg
          className="roster-folder-back"
          viewBox="0 0 1600 90"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <image
            href={asset('assets/roster/dossier-folder.svg')}
            width="1600"
            height="1000"
            preserveAspectRatio="none"
          />
        </svg>
        <section
          className="roster-contact-sheet"
          aria-label={en ? 'Hero portraits' : 'Портреты героев'}
        >
          <div className="roster-sheet-heading">
            <h2>{en ? 'Personal files' : 'Личные дела'}</h2>
            <span aria-live="polite">
              {heroes.length} / {data.heroes.length}
            </span>
          </div>
          <div className="roster-search">
            <label className="sr-only" htmlFor="roster-search">
              {en ? 'Find a hero' : 'Найти героя'}
            </label>
            <Search size={20} />
            <input
              id="roster-search"
              type="search"
              autoComplete="off"
              placeholder={en ? 'Find a hero…' : 'Найти героя…'}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {query && (
              <button
                type="button"
                className="roster-clear"
                onClick={() => setQuery('')}
                aria-label={en ? 'Clear search' : 'Очистить поиск'}
              >
                <X size={18} />
              </button>
            )}
          </div>
          <div className="expansion-portraits">
            {heroes.map((h) => {
              const rate = rates.get(h.id);
              return (
                <div className="roster-plate" key={h.id}>
                  <a
                    className="expansion-portrait"
                    href={`#/heroes/${h.slug}`}
                    data-selected={(showPreview && hero?.id === h.id) || undefined}
                    onMouseEnter={() => pick(h.id)}
                    onFocus={() => pick(h.id)}
                    aria-label={`${en ? 'Open dossier for' : 'Открыть досье:'} ${h.name}`}
                  >
                    <img src={asset(h.portrait)} alt="" loading="lazy" width="96" height="96" />
                    <span className="roster-name">{h.name}</span>
                    <strong
                      className={`roster-rate${rate == null ? '' : rate >= 50 ? ' is-positive' : ' is-negative'}`}
                      title={en ? 'Win rate · last 7 days' : 'Винрейт за неделю'}
                    >
                      {rate == null ? '—' : `${format(rate, 1)}%`}
                    </strong>
                  </a>
                </div>
              );
            })}
          </div>
          {!heroes.length && (
            <div className="roster-empty">
              <p>{en ? 'No heroes found.' : 'Герои не найдены.'}</p>
              <button type="button" onClick={() => setQuery('')}>
                {en ? 'Reset search' : 'Сбросить поиск'}
              </button>
            </div>
          )}
          {statistics.error && (
            <p className="roster-notice" role="alert">
              {en ? 'Match statistics could not load.' : 'Не удалось загрузить статистику матчей.'}{' '}
              <button onClick={statistics.retry}>{en ? 'Retry' : 'Повторить'}</button>
            </p>
          )}
        </section>
        {hero && showPreview && (
          <HeroShowcase hero={hero} data={data} language={language} arriving={arriving} />
        )}
      </div>
    </div>
  );
}
