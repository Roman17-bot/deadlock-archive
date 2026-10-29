import { ArrowDown, CircleAlert } from '../../../components/ui/ArchiveIcon/ArchiveIcons';
import { format } from '../../../lib/format';
import { useI18n } from '../../../i18n';
import { tasks, type Task } from '../model/tasks';
import type { Result } from '../model/evaluate';
import { useResultMotion } from '../../../hooks/useResultMotion';

type CalculatorResultProps = {
  task: Task;
  result?: Result;
  error?: string;
  onRule: (id: string) => void;
};

export function CalculatorResult({ task, result, error, onRule }: CalculatorResultProps) {
  const { t } = useI18n();
  const resultRef = useResultMotion(task.id);
  return (
    <div ref={resultRef} className="calculator-result" aria-live="polite" aria-atomic="true">
      <span className="result-kicker">
        {t('РАСЧЁТНОЕ ДЕЛО / {{number}}', {
          number: String(tasks.indexOf(task) + 1).padStart(2, '0'),
        })}
      </span>
      {error ? (
        <div className="calc-error" role="alert">
          <CircleAlert size={30} />
          <h3>{t('Проверь значения')}</h3>
          <p>{error}</p>
        </div>
      ) : (
        result && (
          <>
            <h3>{t(result.label)}</h3>
            <div className="calc-primary">
              <strong data-testid="calc-primary">{format(result.value, 3)}</strong>
              <span>{t(result.unit)}</span>
            </div>
            <dl>
              {result.rows.map((row) => (
                <div key={row.label}>
                  <dt>{t(row.label)}</dt>
                  <dd>
                    <b>{format(row.value, 3)}</b>
                    {row.unit && <span>{t(row.unit)}</span>}
                  </dd>
                </div>
              ))}
            </dl>
            <p className="result-equation">{t(result.equation)}</p>
          </>
        )
      )}
      <p className="calculator-assumption">{t(task.note)}</p>
      <button className="text-link" onClick={() => onRule(task.rule)}>
        {t('Как это считается')}
        <ArrowDown size={17} />
      </button>
    </div>
  );
}
