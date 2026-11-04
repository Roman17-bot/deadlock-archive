import { useI18n } from '../../i18n';
import './heroes-reference.css';

export function HeroNavigation({ active }: { active: 'table' | 'roster' | 'statistics' }) {
  const { language } = useI18n();
  const en = language === 'en';
  return (
    <nav className="hero-section-nav" aria-label={en ? 'Hero pages' : 'Разделы героев'}>
      {(
        [
          ['roster', '#/heroes/roster', en ? 'Choose a hero' : 'Выбор героя'],
          ['table', '#/heroes', en ? 'Attributes' : 'Характеристики'],
          ['statistics', '#/heroes/statistics', en ? 'Match statistics' : 'Статистика матчей'],
        ] as const
      ).map(([key, href, label]) => (
        <a href={href} key={key} aria-current={active === key ? 'page' : undefined}>
          {label}
        </a>
      ))}
    </nav>
  );
}
