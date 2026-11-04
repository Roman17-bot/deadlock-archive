import { useState } from 'react';
import type { WorldMapCatalogue, WorldMapRouteResult } from '../../../shared/world-map';
import { calculateWorldMapRoute } from '../../../shared/world-map';
import { useI18n } from '../../i18n';
import { format } from '../../lib/format';
import { clockTime, objectName } from './mapLabels';

export interface RouteEntry {
  objectId: string;
  travel: string;
  clear: string;
  count: string;
  available: boolean;
  lastCleared: string;
}
export const routeEntry = (objectId: string): RouteEntry => ({
  objectId,
  travel: '',
  clear: '',
  count: '',
  available: false,
  lastCleared: '',
});
export function FarmRoute({
  map,
  entries,
  setEntries,
  onSelect,
}: {
  map: WorldMapCatalogue;
  entries: RouteEntry[];
  setEntries: (entries: RouteEntry[]) => void;
  onSelect: (id: string) => void;
}) {
  const { language } = useI18n();
  const en = language === 'en';
  const [start, setStart] = useState('5');
  const [side, setSide] = useState('own');
  const [plan, setPlan] = useState('');
  const [hero, setHero] = useState('');
  let result: WorldMapRouteResult | undefined;
  let error = '';
  const ready =
    entries.length > 0 &&
    start.trim() !== '' &&
    entries.every((e) => e.travel.trim() && e.clear.trim());
  if (ready) {
    try {
      result = calculateWorldMapRoute(map, {
        startSeconds: Number(start) * 60,
        stops: entries.map((entry) => ({
          objectId: entry.objectId,
          travelSeconds: Number(entry.travel),
          clearSeconds: Number(entry.clear),
          availableConfirmed: entry.available,
          ...(entry.count.trim() ? { unitCount: Number(entry.count) } : {}),
          ...(entry.lastCleared.trim()
            ? { lastClearedSeconds: Number(entry.lastCleared) * 60 }
            : {}),
        })),
      });
    } catch {
      error = en
        ? 'Check times and creature counts: use positive counts and non-negative times.'
        : 'Проверь время и число существ: количество должно быть положительным, время — неотрицательным.';
    }
  }
  const change = (index: number, field: keyof RouteEntry, value: string | boolean) =>
    setEntries(entries.map((entry, i) => (i === index ? { ...entry, [field]: value } : entry)));
  const move = (index: number, offset: number) => {
    const next = [...entries];
    [next[index], next[index + offset]] = [next[index + offset], next[index]];
    setEntries(next);
  };
  return (
    <section className="map-route" aria-labelledby="farm-route-title">
      <h2 id="farm-route-title">{en ? 'Plan a farming route' : 'План маршрута фарма'}</h2>
      <p>
        {en
          ? 'Choose stops, enter travel and clearing times for your hero and build, and confirm availability. Lines on the map show the order of stops; they do not represent walkable paths.'
          : 'Выбери точки, введи время переходов и зачистки для своего героя и билда, затем подтверди наличие объектов. Линии на карте показывают порядок точек, а не путь через проходы.'}
      </p>
      <div className="map-route-settings">
        <label>
          {en ? 'Starting plan' : 'Пример плана'}
          <select
            value={plan}
            onChange={(e) => {
              setPlan(e.target.value);
              const example = map.routeExamples?.find((r) => r.id === e.target.value);
              if (example) {
                setEntries(example.stopIds.map(routeEntry));
                setStart(String(example.earliestAllFirstSpawnsSeconds / 60));
              }
            }}
          >
            <option value="">{en ? 'Custom route' : 'Свой маршрут'}</option>
            {map.routeExamples?.map((r) => (
              <option key={r.id} value={r.id}>
                {en
                  ? {
                      'west-five': 'West: docks — alleys',
                      'east-eight': 'East: park — theatre',
                      'central-five': 'Centre: camp — department store',
                    }[r.id] || r.side
                  : r.nameRu}
              </option>
            ))}
          </select>
        </label>
        <label>
          {en ? 'Start / min' : 'Старт / мин'}
          <input
            type="number"
            min="0"
            max="240"
            step="0.1"
            value={start}
            onChange={(e) => setStart(e.target.value)}
          />
        </label>
        <label>
          {en ? 'Territory' : 'Территория'}
          <select value={side} onChange={(e) => setSide(e.target.value)}>
            <option value="own">{en ? 'Your side' : 'Своя сторона'}</option>
            <option value="enemy">{en ? 'Enemy side' : 'Сторона противника'}</option>
            <option value="mixed">{en ? 'Both sides' : 'Обе стороны'}</option>
          </select>
        </label>
        <label>
          {en ? 'Hero / build note' : 'Герой / заметка о билде'}
          <input
            value={hero}
            onChange={(e) => setHero(e.target.value)}
            placeholder={en ? 'For your timing estimates' : 'Для оценки времени'}
            maxLength={160}
          />
        </label>
      </div>
      {side !== 'own' && (
        <p className="hero-caption">
          {en
            ? 'Enemy territory adds risk. The estimate cannot predict opponents or guarantee access.'
            : 'Территория противника добавляет риск. Расчёт не предсказывает действия врагов и доступность проходов.'}
        </p>
      )}
      {!entries.length && (
        <p className="hero-empty">
          {en
            ? 'Select a map object and add it here, or choose a starting plan.'
            : 'Выбери объект на карте и добавь его сюда либо открой пример плана.'}
        </p>
      )}
      <ol className="map-route-stops">
        {entries.map((entry, index) => {
          const object = map.objects.find((o) => o.id === entry.objectId)!;
          const stop = result?.stops[index];
          return (
            <li key={`${index}-${entry.objectId}`}>
              <div className="route-stop-heading">
                <button onClick={() => onSelect(entry.objectId)}>
                  {index + 1}. {objectName(object, language)}
                </button>
                <div>
                  <button
                    disabled={index === 0}
                    onClick={() => move(index, -1)}
                    aria-label={`${en ? 'Move up' : 'Выше'}: ${index + 1}`}
                  >
                    ↑
                  </button>
                  <button
                    disabled={index === entries.length - 1}
                    onClick={() => move(index, 1)}
                    aria-label={`${en ? 'Move down' : 'Ниже'}: ${index + 1}`}
                  >
                    ↓
                  </button>
                  <button
                    onClick={() => setEntries(entries.filter((_, i) => i !== index))}
                    aria-label={`${en ? 'Remove stop' : 'Удалить точку'} ${index + 1}`}
                  >
                    ×
                  </button>
                </div>
              </div>
              <div className="route-stop-fields">
                <label>
                  {en ? 'Travel / s' : 'Переход / с'}
                  <input
                    type="number"
                    min="0"
                    max="3600"
                    value={entry.travel}
                    onChange={(e) => change(index, 'travel', e.target.value)}
                  />
                </label>
                <label>
                  {en ? 'Clear / s' : 'Зачистка / с'}
                  <input
                    type="number"
                    min="0"
                    max="3600"
                    value={entry.clear}
                    onChange={(e) => change(index, 'clear', e.target.value)}
                  />
                </label>
                {object.category === 'camps' && (
                  <label>
                    {object.kind === 'vault'
                      ? en
                        ? 'Machines'
                        : 'Автоматов'
                      : en
                        ? 'Creatures'
                        : 'Существ'}
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={entry.count}
                      onChange={(e) => change(index, 'count', e.target.value)}
                    />
                  </label>
                )}
                <label>
                  {en ? 'Last clear / min (optional)' : 'Последняя зачистка / мин (если известна)'}
                  <input
                    type="number"
                    min="0"
                    max="240"
                    value={entry.lastCleared}
                    onChange={(e) => change(index, 'lastCleared', e.target.value)}
                  />
                </label>
                <label className="route-availability">
                  <input
                    type="checkbox"
                    checked={entry.available}
                    onChange={(e) => change(index, 'available', e.target.checked)}
                  />
                  {en ? 'Object available' : 'Объект доступен'}
                </label>
              </div>
              {stop && (
                <p className="hero-caption">
                  {en ? 'Arrival' : 'Прибытие'} {clockTime(stop.arrivalSeconds)} ·{' '}
                  {en ? 'Wait' : 'Ожидание'} {clockTime(stop.waitSeconds)} ·{' '}
                  {en ? 'Finish' : 'Конец'} {clockTime(stop.finishSeconds)} ·{' '}
                  {stop.reward.expectedSouls === null
                    ? en
                      ? 'Reward unknown'
                      : 'Награда неизвестна'
                    : `${format(stop.reward.expectedSouls, 1)} ${en ? 'expected souls' : 'ожидаемых душ'}`}
                </p>
              )}
            </li>
          );
        })}
      </ol>
      {error && <p role="alert">{error}</p>}
      <div className="map-route-result" aria-live="polite">
        {result ? (
          <>
            <strong>
              {result.totalExpectedSouls === null
                ? en
                  ? 'Total reward is not yet known'
                  : 'Общая награда пока неизвестна'
                : `${format(result.totalExpectedSouls, 1)} ${en ? 'expected souls' : 'ожидаемых душ'}`}
            </strong>
            <span>
              {en ? 'Duration' : 'Длительность'} {clockTime(result.elapsedSeconds)} ·{' '}
              {en ? 'Finish' : 'Финиш'} {clockTime(result.finishSeconds)}
            </span>
            {result.totalExpectedSouls === null && (
              <span>
                {en ? 'Known portion' : 'Известная часть'}: {format(result.knownExpectedSouls, 1)}
              </span>
            )}
          </>
        ) : entries.length > 0 ? (
          <p>
            {en
              ? 'Enter all travel and clearing times to calculate.'
              : 'Для расчёта заполни время всех переходов и зачисток.'}
          </p>
        ) : null}
      </div>
      <p className="hero-caption">
        {en
          ? 'This is an estimate, not an optimal route. Soul growth uses configured continuous scaling; rounding, enemy interference, stolen camps and random drops can change the result. Buffs are not converted into souls.'
          : 'Это оценка, а не оптимальный маршрут. Рост душ рассчитан по непрерывной формуле параметров; округление, противники, занятые кемпы и случайный дроп меняют результат. Усиления не переводятся в души.'}
      </p>
    </section>
  );
}
