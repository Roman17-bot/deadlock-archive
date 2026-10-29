import type { ItemCatalog, ItemStatistics, PurchaseSummary } from '../../../shared/item-types';
import type { HeroSnapshot } from '../../../shared/types';
import { useItems } from '../../features/items/useItems';
import { buyTime, categoryNames, itemHref, safeReturn } from '../../features/items/model';
import { ItemContent } from '../../features/items/ItemContent';
import { ItemSkeleton } from '../../features/items/ItemSkeleton';
import { useI18n } from '../../i18n';
import { asset, format } from '../../lib/format';

export function ItemDetailPage({
  slug,
  initialCatalog,
  initialStatistics,
  heroes,
}: {
  slug: string;
  initialCatalog?: ItemCatalog;
  initialStatistics?: ItemStatistics;
  heroes?: HeroSnapshot;
}) {
  const { t, language } = useI18n();
  const { catalog, statistics, statisticsState, error, retry, retryStatistics } = useItems(
    initialCatalog,
    initialStatistics,
    true,
  );
  const returnTo = safeReturn(
    new URLSearchParams(window.location.hash.split('?')[1] ?? '').get('returnTo'),
  );
  const back = (
    <a className="item-back" href={returnTo}>
      ← {t('Назад к предметам')}
    </a>
  );
  if (error)
    return (
      <div className="items-page">
        {back}
        <section className="item-state" role="alert">
          <h1>{t('Не удалось загрузить предметы')}</h1>
          <button className="button" onClick={retry}>
            {t('Повторить загрузку')}
          </button>
        </section>
      </div>
    );
  if (!catalog)
    return (
      <div className="items-page">
        {back}
        <ItemSkeleton variant="detail" />
      </div>
    );
  const item = catalog.items.find((i) => i.slug === slug);
  if (!item)
    return (
      <div className="items-page">
        {back}
        <section className="item-state">
          <h1>{t('Предмет не найден')}</h1>
          <p>{t('Возможно, он больше не продаётся в этой версии.')}</p>
        </section>
      </div>
    );
  const stats = statistics?.items.find((row) => row.itemId === item.id);
  const winrate = (row: PurchaseSummary) =>
    row.matches > 0 ? `${format((row.wins / row.matches) * 100, 1)}%` : '—';
  const relations = (ids: number[], label: string) => {
    const linked = ids.flatMap((id) => catalog.items.filter((i) => i.id === id));
    return (
      linked.length > 0 && (
        <section className="item-relations">
          <h2>{t(label)}</h2>
          <div>
            {linked.map((i) => (
              <a
                className={`item-related ${i.category}`}
                key={i.id}
                href={itemHref(i.slug, returnTo)}
              >
                <img src={asset(i.icon)} alt="" />
                <span>
                  {i.name}
                  <small>◈ {format(i.cost)}</small>
                </span>
              </a>
            ))}
          </div>
        </section>
      )
    );
  };
  const heroRows =
    stats?.heroes
      .flatMap((row) => {
        const hero = heroes?.heroes.find((hero) => hero.id === row.heroId);
        return hero ? [{ ...row, hero }] : [];
      })
      .sort((a, b) => b.matches - a.matches)
      .slice(0, 10) ?? [];
  return (
    <div className={`items-page item-detail ${item.category}`}>
      {back}
      <header className="item-detail-heading">
        <img src={asset(item.icon)} alt="" />
        <div>
          <p className="items-eyebrow">
            {t(categoryNames[item.category])} / {t('Тир')} {item.tier}
          </p>
          <h1>{item.name}</h1>
          {language === 'ru' && item.localizedName.ru !== item.name && (
            <p className="item-local-name">{item.localizedName.ru}</p>
          )}
          <div className="item-detail-meta">
            <span className="item-price">◈ {format(item.cost)}</span>
            <span>
              {t(item.activation === 'active' ? 'Активный предмет' : 'Пассивный предмет')}
            </span>
          </div>
        </div>
      </header>
      <div className="item-detail-columns">
        <div className="item-properties">
          <ItemContent item={item} />
          {item.advice.length > 0 && (
            <section className="item-advice">
              <h2>{t('Когда пригодится')}</h2>
              <ul>
                {item.advice.map((advice, index) => (
                  <li key={index}>{advice[language]}</li>
                ))}
              </ul>
            </section>
          )}
          {relations(item.components, 'Собирается из')}
          {relations(item.upgrades, 'Улучшается до')}
        </div>
        <aside className="item-statistics">
          <p className="items-eyebrow">{t('ПРАКТИКА ПОКУПОК')}</p>
          <h2>{t('Предмет в матчах')}</h2>
          {statisticsState === 'loading' ? (
            <ItemSkeleton variant="statistics" />
          ) : statisticsState === 'error' ? (
            <div>
              <p>{t('Статистика покупок недоступна.')}</p>
              <button className="button" onClick={retryStatistics}>
                {t('Повторить загрузку')}
              </button>
            </div>
          ) : !stats || stats.matches === 0 ? (
            <p>{t('За этот период покупок нет.')}</p>
          ) : (
            <>
              <dl className="item-stat-grid">
                <div>
                  <dt>{t('Победы после покупки')}</dt>
                  <dd>{winrate(stats)}</dd>
                </div>
                <div>
                  <dt>{t('Покупок')}</dt>
                  <dd>{format(stats.matches, 0)}</dd>
                </div>
                <div>
                  <dt>{t('Среднее время покупки')}</dt>
                  <dd>{buyTime(stats.averageBuyTimeSeconds)}</dd>
                </div>
              </dl>
              {heroRows.length > 0 && (
                <section className="item-popular-heroes">
                  <h3>{t('Кто покупает чаще')}</h3>
                  <p>{t('Покупки · победы · время')}</p>
                  <ol>
                    {heroRows.map((row) => (
                      <li key={row.heroId}>
                        <a href={`#/heroes?hero=${encodeURIComponent(row.hero.slug)}`}>
                          <img src={asset(row.hero.portrait)} alt="" />
                          <span>{row.hero.name}</span>
                        </a>
                        <span>
                          {format(row.matches, 0)}
                          <small>
                            {winrate(row)} · {buyTime(row.averageBuyTimeSeconds)}
                          </small>
                        </span>
                      </li>
                    ))}
                  </ol>
                </section>
              )}
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
