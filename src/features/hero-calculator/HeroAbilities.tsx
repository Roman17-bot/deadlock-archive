import { useState } from 'react';
import type { Hero, HeroSnapshot } from '../../../shared/types';
import type { ShopItem } from '../../../shared/item-types';
import type { BuildContext, BuildRules } from '../../../shared/build-types';
import { useI18n } from '../../i18n';
import { useAbilities } from './useAbilities';
import { AbilityCard } from './AbilityCard';
import './HeroAbilities.css';

export function HeroAbilities({
  data,
  hero,
  level,
  items,
  rules,
  context,
  onDemo,
}: {
  data: HeroSnapshot;
  hero: Hero;
  level: number;
  items?: readonly ShopItem[];
  rules?: BuildRules;
  context: BuildContext;
  onDemo?: (abilityId: number, title: string) => void;
}) {
  const { t, language } = useI18n();
  const { catalog, error, mismatch, retry } = useAbilities(data);
  const [ranks, setRanks] = useState<Record<string, number>>({});
  const [targets, setTargets] = useState<Record<string, number>>({});
  const abilities = catalog?.heroes.find((entry) => entry.heroId === hero.id)?.abilities;
  const imbued =
    items?.filter((item) =>
      item.calculation?.modifiers.some((modifier) => modifier.scope === 'imbuedAbility'),
    ) ?? [];
  const itemTargets = (abilityId: number) =>
    imbued.filter((item) => targets[`${hero.id}/${item.id}`] === abilityId).map((item) => item.id);
  const failure = error
    ? 'Не удалось загрузить способности.'
    : mismatch
      ? 'Версии героев и способностей различаются. Обнови данные перед расчётом.'
      : undefined;
  return (
    <section className="build-abilities" aria-labelledby="hero-abilities-heading">
      <h3 id="hero-abilities-heading">{t('Способности героя')}</h3>
      {failure ? (
        <p role="alert">
          {t(failure)}{' '}
          <button type="button" onClick={retry}>
            {t('Повторить загрузку')}
          </button>
        </p>
      ) : !catalog ? (
        <p aria-busy="true">{t('Загружаем способности…')}</p>
      ) : !abilities?.length ? (
        <p>{t('Для этого героя пока нет способностей.')}</p>
      ) : (
        <>
          {(!items || !rules) && (
            <p role="status">{t('Загрузи совместимые предметы для расчёта способностей.')}</p>
          )}
          {imbued.length > 0 && (
            <fieldset className="ability-imbuements">
              <legend>{t('Усиление способностей')}</legend>
              {imbued.map((item) => (
                <label key={item.id}>
                  {item.localizedName[language] || item.name}
                  <select
                    value={targets[`${hero.id}/${item.id}`] ?? ''}
                    onChange={(event) =>
                      setTargets((current) => ({
                        ...current,
                        [`${hero.id}/${item.id}`]: Number(event.target.value),
                      }))
                    }
                  >
                    <option value="">{t('Без усиления')}</option>
                    {abilities.map((ability) => (
                      <option key={ability.id} value={ability.id}>
                        {ability.slot}. {ability.name[language] || ability.name.en}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </fieldset>
          )}
          {abilities.map((ability, index) => (
            <AbilityCard
              key={`${hero.id}/${ability.id}`}
              ability={ability}
              rank={ranks[`${hero.id}/${ability.id}`] ?? 0}
              onRank={(rank) =>
                setRanks((current) => ({ ...current, [`${hero.id}/${ability.id}`]: rank }))
              }
              hero={hero}
              level={level}
              items={items}
              rules={rules}
              context={context}
              imbuedItemIds={itemTargets(ability.id)}
              initiallyOpen={index === 0}
              onDemo={
                onDemo
                  ? () => onDemo(ability.id, ability.name[language] || ability.name.en)
                  : undefined
              }
            />
          ))}
        </>
      )}
    </section>
  );
}
