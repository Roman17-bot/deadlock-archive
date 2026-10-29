import { Heart, Layers3, Calculator } from '../../../components/ui/ArchiveIcon/ArchiveIcons';
import { useI18n } from '../../../i18n';

export function RegisterIntro() {
  const { t } = useI18n();
  return (
    <section className="home-register-intro">
      <div className="section-kicker">{t('СНАЧАЛА ФАКТЫ, ЗАТЕМ ЭКСПЕРИМЕНТЫ')}</div>
      <div className="intro-columns">
        <h2>
          {t('Хороший билд начинается')}
          <br />
          {t('со знакомства с героем.')}
        </h2>
        <p>
          {t(
            'Сравни здоровье, урон и скорость стрельбы героев. Посмотри, как они растут с уровнем, а затем рассчитай, что дадут предметы твоему билду.',
          )}
        </p>
      </div>
      <div className="feature-line">
        <span>
          <Layers3 size={17} />
          {t('Базовые статы и приросты')}
        </span>
        <span>
          <Heart size={17} />
          {t('Параметры на любом уровне')}
        </span>
        <span>
          <Calculator size={17} />
          {t('Калькулятор урона и защиты')}
        </span>
      </div>
    </section>
  );
}
