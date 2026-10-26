import { ArrowRight, ArrowUpRight, Sparkles } from 'lucide-react';
import { asset, format } from '../../../lib/format';
import type { Hero, HeroSnapshot } from '../../../../shared/types';
import { useI18n } from '../../../i18n';

export function FeaturedRecords({ data }: { data: HeroSnapshot }) {
  const { t } = useI18n();
  const featured = ['Nurse Harrow', 'Violet']
    .map((name) => data.heroes.find((hero) => hero.name === name))
    .filter((hero): hero is Hero => hero !== undefined);
  return (
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
  );
}
