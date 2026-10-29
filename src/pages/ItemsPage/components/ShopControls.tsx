import { Layers, RotateCcw, Shield, Zap } from '../../../components/ui/ArchiveIcon/ArchiveIcons';
import type { ItemCatalog, ItemTier } from '../../../../shared/item-types';
import type { ItemFilters } from '../../../../shared/item-filters';
import { useI18n } from '../../../i18n';
import { format } from '../../../lib/format';

export function ShopControls({
  catalog,
  filters,
  update,
  reset,
  active,
}: {
  catalog: ItemCatalog | undefined;
  filters: ItemFilters;
  update: (next: ItemFilters) => void;
  reset: () => void;
  active: boolean;
}) {
  const { t } = useI18n();
  return (
    <div className="item-shop-controls">
      <fieldset className="item-tier-controls">
        <legend>{t('Тиры')}</legend>
        <div className="item-tier-tiles">
          {([1, 2, 3, 4] as ItemTier[]).map((tier) => {
            const costs = [
              ...new Set(
                catalog?.items.filter((item) => item.tier === tier).map((item) => item.cost) ?? [],
              ),
            ].sort((a, b) => a - b);
            const price =
              costs.length > 1
                ? `${format(costs[0])}–${format(costs[costs.length - 1])}`
                : costs.length
                  ? format(costs[0])
                  : '—';
            return (
              <button
                key={tier}
                className="item-tier-tile"
                aria-label={`${t('Тир')} ${tier}`}
                aria-pressed={filters.tiers.includes(tier)}
                onClick={() =>
                  update({
                    ...filters,
                    tiers: filters.tiers.includes(tier)
                      ? filters.tiers.filter((value) => value !== tier)
                      : [...filters.tiers, tier],
                  })
                }
              >
                <strong>{['I', 'II', 'III', 'IV'][tier - 1]}</strong>
                <span>◈ {price}</span>
              </button>
            );
          })}
        </div>
      </fieldset>
      <fieldset className="item-activation-controls">
        <legend>{t('Активация')}</legend>
        <div className="item-activation-segments">
          {(['all', 'active', 'passive'] as const).map((mode) => {
            const Icon = mode === 'all' ? Layers : mode === 'active' ? Zap : Shield;
            return (
              <button
                key={mode}
                aria-pressed={filters.activation === mode}
                onClick={() => update({ ...filters, activation: mode })}
              >
                <Icon size={17} />
                <span>
                  {t(
                    mode === 'all' ? 'Все предметы' : mode === 'active' ? 'Активные' : 'Пассивные',
                  )}
                </span>
              </button>
            );
          })}
        </div>
      </fieldset>
      <button className={`item-reset${active ? ' has-filters' : ''}`} onClick={reset}>
        <RotateCcw size={18} />
        {t('Сбросить фильтры')}
      </button>
    </div>
  );
}
