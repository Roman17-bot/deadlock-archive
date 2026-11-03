import { lazy, Suspense, useId, useState } from 'react';
import { Calculator as CalculatorIcon } from '../../components/ui/ArchiveIcon/ArchiveIcons';
import { useI18n, translateError } from '../../i18n';
import { tasks } from './model/tasks';
import { evaluate, type Result } from './model/evaluate';
import { CalculatorForm } from './components/CalculatorForm';
import { CalculatorResult } from './components/CalculatorResult';

import type { HeroSnapshot } from '../../../shared/types';
const HeroCalculator = lazy(() => import('../hero-calculator/HeroCalculator'));

export function Calculator({
  onRule,
  data,
}: {
  onRule: (id: string) => void;
  data?: HeroSnapshot;
}) {
  const { t } = useI18n();
  const id = useId();
  const [view, setView] = useState('formulas');
  const [buildOpened, setBuildOpened] = useState(false);
  const [mode, setMode] = useState('defense');
  const [values, setValues] = useState<Record<string, Record<string, string>>>(() =>
    Object.fromEntries(
      tasks.map((t) => [
        t.id,
        Object.fromEntries(t.fields.map((field) => [field.key, field.value])),
      ]),
    ),
  );
  const task = tasks.find((entry) => entry.id === mode)!;
  let result: Result | undefined, error: string | undefined;
  try {
    result = evaluate(mode, values[mode]);
  } catch (e) {
    error = e instanceof Error ? translateError(e.message) : t('Не удалось рассчитать.');
  }
  return (
    <section className="mechanics-calculator" aria-labelledby={`${id}-heading`}>
      <div className="calculator-title">
        <div>
          <span className="section-kicker">{t('ПОЛЕВАЯ ЛАБОРАТОРИЯ')}</span>
          <h2 id={`${id}-heading`}>{t('Проверь идею цифрами.')}</h2>
        </div>
        <CalculatorIcon size={34} aria-hidden="true" />
      </div>
      {data && (
        <div className="calculator-modes" aria-label={t('Режим калькулятора')}>
          <button
            type="button"
            aria-pressed={view === 'formulas'}
            onClick={() => setView('formulas')}
          >
            {t('Формулы')}
          </button>
          <button
            type="button"
            aria-pressed={view === 'build'}
            onClick={() => {
              setBuildOpened(true);
              setView('build');
            }}
          >
            {t('Билд героя')}
          </button>
        </div>
      )}
      <div hidden={view !== 'formulas'}>
        <div className="calculator-layout">
          <CalculatorForm
            id={id}
            mode={mode}
            task={task}
            values={values}
            setMode={setMode}
            setValues={setValues}
          />
          <CalculatorResult task={task} result={result} error={error} onRule={onRule} />
        </div>
      </div>
      {buildOpened && data && (
        <div hidden={view !== 'build'}>
          <Suspense fallback={<p aria-busy="true">{t('Загружаем предметы…')}</p>}>
            <HeroCalculator data={data} onRule={onRule} />
          </Suspense>
        </div>
      )}
    </section>
  );
}
