import { useEffect, useState } from 'react';
import { useI18n } from '../../../i18n';
import type { Catalogs } from '../../../services/mechanicsApi';

const normalize = (text: string) => text.toLocaleLowerCase('ru').replaceAll('ё', 'е');

export function useFormulaLibrary(catalogs: Catalogs, language: string) {
  const { t } = useI18n();
  const { ru: ruCatalog, en: enCatalog } = catalogs;
  const catalog = language === 'en' ? enCatalog : ruCatalog;
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('Все');
  const [target, setTarget] = useState<{ id: string; request: number } | null>(null);
  useEffect(() => {
    if (!target) return;
    const heading = document.getElementById(`formula-heading-${target.id}`);
    heading?.focus({ preventScroll: true });
    heading?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
  }, [target]);
  const categories = ['Все', ...new Set(ruCatalog.formulas.map((entry) => entry.category))];
  const categoryLabel = (key: string) => {
    if (key === 'Все') return t('Все');
    const source = ruCatalog.formulas.find((entry) => entry.category === key)!;
    return catalog.formulas.find((entry) => entry.id === source.id)!.category;
  };
  const matching = catalog.formulas.filter((entry) => {
    const original = ruCatalog.formulas.find((formula) => formula.id === entry.id)!;
    const english = enCatalog.formulas.find((formula) => formula.id === entry.id)!;
    const searchable = [original, english]
      .flatMap((formula) => [
        formula.title,
        formula.id,
        formula.expression,
        ...formula.variables,
        ...formula.explanation,
        ...formula.caveats,
        formula.example,
      ])
      .join(' ');
    return (
      (category === 'Все' || original.category === category) &&
      normalize(searchable).includes(normalize(query.trim()))
    );
  });
  const onRule = (id: string) => {
    const formula = catalog.formulas.find((entry) => entry.id === id);
    if (!formula) return;
    setCategory('Все');
    setQuery(formula.title);
    setTarget((current) => ({ id, request: (current?.request ?? 0) + 1 }));
  };
  return {
    catalog,
    query,
    setQuery,
    category,
    setCategory,
    target,
    categories,
    categoryLabel,
    matching,
    onRule,
  };
}
