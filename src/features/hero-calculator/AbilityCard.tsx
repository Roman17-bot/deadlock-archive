import type { AbilityDetails, AbilityUpgrade, HeroAbility } from '../../../shared/ability-types';
import type { EvaluatedAbilityParameter } from '../../../shared/ability-calculation';
import { calculateHeroAbility } from '../../../shared/ability-build';
import { withAbilityLabels } from '../../../shared/ability-display';
import type { Hero } from '../../../shared/types';
import type { ShopItem } from '../../../shared/item-types';
import type { BuildContext, BuildRules } from '../../../shared/build-types';
import { useI18n } from '../../i18n';
import { asset, format } from '../../lib/format';
import { Check, ChevronDown, Plus } from '../../components/ui/ArchiveIcon/ArchiveIcons';

type Props = {
  ability: HeroAbility;
  rank: number;
  onRank: (rank: number) => void;
  hero: Hero;
  level: number;
  items?: readonly ShopItem[];
  rules?: BuildRules;
  context: BuildContext;
  imbuedItemIds: readonly number[];
  initiallyOpen: boolean;
  showOverview?: boolean;
  onDemo?: () => void;
};

export function AbilityCard({
  ability,
  rank,
  onRank,
  hero,
  level,
  items,
  rules,
  context,
  imbuedItemIds,
  initiallyOpen,
  showOverview = false,
  onDemo,
}: Props) {
  const { t, language } = useI18n();
  const localized = (text: { ru: string; en: string }) => text[language] || text.en || text.ru;
  const benefit = (upgrade: AbilityUpgrade, details: AbilityDetails) =>
    localized(upgrade.description) ||
    upgrade.operations
      .map((operation) => {
        const parameter = withAbilityLabels(details).parameters.find(
          (candidate) => candidate.id === operation.property,
        );
        const label = parameter && localized(parameter.label);
        if (!label) return '';
        const action =
          operation.type === 'addScale'
            ? t(
                operation.scaleStat === 'ETechPower'
                  ? 'Множитель спирита'
                  : 'Множитель характеристики',
              )
            : operation.type === 'multiplyScale'
              ? t('Множитель масштаба')
              : operation.type === 'multiplyBase'
                ? t('Умножение базового значения')
                : operation.type === 'set'
                  ? t('Новое значение')
                  : '';
        const value =
          typeof operation.value === 'number' ? format(operation.value) : operation.value;
        const unit =
          typeof operation.value === 'number' &&
          !['addScale', 'multiplyScale', 'multiplyBase'].includes(operation.type)
            ? parameter?.unit?.trim()
            : '';
        const suffix = unit === 's' ? t('с') : unit === 'm' ? t('м') : unit;
        return `${label}: ${action ? `${action} ` : ''}${operation.type.startsWith('add') && Number(operation.value) > 0 ? '+' : ''}${value}${operation.type === 'multiplyBase' ? '%' : suffix ? ` ${suffix}` : ''}`;
      })
      .filter(Boolean)
      .join('; ') ||
    t('Улучшение способности');
  const renderDetails = (
    details: AbilityDetails,
    selectedRank: number,
    ids: readonly number[],
    linked = false,
  ) => {
    details = withAbilityLabels(details);
    if (!items || !rules)
      return (
        <>
          {(!showOverview || linked) && localized(details.description) && (
            <p>{localized(details.description)}</p>
          )}
          {details.sections.map((section, index) => (
            <p key={index}>{localized(section.description)}</p>
          ))}
        </>
      );
    let evaluated: ReturnType<typeof calculateHeroAbility>;
    try {
      evaluated = calculateHeroAbility(details, selectedRank, hero, level, items, rules, {
        ...context,
        imbued: false,
        imbuedItemIds: ids,
      });
    } catch {
      return <p role="alert">{t('Не удалось рассчитать способности. Проверь параметры билда.')}</p>;
    }
    const byId = new Map(evaluated.parameters.map((parameter) => [parameter.id, parameter]));
    const enabled = (parameter: EvaluatedAbilityParameter | undefined) =>
      !!parameter &&
      parameter.available &&
      !(
        parameter.disableValue !== undefined &&
        String(parameter.value) === String(parameter.disableValue)
      ) &&
      !(Number(parameter.value) === 0);
    const visible = (parameter: EvaluatedAbilityParameter | undefined) =>
      !!parameter &&
      parameter.available &&
      parameter.display &&
      parameter.metadata?.m_bIsHidden !== true &&
      !!localized(parameter.label) &&
      !(
        parameter.disableValue !== undefined &&
        String(parameter.value) === String(parameter.disableValue)
      ) &&
      !(
        Number(parameter.value) < 0 &&
        [
          'AbilityCooldown',
          'AbilityCharges',
          'AbilityCooldownBetweenCharge',
          'AbilityCastRange',
          'AbilityChannelTime',
        ].includes(parameter.id)
      ) &&
      !(Number(parameter.value) === 0 && parameter.id !== 'AbilityCooldown');
    const blockIds = (block: AbilityDetails['sections'][number]['blocks'][number]) => {
      const metadata = block.metadata?.properties;
      const references = Array.isArray(metadata) ? metadata : [];
      return block.properties.map((id) => {
        const reference = references.find(
          (entry) => entry && typeof entry === 'object' && entry.important_property === id,
        );
        return reference && typeof reference.status_effect_value === 'string'
          ? reference.status_effect_value
          : id;
      });
    };
    const used = new Set(
      details.sections.flatMap((section) => [
        ...section.properties,
        ...section.blocks.flatMap(blockIds),
      ]),
    );
    const unit = (parameter: EvaluatedAbilityParameter) =>
      parameter.unit === 's'
        ? t('с')
        : parameter.displayUnits === 'EDisplayUnit_MetersPerSecond'
          ? t('м/с')
          : parameter.unit === 'm'
            ? t('м')
            : (parameter.unit ?? '');
    const rows = (ids: readonly string[]) => {
      const parameters = ids
        .map((id) => byId.get(id))
        .filter(visible) as EvaluatedAbilityParameter[];
      if (!parameters.length) return null;
      return (
        <dl className="ability-parameters">
          {parameters.map((parameter) => (
            <div key={parameter.id}>
              <dt>{localized(parameter.label)}</dt>
              <dd>
                {parameter.dependency ? (
                  <span className="ability-dependency">
                    {t(
                      (
                        {
                          weapon: 'Зависит от оружия',
                          melee: 'Зависит от ближнего боя',
                          range: 'Зависит от расстояния',
                          boons: 'Зависит от уровня',
                          custom: 'Особый расчёт',
                          units: 'Особый расчёт',
                        } as const
                      )[parameter.dependency],
                    )}
                  </span>
                ) : (
                  <>
                    {Number(parameter.value) > 0 &&
                      (parameter.metadata?.prefix === '-'
                        ? '−'
                        : parameter.metadata?.prefix === '{s:sign}'
                          ? '+'
                          : '')}
                    {typeof parameter.value === 'number'
                      ? format(parameter.value)
                      : parameter.value}
                    {unit(parameter) && <small> {unit(parameter)}</small>}
                  </>
                )}
              </dd>
            </div>
          ))}
        </dl>
      );
    };
    return (
      <>
        {(!showOverview || linked) && localized(details.description) && (
          <p className="ability-description">{localized(details.description)}</p>
        )}
        {rows(
          details.parameters
            .filter((parameter) => !used.has(parameter.id))
            .map((parameter) => parameter.id),
        )}
        {details.sections.map((section, index) => {
          const required = section.metadata?.property_upgrade_required;
          if (typeof required === 'string' && required && !enabled(byId.get(required))) return null;
          return (
            <div className="ability-section" key={index}>
              {localized(section.description) &&
                localized(section.description) !== localized(details.description) && (
                  <p className="ability-description">{localized(section.description)}</p>
                )}
              {rows(section.properties)}
              {section.blocks.map((block, blockIndex) => (
                <div key={blockIndex}>
                  {localized(block.title) && <h5>{localized(block.title)}</h5>}
                  {rows(blockIds(block))}
                </div>
              ))}
            </div>
          );
        })}
        {linked && details.upgrades.length > 0 && (
          <ul className="ability-upgrade-descriptions">
            {details.upgrades.map((upgrade) => (
              <li key={upgrade.tier}>
                {upgrade.cost} AP · {benefit(upgrade, details)}
              </li>
            ))}
          </ul>
        )}
      </>
    );
  };
  return (
    <details className="build-ability-card" data-testid="ability-card" open={initiallyOpen}>
      <summary className="ability-header">
        {ability.icon ? (
          <img className="ability-icon" src={asset(ability.icon)} alt="" />
        ) : (
          <span className="ability-icon" aria-hidden="true">
            {ability.slot}
          </span>
        )}
        <span>
          <span className="ability-key">
            {t('Способность')} {ability.slot}
          </span>
          <strong>{localized(ability.name)}</strong>
          {showOverview && (
            <>
              <span className="ability-lede">{localized(ability.description)}</span>
              <span className="ability-more">
                <span className="ability-more-closed">
                  {language === 'en' ? 'Details' : 'Подробнее'}
                </span>
                <span className="ability-more-open">
                  {language === 'en' ? 'Collapse' : 'Свернуть'}
                </span>
              </span>
            </>
          )}
        </span>
        <ChevronDown className="ability-disclosure" size={22} />
      </summary>
      <div className="ability-body">
        {onDemo && (
          <button
            className="hero-demo-button"
            type="button"
            onClick={(event) => {
              event.currentTarget.focus();
              onDemo();
            }}
          >
            ▷ {language === 'en' ? 'Watch ability' : 'Посмотреть способность'}
          </button>
        )}
        <fieldset className="ability-upgrades">
          <legend>{t('Улучшения')}</legend>
          {ability.upgrades.map((upgrade) => (
            <button
              key={upgrade.tier}
              type="button"
              aria-pressed={rank >= upgrade.tier}
              aria-label={t('Улучшение за {{cost}} AP: {{benefit}}', {
                cost: upgrade.cost,
                benefit: benefit(upgrade, ability),
              })}
              onClick={() => onRank(rank === upgrade.tier ? rank - 1 : upgrade.tier)}
            >
              {rank >= upgrade.tier ? <Check size={16} /> : <Plus size={16} />} {upgrade.cost} AP
            </button>
          ))}
        </fieldset>
        <div className="ability-rank">
          <span>{t('Ранг {{rank}} из 3', { rank })}</span>
          <button type="button" onClick={() => onRank(0)} disabled={rank === 0}>
            {t('Базовая способность')}
          </button>
        </div>
        {renderDetails(ability, rank, imbuedItemIds)}
        <ul className="ability-upgrade-descriptions">
          {ability.upgrades.map((upgrade) => (
            <li key={upgrade.tier} className={rank >= upgrade.tier ? 'selected' : ''}>
              <strong>{upgrade.cost} AP</strong> · {benefit(upgrade, ability)}
            </li>
          ))}
        </ul>
        {ability.variants.map((variant) => (
          <section className="ability-variant" key={variant.id}>
            <h5>{localized(variant.name)}</h5>
            {renderDetails(
              variant,
              variant.linkUpgrades ? rank : 0,
              variant.linkImbues ? imbuedItemIds : [],
              true,
            )}
          </section>
        ))}
      </div>
    </details>
  );
}
