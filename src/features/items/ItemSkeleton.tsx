import { useI18n } from '../../i18n';
import './ItemSkeleton.css';

const bars = (count: number) =>
  Array.from({ length: count }, (_, index) => <span className="item-skeleton-bar" key={index} />);

export function ItemSkeleton({ variant }: { variant: 'catalog' | 'detail' | 'statistics' }) {
  const { t } = useI18n();
  return (
    <div className={`item-skeleton item-skeleton-${variant}`} role="status" aria-busy="true">
      <p className="item-skeleton-label">
        {t(variant === 'statistics' ? 'Загрузка статистики…' : 'Загрузка предметов…')}
      </p>
      <div aria-hidden="true">
        {variant === 'catalog' ? (
          <div className="shop-columns">
            {['weapon', 'vitality', 'spirit'].map((category) => (
              <div className={`item-skeleton-category ${category}`} key={category}>
                <div className="item-skeleton-category-heading">{bars(1)}</div>
                <div className="shop-tier-grid">
                  {Array.from({ length: 6 }, (_, index) => (
                    <div className="item-skeleton-card" key={index}>
                      <span className="item-skeleton-art" />
                      {bars(2)}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : variant === 'detail' ? (
          <>
            <div className="item-skeleton-heading">
              <span className="item-skeleton-art" />
              <div>{bars(3)}</div>
            </div>
            <div className="item-detail-columns">
              <div className="item-skeleton-prose">{bars(7)}</div>
              <div className="item-skeleton-prose">{bars(5)}</div>
            </div>
          </>
        ) : (
          <div className="item-skeleton-prose">{bars(5)}</div>
        )}
      </div>
    </div>
  );
}
