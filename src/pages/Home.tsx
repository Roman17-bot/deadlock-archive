import {
  ArrowRight,
  ArrowUpRight,
  Crosshair,
  Heart,
  Layers3,
  ScanLine,
  Sparkles,
} from 'lucide-react';
import type { Hero, HeroSnapshot } from '../../shared/types';
import { asset, format, formatDate } from '../lib/format';
import { useI18n } from '../i18n';

export function Home({ data, onMethod }: { data: HeroSnapshot; onMethod: () => void }) {
  const { t } = useI18n();
  const featured = ['Nurse Harrow', 'Violet']
    .map((name) => data.heroes.find((hero) => hero.name === name))
    .filter((hero): hero is Hero => hero !== undefined);
  return (
    <div className="home-page">
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
              'Сравнивай, замечай различия и находи свой стиль игры. Досье на всех героев Deadlock — от первого уровня до последнего Boon.',
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
          <div className="hero-verification">
            <span className="verification-seal">
              <ScanLine size={20} />
            </span>
            <div>
              <strong>{t('Сверено с файлами игры')}</strong>
              <span>
                {t('Клиент {{version}} · проверено {{date}}', {
                  version: data.meta.clientVersion,
                  date: formatDate(data.meta.snapshotDate),
                })}
              </span>
            </div>
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
            <span className="roster-endmark">✦</span>
          </div>
          <div className="roster-art-footer">
            <strong>{data.heroes.length}</strong>
            <span>
              {t('ГЕРОЯ В АРХИВЕ')}
              <br />
              {t('У КАЖДОГО СВОЯ ИСТОРИЯ')}
            </span>
            <span className="roster-seal">
              {t('СВЕРЕНО')}
              <br />
              {data.meta.clientVersion}
            </span>
          </div>
        </div>
      </section>
      <section className="archive-strip" aria-label={t('О справочнике')}>
        <div>
          <strong>{data.heroes.length}</strong>
          <span>{t('ДОСТУПНЫХ ГЕРОЯ')}</span>
        </div>
        <div>
          <strong>1—36</strong>
          <span>{t('УРОВНИ ДЛЯ СРАВНЕНИЯ')}</span>
        </div>
        <div>
          <Crosshair size={26} />
          <span>{t('БЕЗ ПРЕДМЕТОВ И БАФФОВ')}</span>
        </div>
        <button onClick={onMethod}>
          <span>{t('КАК УСТРОЕНЫ ДАННЫЕ')}</span>
          <ArrowUpRight size={23} />
        </button>
      </section>
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
      <section className="new-records">
        <div className="section-heading">
          <div>
            <div className="section-kicker">{t('НОВЫЕ ПОСТУПЛЕНИЯ')}</div>
            <h2>{t('Новые лица в старом городе.')}</h2>
          </div>
          <a className="text-link" href="#/heroes">
            {t('Весь реестр')}
            <ArrowRight size={17} />
          </a>
        </div>
        <div className="spotlight-grid">
          {featured.map((hero) => (
            <article
              className={`spotlight spotlight-${hero.name === 'Nurse Harrow' ? 0 : 1}`}
              key={hero.id}
            >
              <div className="spotlight-image">
                <img
                  src={asset(`assets/feature/${hero.slug}-card.webp`)}
                  alt={hero.name}
                  loading="lazy"
                />
                <span className="record-index">{String(hero.id).padStart(3, '0')}</span>
              </div>
              <div className="spotlight-copy">
                <span className="record-label">
                  <Sparkles size={12} />
                  {t('НОВЫЙ ГЕРОЙ')}
                </span>
                <h3>{hero.name}</h3>
                <p>
                  {t(
                    hero.name === 'Nurse Harrow'
                      ? 'Строгие методы. Спасительные иглы. У неё есть всё, кроме права на ошибку.'
                      : 'Живые чернила и опасное вдохновение. Искусство, которое отвечает взаимностью.',
                  )}
                </p>
                <div className="spotlight-stats">
                  <span>
                    <strong>{format(hero.base.health)}</strong>HP
                  </span>
                  <span>
                    <strong>{format(hero.base.regen)}</strong>
                    {t('HP/с')}
                  </span>
                  <span>
                    <strong>+{format(hero.growth.health)}</strong>HP / LVL
                  </span>
                </div>
                <a className="text-link" href={`#/heroes?hero=${hero.slug}`}>
                  {t('Изучить характеристики')}
                  <ArrowUpRight size={17} />
                </a>
              </div>
            </article>
          ))}
        </div>
      </section>
      <section className="archive-note">
        <span className="note-mark">✦</span>
        <div>
          <h2>{t('Цифры меняются. Источники остаются.')}</h2>
          <p>
            {t(
              'Это снимок игры на {{date}}. У каждого значения есть версия клиента, а у расчётных показателей — своя формула.',
              { date: formatDate(data.meta.snapshotDate) },
            )}
          </p>
        </div>
        <button className="button button-outline" onClick={onMethod}>
          {t('Открыть методику')}
          <ArrowUpRight size={17} />
        </button>
      </section>
    </div>
  );
}
