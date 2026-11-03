import { useState } from 'react';
import type { Hero } from '../../../shared/types';
import { ChevronDown, RotateCcw } from '../../components/ui/ArchiveIcon/ArchiveIcons';
import { useI18n } from '../../i18n';
import { asset } from '../../lib/format';

export function BuildHeroControls({
  hero,
  level,
  onLevel,
  onHero,
  onClear,
}: {
  hero: Hero | undefined;
  level: number;
  onLevel: (level: number) => void;
  onHero: () => void;
  onClear: () => void;
}) {
  const { t } = useI18n();
  const [draft, setDraft] = useState(String(level));
  const valid = (raw: string) =>
    raw.trim() !== '' && Number.isInteger(Number(raw)) && Number(raw) >= 1 && Number(raw) <= 36;
  const commit = () => {
    const numeric = Number(draft);
    const next =
      draft.trim() && Number.isFinite(numeric)
        ? Math.max(1, Math.min(36, Math.round(numeric)))
        : level;
    setDraft(String(next));
    onLevel(next);
  };
  return (
    <div className="build-toolbar">
      <button
        type="button"
        className="build-hero"
        aria-label={t('Выбрать героя: {{hero}}', { hero: hero?.name ?? '' })}
        onClick={onHero}
      >
        {hero?.portrait && <img src={asset(hero.portrait)} alt="" />}
        <span className="build-hero-name">
          <small>{t('Герой')}</small>
          <strong>{hero?.name}</strong>
        </span>
        <span className="hero-chevron">
          <ChevronDown size={20} />
        </span>
      </button>
      <label className="build-level">
        {t('Уровень героя')}
        <input
          type="number"
          min={1}
          max={36}
          value={draft}
          aria-invalid={!valid(draft)}
          onChange={(event) => {
            const raw = event.target.value;
            setDraft(raw);
            if (valid(raw)) onLevel(Number(raw));
          }}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              commit();
            }
          }}
        />
      </label>
      <button type="button" className="button build-clear" onClick={onClear}>
        <RotateCcw size={18} />
        {t('Очистить предметы')}
      </button>
    </div>
  );
}
