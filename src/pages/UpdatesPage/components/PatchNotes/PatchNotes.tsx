import { useMemo } from 'react';
import { asset } from '../../../../lib/format';
import { changeLabel, numberSegments, parseNote, type EntityLookup } from './patchText';
import './PatchNotes.css';

function Values({ text }: { text: string }) {
  return numberSegments(text).map((part, index) =>
    part.number ? (
      <span className="patch-note-number" key={index}>
        {part.text}
      </span>
    ) : (
      part.text
    ),
  );
}

export function PatchNotes({ text, lookup }: { text: string; lookup: EntityLookup }) {
  const blocks = useMemo(() => parseNote(text), [text]);
  return blocks.map((block, index) =>
    block.kind === 'heading' ? (
      <h4 className="patch-note-section" key={index}>
        {block.lines[0]}
      </h4>
    ) : block.kind === 'list' ? (
      <ul className="patch-note-list" key={index}>
        {block.lines.map((line, lineIndex) => {
          const label = changeLabel(line);
          const entity = label ? lookup(label.name) : undefined;
          return (
            <li
              className={`patch-note-line${entity?.category ? ` ${entity.category}` : ''}`}
              data-category={entity?.category}
              key={lineIndex}
            >
              <span
                className={`patch-note-symbol${entity ? ` patch-note-symbol--${entity.kind}` : ''}`}
                aria-hidden="true"
              >
                {entity ? (
                  <img
                    key={entity.image}
                    src={asset(entity.image)}
                    alt=""
                    width={26}
                    height={26}
                    loading="lazy"
                    decoding="async"
                    onError={(event) => {
                      event.currentTarget.style.visibility = 'hidden';
                    }}
                  />
                ) : (
                  <span className="patch-note-bullet" />
                )}
              </span>
              <span className="patch-note-line-copy">
                {label ? (
                  <>
                    <strong className="patch-note-name">{label.name}</strong>:
                    <Values text={label.rest} />
                  </>
                ) : (
                  <Values text={line} />
                )}
              </span>
            </li>
          );
        })}
      </ul>
    ) : (
      <p key={index}>
        <Values text={block.lines.join('\n')} />
      </p>
    ),
  );
}
