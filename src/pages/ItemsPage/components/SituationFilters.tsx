import { useEffect, useState } from 'react';
import {
  Activity,
  Anchor,
  Ban,
  BatteryCharging,
  Check,
  ChevronsUp,
  CirclePause,
  Coins,
  Crosshair,
  Droplets,
  Eraser,
  Expand,
  Eye,
  Flame,
  Footprints,
  Gauge,
  Ghost,
  Hand,
  Heart,
  HeartOff,
  HeartPulse,
  Hourglass,
  Layers,
  Move,
  Package,
  Pickaxe,
  Plus,
  RotateCw,
  Ruler,
  Search,
  Shield,
  ShieldCheck,
  ShieldOff,
  ShieldPlus,
  Skull,
  SlidersHorizontal,
  Snail,
  Sparkles,
  Swords,
  Target,
  Timer,
  TrendingDown,
  Users,
  VolumeX,
  WandSparkles,
  Wind,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import {
  ITEM_FILTER_GROUPS,
  filterItems,
  searchItemProperties,
  type ItemFilters,
} from '../../../../shared/item-filters';
import type { ItemCatalog } from '../../../../shared/item-types';
import { useI18n } from '../../../i18n';

const propertyIcons: Record<string, LucideIcon> = {
  'bullet-resist': Shield,
  'spirit-resist': Sparkles,
  'melee-resist': Swords,
  barrier: ShieldPlus,
  'damage-reduction': ShieldCheck,
  'bullet-immunity': ShieldOff,
  invulnerable: ShieldCheck,
  'death-prevention': HeartPulse,
  'debuff-resist': Timer,
  'slow-resist': Wind,
  cleanse: Eraser,
  'cc-immunity': ShieldCheck,
  'anti-heal': HeartOff,
  'bullet-shred': Crosshair,
  'spirit-shred': Sparkles,
  'damage-suppression': TrendingDown,
  'fire-rate-slow': Gauge,
  silence: VolumeX,
  disarm: Ban,
  curse: Skull,
  'health-damage': Heart,
  reveal: Eye,
  'movement-slow': Snail,
  stun: CirclePause,
  root: Anchor,
  'mobility-lock': Ban,
  'dash-reduction': Footprints,
  'forced-movement': Move,
  'bonus-health': Plus,
  regen: HeartPulse,
  healing: Heart,
  'ally-support': Users,
  'bullet-lifesteal': Droplets,
  'spirit-lifesteal': Droplets,
  'melee-heal': Hand,
  'healing-amp': Activity,
  'antiheal-resist': ShieldPlus,
  'move-speed': Footprints,
  sprint: Wind,
  stamina: BatteryCharging,
  teleport: Zap,
  flight: ChevronsUp,
  stealth: Ghost,
  'weapon-damage': Crosshair,
  'fire-rate': Gauge,
  ammo: Package,
  reload: RotateCw,
  headshot: Target,
  'melee-damage': Swords,
  'weapon-range': Ruler,
  farming: Pickaxe,
  economy: Coins,
  'spirit-power': Flame,
  'spirit-damage': Sparkles,
  cooldown: Timer,
  'ability-range': Expand,
  duration: Hourglass,
  charges: Layers,
  imbue: WandSparkles,
};

export function SituationFilters({
  catalog,
  filters,
  update,
  query,
  setQuery,
}: {
  catalog: ItemCatalog | undefined;
  filters: ItemFilters;
  update: (next: ItemFilters) => void;
  query: string;
  setQuery: (value: string) => void;
}) {
  const { t, language } = useI18n();
  const [expanded, setExpanded] = useState<string[]>(['defense']);
  const selected = filters.tags[0];
  useEffect(() => {
    const group = ITEM_FILTER_GROUPS.find((group) =>
      group.filters.some((filter) => filter.id === selected),
    );
    if (group)
      setExpanded((current) => (current.includes(group.id) ? current : [...current, group.id]));
  }, [selected]);
  const words = query.trim().split(/\s+/).filter(Boolean);
  const matching = new Set(searchItemProperties(query).map((filter) => filter.id));
  const groups = ITEM_FILTER_GROUPS.map((group) => ({
    ...group,
    filters: group.filters.filter((filter) => matching.has(filter.id)),
  })).filter((group) => group.filters.length);
  const select = (id?: string) => update({ ...filters, tags: id ? [id] : [], tagMode: 'all' });
  const count = (id?: string) =>
    catalog
      ? filterItems(catalog.items, { ...filters, tags: id ? [id] : [], tagMode: 'all' }).length
      : 0;
  return (
    <aside className="item-situations" aria-labelledby="item-situations-heading">
      <div className="item-situations-heading">
        <SlidersHorizontal size={22} />
        <h2 id="item-situations-heading">{t('Предметы под ситуацию')}</h2>
      </div>
      <p className="item-situations-hint">{t('Выбери одно свойство для предметов.')}</p>
      <label className="item-property-search">
        <span>{t('Поиск свойств')}</span>
        <span>
          <Search size={17} />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('Например, лечение или броня…')}
          />
        </span>
      </label>
      <button
        className="item-property-tile item-property-all"
        aria-label={t('Все свойства')}
        aria-pressed={!selected}
        onClick={() => select()}
      >
        {!selected ? <Check size={18} /> : <Layers size={18} />}
        <span>{t('Все свойства')}</span>
        <small>{count()}</small>
      </button>
      {groups.length === 0 ? (
        <p className="item-property-empty" role="status">
          {t('Свойства не найдены')}
        </p>
      ) : (
        <div className="item-property-groups">
          {groups.map((group) => (
            <details
              key={group.id}
              open={words.length > 0 || expanded.includes(group.id)}
              onToggle={(event) => {
                if (words.length) return;
                const open = event.currentTarget.open;
                setExpanded((current) =>
                  open
                    ? current.includes(group.id)
                      ? current
                      : [...current, group.id]
                    : current.filter((id) => id !== group.id),
                );
              }}
            >
              <summary>
                <span>{group.label[language]}</span>
                <small>
                  {group.filters.some((filter) => filter.id === selected) ? '● ' : ''}
                  {group.filters.length}
                </small>
              </summary>
              <div className="item-property-tiles" role="group" aria-label={group.label[language]}>
                {group.filters.map((filter) => {
                  const Icon = propertyIcons[filter.id] ?? SlidersHorizontal;
                  return (
                    <button
                      key={filter.id}
                      className="item-property-tile"
                      aria-label={filter.label[language]}
                      aria-pressed={selected === filter.id}
                      title={filter.description[language]}
                      onClick={() => select(filter.id)}
                    >
                      {selected === filter.id ? <Check size={18} /> : <Icon size={18} />}
                      <span>{filter.label[language]}</span>
                      <small>{count(filter.id)}</small>
                    </button>
                  );
                })}
              </div>
            </details>
          ))}
        </div>
      )}
    </aside>
  );
}
