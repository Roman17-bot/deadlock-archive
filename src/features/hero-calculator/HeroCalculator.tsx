import { useEffect, useMemo, useState } from 'react';
import type { HeroSnapshot } from '../../../shared/types';
import type { BuildContext } from '../../../shared/build-types';
import { chooseBuildItem } from '../../../shared/build-inventory';
import { calculateBuild } from '../../../shared/build-stats';
import { useItems } from '../items/useItems';
import { useI18n } from '../../i18n';
import { asset, format } from '../../lib/format';
import { PickerDialog } from './PickerDialog';
import { BuildResults } from './BuildResults';
import './HeroCalculator.css';
const categories = ['weapon', 'vitality', 'spirit'] as const;
const categoryNames = { weapon: 'Оружие', vitality: 'Выживаемость', spirit: 'Спирит' };

export default function HeroCalculator({
  data,
  onRule,
}: {
  data: HeroSnapshot;
  onRule: (id: string) => void;
}) {
  const { t, language } = useI18n();
  const { catalog, error, retry } = useItems();
  const [heroId, setHeroId] = useState(data.heroes[0]?.id);
  const [level, setLevel] = useState(1);
  const [levelDraft, setLevelDraft] = useState('1');
  const [slots, setSlots] = useState<(number | null)[]>(() =>
    Array(data.calculatorRules?.maxSlots ?? 0).fill(null),
  );
  const [picker, setPicker] = useState<'hero' | number | null>(null);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [tier, setTier] = useState('all');
  const [notice, setNotice] = useState<{ key: string; removed?: number[] }>();
  const [context, setContext] = useState<BuildContext>({ distance: 15 });
  const hero = data.heroes.find((h) => h.id === heroId) ?? data.heroes[0];
  const rules = data.calculatorRules;
  const items = catalog?.items ?? [];
  const selected = slots.flatMap((id) => {
    const item = items.find((i) => i.id === id);
    return item ? [item] : [];
  });
  const compatible = catalog?.meta.clientVersion === data.meta.clientVersion;
  useEffect(() => {
    if (!catalog || !compatible || !rules) return;
    const known = new Set(catalog.items.map((item) => item.id));
    const next = Array.from({ length: rules.maxSlots }, (_, index) => {
      const id = slots[index];
      return id != null && known.has(id) ? id : null;
    });
    if (next.length !== slots.length || next.some((id, index) => id !== slots[index])) {
      setSlots(next);
      setNotice({ key: 'Сборка обновлена по новому списку предметов.' });
    }
  }, [catalog, compatible, rules, slots]);
  const metadataReady = !!hero?.calculation && items.every((item) => !!item.calculation);
  const calculation = useMemo(() => {
    if (!hero || !rules || !compatible || !metadataReady) return {};
    try {
      return { value: calculateBuild(hero, level, selected, rules, context) };
    } catch {
      return { error: true };
    }
  }, [hero, rules, compatible, metadataReady, level, slots, catalog, context]);
  const result = calculation.value;
  const open = (value: 'hero' | number) => {
    setQuery('');
    setCategory('all');
    setTier('all');
    setPicker(value);
  };
  const name = (item: (typeof items)[number]) => item.localizedName[language] || item.name;
  const validLevel = (raw: string) =>
    raw.trim() !== '' && Number.isInteger(Number(raw)) && Number(raw) >= 1 && Number(raw) <= 36;
  const commitLevel = () => {
    const value = Number(levelDraft);
    const next =
      levelDraft.trim() && Number.isFinite(value)
        ? Math.max(1, Math.min(36, Math.round(value)))
        : level;
    setLevel(next);
    setLevelDraft(String(next));
  };
  const choose = (itemId: number) => {
    if (typeof picker !== 'number' || !rules) return;
    try {
      const currentSlots = Array.from(
        { length: rules.maxSlots },
        (_, index) => slots[index] ?? null,
      );
      const next = chooseBuildItem(currentSlots, picker, itemId, items, rules);
      setSlots(next.slots);
      setNotice(
        next.removed.length
          ? { key: 'Убраны: {{items}}', removed: next.removed }
          : { key: 'Предмет добавлен' },
      );
      setPicker(null);
    } catch (error) {
      setNotice({
        key:
          error instanceof Error
            ? error.message
            : 'Этот предмет не помещается в билд. Проверь повторы и лимит активных предметов.',
      });
    }
  };
  return (
    <div className="hero-build">
      <div className="build-workspace">
        <div className="build-input-sheet">
          <div className="build-toolbar">
            <button
              type="button"
              className="build-hero"
              aria-label={t('Выбрать героя: {{hero}}', { hero: hero?.name ?? '' })}
              onClick={() => open('hero')}
            >
              {hero?.portrait && <img src={asset(hero.portrait)} alt="" />}
              <span>
                <small>{t('Герой')}</small>
                <strong>{hero?.name}</strong>
              </span>
              <span aria-hidden="true">⌄</span>
            </button>
            <label>
              {t('Уровень героя')}
              <input
                type="number"
                min={1}
                max={36}
                value={levelDraft}
                aria-invalid={!validLevel(levelDraft)}
                onChange={(e) => {
                  const raw = e.target.value;
                  setLevelDraft(raw);
                  if (validLevel(raw)) setLevel(Number(raw));
                }}
                onBlur={commitLevel}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    commitLevel();
                  }
                }}
              />
            </label>
            <button
              type="button"
              className="button"
              onClick={() => {
                setSlots(Array(rules?.maxSlots ?? 0).fill(null));
                setNotice({ key: 'Предметы убраны' });
              }}
            >
              {t('Очистить предметы')}
            </button>
          </div>
          {calculation.error && (
            <p role="alert">{t('Не удалось рассчитать билд. Проверь предметы и обнови данные.')}</p>
          )}
          {!rules ? (
            <p>{t('Для этой версии ещё нет параметров билдов.')}</p>
          ) : (
            <>
              <div className="build-heading">
                <h3>{t('Предметы')}</h3>
                <span>
                  {selected.length} / {rules.maxSlots} · {t('Активные')}:{' '}
                  {selected.filter((i) => i.activation === 'active').length} /{' '}
                  {rules.maxActiveItems}
                </span>
              </div>
              {error ? (
                <p role="alert">
                  {t('Не удалось загрузить предметы')}{' '}
                  <button onClick={retry}>{t('Повторить загрузку')}</button>
                </p>
              ) : !catalog ? (
                <p aria-busy="true">{t('Загружаем предметы…')}</p>
              ) : !compatible ? (
                <p role="alert">
                  {t('Версии героев и предметов различаются. Обнови данные перед расчётом.')}{' '}
                  <button onClick={retry}>{t('Повторить загрузку')}</button>
                </p>
              ) : (
                <div className="build-slots">
                  {Array.from({ length: rules.maxSlots }, (_, index) => {
                    const item = items.find((i) => i.id === slots[index]);
                    return (
                      <div className={`build-slot ${item?.category ?? ''}`} key={index}>
                        <button
                          type="button"
                          aria-label={
                            item
                              ? t('Слот {{slot}}: {{item}}. Заменить предмет', {
                                  slot: index + 1,
                                  item: name(item),
                                })
                              : t('Предмет для слота {{slot}}', { slot: index + 1 })
                          }
                          onClick={() => open(index)}
                        >
                          <small>
                            {String(index + 1).padStart(2, '0')}
                            {index >= rules.baseSlots ? ' +' : ''}
                          </small>
                          {item ? (
                            <>
                              <img src={asset(item.icon)} alt="" />
                              <span>{name(item)}</span>
                              <small>
                                {t('Тир')} {item.tier} · {format(item.cost)}
                              </small>
                            </>
                          ) : (
                            <>
                              <b aria-hidden="true">+</b>
                              <span>{t('Выбрать предмет')}</span>
                            </>
                          )}
                        </button>
                        {item && (
                          <button
                            type="button"
                            className="build-remove"
                            aria-label={t('Убрать {{item}}', { item: name(item) })}
                            onClick={() => {
                              setSlots(slots.map((id, i) => (i === index ? null : id)));
                              setNotice({ key: 'Предмет убран' });
                            }}
                          >
                            ×
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
              <p className="build-notice" role="status">
                {notice &&
                  t(notice.key, {
                    items: notice.removed
                      ?.map((id) => {
                        const item = items.find((item) => item.id === id);
                        return item ? name(item) : '';
                      })
                      .join(', '),
                  })}
              </p>
              <details className="build-conditions">
                <summary>{t('Условия расчёта')}</summary>
                <p>
                  {t(
                    'Без временных активаций, накопленных зарядов эффектов и ослаблений врага. Все дополнительные слоты открыты. Урон оружия — попадание в тело без падения урона и перезарядки.',
                  )}
                </p>
                <div className="build-context">
                  {([['versusNPC', 'Против NPC']] as const).map(([key, label]) => (
                    <label key={key}>
                      <input
                        type="checkbox"
                        checked={!!context[key]}
                        onChange={(e) => setContext({ ...context, [key]: e.target.checked })}
                      />
                      {t(label)}
                    </label>
                  ))}
                  <label>
                    {t('Расстояние, м')}
                    <input
                      type="number"
                      min={0}
                      max={1000}
                      value={context.distance ?? 15}
                      onChange={(e) =>
                        setContext({
                          ...context,
                          distance: Math.max(0, Number(e.target.value) || 0),
                        })
                      }
                    />
                  </label>
                </div>
                <fieldset>
                  <legend>{t('Выбранная способность')}</legend>
                  <div className="build-context">
                    {(
                      [
                        ['imbued', 'Усилена предметом'],
                        ['charged', 'Имеет заряды'],
                        ['ultimate', 'Ультимейт'],
                      ] as const
                    ).map(([key, label]) => (
                      <label key={key}>
                        <input
                          type="checkbox"
                          checked={!!context[key]}
                          onChange={(e) => setContext({ ...context, [key]: e.target.checked })}
                        />
                        {t(label)}
                      </label>
                    ))}
                  </div>
                </fieldset>
              </details>
              {catalog && compatible && !metadataReady && (
                <p role="alert">
                  {t('Параметры героя или предметов ещё не готовы для расчёта. Обнови данные.')}
                </p>
              )}
            </>
          )}
        </div>
        {result && rules && (
          <div className="build-output">
            <BuildResults result={result} rules={rules} onRule={onRule} />
          </div>
        )}
      </div>
      {picker !== null && (
        <PickerDialog
          title={
            picker === 'hero'
              ? t('Выбрать героя')
              : t('Предмет для слота {{slot}}', { slot: picker + 1 })
          }
          onClose={() => setPicker(null)}
        >
          <div className="build-picker-tools">
            <label>
              {picker === 'hero' ? t('Найти героя') : t('Найти предмет')}
              <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} />
            </label>
            {picker !== 'hero' && (
              <div className="build-picker-filters">
                <label>
                  {t('Категория')}
                  <select value={category} onChange={(e) => setCategory(e.target.value)}>
                    <option value="all">{t('Все категории')}</option>
                    {categories.map((c) => (
                      <option key={c} value={c}>
                        {t(categoryNames[c])}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  {t('Тир')}
                  <select value={tier} onChange={(e) => setTier(e.target.value)}>
                    <option value="all">{t('Все тиры')}</option>
                    {[1, 2, 3, 4].map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  className="text-link"
                  onClick={() => {
                    setQuery('');
                    setCategory('all');
                    setTier('all');
                  }}
                >
                  {t('Сбросить фильтры')}
                </button>
              </div>
            )}
          </div>
          <div className={`build-picker-results ${picker === 'hero' ? 'heroes' : ''}`}>
            {picker === 'hero'
              ? data.heroes
                  .filter((h) =>
                    `${h.name} ${h.aliases}`
                      .toLocaleLowerCase()
                      .includes(query.toLocaleLowerCase()),
                  )
                  .map((h) => (
                    <button
                      key={h.id}
                      type="button"
                      aria-pressed={h.id === heroId}
                      onClick={() => {
                        setHeroId(h.id);
                        setPicker(null);
                      }}
                    >
                      <img src={asset(h.portrait)} alt="" />
                      <span>{h.name}</span>
                    </button>
                  ))
              : items
                  .filter(
                    (i) =>
                      (category === 'all' || i.category === category) &&
                      (tier === 'all' || i.tier === Number(tier)) &&
                      `${name(i)} ${i.name}`
                        .toLocaleLowerCase()
                        .includes(query.toLocaleLowerCase()),
                  )
                  .map((item) => {
                    let reason = '';
                    try {
                      if (rules)
                        chooseBuildItem(
                          Array.from(
                            { length: rules.maxSlots },
                            (_, index) => slots[index] ?? null,
                          ),
                          picker,
                          item.id,
                          items,
                          rules,
                        );
                    } catch (error) {
                      reason =
                        error instanceof Error
                          ? t(error.message)
                          : t('Повтор или превышен лимит активных предметов');
                    }
                    return (
                      <button
                        type="button"
                        key={item.id}
                        aria-pressed={slots[picker] === item.id}
                        className={item.category}
                        disabled={!!reason}
                        title={reason}
                        onClick={() => choose(item.id)}
                      >
                        <img src={asset(item.icon)} alt="" />
                        <span>
                          <strong>{name(item)}</strong>
                          <small>
                            {t(categoryNames[item.category])} · {t('Тир')} {item.tier}
                            {reason && ` · ${reason}`}
                          </small>
                        </span>
                        <b>{format(item.cost)}</b>
                      </button>
                    );
                  })}
          </div>
          <p className="build-picker-empty">
            {t('Не нашёл предмет или героя? Измени запрос или фильтры.')}
          </p>
        </PickerDialog>
      )}
    </div>
  );
}
