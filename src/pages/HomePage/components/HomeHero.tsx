import { ArrowRight } from '../../../components/ui/ArchiveIcon/ArchiveIcons';
import { asset } from '../../../lib/format';
import type { HeroSnapshot } from '../../../../shared/types';
import { useI18n } from '../../../i18n';
import { ArchiveLogo } from '../../../components/ui/ArchiveLogo/ArchiveLogo';

export function HomeHero({ data }: { data: HeroSnapshot }) {
  const { t } = useI18n();
  return (
    <section className="home-hero">
      <div className="hero-copy">
        <div className="section-kicker light">
          <span />
          {t('НЕЗАВИСИМОЕ БЮРО ИССЛЕДОВАНИЙ')}
        </div>
        <p className="issue-number">
          {t('ТОМ I')} <span>{t('ОКТЯБРЬ, 2026')}</span>
        </p>
        <h1>
          {t('У каждого героя')}
          <br />
          {t('есть')} <em>{t('свои цифры.')}</em>
        </h1>
        <p className="hero-description">
          {t(
            'Характеристики всех героев Deadlock, приросты за уровень и калькулятор для сравнения билдов.',
          )}
        </p>
        <div className="hero-cta">
          <a className="button button-paper" href="#/heroes" aria-label={t('Открыть реестр')}>
            {t('Открыть реестр')}
            <ArrowRight size={19} />
          </a>
          <span>
            {t('{{count}} героя.', { count: data.heroes.length })}
            <br />
            {t('Все уровни в одном реестре.')}
          </span>
        </div>
      </div>
      <div className="roster-art" aria-hidden="true">
        <div className="roster-art-heading">
          <span>DEADLOCK / CHARACTER INDEX</span>
          <span>№ 001—{String(data.heroes.length).padStart(3, '0')}</span>
        </div>
        <div className="roster-art-title">
          <span>{t('Личные дела')}</span>
          <em>{t('старого города.')}</em>
        </div>
        <div className="roster-portraits">
          {data.heroes.map((hero, index) => (
            <div className="roster-portrait" key={hero.id}>
              <img src={asset(hero.portrait)} alt="" width="54" height="54" />
              <span>{String(index + 1).padStart(2, '0')}</span>
            </div>
          ))}
          <span className="roster-endmark">
            <ArchiveLogo className="roster-monogram" />
          </span>
        </div>
        <div className="roster-art-footer">
          <strong>{data.heroes.length}</strong>
          <span>
            {t('ГЕРОЯ В АРХИВЕ')}
            <br />
            {t('У КАЖДОГО СВОЯ ИСТОРИЯ')}
          </span>
        </div>
      </div>
    </section>
  );
}
