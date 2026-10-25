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
  const labels = english
    ? {
        math_identity: 'Mathematics under the stated conditions',
        config_confirmed: 'Parameters and flags from game files',
        community_documented: 'Working rule supported by sources',
        inferred: 'Model: verification has limitations',
      }
    : {
        math_identity: 'Математика при указанных условиях',
        config_confirmed: 'Параметры и флаги из файлов игры',
        community_documented: 'Рабочее правило по источникам',
        inferred: 'Модель: есть ограничения проверки',
      };
  const sources = new Map(catalog.sources.map((source) => [source.id, source]));
  const date = new Intl.DateTimeFormat(english ? 'en-US' : 'ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(catalog.meta.checkedAt));
  const lines = [
    english ? '# Deadlock — formulas and mechanics' : '# Deadlock — формулы и механики',
    '',
    english
      ? `**Reviewed ${date}. Client ${catalog.meta.reviewedClientVersion}, SourceRevision ${catalog.meta.sourceRevision}.**`
      : `**Проверено ${date}. Клиент ${catalog.meta.reviewedClientVersion}, SourceRevision ${catalog.meta.sourceRevision}.**`,
    '',
    english
      ? 'Consistent independent observations are used as working rules. Provenance, conditions and specific disagreements are preserved. This review uses game files and published observations; the game was not launched.'
      : 'Согласующиеся независимые наблюдения принимаются как рабочие правила. Происхождение, условия и конкретные расхождения сохранены. Это проверка файлов и опубликованных наблюдений; игра не запускалась.',
    '',
    english
      ? 'Percentages in equations are fractions: 30% = 0.30. Enter ordinary percentages in the calculator. HP and effective HP are different; rounding is applied only for display.'
      : 'Проценты в уравнениях — доли: 30% = 0,30. В калькулятор вводи обычные проценты. HP и эффективное HP различаются; округление применяется только при выводе.',
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
      `**${labels[formula.confidence]} · ${formula.category}**`,
      '',
      `\`${formula.expression}\``,
      '',
      ...formula.variables.map((text) => `- ${text}`),
      '',
      ...formula.explanation.flatMap((text) => [text, '']),
      `**${english ? 'Example.' : 'Пример.'}** ${formula.example}`,
      '',
      english ? '**Scope and limitations:**' : '**Границы применения:**',
      '',
      ...formula.caveats.map((text) => `- ${text}`),
      '',
      `${english ? 'Sources' : 'Источники'}: ${formula.sourceIds
        .map((id) => {
          const source = sources.get(id);
          if (!source) throw new Error(`Missing source ${id}`);
          return `[${source.label}](${source.url})`;
        })
        .join(', ')}.`,
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
