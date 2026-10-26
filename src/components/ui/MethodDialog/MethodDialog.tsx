import { useEffect, useRef } from 'react';
import { ExternalLink, X } from 'lucide-react';
import type { HeroSnapshot } from '../../../../shared/types';
import { formatDate } from '../../../lib/format';
import { useI18n, translateDataText } from '../../../i18n';

export function MethodDialog({ data, onClose }: { data: HeroSnapshot; onClose: () => void }) {
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
        <div className="section-kicker">{t('ПРИМЕЧАНИЯ АРХИВАРИУСА')}</div>
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
            'База, приросты и расчётные показатели здесь разделены. Всё относится к клиенту {{version}}, проверенному {{date}}.',
            { version: data.meta.clientVersion, date: formatDate(data.meta.snapshotDate) },
          )}
        </p>
        <ol>
          {data.meta.methodology.map((text) => (
            <li key={text}>{translateDataText(text)}</li>
          ))}
        </ol>
        <div className="method-callout">
          <strong>{t('Особое оружие')}</strong>
          <p>
            {t(
              'У очередей, зарядов и раскрутки есть нюансы. Нажми на имя героя в строке, чтобы увидеть параметры и ограничения его модели.',
            )}
          </p>
        </div>
        <h3>{t('Откуда данные')}</h3>
        <div className="source-list">
          {data.meta.sources.map((source) => (
            <a href={source.url} key={source.url} target="_blank" rel="noreferrer">
              {translateDataText(source.label)}
              <ExternalLink size={14} />
            </a>
          ))}
        </div>
        <p className="fine-print">
          {t(
            'Статические параметры сверены с файлами игры. Это не замеры урона в запущенном клиенте и не рейтинг силы героев. Ревизия {{commit}}.',
            { commit: data.meta.gameCommit.slice(0, 12) },
          )}
        </p>
      </div>
    </dialog>
  );
}
