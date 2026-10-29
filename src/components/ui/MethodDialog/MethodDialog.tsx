import { useEffect, useRef } from 'react';
import { X } from '../ArchiveIcon/ArchiveIcons';
import type { HeroSnapshot } from '../../../../shared/types';
import { useI18n } from '../../../i18n';

export function MethodDialog({ onClose }: { data: HeroSnapshot; onClose: () => void }) {
  const { t } = useI18n();
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  return (
    <dialog
      ref={dialog}
      className="method-dialog"
      aria-labelledby="method-title"
      onClose={onClose}
      onClick={(event) => {
        if (event.target === dialog.current) dialog.current.close();
      }}
    >
      <div className="dialog-inner">
        <div className="section-kicker">{t('ТАБЛИЦА ГЕРОЕВ')}</div>
        <button
          className="icon-button close-dialog"
          aria-label={t('Закрыть методику')}
          onClick={() => dialog.current?.close()}
        >
          <X size={22} />
        </button>
        <h2 id="method-title">{t('Как устроены цифры')}</h2>
        <p>
          {t(
            'Таблица показывает характеристики героя без предметов и активных эффектов. Выбранный уровень применяется ко всем героям.',
          )}
        </p>
        <ol>
          {[
            'Базовые характеристики относятся к первому уровню. Каждый следующий уровень добавляет соответствующий прирост.',
            'Урон выстрела учитывает все дробины, попавшие в одну цель. Если снаряды одного выстрела делят общее попадание, урон учитывается один раз.',
            'DPS показывает урон за секунду стрельбы без перезарядки. Попадания в голову, сопротивления и расстояние до цели в него не входят.',
            'Spirit может усиливать оружие, скорострельность или восстановление здоровья. Эти прибавки уже включены в значения на выбранном уровне.',
          ].map((text) => (
            <li key={text}>{t(text)}</li>
          ))}
        </ol>
        <div className="method-callout">
          <strong>{t('Особое оружие')}</strong>
          <p>
            {t(
              'Нажми на имя героя, чтобы посмотреть дробь, очереди, раскрутку оружия и другие особенности его стрельбы.',
            )}
          </p>
        </div>
      </div>
    </dialog>
  );
}
