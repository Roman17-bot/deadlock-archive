import { useEffect, useId, useRef, type ReactNode } from 'react';
import { useI18n } from '../../i18n';

export function PickerDialog({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const id = useId();
  const { t } = useI18n();
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialog.current?.showModal();
    dialog.current?.querySelector<HTMLInputElement>('input')?.focus();
    return () => previous?.focus();
  }, []);
  return (
    <dialog
      ref={dialog}
      className="build-picker"
      aria-labelledby={id}
      onKeyDownCapture={(event) => {
        // A search input otherwise consumes the first Escape to clear its text.
        if (event.key === 'Escape') {
          event.preventDefault();
          event.stopPropagation();
          onClose();
        }
      }}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === dialog.current) onClose();
      }}
    >
      <header>
        <h3 id={id}>{title}</h3>
        <button type="button" className="button" onClick={onClose}>
          {t('Отмена')}
        </button>
      </header>
      {children}
    </dialog>
  );
}
