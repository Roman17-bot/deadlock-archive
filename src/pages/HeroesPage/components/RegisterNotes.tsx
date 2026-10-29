import { ArrowUpRight, Info } from '../../../components/ui/ArchiveIcon/ArchiveIcons';
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
              'Урон выстрела указан для одной цели. Дробины складываются при попадании в неё; особенности оружия описаны в подробностях героя. DPS — урон в секунду без перезарядки. На первом уровне Spirit может быть равен нулю.',
            )}
          </span>
        </p>
        <span className="data-stamp">
          {t('Версия игры')} {data.meta.clientVersion}
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
