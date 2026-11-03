import type { BuildRules } from '../../../shared/build-types';
import type { ShopItem } from '../../../shared/item-types';
import { Plus, X } from '../../components/ui/ArchiveIcon/ArchiveIcons';
import { useI18n } from '../../i18n';
import { asset, format } from '../../lib/format';

export function BuildInventory({
  slots,
  items,
  rules,
  onChoose,
  onRemove,
}: {
  slots: readonly (number | null)[];
  items: readonly ShopItem[];
  rules: BuildRules;
  onChoose: (index: number) => void;
  onRemove: (index: number) => void;
}) {
  const { t, language } = useI18n();
  return (
    <div className="build-slots">
      {Array.from({ length: rules.maxSlots }, (_, index) => {
        const item = items.find((item) => item.id === slots[index]);
        const name = item?.localizedName[language] || item?.name;
        return (
          <div className={`build-slot ${item?.category ?? ''}`} key={index} data-filled={!!item}>
            <button
              type="button"
              className="build-slot-action"
              aria-label={
                item
                  ? t('Слот {{slot}}: {{item}}. Заменить предмет', { slot: index + 1, item: name })
                  : t('Предмет для слота {{slot}}', { slot: index + 1 })
              }
              onClick={() => onChoose(index)}
            >
              <small className="slot-number">
                {String(index + 1).padStart(2, '0')}
                {index >= rules.baseSlots ? ' +' : ''}
              </small>
              <span className="slot-socket" key={item?.id ?? 'empty'}>
                {item ? <img src={asset(item.icon)} alt="" /> : <Plus size={26} />}
              </span>
              <span className="slot-title">{name || t('Выбрать предмет')}</span>
              {item && (
                <small className="slot-meta">
                  {t('Тир')} {item.tier} · {format(item.cost)}
                </small>
              )}
            </button>
            {item && (
              <button
                type="button"
                className="build-remove"
                aria-label={t('Убрать {{item}}', { item: name })}
                onClick={() => onRemove(index)}
              >
                <X size={17} />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
