import {
  Check,
  Crosshair,
  Eraser,
  HeartOff,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Snail,
  Sparkles,
} from 'lucide-react';
import { ITEM_FILTER_GROUPS, filterItems, type ItemFilters } from '../../../../shared/item-filters';
import type { ItemCatalog } from '../../../../shared/item-types';
import { useI18n } from '../../../i18n';

const commonTags = [
  { id: 'anti-heal', label: 'Антихил', icon: HeartOff },
  { id: 'bullet-resist', label: 'Против пуль', icon: Crosshair },
  { id: 'spirit-resist', label: 'Против спирита', icon: Sparkles },
  { id: 'cleanse', label: 'Снятие дебаффов', icon: Eraser },
  { id: 'cc-immunity', label: 'Защита от контроля', icon: ShieldCheck },
  { id: 'movement-slow', label: 'Замедление', icon: Snail },
];
const definitions = ITEM_FILTER_GROUPS.flatMap((group) => group.filters);
export function SituationFilters({
  catalog,
  filters,
  update,
  query,
  setQuery,
  wide,
}: {
  catalog: ItemCatalog | undefined;
  filters: ItemFilters;
  update: (next: ItemFilters) => void;
  query: string;
  setQuery: (value: string) => void;
  wide: boolean;
}) {
  const { t, language } = useI18n();
  const toggle = (id: string) =>
    update({
      ...filters,
      tags: filters.tags.includes(id)
        ? filters.tags.filter((tag) => tag !== id)
        : [...filters.tags, id],
    });
  const words = query.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
  const groups = ITEM_FILTER_GROUPS.map((group) => ({
    ...group,
    filters: group.filters.filter((filter) => {
      const corpus = [
        filter.label.ru,
        filter.label.en,
        filter.description.ru,
        filter.description.en,
        ...(filter.aliases ?? []),
      ]
        .join(' ')
        .toLocaleLowerCase();
      return words.every((word) => corpus.includes(word));
    }),
  })).filter((group) => group.filters.length);
  const count = (id: string) =>
    catalog
      ? filterItems(catalog.items, {
          ...filters,
          tags: filters.tags.includes(id) ? filters.tags : [...filters.tags, id],
        }).length
      : 0;
  return (
    <aside className="item-situations" aria-labelledby="item-situations-heading">
      <div className="item-situations-heading">
        <SlidersHorizontal size={22} />
        <h2 id="item-situations-heading">{t('Предметы под ситуацию')}</h2>
      </div>
      <p className="item-situations-hint">{t('Выбери, что нужно в матче.')}</p>
      <label className="item-property-search">
        <span>{t('Поиск свойств')}</span>
        <span>
          <Search size={17} />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('Например, лечение или броня…')}
          />
        </span>
      </label>
      <div className="item-shortcuts" role="group" aria-label={t('Частые ситуации')}>
        {commonTags.map(({ id, label, icon: Icon }) => {
          const filter = definitions.find((filter) => filter.id === id)!;
          return (
            <button
              key={id}
              aria-label={t(label)}
              aria-pressed={filters.tags.includes(id)}
              onClick={() => toggle(id)}
              title={filter.description[language]}
            >
              {filters.tags.includes(id) ? <Check size={16} /> : <Icon size={16} />}
              <span>{t(label)}</span>
              <small>{count(id)}</small>
            </button>
          );
        })}
      </div>
      <fieldset className="item-mode">
        <legend>{t('Совпадение свойств')}</legend>
        {(['all', 'any'] as const).map((mode) => (
          <label key={mode}>
            <input
              type="radio"
              name="tagMode"
              checked={filters.tagMode === mode}
              onChange={() => update({ ...filters, tagMode: mode })}
            />
            {t(mode === 'all' ? 'Все выбранные' : 'Любое выбранное')}
          </label>
        ))}
      </fieldset>
      <details className="item-all-properties" open={wide || words.length > 0}>
        <summary>
          <span>{t('Все свойства')}</span>
          <small>{definitions.length}</small>
        </summary>
        {groups.length === 0 ? (
          <p className="item-property-empty" role="status">
            {t('Свойства не найдены')}
          </p>
        ) : (
          <div className="item-filter-groups">
            {groups.map((group) => (
              <details key={group.id} open={words.length > 0}>
                <summary>
                  <span>{group.label[language]}</span>
                  <small>
                    {group.filters.filter((filter) => filters.tags.includes(filter.id)).length ||
                      ''}
                    {group.filters.some((filter) => filters.tags.includes(filter.id)) ? ' / ' : ''}
                    {group.filters.length}
                  </small>
                </summary>
                {group.filters.map((filter) => (
                  <label
                    className="item-tag-option"
                    key={filter.id}
                    title={filter.description[language]}
                  >
                    <input
                      type="checkbox"
                      checked={filters.tags.includes(filter.id)}
                      onChange={() => toggle(filter.id)}
                    />
                    <span>{filter.label[language]}</span>
                    <small>{count(filter.id)}</small>
                  </label>
                ))}
              </details>
            ))}
          </div>
        )}
      </details>
    </aside>
  );
}
