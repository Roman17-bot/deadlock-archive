import { useRef, useState } from 'react';
import { ArrowUpRight, ChevronDown } from '../../../components/ui/ArchiveIcon/ArchiveIcons';
import type { OfficialPatch } from '../../../../shared/version-history';
import { formatDate } from '../../../lib/format';
import { useI18n } from '../../../i18n';
import { PatchNotes } from './PatchNotes/PatchNotes';
import { needsItemIcons, type EntityLookup } from './PatchNotes/patchText';

export function PatchDetails({
  patch,
  current,
  lookup,
  requestItems,
}: {
  patch: OfficialPatch;
  current: boolean;
  lookup: EntityLookup;
  requestItems: () => void;
}) {
  const { t, language } = useI18n();
  const [open, setOpen] = useState(false);
  const lastToggle = useRef(false);
  const title = patch.title[language] ?? patch.title.en;
  const body = patch.body[language] ?? patch.body.en;
  const original = language === 'ru' && !patch.body.ru;
  return (
    <details
      className="history-patch"
      onToggle={(event) => {
        const expanded = event.currentTarget.open;
        if (expanded === lastToggle.current) return;
        lastToggle.current = expanded;
        setOpen(expanded);
        if (expanded && needsItemIcons(body, lookup)) requestItems();
      }}
    >
      <summary>
        <span className="history-patch-date">
          <time dateTime={patch.publishedAt}>{formatDate(patch.publishedAt)}</time>
          {patch.clientVersion && (
            <span>{t('Версия {{version}}', { version: patch.clientVersion })}</span>
          )}
          {current && <span className="version-current">{t('Текущая')}</span>}
        </span>
        <span className="history-patch-heading">
          <h3
            className="history-patch-title"
            lang={language === 'ru' && !patch.title.ru ? 'en' : language}
          >
            {title}
          </h3>
          <span className="history-patch-action">
            {t(open ? 'Свернуть изменения' : 'Читать изменения')}
            <ChevronDown size={20} />
          </span>
        </span>
      </summary>
      {open && (
        <div className="history-patch-content">
          <div className="history-patch-toolbar">
            {original && <span>{t('Оригинал на английском')}</span>}
            <a href={patch.url} target="_blank" rel="noopener noreferrer">
              {t('Открыть в Steam')}
              <ArrowUpRight size={16} />
            </a>
          </div>
          <div className="history-patch-copy" lang={original ? 'en' : language}>
            <PatchNotes text={body} lookup={lookup} />
          </div>
        </div>
      )}
    </details>
  );
}
