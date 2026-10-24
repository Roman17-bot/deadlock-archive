import { useEffect, useRef } from 'react';
import { ExternalLink, X } from 'lucide-react';
import type { HeroSnapshot } from '../../shared/types';

export function MethodDialog({ data, onClose }: { data: HeroSnapshot; onClose: () => void }) {
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
        <div className="section-kicker">ПРИМЕЧАНИЯ АРХИВАРИУСА</div>
        <button
          className="icon-button close-dialog"
          aria-label="Закрыть методику"
          onClick={() => dialog.current?.close()}
        >
          <X size={22} />
        </button>
        <h2 id="method-title">Как устроены цифры</h2>
        <p>
          База, приросты и расчётные показатели здесь разделены. Всё относится к клиенту{' '}
          <strong>{data.meta.clientVersion}</strong>, проверенному 24 октября 2026 года.
        </p>
        <ol>
          {data.meta.methodology.map((text) => (
            <li key={text}>{text}</li>
          ))}
        </ol>
        <div className="method-callout">
          <strong>Особое оружие</strong>
          <p>
            У очередей, зарядов и раскрутки есть нюансы. Нажми на значок информации в строке героя,
            чтобы увидеть параметры и ограничения его модели.
          </p>
        </div>
        <h3>Откуда данные</h3>
        <div className="source-list">
          {data.meta.sources.map((source) => (
            <a href={source.url} key={source.url} target="_blank" rel="noreferrer">
              {source.label}
              <ExternalLink size={14} />
            </a>
          ))}
        </div>
        <p className="fine-print">
          Статические параметры сверены с файлами игры. Это не замеры урона в запущенном клиенте и
          не рейтинг силы героев. Ревизия {data.meta.gameCommit.slice(0, 12)}.
        </p>
      </div>
    </dialog>
  );
}
