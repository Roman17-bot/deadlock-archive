import { useEffect, useRef, useState } from 'react';
import type { HeroSnapshot } from '../../../shared/types';
import { loadWorldMap } from '../../services/worldMapApi';
import { referenceMedia } from '../../services/heroReferenceApi';
import { useReference } from '../../features/heroes/useReference';
import { useI18n } from '../../i18n';
import { formatDate } from '../../lib/format';
import { categories, objectName } from './mapLabels';
import { MapObjectCard } from './MapObjectCard';
import { FarmRoute, routeEntry } from './FarmRoute';
import type { RouteEntry } from './FarmRoute';
import './MapPage.css';

export function MapPage({ data }: { data: HeroSnapshot }) {
  const { language } = useI18n();
  const en = language === 'en';
  const reference = useReference(loadWorldMap);
  const [enabled, setEnabled] = useState([
    'camps',
    'objectives',
    'shops',
    'soul_urn_spawns',
    'soul_urn_pads',
  ]);
  const [layer, setLayer] = useState('mid');
  const [selected, setSelected] = useState('');
  const [query, setQuery] = useState('');
  const [minute, setMinute] = useState(10);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [entries, setEntries] = useState<RouteEntry[]>([]);
  const viewport = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; panX: number; panY: number; id: number } | undefined>(
    undefined,
  );
  useEffect(() => {
    const node = viewport.current;
    if (!node) return;
    const wheel = (event: WheelEvent) => {
      if (event.ctrlKey || event.metaKey) return;
      event.preventDefault();
      setZoom((value) => Math.min(5, Math.max(1, value * (event.deltaY > 0 ? 0.9 : 1.1))));
    };
    node.addEventListener('wheel', wheel, { passive: false });
    return () => node.removeEventListener('wheel', wheel);
  }, [reference.data]);
  if (reference.error)
    return (
      <div className="map-page">
        <h1>{en ? 'City map' : 'Карта города'}</h1>
        <p role="alert">
          {en ? 'The map could not be loaded.' : 'Не удалось загрузить карту.'}{' '}
          <button onClick={reference.retry}>{en ? 'Retry' : 'Повторить'}</button>
        </p>
      </div>
    );
  if (!reference.data)
    return (
      <div className="map-page" aria-busy="true">
        {en ? 'Loading the city map…' : 'Загружаем карту города…'}
      </div>
    );
  const map = reference.data;
  if (map.meta.clientVersion !== data.meta.clientVersion)
    return (
      <div className="map-page">
        <h1>{en ? 'City map' : 'Карта города'}</h1>
        <p>
          {en ? 'The map is being updated for this version.' : 'Карта обновляется для этой версии.'}
        </p>
      </div>
    );
  const objects = map.objects.filter(
    (o) =>
      enabled.includes(o.category) &&
      objectName(o, language).toLocaleLowerCase().includes(query.toLocaleLowerCase()),
  );
  const object = map.objects.find((o) => o.id === selected);
  const route = entries.flatMap((e) => map.objects.filter((o) => o.id === e.objectId));
  const choose = (id: string) => setSelected(id);
  return (
    <div className="map-page">
      <header className="map-heading">
        <div>
          <p className="hero-eyebrow">{en ? 'CITY FIELD GUIDE' : 'ПУТЕВОДИТЕЛЬ ПО ГОРОДУ'}</p>
          <h1>{en ? 'Every stop counts' : 'Каждая точка важна'}</h1>
        </div>
        <p>
          {en ? 'Version' : 'Версия'} {map.meta.clientVersion}
          <br />
          {map.meta.checkedAt && formatDate(map.meta.checkedAt)}
        </p>
      </header>
      <div className="map-workspace">
        <aside className="map-filters">
          <h2>{en ? 'Map layers' : 'Слои карты'}</h2>
          <div className="map-layer-actions">
            <button onClick={() => setEnabled(Object.keys(categories))}>
              {en ? 'All' : 'Все'}
            </button>
            <button onClick={() => setEnabled([])}>{en ? 'None' : 'Скрыть'}</button>
          </div>
          <fieldset>
            <legend className="sr-only">{en ? 'Object types' : 'Виды объектов'}</legend>
            {Object.entries(categories).map(([key, info]) => (
              <label key={key}>
                <input
                  type="checkbox"
                  checked={enabled.includes(key)}
                  onChange={() =>
                    setEnabled((current) =>
                      current.includes(key) ? current.filter((c) => c !== key) : [...current, key],
                    )
                  }
                />
                <span aria-hidden="true" style={{ color: info.color }}>
                  {info.glyph}
                </span>
                <span>{info[language]}</span>
                <small>{map.objects.filter((o) => o.category === key).length}</small>
              </label>
            ))}
          </fieldset>
        </aside>
        <div className="map-centre">
          <div className="map-tools">
            <label>
              {en ? 'Background' : 'Подложка'}
              <select value={layer} onChange={(e) => setLayer(e.target.value)}>
                <option value="mid">{en ? 'Streets' : 'Улицы'}</option>
                <option value="mid_tunnels">{en ? 'Tunnels' : 'Тоннели'}</option>
                <option value="rat_tunnels">{en ? 'Rat tunnels' : 'Крысиные тоннели'}</option>
              </select>
            </label>
            <label>
              {en ? 'Match minute' : 'Минута матча'}
              <input
                type="number"
                min="0"
                max="120"
                value={minute}
                onChange={(e) => setMinute(Math.max(0, Math.min(120, Number(e.target.value))))}
              />
            </label>
          </div>
          <div
            className="map-viewport"
            ref={viewport}
            tabIndex={0}
            role="group"
            aria-label={
              en
                ? 'Interactive map. Arrow keys pan; plus and minus zoom. Select objects in the list below.'
                : 'Интерактивная карта. Стрелки — перемещение, плюс и минус — масштаб. Выбор объектов в списке ниже.'
            }
            onKeyDown={(e) => {
              const shifts: Record<string, [number, number]> = {
                ArrowLeft: [40, 0],
                ArrowRight: [-40, 0],
                ArrowUp: [0, 40],
                ArrowDown: [0, -40],
              };
              if (shifts[e.key]) {
                e.preventDefault();
                setPan((p) => ({ x: p.x + shifts[e.key][0], y: p.y + shifts[e.key][1] }));
              }
              if (e.key === '+' || e.key === '=') setZoom((z) => Math.min(5, z + 0.25));
              if (e.key === '-') setZoom((z) => Math.max(1, z - 0.25));
            }}
            onPointerDown={(e) => {
              if ((e.target as Element).closest('[data-marker]')) return;
              drag.current = {
                x: e.clientX,
                y: e.clientY,
                panX: pan.x,
                panY: pan.y,
                id: e.pointerId,
              };
              e.currentTarget.setPointerCapture(e.pointerId);
            }}
            onPointerMove={(e) => {
              if (drag.current?.id === e.pointerId)
                setPan({
                  x: drag.current.panX + e.clientX - drag.current.x,
                  y: drag.current.panY + e.clientY - drag.current.y,
                });
            }}
            onPointerUp={() => {
              drag.current = undefined;
            }}
            onPointerCancel={() => {
              drag.current = undefined;
            }}
          >
            <div
              className="map-drawing"
              style={{ transform: `translate(${pan.x}px,${pan.y}px) scale(${zoom})` }}
            >
              <img
                className="map-base"
                src={referenceMedia(map.images[layer] || map.images.mid)}
                alt=""
                draggable={false}
              />
              <svg className="map-markers" viewBox="0 0 1000 1000" aria-hidden="true">
                {Array.from({ length: 9 }, (_, i) => (
                  <g key={i} className="map-grid-lines">
                    <path d={`M${i * 125} 0V1000 M0 ${i * 125}H1000`} />
                    {i < 8 && (
                      <>
                        <text x={i * 125 + 62} y="22">
                          {String.fromCharCode(65 + i)}
                        </text>
                        <text x="12" y={i * 125 + 70}>
                          {i + 1}
                        </text>
                      </>
                    )}
                  </g>
                ))}
                {route.length > 1 && (
                  <polyline
                    className="map-route-line"
                    points={route.map((o) => `${o.x * 1000},${o.y * 1000}`).join(' ')}
                  />
                )}
                {objects.map((o) => (
                  <g
                    key={o.id}
                    data-marker="true"
                    onClick={() => choose(o.id)}
                    className={`map-marker ${selected === o.id ? 'selected' : ''}`}
                    transform={`translate(${o.x * 1000} ${o.y * 1000})`}
                    style={{ color: categories[o.category]?.color }}
                  >
                    <circle r={selected === o.id ? 16 : 12} />
                    <text y="5">
                      {o.category === 'camps'
                        ? { weak: '1', medium: '2', strong: '3', vault: 'V' }[o.kind ?? ''] || '◆'
                        : categories[o.category]?.glyph}
                    </text>
                    <title>{objectName(o, language)}</title>
                  </g>
                ))}
                {route.map((o, index) => (
                  <g
                    key={`${o.id}-${index}`}
                    className="map-route-number"
                    transform={`translate(${o.x * 1000 + 16} ${o.y * 1000 - 15})`}
                  >
                    <circle r="12" />
                    <text y="5">{index + 1}</text>
                  </g>
                ))}
              </svg>
            </div>
          </div>
          <div className="map-controls">
            {object && (
              <button
                onClick={() => {
                  const title = document.getElementById('map-object-title');
                  title?.scrollIntoView({ block: 'start' });
                  title?.focus({ preventScroll: true });
                }}
              >
                {en ? 'Object details' : 'Подробнее об объекте'}
              </button>
            )}
            <button
              onClick={() => setZoom((z) => Math.min(5, z + 0.25))}
              aria-label={en ? 'Zoom in' : 'Приблизить'}
            >
              +
            </button>
            <output>{Math.round(zoom * 100)}%</output>
            <button
              onClick={() => setZoom((z) => Math.max(1, z - 0.25))}
              aria-label={en ? 'Zoom out' : 'Отдалить'}
            >
              −
            </button>
            <button
              onClick={() => {
                setZoom(1);
                setPan({ x: 0, y: 0 });
              }}
            >
              {en ? 'Reset view' : 'Сбросить вид'}
            </button>
          </div>
          <p className="hero-caption">
            {en
              ? 'Camps: 1 weak · 2 medium · 3 strong · V Sinner machine.'
              : 'Кемпы: 1 слабый · 2 средний · 3 сильный · V жертвенный автомат.'}
          </p>
          <p className="hero-caption">
            {en
              ? 'Drag to pan. Backgrounds do not filter points by floor: object floors are not provided. Choose a point below if markers overlap.'
              : 'Перетаскивай для перемещения. Подложка не отбирает точки по этажу: этажи объектов не указаны. Если значки перекрываются, выбери точку ниже.'}
          </p>
          <div className="map-object-picker">
            <label>
              {en ? 'Find a type or grid cell' : 'Поиск по типу или клетке'}
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={en ? 'Camp, D4…' : 'Кемп, D4…'}
              />
            </label>
            <label>
              {en ? 'Objects shown' : 'Объекты на карте'} · {objects.length}
              <select
                value={objects.some((o) => o.id === selected) ? selected : ''}
                onChange={(e) => choose(e.target.value)}
              >
                <option value="">{en ? 'Select an object' : 'Выбери объект'}</option>
                {objects.map((o, index) => (
                  <option key={o.id} value={o.id}>
                    {objectName(o, language)} · {index + 1}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
        {object ? (
          <MapObjectCard
            map={map}
            object={object}
            minute={minute}
            onAdd={() =>
              setEntries((current) =>
                current.length < 20 ? [...current, routeEntry(object.id)] : current,
              )
            }
          />
        ) : (
          <aside className="map-object-card">
            <h2>{en ? 'Explore the city' : 'Изучай город'}</h2>
            <p>
              {en
                ? 'Select a point to see its rewards and timers or add it to a farming plan.'
                : 'Выбери точку, чтобы узнать награду и таймеры или добавить её в план фарма.'}
            </p>
            <p className="hero-caption">
              {en
                ? 'Solid and outlined crate symbols distinguish tough and normal crates.'
                : 'Залитый и контурный значки отличают крепкие ящики от обычных.'}
            </p>
          </aside>
        )}
      </div>
      <FarmRoute map={map} entries={entries} setEntries={setEntries} onSelect={choose} />
    </div>
  );
}
