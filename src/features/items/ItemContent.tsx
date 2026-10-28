import type { ShopItem } from '../../../shared/item-types';
import { useI18n } from '../../i18n';
export function ItemContent({ item }: { item: ShopItem }) {
  const { language, t } = useI18n();
  const prose = (value: string) => value.replace(/\s+/g, ' ').trim();
  const effectProse = prose(item.effects.map((effect) => effect.description[language]).join(' '));
  const showLead =
    Boolean(prose(item.description[language])) && prose(item.description[language]) !== effectProse;
  const displayValue = (value: string) =>
    language === 'en'
      ? value
      : value.replace(
          /(\d[\d.,]*\s*)(HP\/s|m\/s|m|s)\b/g,
          (_, number: string, unit: string) =>
            number + ({ 'HP/s': 'HP/с', 'm/s': 'м/с', m: 'м', s: 'с' }[unit] ?? unit),
        );
  const attributes = (entries: ShopItem['attributes']) =>
    entries.length > 0 && (
      <dl className="item-attributes">
        {entries.map((a, index) => (
          <div key={`${a.key}-${index}`}>
            <dt>
              {a.label[language]}
              {a.scaling && <small>{a.scaling[language]}</small>}
            </dt>
            <dd>{displayValue(a.value)}</dd>
          </div>
        ))}
      </dl>
    );
  return (
    <>
      {showLead && <p className="item-description">{item.description[language]}</p>}
      {attributes(item.attributes)}
      {item.effects.map((effect, index) => (
        <section className="item-effect" key={index}>
          <h3>{t(effect.kind === 'active' ? 'Активный эффект' : 'Пассивный эффект')}</h3>
          <p>{effect.description[language]}</p>
          {attributes(effect.attributes)}
        </section>
      ))}
    </>
  );
}
