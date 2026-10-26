import { ArrowUpRight } from 'lucide-react';
import type { Hero, HeroStats } from '../../../../shared/types';
import { format } from '../../../lib/format';
import { useI18n, translateDataText } from '../../../i18n';

export function HeroNotesRow({
  hero,
  stats,
  columnCount,
}: {
  hero: Hero;
  stats: HeroStats;
  columnCount: number;
}) {
  const { t } = useI18n();
  return (
    <tr className="details-row">
      <td colSpan={columnCount}>
        <div>
          <strong>{t('{{hero}} / параметры оружия', { hero: hero.name })}</strong>
          <p>
            {t(
              'Пуля или дробина: {{damage}} · Траекторий: {{projectiles}} · Выстрелов в очереди: {{burst}} · Магазин: {{clip}}.',
              {
                damage: format(stats.bulletDamage, 4),
                projectiles: hero.weapon.projectiles,
                burst: hero.weapon.burst,
                clip: hero.weapon.clipSize,
              },
            )}
          </p>
          {hero.weapon.notes.map((note) => (
            <p key={note}>{translateDataText(note)}</p>
          ))}
          <p>
            {t('Прямой прирост пули: +{{growth}} / LVL', {
              growth: format(hero.growth.bulletDamage, 5),
            })}
            {hero.scaling.bulletDamagePerSpirit > 0
              ? t(' · Дополнительно +{{scale}} урона за Spirit.', {
                  scale: format(hero.scaling.bulletDamagePerSpirit, 5),
                })
              : '.'}
          </p>
          <a href={hero.source.weaponUrl} target="_blank" rel="noreferrer">
            {t('Открыть исходные параметры')}
            <ArrowUpRight size={13} />
          </a>
        </div>
      </td>
    </tr>
  );
}
