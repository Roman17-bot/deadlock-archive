import { useId } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronRight, Info, Search } from 'lucide-react';
import type { HeroSnapshot, SortKey } from '../../../../shared/types';
import { useI18n } from '../../../i18n';
import type { HeroRegisterState } from '../hooks/useHeroRegister';
import { HeroTableRow } from './HeroTableRow';
import { useTableScroll } from '../hooks/useTableScroll';
import { TableScrollNavigation } from './TableScrollNavigation';

type Props = Pick<
  HeroRegisterState,
  | 'level'
  | 'isMobile'
  | 'statView'
  | 'selected'
  | 'visibleColumns'
  | 'activeSortKey'
  | 'activeDirection'
  | 'sort'
  | 'expanded'
  | 'setExpanded'
  | 'setQuery'
> & { data: HeroSnapshot; onMethod: () => void };

export function HeroTable({
  data,
  onMethod,
  level,
  isMobile,
  statView,
  selected,
  visibleColumns,
  activeSortKey,
  activeDirection,
  sort,
  expanded,
  setExpanded,
  setQuery,
}: Props) {
  const { t } = useI18n();
  const tableId = useId();
  const hintId = useId();
  const scroll = useTableScroll(isMobile ? statView : 'all');
  const showNavigation = isMobile && scroll.overflowing && selected.length > 0;
  const icon = (key: SortKey) =>
    activeSortKey !== key ? (
      <ArrowUpDown size={12} />
    ) : activeDirection === 'asc' ? (
      <ArrowUp size={13} />
    ) : (
      <ArrowDown size={13} />
    );
  return (
    <>
      <div className="table-caption">
        <span aria-live="polite">
          {t('В реестре {{selected}} из {{count}} героев', {
            selected: selected.length,
            count: data.heroes.length,
          })}
        </span>
        <div>
          <span className="legend-square" />
          {t('Приросты учитывают усиление от Spirit')}
        </div>
        <button aria-label={t('Как считаем характеристики')} onClick={onMethod}>
          <Info size={14} />
          {t('Как считаем')}
        </button>
      </div>
      <div
        className="table-frame"
        data-stat-view={isMobile ? statView : 'all'}
        data-scroll-left={showNavigation && scroll.canScrollLeft}
        data-scroll-right={showNavigation && scroll.canScrollRight}
      >
        {showNavigation && <TableScrollNavigation tableId={tableId} hintId={hintId} {...scroll} />}
        <div className="table-viewport">
          <div
            className="table-scroll"
            id={tableId}
            ref={scroll.scrollRef}
            tabIndex={0}
            role="region"
            aria-label={t('Таблица характеристик героев')}
            aria-describedby={showNavigation ? hintId : undefined}
          >
            <table aria-label={t('Характеристики героев')}>
              <caption className="sr-only">
                {t('Параметры героев на уровне {{level}}. Нажми на заголовок для сортировки.', {
                  level,
                })}
              </caption>
              <thead>
                <tr>
                  <th
                    className="hero-column"
                    scope="col"
                    aria-sort={
                      activeSortKey === 'name'
                        ? activeDirection === 'asc'
                          ? 'ascending'
                          : 'descending'
                        : 'none'
                    }
                  >
                    <button aria-label={t('Герой: сортировать')} onClick={() => sort('name')}>
                      {t('ГЕРОЙ')}
                      {icon('name')}
                    </button>
                  </th>
                  {visibleColumns.map((column) => (
                    <th
                      key={column.key}
                      scope="col"
                      className={`${column.growth ? 'growth-column' : ''} ${column.key === 'damageGrowth' ? 'growth-first' : ''} ${activeSortKey === column.key ? 'sorted-column' : ''}`}
                      aria-sort={
                        activeSortKey === column.key
                          ? activeDirection === 'asc'
                            ? 'ascending'
                            : 'descending'
                          : 'none'
                      }
                    >
                      <button
                        aria-label={t('{{label}}: сортировать', { label: t(column.label) })}
                        onClick={() => sort(column.key)}
                      >
                        <span>
                          {t(isMobile ? (column.mobileLabel ?? column.label) : column.label)}
                          <small>
                            {t(
                              isMobile
                                ? column.growth
                                  ? ''
                                  : (column.mobileUnit ?? column.unit)
                                : column.unit,
                            )}
                          </small>
                        </span>
                        {icon(column.key)}
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {selected.map((hero, index) => (
                  <HeroTableRow
                    key={hero.id}
                    hero={hero}
                    index={index}
                    level={level}
                    expanded={expanded}
                    setExpanded={setExpanded}
                    visibleColumns={visibleColumns}
                    activeSortKey={activeSortKey}
                  />
                ))}
              </tbody>
            </table>
            {!selected.length && (
              <div className="empty-state">
                <Search size={28} />
                <h2>{t('Таких героев в досье нет')}</h2>
                <p>{t('Попробуй другое имя — можно на русском или английском.')}</p>
                <button className="text-link" onClick={() => setQuery('')}>
                  {t('Показать всех героев')}
                  <ArrowRightFallback />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function ArrowRightFallback() {
  return <ChevronRight size={16} />;
}
