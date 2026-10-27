import type { Dispatch, SetStateAction } from 'react';
import { RotateCcw } from 'lucide-react';
import { StyledSelect } from '../../../components/ui/StyledSelect/StyledSelect';
import { useI18n } from '../../../i18n';
import { tasks, type Task } from '../model/tasks';

type CalculatorFormProps = {
  id: string;
  mode: string;
  task: Task;
  values: Record<string, Record<string, string>>;
  setMode: Dispatch<SetStateAction<string>>;
  setValues: Dispatch<SetStateAction<Record<string, Record<string, string>>>>;
};

export function CalculatorForm({
  id,
  mode,
  task,
  values,
  setMode,
  setValues,
}: CalculatorFormProps) {
  const { t } = useI18n();
  return (
    <div className="calculator-form">
      <label className="calc-task-label" id={`${id}-mode-label`} htmlFor={`${id}-mode`}>
        {t('Задача расчёта')}
      </label>
      <StyledSelect
        id={`${id}-mode`}
        labelledBy={`${id}-mode-label`}
        value={mode}
        onChange={setMode}
        options={tasks.map((entry) => ({ value: entry.id, label: t(entry.label) }))}
      />
      <p className="calc-entry-hint">
        {t('Числа можно вводить с запятой. Отдельные проценты разделяй точкой с запятой:')}{' '}
        <b>30;20</b>
        {t('. Пустой список — нет эффектов.')}
      </p>
      <div className="calculator-fields">
        {task.fields.map((field) => (
          <label key={field.key} htmlFor={`${id}-${mode}-${field.key}`}>
            <span>{t(field.label)}</span>
            <input
              id={`${id}-${mode}-${field.key}`}
              type="text"
              inputMode={field.list ? 'text' : 'decimal'}
              value={values[mode][field.key]}
              placeholder={field.list ? t('Нет эффектов') : undefined}
              autoComplete="off"
              onChange={(e) =>
                setValues((current) => ({
                  ...current,
                  [mode]: { ...current[mode], [field.key]: e.target.value },
                }))
              }
            />
            {field.hint && <small>{t(field.hint)}</small>}
          </label>
        ))}
      </div>
      <button
        className="calc-reset"
        onClick={() =>
          setValues((current) => ({
            ...current,
            [mode]: Object.fromEntries(task.fields.map((field) => [field.key, field.value])),
          }))
        }
      >
        <RotateCcw size={16} />
        {t('Вернуть пример')}
      </button>
    </div>
  );
}
