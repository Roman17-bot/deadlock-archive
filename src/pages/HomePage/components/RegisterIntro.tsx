import { Heart, Layers3, ScanLine } from 'lucide-react';
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
            'Урон одного выстрела не равен урону в секунду. Spirit растёт по-разному, а регенерация не всегда появляется сама. Мы сохранили эти различия — и дали тебе инструменты для сравнения.',
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
          <ScanLine size={17} />
          {t('Проверяемые источники')}
        </span>
      </div>
    </section>
  );
}
