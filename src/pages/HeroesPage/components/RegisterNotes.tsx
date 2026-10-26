import { ArrowUpRight, Info } from 'lucide-react';
import type { HeroSnapshot } from '../../../../shared/types';
import { useI18n } from '../../../i18n';

export function RegisterNotes({ data, onMethod }: { data: HeroSnapshot; onMethod: () => void }) {
  const { t } = useI18n();
  return (
    <>
      <div className="register-footnote">
        <p>
          <Info size={14} />
          <span>
            {t(
              'Урон выстрела учитывает обычные дробины и исключение hit-once. DPS — расчёт без перезарядки; особые режимы отмечены в строках. Нулевой Spirit на LVL 1 — корректное базовое значение.',
            )}
          </span>
        </p>
        <span className="data-stamp">
          BUILD {data.meta.clientVersion} / {data.meta.gameCommit.slice(0, 7)}
        </span>
      </div>
      <aside className="register-aside">
        <span className="note-mark">✦</span>
        <p>
          <strong>{t('Смотри на сочетания, а не на одну цифру.')}</strong>{' '}
          {t(
            'Высокий урон выстрела не гарантирует высокий DPS. Приросты и выбранный уровень меняют картину.',
          )}
        </p>
        <button className="text-link" onClick={onMethod}>
          {t('Читать методику')}
          <ArrowUpRight size={16} />
        </button>
      </aside>
    </>
  );
}
