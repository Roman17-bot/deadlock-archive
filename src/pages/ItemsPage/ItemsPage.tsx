import { useEffect, useState } from 'react';
import {
  Check,
  Crosshair,
  Search,
  Shield,
  Sparkles,
  X,
  Zap,
  Layers,
} from '../../components/ui/ArchiveIcon/ArchiveIcons';
import type { ItemCatalog, ItemTier, ShopItem } from '../../../shared/item-types';
import {
  EMPTY_ITEM_FILTERS,
  ITEM_FILTER_GROUPS,
  filterItems,
  type ItemFilters,
} from '../../../shared/item-filters';
import { useItems } from '../../features/items/useItems';
import {
  categories,
  categoryNames,
  filtersHash,
  itemHref,
  readFilters,
  normalizeItemFilters,
} from '../../features/items/model';
import { ItemContent } from '../../features/items/ItemContent';
import { ItemSkeleton } from '../../features/items/ItemSkeleton';
import { useI18n } from '../../i18n';
import { asset, format } from '../../lib/format';
import { useResultMotion } from '../../hooks/useResultMotion';

import { ShopControls } from './components/ShopControls';
import { SituationFilters } from './components/SituationFilters';

const categoryIcons = { weapon: Crosshair, vitality: Shield, spirit: Sparkles };

function ItemCard({ item, returnTo }: { item: ShopItem; returnTo: string }) {
  const { t, language } = useI18n();
  const [preview, setPreview] = useState(false);
  const [previewLeft, setPreviewLeft] = useState(0);
  const [previewAbove, setPreviewAbove] = useState(false);
  const [previewHeight, setPreviewHeight] = useState(400);
  const openPreview = (element: HTMLElement) => {
    const { left, top, bottom } = element.getBoundingClientRect();
    const width = Math.min(360, window.innerWidth - 48);
    setPreviewLeft(Math.max(24, Math.min(left, window.innerWidth - width - 24)) - left);
    const above = top > window.innerHeight - bottom;
    setPreviewAbove(above);
    setPreviewHeight(Math.max(160, (above ? top : window.innerHeight - bottom) - 24));
    setPreview(true);
  };
  useEffect(() => {
    if (!preview) return;
    const dismiss = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPreview(false);
    };
    document.addEventListener('keydown', dismiss);
    return () => document.removeEventListener('keydown', dismiss);
  }, [preview]);
  return (
    <div
      className="shop-card-wrap"
      onMouseEnter={(event) => openPreview(event.currentTarget)}
      onMouseLeave={() => setPreview(false)}
    >
      <a
        className="shop-card"
        href={itemHref(item.slug, returnTo)}
        onFocus={(event) => openPreview(event.currentTarget)}
        onBlur={() => setPreview(false)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') setPreview(false);
        }}
        aria-describedby={preview ? `preview-${item.id}` : undefined}
      >
        <img src={asset(item.icon)} alt="" loading="lazy" />
        <span className="shop-card-name">
          <strong>{item.name}</strong>
          {language === 'ru' && item.localizedName.ru !== item.name && (
            <small>{item.localizedName.ru}</small>
          )}
          <span className="item-price">◈ {format(item.cost)}</span>
        </span>
        {item.activation === 'active' && (
          <span className="item-active" title={t('Активный эффект')}>
            <Zap size={14} />
            <span className="sr-only">{t('Активный эффект')}</span>
          </span>
        )}
      </a>
      {preview && (
        <div
          className="item-preview"
          role="tooltip"
          id={`preview-${item.id}`}
          style={{
            left: previewLeft,
            right: 'auto',
            top: previewAbove ? 'auto' : '100%',
            bottom: previewAbove ? '100%' : 'auto',
            maxHeight: previewHeight,
            overflowY: 'auto',
          }}
        >
          <div className="item-preview-heading">
            <strong>{item.name}</strong>
            <span>◈ {format(item.cost)}</span>
          </div>
          <ItemContent item={item} />
        </div>
      )}
    </div>
  );
}

export function ItemsPage({ initialCatalog }: { initialCatalog?: ItemCatalog }) {
  const { t, language } = useI18n();
  const [propertyQuery, setPropertyQuery] = useState('');
  const { catalog, error, retry } = useItems(initialCatalog);
  const [filters, setFilters] = useState<ItemFilters>(readFilters);
  const selectionKey = JSON.stringify([
    filters.categories,
    filters.tiers,
    filters.tags,
    filters.activation,
  ]);
  const resultsRef = useResultMotion(selectionKey);
  useEffect(() => {
    const changed = () => {
      if (!/^#\/items(?:\?|$)/.test(window.location.hash)) return;
      const recovered = readFilters();
      setFilters(recovered);
      const canonical = filtersHash(recovered);
      if (window.location.hash !== canonical) window.history.replaceState(null, '', canonical);
    };
    changed();
    window.addEventListener('hashchange', changed);
    return () => window.removeEventListener('hashchange', changed);
  }, []);
  const update = (next: ItemFilters) => {
    const normalized = normalizeItemFilters(next);
    setFilters(normalized);
    window.history.replaceState(null, '', filtersHash(normalized));
  };
  const toggle = <T,>(values: T[], value: T) =>
    values.includes(value) ? values.filter((v) => v !== value) : [...values, value];
  const items = catalog ? filterItems(catalog.items, filters) : [];
  const definitions = ITEM_FILTER_GROUPS.flatMap((group) => group.filters);
  const chipLabels = [
    ...filters.categories.map((id) => ({
      id: `category-${id}`,
      label: t(categoryNames[id]),
      remove: () => update({ ...filters, categories: toggle(filters.categories, id) }),
    })),
    ...filters.tiers.map((id) => ({
      id: `tier-${id}`,
      label: `${t('Тир')} ${id}`,
      remove: () => update({ ...filters, tiers: toggle(filters.tiers, id) }),
    })),
    ...filters.tags.map((id) => ({
      id,
      label: definitions.find((f) => f.id === id)?.label[language] ?? id,
      remove: () => update({ ...filters, tags: toggle(filters.tags, id) }),
    })),
    ...(filters.activation !== 'all'
      ? [
          {
            id: 'activation',
            label: t(filters.activation === 'active' ? 'Активные' : 'Пассивные'),
            remove: () => update({ ...filters, activation: 'all' }),
          },
        ]
      : []),
  ];
  return (
    <div className="items-page item-catalog-page">
      <header className="items-heading">
        <p className="items-eyebrow">{t('СНАРЯЖЕНИЕ / МАГАЗИН')}</p>
        <h1>{t('Предметы')}</h1>
        <p>{t('Подбери снаряжение под свою игру.')}</p>
      </header>
      <div className="item-catalog-layout">
        <div className="item-catalog-tools">
          <div className="items-search">
            <Search size={21} />
            <input
              type="search"
              aria-label={t('Поиск предметов')}
              placeholder={t('Название или свойство предмета…')}
              value={filters.query}
              onChange={(event) => update({ ...filters, query: event.target.value })}
            />
          </div>
          <div className="item-category-filters" role="group" aria-label={t('Категории')}>
            <button
              className="item-category-button item-category-all"
              aria-pressed={filters.categories.length === 0}
              onClick={() => update({ ...filters, categories: [] })}
            >
              <Layers className="item-category-icon" size={23} />
              <span>{t('Все категории')}</span>
              <Check className="item-category-check" size={17} />
            </button>
            {categories.map((category) => {
              const Icon = categoryIcons[category];
              return (
                <button
                  key={category}
                  className={`item-category-button ${category}`}
                  aria-pressed={filters.categories.includes(category)}
                  onClick={() => update({ ...filters, categories: [category] })}
                >
                  <Icon className="item-category-icon" size={23} />
                  <span>{t(categoryNames[category])}</span>
                  <Check className="item-category-check" size={17} />
                </button>
              );
            })}
          </div>
          <ShopControls
            catalog={catalog}
            filters={filters}
            update={update}
            active={chipLabels.length > 0 || !!filters.query || !!propertyQuery}
            reset={() => {
              update({ ...EMPTY_ITEM_FILTERS });
              setPropertyQuery('');
            }}
          />
        </div>
        <SituationFilters
          catalog={catalog}
          filters={filters}
          update={update}
          query={propertyQuery}
          setQuery={setPropertyQuery}
        />
        <div className="item-catalog-results" ref={resultsRef}>
          {(chipLabels.length > 0 || filters.query) && (
            <div className="item-selected">
              {chipLabels.map((chip) => (
                <button key={chip.id} onClick={chip.remove}>
                  {chip.label}
                  <X size={13} />
                  <span className="sr-only">{t('Убрать условие')}</span>
                </button>
              ))}
            </div>
          )}
          {error ? (
            <div className="item-state" role="alert">
              <h2>{t('Не удалось загрузить предметы')}</h2>
              <button className="button" onClick={retry}>
                {t('Повторить загрузку')}
              </button>
            </div>
          ) : !catalog ? (
            <ItemSkeleton variant="catalog" />
          ) : (
            <>
              <p className="item-results" role="status">
                {t('Найдено предметов')}: {items.length}
              </p>
              {items.length === 0 ? (
                <section className="item-state">
                  <h2>{t('Ничего не найдено')}</h2>
                  <p>{t('Убери часть условий или попробуй другое название.')}</p>
                </section>
              ) : (
                <div className="shop-columns">
                  {categories
                    .filter((category) => items.some((i) => i.category === category))
                    .map((category) => (
                      <section className={`shop-category ${category}`} key={category}>
                        <header>
                          <span
                            className="catalog-selection-line"
                            key={selectionKey}
                            aria-hidden="true"
                          />
                          {(() => {
                            const Icon = categoryIcons[category];
                            return <Icon size={23} />;
                          })()}
                          <h2>{t(categoryNames[category])}</h2>
                          <span>{items.filter((i) => i.category === category).length}</span>
                        </header>
                        {([1, 2, 3, 4] as ItemTier[]).map((tier) => {
                          const rows = items.filter(
                            (i) => i.category === category && i.tier === tier,
                          );
                          return (
                            rows.length > 0 && (
                              <section
                                className="shop-tier"
                                key={tier}
                                style={{ gridRow: tier + 1 }}
                              >
                                <h3>
                                  <span>
                                    {t('Тир')} {tier}
                                  </span>
                                  <span>{rows.length}</span>
                                </h3>
                                <div className="shop-tier-grid">
                                  {rows.map((item) => (
                                    <ItemCard
                                      key={item.id}
                                      item={item}
                                      returnTo={filtersHash(filters)}
                                    />
                                  ))}
                                </div>
                              </section>
                            )
                          );
                        })}
                      </section>
                    ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
