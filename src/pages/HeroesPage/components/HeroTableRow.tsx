import { Info } from 'lucide-react';
import type { Hero } from '../../../../shared/types';
import { statsAtLevel } from '../../../../shared/heroes';
import { asset, format } from '../../../lib/format';
import { useI18n } from '../../../i18n';
import type { HeroRegisterState } from '../hooks/useHeroRegister';
import { HeroNotesRow } from './HeroNotesRow';

type Props = Pick<
  HeroRegisterState,
  'level' | 'expanded' | 'setExpanded' | 'visibleColumns' | 'activeSortKey'
> & { hero: Hero; index: number };

export function HeroTableRow({
  hero,
  index,
  level,
  expanded,
  setExpanded,
  visibleColumns,
  activeSortKey,
}: Props) {
  const { t } = useI18n();
  const stats = statsAtLevel(hero, level);
  return (
    <>
      <tr data-hero={hero.slug} className={expanded === hero.id ? 'expanded-row' : ''}>
        <th className="hero-column" scope="row">
          <button
            className="hero-cell"
            aria-label={t('Примечания: {{hero}}', { hero: hero.name })}
            aria-expanded={expanded === hero.id}
            onClick={() => setExpanded(expanded === hero.id ? null : hero.id)}
          >
            <span className="row-index">{String(index + 1).padStart(2, '0')}</span>
            <img
              src={asset(hero.portrait)}
              alt=""
              width="42"
              height="42"
              loading="lazy"
              onError={(e) => {
                e.currentTarget.style.visibility = 'hidden';
              }}
            />
            <span className="hero-cell-name">
              {hero.name}
              {hero.isNew && <small>{t('НОВЫЙ ГЕРОЙ')}</small>}
            </span>
            <Info className="row-info-icon" size={18} aria-hidden="true" />
          </button>
        </th>
        {visibleColumns.map((column) => (
          <td
            key={column.key}
            data-testid={`stat-${hero.slug}-${column.key}`}
            className={`${column.className ?? ''} ${column.growth ? 'growth-column' : ''} ${column.key === 'damageGrowth' ? 'growth-first' : ''} ${activeSortKey === column.key ? 'sorted-column' : ''}`}
          >
            <span>
              {column.growth && stats[column.key] > 0 ? '+' : ''}
              {format(stats[column.key], column.growth ? 3 : 2)}
            </span>
            {column.key === 'shotDamage' && hero.weapon.projectiles > 1 && (
              <small className="pellet-note">
                {hero.weapon.hitOnce
                  ? t('Одно попадание')
                  : `${hero.weapon.projectiles} × ${format(stats.bulletDamage)}`}
              </small>
            )}
          </td>
        ))}
      </tr>
      {expanded === hero.id && (
        <HeroNotesRow
          hero={hero}
          stats={stats}
          level={level}
          columnCount={visibleColumns.length + 1}
        />
      )}
    </>
  );
}
