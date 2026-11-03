import { useEffect, useMemo, useRef, useState } from 'react';
import type { BuildRules } from '../../../shared/build-types';
import type { ItemCategory, ShopItem } from '../../../shared/item-types';
import { chooseBuildItem } from '../../../shared/build-inventory';
import {
  Check,
  Crosshair,
  Layers,
  RotateCcw,
  Shield,
  Sparkles,
  Zap,
} from '../../components/ui/ArchiveIcon/ArchiveIcons';
import { useI18n } from '../../i18n';
import { asset, format } from '../../lib/format';
import { PickerDialog } from './PickerDialog';
import './BuildItemPicker.css';

const categories = [
  { id: 'weapon', label: 'Оружие', Icon: Crosshair },
  { id: 'vitality', label: 'Выживаемость', Icon: Shield },
  { id: 'spirit', label: 'Спирит', Icon: Sparkles },
] as const;
const tiers = [1, 2, 3, 4] as const;

export function BuildItemPicker({
  items,
  slots,
  slot,
  rules,
  onChoose,
  onClose,
}: {
  items: readonly ShopItem[];
  slots: readonly (number | null)[];
  slot: number;
  rules: BuildRules;
  onChoose: (id: number) => void;
  onClose: () => void;
}) {
  const { t, language } = useI18n();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<ItemCategory | 'all'>('all');
  const [tier, setTier] = useState<number | 'all'>('all');
  const shop = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (shop.current) {
      shop.current.scrollTop = 0;
      const dialog = shop.current.closest('dialog');
      if (dialog) dialog.scrollTop = 0;
    }
  }, [query, category, tier]);
  const name = (item: ShopItem) => item.localizedName[language] || item.name;
  const choices = useMemo(() => {
    const search = query.trim().toLocaleLowerCase();
    const currentSlots = Array.from({ length: rules.maxSlots }, (_, index) => slots[index] ?? null);
    return items
      .filter(
        (item) =>
          (category === 'all' || item.category === category) &&
          (tier === 'all' || item.tier === tier) &&
          `${item.localizedName[language]} ${item.name}`.toLocaleLowerCase().includes(search),
      )
      .map((item) => {
        let reason = '';
        try {
          chooseBuildItem(currentSlots, slot, item.id, items, rules);
        } catch (error) {
          reason =
            error instanceof Error ? error.message : 'Повтор или превышен лимит активных предметов';
        }
        return { item, reason };
      })
      .sort(
        (a, b) =>
          a.item.tier - b.item.tier ||
          (a.item.localizedName[language] || a.item.name).localeCompare(
            b.item.localizedName[language] || b.item.name,
            language,
          ),
      );
  }, [items, slots, slot, rules, query, category, tier, language]);
  const reset = () => {
    setQuery('');
    setCategory('all');
    setTier('all');
  };

  return (
    <PickerDialog
      title={t('Предмет для слота {{slot}}', { slot: slot + 1 })}
      onClose={onClose}
      className="build-item-picker"
    >
      <div className="item-picker-tools">
        <div className="item-picker-search">
          <label>
            {t('Найти предмет')}
            <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} />
          </label>
          <button type="button" className="button item-picker-reset" onClick={reset}>
            <RotateCcw size={17} />
            {t('Сбросить фильтры')}
          </button>
        </div>
        <div className="item-picker-categories" role="group" aria-label={t('Категория')}>
          <button
            type="button"
            aria-pressed={category === 'all'}
            onClick={() => setCategory('all')}
          >
            <Layers size={19} />
            {t('Все категории')}
          </button>
          {categories.map(({ id, label, Icon }) => (
            <button
              type="button"
              key={id}
              className={id}
              aria-pressed={category === id}
              onClick={() => setCategory(id)}
            >
              <Icon size={19} />
              {t(label)}
            </button>
          ))}
        </div>
        <div className="item-picker-bottom">
          <div className="item-picker-tiers" role="group" aria-label={t('Тир')}>
            <button type="button" aria-pressed={tier === 'all'} onClick={() => setTier('all')}>
              {t('Все тиры')}
            </button>
            {tiers.map((value) => (
              <button
                type="button"
                key={value}
                aria-label={`${t('Тир')} ${value}`}
                aria-pressed={tier === value}
                onClick={() => setTier(value)}
              >
                {['I', 'II', 'III', 'IV'][value - 1]}
              </button>
            ))}
          </div>
          <span className="item-picker-count" role="status">
            {t('Найдено предметов')}: <b>{choices.length}</b>
          </span>
        </div>
      </div>
      <div className="item-picker-shop" ref={shop}>
        {categories.map(({ id, label, Icon }) => {
          const group = choices.filter(({ item }) => item.category === id);
          if (!group.length) return null;
          return (
            <section className={`item-picker-group ${id}`} aria-label={t(label)} key={id}>
              <h4>
                <Icon size={22} />
                {t(label)}
                <span aria-hidden="true">{group.length}</span>
              </h4>
              {tiers.map((value) => {
                const rows = group.filter(({ item }) => item.tier === value);
                if (!rows.length) return null;
                return (
                  <div className="item-picker-tier" key={value}>
                    <h5>
                      {t('Тир')} {value}
                    </h5>
                    <div className="item-picker-grid">
                      {rows.map(({ item, reason }) => (
                        <button
                          type="button"
                          key={item.id}
                          className={`item-picker-tile ${item.category}`}
                          aria-label={[
                            name(item),
                            `${t('Тир')} ${item.tier}`,
                            format(item.cost),
                            item.activation === 'active' ? t('Активный предмет') : '',
                            reason ? t(reason) : '',
                          ]
                            .filter(Boolean)
                            .join('. ')}
                          aria-pressed={slots[slot] === item.id}
                          disabled={!!reason}
                          title={reason ? t(reason) : name(item)}
                          onClick={() => onChoose(item.id)}
                        >
                          <span className="item-picker-art">
                            <img
                              src={asset(item.icon)}
                              alt=""
                              loading="lazy"
                              width={56}
                              height={56}
                            />
                            {item.activation === 'active' && (
                              <span
                                className="item-picker-active"
                                role="img"
                                aria-label={t('Активный предмет')}
                              >
                                <Zap size={16} />
                              </span>
                            )}
                            {slots[slot] === item.id && (
                              <span className="item-picker-selected">
                                <Check size={18} />
                              </span>
                            )}
                          </span>
                          <strong>{name(item)}</strong>
                          <small className="item-picker-price">
                            {t('Тир')} {item.tier}
                            <b>{format(item.cost)}</b>
                          </small>
                          {reason && <small className="item-picker-reason">{t(reason)}</small>}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </section>
          );
        })}
        {!choices.length && (
          <div className="item-picker-empty">
            <p>{t('Ничего не найдено')}</p>
          </div>
        )}
      </div>
    </PickerDialog>
  );
}
