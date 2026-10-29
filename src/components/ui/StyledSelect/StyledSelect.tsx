import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Check, ChevronDown } from '../ArchiveIcon/ArchiveIcons';

type Option = { value: string; label: string };

/** A select-only combobox: focus stays on its trigger while arrows explore the list. */
export function StyledSelect({
  id,
  labelledBy,
  value,
  options,
  onChange,
}: {
  id: string;
  labelledBy: string;
  value: string;
  options: Option[];
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const selected = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );
  const listId = `${id}-list`;
  const optionId = (index: number) => `${id}-option-${index}`;
  useEffect(() => {
    if (!open) return;
    const dismiss = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', dismiss);
    return () => document.removeEventListener('pointerdown', dismiss);
  }, [open]);
  useEffect(() => {
    if (open) document.getElementById(optionId(active))?.scrollIntoView?.({ block: 'nearest' });
  }, [open, active, id]);
  const choose = (index: number) => {
    onChange(options[index].value);
    setOpen(false);
    trigger.current?.focus();
  };
  const handleKey = (event: KeyboardEvent<HTMLButtonElement>) => {
    const index = open ? active : selected;
    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowUp':
        event.preventDefault();
        setActive(
          Math.max(0, Math.min(options.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1))),
        );
        setOpen(true);
        break;
      case 'Home':
      case 'End':
        event.preventDefault();
        setActive(event.key === 'Home' ? 0 : options.length - 1);
        setOpen(true);
        break;
      case 'Enter':
      case ' ':
        event.preventDefault();
        if (open) choose(active);
        else {
          setActive(selected);
          setOpen(true);
        }
        break;
      case 'Escape':
        if (open) {
          event.preventDefault();
          setOpen(false);
        }
        break;
      case 'Tab':
        setOpen(false);
        break;
      default: {
        if (event.key.length !== 1 || event.ctrlKey || event.metaKey || event.altKey) return;
        const next = options.findIndex(
          (option, offset) =>
            offset > index &&
            option.label.toLocaleLowerCase().startsWith(event.key.toLocaleLowerCase()),
        );
        const match =
          next < 0
            ? options.findIndex((option) =>
                option.label.toLocaleLowerCase().startsWith(event.key.toLocaleLowerCase()),
              )
            : next;
        if (match >= 0) {
          event.preventDefault();
          setActive(match);
          setOpen(true);
        }
      }
    }
  };
  return (
    <div
      className="styled-select"
      ref={root}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
      }}
    >
      <button
        type="button"
        id={id}
        ref={trigger}
        className="styled-select-trigger"
        role="combobox"
        aria-labelledby={labelledBy}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open ? optionId(active) : undefined}
        onKeyDown={handleKey}
        onClick={() => {
          setActive(selected);
          setOpen(!open);
        }}
      >
        <span>{options[selected]?.label}</span>
        <ChevronDown size={20} aria-hidden="true" />
      </button>
      {open && (
        <div id={listId} role="listbox" aria-labelledby={labelledBy} className="styled-select-menu">
          {options.map((option, index) => (
            <div
              key={option.value}
              id={optionId(index)}
              role="option"
              aria-selected={option.value === value}
              className={`styled-select-option${active === index ? ' is-active' : ''}`}
              onPointerMove={() => setActive(index)}
              onPointerDown={(event) => event.preventDefault()}
              onClick={() => choose(index)}
            >
              <span>{option.label}</span>
              <Check size={18} aria-hidden="true" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
