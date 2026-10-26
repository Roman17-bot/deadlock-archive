import { ArrowUpRight } from 'lucide-react';
import type { Hero } from '../../../../shared/types';
import { translateDataText, useI18n } from '../../../i18n';
import { format } from '../../../lib/format';
import { HeroNoteMetric } from './HeroNoteMetrics';

export function HeroSourceNotes({ hero }: { hero: Hero }) {
  const { t } = useI18n();
  return (
    <details className="hero-notes-source">
      <summary>{t('Исходные данные и оговорки')}</summary>
      <p>{t('Это расчёт по снимку параметров, а не замер в игре.')}</p>
      {hero.weapon.hitOnce && (
        <p>
          {t(
            'Рабочая модель по данным и наблюдениям игроков; это не проверка игрового движка. Особые режимы требуют отдельного расчёта.',
          )}
        </p>
      )}
      <dl className="hero-notes-source-parameters">
        <HeroNoteMetric label={t('Класс оружия в файле')}>
          <code>{hero.weapon.className}</code>
        </HeroNoteMetric>
        <HeroNoteMetric label={t('Траекторий в данных')}>
          {format(hero.weapon.projectiles)}
        </HeroNoteMetric>
        <HeroNoteMetric label={t('Выстрелов в очереди в данных')}>
          {format(hero.weapon.burst)}
        </HeroNoteMetric>
        <HeroNoteMetric label={t('Интервал между циклами')}>
          {format(hero.weapon.cycleTime, 5)} {t('с')}
        </HeroNoteMetric>
        <HeroNoteMetric label={t('Интервал внутри очереди')}>
          {format(hero.weapon.intraBurstTime, 5)} {t('с')}
        </HeroNoteMetric>
        <HeroNoteMetric label={t('Перезарядка в данных')}>
          {format(hero.weapon.reloadSeconds, 5)} {t('с')}
        </HeroNoteMetric>
      </dl>
      <p>
        {t(
          'Это параметры снимка. Значение перезарядки само по себе не описывает полный цикл поштучной загрузки.',
        )}
      </p>
      <ul>
        {hero.weapon.notes.map((note) => (
          <li key={note}>{translateDataText(note)}</li>
        ))}
      </ul>
      <a href={hero.source.weaponUrl} target="_blank" rel="noreferrer">
        {t('Открыть исходные параметры')}
        <ArrowUpRight size={13} />
      </a>
    </details>
  );
}
