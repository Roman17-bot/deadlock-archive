import { useState } from 'react';
import { ArrowUpRight, ChevronDown } from '../../../components/ui/ArchiveIcon/ArchiveIcons';
import type { OfficialPatch } from '../../../../shared/version-history';
import { formatDate } from '../../../lib/format';
import { useI18n } from '../../../i18n';

/** Parse only our plain-text paragraphs and list markers. Source HTML is never executed. */
function NoteText({ text }: { text: string }) {
  const blocks: { kind: 'heading' | 'list' | 'paragraph'; lines: string[] }[] = [];
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line) {
      blocks.push({ kind: 'paragraph', lines: [] });
      continue;
    }
    const heading = line.startsWith('## ') || (line.length < 65 && /^[\p{L} &/]+:$/u.test(line));
    const kind = heading ? 'heading' : /^[-•]\s/.test(line) ? 'list' : 'paragraph';
    const content = line.replace(heading ? /^##\s+/ : /^[-•]\s+/, '');
    const previous = blocks.at(-1);
    if (kind !== 'heading' && previous?.kind === kind && previous.lines.length)
      previous.lines.push(content);
    else blocks.push({ kind, lines: [content] });
  }
  return blocks
    .filter((block) => block.lines.length)
    .map((block, index) =>
      block.kind === 'heading' ? (
        <h4 key={index}>{block.lines[0]}</h4>
      ) : block.kind === 'list' ? (
        <ul key={index}>
          {block.lines.map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ul>
      ) : (
        <p key={index}>{block.lines.join('\n')}</p>
      ),
    );
}

export function PatchDetails({ patch, current }: { patch: OfficialPatch; current: boolean }) {
  const { t, language } = useI18n();
  const [open, setOpen] = useState(false);
  const title = patch.title[language] ?? patch.title.en;
  const body = patch.body[language] ?? patch.body.en;
  const original = language === 'ru' && !patch.body.ru;
  return (
    <details className="history-patch" onToggle={(event) => setOpen(event.currentTarget.open)}>
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
            <NoteText text={body} />
          </div>
        </div>
      )}
    </details>
  );
}
