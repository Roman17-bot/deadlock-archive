import { Minus, Plus, RotateCcw } from 'lucide-react';
import { useI18n } from '../../../i18n';
import type { HeroRegisterState } from '../hooks/useHeroRegister';

type Props = Pick<HeroRegisterState, 'level' | 'setLevel' | 'reset'>;

export function LevelToolbar({ level, setLevel, reset }: Props) {
  const { t } = useI18n();
  return (
    <div className="level-toolbar">
      <div className="level-label">
        <span>{t('УРОВЕНЬ ГЕРОЯ')}</span>
        <strong>
          LVL <span>{String(level).padStart(2, '0')}</span>
        </strong>
      </div>
      <div className="level-control">
        <button
          className="level-step"
          aria-label={t('Уменьшить уровень')}
          disabled={level === 1}
          onClick={() => setLevel((n) => n - 1)}
        >
          <Minus size={13} />
        </button>
        <input
          type="range"
          min="1"
          max="36"
          step="1"
          aria-label={t('Уровень героя')}
          value={level}
          onChange={(e) => setLevel(Number(e.target.value))}
          style={{ '--range-progress': `${((level - 1) / 35) * 100}%` } as React.CSSProperties}
        />
        <button
          className="level-step"
          aria-label={t('Увеличить уровень')}
          disabled={level === 36}
          onClick={() => setLevel((n) => n + 1)}
        >
          <Plus size={13} />
        </button>
      </div>
      <p>
        {level === 1 ? t('Базовые параметры') : t('С учётом {{count}} Boons', { count: level - 1 })}
        <span>{t('Без предметов и активных эффектов')}</span>
      </p>
      <button className="reset-button" aria-label={t('Сбросить настройки')} onClick={reset}>
        <RotateCcw size={14} />
        <span>{t('Сбросить')}</span>
      </button>
    </div>
  );
}
