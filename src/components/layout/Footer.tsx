import { ArrowUpRight, BookOpen } from 'lucide-react';
import type { HeroSnapshot } from '../../../shared/types';
import { useI18n } from '../../i18n';

export function Footer({ data, onMethod }: { data: HeroSnapshot | null; onMethod: () => void }) {
  const { t } = useI18n();
  return (
    <footer className="site-footer">
      <div>
        <a className="footer-wordmark" href="#/">
          DEADLOCK / ARCHIVE
        </a>
        <p>{t('Независимый справочник. Игра и изображения принадлежат Valve.')}</p>
      </div>
      <div className="footer-actions">
        {data && (
          <button onClick={onMethod}>
            <BookOpen size={15} />
            {t('Как считаем')}
          </button>
        )}
        <a href="https://github.com/Roman17-bot/deadlock-archive" target="_blank" rel="noreferrer">
          {t('Исходный код')}
          <ArrowUpRight size={16} />
        </a>
      </div>
      <span className="footer-stamp">MANHATTAN · EST. 2026</span>
    </footer>
  );
}
