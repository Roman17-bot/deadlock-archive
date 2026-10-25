import { readFile, writeFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const catalog = JSON.parse(await readFile(new URL('data/mechanics.json', root), 'utf8'));
const labels = {
  math_identity: 'Математика при указанных условиях',
  config_confirmed: 'Параметры и флаги из файлов игры',
  community_documented: 'Рабочее правило по источникам',
  inferred: 'Модель: есть ограничения проверки',
};
const sources = new Map(catalog.sources.map((source) => [source.id, source]));
const date = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
}).format(new Date(catalog.meta.checkedAt));
const lines = [
  '# Deadlock — формулы и механики',
  '',
  `**Проверено ${date}. Клиент ${catalog.meta.reviewedClientVersion}, SourceRevision ${catalog.meta.sourceRevision}.**`,
  '',
  'Согласующиеся независимые наблюдения принимаются как рабочие правила. Происхождение, условия и конкретные расхождения сохранены. Это проверка файлов и опубликованных наблюдений; игра не запускалась.',
  '',
  'Проценты в уравнениях — доли: 30% = 0,30. В калькулятор вводи обычные проценты. HP и эффективное HP различаются; округление применяется только при выводе.',
  '',
  '## Содержание',
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
    `**Пример.** ${formula.example}`,
    '',
    '**Границы применения:**',
    '',
    ...formula.caveats.map((text) => `- ${text}`),
    '',
    `Источники: ${formula.sourceIds
      .map((id) => {
        const source = sources.get(id);
        if (!source) throw new Error(`Missing source ${id}`);
        return `[${source.label}](${source.url})`;
      })
      .join(', ')}.`,
  );
}
const content = lines.join('\n') + '\n';
const target = new URL('docs/mechanics-reference.md', root);
if ((await readFile(target, 'utf8').catch(() => '')) !== content) await writeFile(target, content);
console.log(`Exported ${catalog.formulas.length} mechanics rules.`);
