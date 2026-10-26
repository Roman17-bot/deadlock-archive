import type { HeroStats } from '../../../../shared/types';

export const columns: {
  key: keyof HeroStats;
  label: string;
  unit: string;
  growth?: boolean;
  className?: string;
  mobileLabel?: string;
  mobileUnit?: string;
}[] = [
  {
    key: 'shotDamage',
    label: 'Урон выстрела',
    mobileLabel: 'Урон',
    unit: 'HP',
    className: 'weapon-stat',
  },
  { key: 'dps', label: 'DPS', unit: 'расчётный', mobileUnit: 'HP/с', className: 'weapon-stat' },
  {
    key: 'health',
    label: 'Здоровье',
    mobileLabel: 'HP',
    unit: 'HP',
    mobileUnit: '',
    className: 'health-stat',
  },
  { key: 'spirit', label: 'Spirit', unit: 'мощь', mobileUnit: '', className: 'spirit-stat' },
  {
    key: 'regen',
    label: 'Регенерация',
    mobileLabel: 'Реген.',
    unit: 'HP/с',
    className: 'health-stat',
  },
  { key: 'damageGrowth', label: '+ Урон', unit: 'за уровень', growth: true },
  { key: 'healthGrowth', label: '+ HP', unit: 'за уровень', growth: true },
  { key: 'spiritGrowth', label: '+ Spirit', unit: 'за уровень', growth: true },
  { key: 'regenGrowth', label: '+ Реген.', unit: 'HP/с за LVL', growth: true },
];
