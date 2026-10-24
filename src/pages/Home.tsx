import {
  ArrowRight,
  ArrowUpRight,
  Crosshair,
  Heart,
  Layers3,
  ScanLine,
  Sparkles,
} from 'lucide-react';
import type { HeroSnapshot } from '../../shared/types';
import { asset, format } from '../lib/format';

export function Home({ data, onMethod }: { data: HeroSnapshot; onMethod: () => void }) {
  const nurse = data.heroes.find((h) => h.name === 'Nurse Harrow')!;
  const violet = data.heroes.find((h) => h.name === 'Violet')!;
  return (
    <div className="home-page">
      <section className="home-hero">
        <div className="hero-copy">
          <div className="section-kicker light">
            <span />
            НЕЗАВИСИМОЕ БЮРО ИССЛЕДОВАНИЙ
          </div>
          <p className="issue-number">
            ТОМ I <span>ОКТЯБРЬ, 2026</span>
          </p>
          <h1>
            У каждого героя
            <br />
            есть <em>свои цифры.</em>
          </h1>
          <p className="hero-description">
            Сравнивай, замечай различия и находи свой стиль игры. Досье на всех героев Deadlock — от
            первого уровня до последнего Boon.
          </p>
          <div className="hero-cta">
            <a className="button button-paper" href="#/heroes" aria-label="Открыть реестр">
              Открыть реестр
              <ArrowRight size={19} />
            </a>
            <span>
              44 героя.
              <br />
              Все уровни в одном реестре.
            </span>
          </div>
          <div className="hero-verification">
            <span className="verification-seal">
              <ScanLine size={20} />
            </span>
            <div>
              <strong>Сверено с файлами игры</strong>
              <span>Клиент {data.meta.clientVersion} · проверено 24 октября</span>
            </div>
          </div>
        </div>
        <div className="hero-art" aria-hidden="true">
          <img
            className="hero-art-bg"
            src={asset('assets/feature/nurse-harrow-background.webp')}
            alt=""
          />
          <div className="art-deco-frame" />
          <div className="hero-art-caption">
            <span>ОБЪЕКТ № 087</span>
            <span>MARBLE HILL POSSESSION WARD</span>
          </div>
          <span className="hero-art-type">HARROW</span>
          <div className="portrait-oval">
            <img
              className="hero-portrait"
              src={asset('assets/feature/nurse-harrow-card.webp')}
              alt=""
              fetchPriority="high"
            />
          </div>
          <div className="hero-art-bottom">
            <span className="medical-cross">✚</span>
            <p>
              Лечение требует
              <br />
              <em>твёрдой руки.</em>»
            </p>
            <span className="stamp">
              ДОСЬЕ
              <br />
              ОТКРЫТО
            </span>
          </div>
        </div>
      </section>
      <section className="archive-strip" aria-label="О справочнике">
        <div>
          <strong>44</strong>
          <span>ДОСТУПНЫХ ГЕРОЯ</span>
        </div>
        <div>
          <strong>1—36</strong>
          <span>УРОВНИ ДЛЯ СРАВНЕНИЯ</span>
        </div>
        <div>
          <Crosshair size={26} />
          <span>БЕЗ ПРЕДМЕТОВ И БАФФОВ</span>
        </div>
        <button onClick={onMethod}>
          <span>КАК УСТРОЕНЫ ДАННЫЕ</span>
          <ArrowUpRight size={23} />
        </button>
      </section>
      <section className="home-register-intro">
        <div className="section-kicker">СНАЧАЛА ФАКТЫ, ЗАТЕМ ЭКСПЕРИМЕНТЫ</div>
        <div className="intro-columns">
          <h2>
            Хороший билд начинается
            <br />
            со знакомства с героем.
          </h2>
          <p>
            Урон одного выстрела не равен урону в секунду. Spirit растёт по-разному, а регенерация
            не всегда появляется сама. Мы сохранили эти различия — и дали тебе инструменты для
            сравнения.
          </p>
        </div>
        <div className="feature-line">
          <span>
            <Layers3 size={17} />
            Базовые статы и приросты
          </span>
          <span>
            <Heart size={17} />
            Параметры на любом уровне
          </span>
          <span>
            <ScanLine size={17} />
            Проверяемые источники
          </span>
        </div>
      </section>
      <section className="new-records">
        <div className="section-heading">
          <div>
            <div className="section-kicker">НОВЫЕ ПОСТУПЛЕНИЯ</div>
            <h2>Новые лица в старом городе.</h2>
          </div>
          <a className="text-link" href="#/heroes">
            Весь реестр
            <ArrowRight size={17} />
          </a>
        </div>
        <div className="spotlight-grid">
          {[nurse, violet].map((hero, index) => (
            <article className={`spotlight spotlight-${index}`} key={hero.id}>
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
                  {index === 0 ? 'ФОКУС ИССЛЕДОВАНИЯ' : 'ДОБАВЛЕНО В АРХИВ'}
                </span>
                <h3>{hero.name}</h3>
                <p>
                  {index === 0
                    ? 'Строгие методы. Спасительные иглы. У неё есть всё, кроме права на ошибку.'
                    : 'Живые чернила и опасное вдохновение. Искусство, которое отвечает взаимностью.'}
                </p>
                <div className="spotlight-stats">
                  <span>
                    <strong>{format(hero.base.health)}</strong>HP
                  </span>
                  <span>
                    <strong>{format(hero.base.regen)}</strong>HP/с
                  </span>
                  <span>
                    <strong>+{format(hero.growth.health)}</strong>HP / LVL
                  </span>
                </div>
                <a className="text-link" href={`#/heroes?hero=${hero.slug}`}>
                  Изучить характеристики
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
          <h2>Цифры меняются. Источники остаются.</h2>
          <p>
            Это снимок игры на 24 октября 2026 года. У каждого значения есть версия клиента, а у
            расчётных показателей — своя формула.
          </p>
        </div>
        <button className="button button-outline" onClick={onMethod}>
          Открыть методику
          <ArrowUpRight size={17} />
        </button>
      </section>
    </div>
  );
}
