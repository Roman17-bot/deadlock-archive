import { ChevronRight } from 'lucide-react';
import type { HeroSnapshot } from '../../../../shared/types';
import { formatDate } from '../../../lib/format';
import { useI18n } from '../../../i18n';

export function RegisterHeading({ data }: { data: HeroSnapshot }) {
  const { t } = useI18n();
  return (
    <>
      <div className="breadcrumbs">
        <a href="#/">{t('Архив')}</a>
        <ChevronRight size={12} />
        <span>{t('Реестр героев')}</span>
      </div>
      <section className="register-heading">
        <div>
          <div className="section-kicker">{t('ЛИЧНЫЕ ДЕЛА · ВЫПУСК 001')}</div>
          <h1>
            {t('Реестр героев')}
            <span className="title-star">✦</span>
          </h1>
          <p>
            {t('Разные характеры. Разные возможности. Все базовые характеристики — в одном месте.')}
          </p>
        </div>
        <div className="snapshot-plaque">
          <span className="status-dot" />
          {t('ВЕРСИЯ ИГРЫ')}
          <strong>{data.meta.clientVersion}</strong>
          <span>
            {t('ОБНОВЛЕНО')} {formatDate(data.meta.snapshotDate)}
          </span>
        </div>
      </section>
    </>
  );
}
