import type { CSSProperties } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  MoveHorizontal,
} from '../../../components/ui/ArchiveIcon/ArchiveIcons';
import { useI18n } from '../../../i18n';
import type { TableScrollState } from '../hooks/useTableScroll';

type Props = Pick<
  TableScrollState,
  'canScrollLeft' | 'canScrollRight' | 'progress' | 'move' | 'setProgress'
> & {
  tableId: string;
  hintId: string;
};

export function TableScrollNavigation({
  tableId,
  hintId,
  canScrollLeft,
  canScrollRight,
  progress,
  move,
  setProgress,
}: Props) {
  const { t } = useI18n();
  return (
    <div className="table-scroll-navigation" role="group" aria-label={t('Навигация по столбцам')}>
      <strong>
        <MoveHorizontal size={18} aria-hidden="true" />
        {t('Листай характеристики')}
      </strong>
      <p id={hintId}>{t('Урон · DPS · HP · Spirit · Реген.')}</p>
      <div className="table-scroll-controls">
        <button
          aria-label={t('Предыдущие столбцы')}
          aria-controls={tableId}
          disabled={!canScrollLeft}
          onClick={() => move(-1)}
        >
          <ArrowLeft size={20} aria-hidden="true" />
        </button>
        <input
          type="range"
          min="0"
          max="100"
          value={progress}
          aria-label={t('Прокрутка характеристик')}
          aria-controls={tableId}
          style={{ '--table-scroll-progress': `${progress}%` } as CSSProperties}
          onChange={(event) => setProgress(Number(event.target.value))}
        />
        <button
          aria-label={t('Следующие столбцы')}
          aria-controls={tableId}
          disabled={!canScrollRight}
          onClick={() => move(1)}
        >
          <ArrowRight size={20} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
