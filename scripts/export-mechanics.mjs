import { readFile, writeFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
async function exportLanguage(language) {
  const english = language === 'en';
  const catalog = JSON.parse(
    await readFile(
      new URL(english ? 'data/mechanics.en.json' : 'data/mechanics.json', root),
      'utf8',
    ),
  );
  const date = new Intl.DateTimeFormat(english ? 'en-US' : 'ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
    .format(new Date(catalog.meta.checkedAt))
    .replace(/\.$/, '');
  const lines = [
    english ? '# Deadlock — formulas and mechanics' : '# Deadlock — формулы и механики',
    '',
    english
      ? `**Game version: ${catalog.meta.reviewedClientVersion}. Data as of ${date}.**`
      : `**Версия игры: ${catalog.meta.reviewedClientVersion}. Данные на ${date}.**`,
    '',
    english
      ? 'Percentages in equations are fractions: 30% = 0.30. Enter ordinary percentages in the calculator. HP means health; EHP means effective health. Results are rounded only for display.'
      : 'Проценты в уравнениях записаны долями: 30% = 0,30. В калькулятор вводи обычные проценты. HP — здоровье, EHP — эффективное здоровье. Результаты округляются только при выводе.',
    '',
    english ? '## Contents' : '## Содержание',
    '',
  ];
  for (const formula of catalog.formulas) lines.push(`- [${formula.title}](#${formula.id})`);
  for (const formula of catalog.formulas) {
    lines.push(
      '',
      `<a id="${formula.id}"></a>`,
      `## ${formula.title}`,
      '',
      `**${formula.category}**`,
      '',
      `\`${formula.expression}\``,
      '',
      ...formula.variables.map((text) => `- ${text}`),
      '',
      ...formula.explanation.flatMap((text) => [text, '']),
      `**${english ? 'Example.' : 'Пример.'}** ${formula.example}`,
      '',
      english ? '**Calculation conditions:**' : '**Условия расчёта:**',
      '',
      ...formula.caveats.map((text) => `- ${text}`),
    );
  }
  const content = lines.join('\n') + '\n';
  const target = new URL(
    english ? 'docs/mechanics-reference.en.md' : 'docs/mechanics-reference.md',
    root,
  );
  if ((await readFile(target, 'utf8').catch(() => '')) !== content)
    await writeFile(target, content);
  console.log(`Exported ${catalog.formulas.length} mechanics rules (${language}).`);
}
await exportLanguage('ru');
await exportLanguage('en');
