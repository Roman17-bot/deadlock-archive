// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import snapshot from '../data/heroes.json';
import type { Hero, HeroSnapshot } from '../shared/types';
import { statsAtLevel } from '../shared/heroes';
import { HeroesPage } from '../src/pages/HeroesPage/HeroesPage';
import { HeroNotesRow } from '../src/pages/HeroesPage/components/HeroNotesRow';
import { i18n, setLanguage } from '../src/i18n';

const data = snapshot as HeroSnapshot;
const hero = (name: string): Hero => data.heroes.find((entry) => entry.name === name)!;

beforeEach(async () => {
  window.location.hash = '#/heroes';
  localStorage.clear();
  await i18n.changeLanguage('ru');
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function renderNotes(name: string, level = 1) {
  const selected = hero(name);
  return render(
    <table>
      <tbody>
        <HeroNotesRow
          hero={selected}
          stats={statsAtLevel(selected, level)}
          level={level}
          columnCount={10}
        />
      </tbody>
    </table>,
  );
}

function metric(root: HTMLElement, label: string) {
  return within(root).getByText(label, { selector: 'dt' }).parentElement!;
}

describe('readable hero details', () => {
  it('shows Solomon’s complete natural growth and keeps source flags behind a disclosure', async () => {
    const user = userEvent.setup();
    render(<HeroesPage data={data} onMethod={() => {}} />);
    await user.click(screen.getByRole('button', { name: 'Примечания: Solomon' }));
    const notes = screen.getByRole('region', { name: 'Solomon / параметры оружия' });
    expect(metric(notes, 'Урон выстрела')).toHaveTextContent('30 HP');
    expect(metric(notes, 'Урон за уровень')).toHaveTextContent('+0,554 HP');
    expect(within(notes).getByText(/Прямой прирост.*0,4.*0,154.*0,554/)).toBeVisible();
    expect(within(notes).getByText(/1,1.*0,14/)).toBeVisible();
    const original = within(notes).getByText(/m_bSuppressBulletOnBishopFire/);
    expect(original).not.toBeVisible();
    expect(within(notes).getByText(/intra_burst_cycle_time/)).not.toBeVisible();
    await user.click(
      within(notes).getByText('Исходные данные и оговорки', { selector: 'summary' }),
    );
    expect(original).toBeVisible();
    expect(within(notes).getByRole('link', { name: 'Открыть исходные параметры' })).toHaveAttribute(
      'href',
      hero('Solomon').source.weaponUrl,
    );
  });

  it('recalculates an open panel at the chosen level without reusing the base example', async () => {
    const user = userEvent.setup();
    render(<HeroesPage data={data} onMethod={() => {}} />);
    await user.click(screen.getByRole('button', { name: 'Примечания: Solomon' }));
    fireEvent.change(screen.getByRole('slider', { name: 'Уровень героя' }), {
      target: { value: '11' },
    });
    const notes = screen.getByRole('region', { name: 'Solomon / параметры оружия' });
    expect(within(notes).getByText('Уровень 11')).toBeVisible();
    expect(metric(notes, 'Урон выстрела')).toHaveTextContent('35,54 HP');
    expect(metric(notes, 'Расчётный DPS')).toHaveTextContent('71,08 HP/с');
    expect(metric(notes, 'Урон за уровень')).toHaveTextContent('+0,554 HP');
  });

  it('adds ordinary pellets while counting only one full hit for overlapping trajectories', () => {
    const view = renderNotes('Abrams');
    let notes = screen.getByRole('region', { name: 'Abrams / параметры оружия' });
    expect(metric(notes, 'Урон одной дробины')).toHaveTextContent('3,6 HP');
    expect(metric(notes, 'Дробин в выстреле')).toHaveTextContent('9');
    expect(metric(notes, 'Урон выстрела')).toHaveTextContent('32,4 HP');
    expect(within(notes).getByText(/Все 9 дробин.*одну цель/)).toBeVisible();
    view.unmount();
    renderNotes('Baba');
    notes = screen.getByRole('region', { name: 'Baba / параметры оружия' });
    expect(metric(notes, 'Урон выстрела')).toHaveTextContent('8,8 HP');
    expect(within(notes).queryByText('Урон одной дробины')).not.toBeInTheDocument();
    expect(within(notes).getByText(/один выстрел.*8,8.*Несколько снарядов/)).toBeVisible();
    expect(
      within(notes).getByText(/Рабочая модель.*наблюдениям игроков.*не проверка игрового движка/),
    ).not.toBeVisible();
  });

  it('distinguishes a single shot from its burst and explains how burst pauses affect DPS', () => {
    renderNotes('Paradox');
    const notes = screen.getByRole('region', { name: 'Paradox / параметры оружия' });
    expect(metric(notes, 'Урон выстрела')).toHaveTextContent('6,8 HP');
    expect(metric(notes, 'Урон полной очереди')).toHaveTextContent('34 HP');
    expect(metric(notes, 'Выстрелов в очереди')).toHaveTextContent('5');
    expect(metric(notes, 'Магазин')).toHaveTextContent('40');
    expect(
      within(notes).getByText(/Один выстрел.*часть очереди.*не урон всей очереди/),
    ).toBeVisible();
    expect(within(notes).getByText(/паузы между выстрелами.*между очередями/)).toBeVisible();
    expect(within(notes).getByText(/без перезарядки.*сопротивлен.*дистанции/)).toBeVisible();
  });

  it('updates fully spun-up DPS with the level instead of repeating a level-one source note', () => {
    renderNotes('McGinnis', 11);
    const notes = screen.getByRole('region', { name: 'McGinnis / параметры оружия' });
    expect(metric(notes, 'Расчётный DPS')).toHaveTextContent('37,1 HP/с');
    expect(metric(notes, 'DPS при полной раскрутке')).toHaveTextContent('92,74 HP/с');
    expect(within(notes).getByText(/время на раскрутку.*не включено/)).toBeVisible();
  });

  it('includes Warden’s fire-rate scaling once and Victor’s regeneration scaling', () => {
    const view = renderNotes('Warden', 11);
    let notes = screen.getByRole('region', { name: 'Warden / параметры оружия' });
    expect(metric(notes, 'Расчётный DPS')).toHaveTextContent('77,33 HP/с');
    expect(within(notes).getByText(/0,21%.*2,31%.*один раз/)).toBeVisible();
    view.unmount();
    renderNotes('Victor', 11);
    notes = screen.getByRole('region', { name: 'Victor / параметры оружия' });
    expect(metric(notes, 'Восстановление за уровень')).toHaveTextContent('+0,088 HP/с');
    expect(within(notes).getByText(/0,08 HP\/с.*1,1.*0,088 HP\/с/)).toBeVisible();
  });

  it('explains special weapon limits without exposing raw configuration in the main view', () => {
    const cases = [
      ['Bebop', /задержка 0,3 с.*после неё/],
      ['Deadman Danny', /без заряда.*Заряженная атака.*отдельного расчёта/],
      ['Graves', /порция урона.*тик.*одна цель/],
      ['Silver', /исходная винтовка.*форме волка не относятся/],
      ['Violet', /без усиленного альтернативного режима.*Sketchbook/],
    ] as const;
    for (const [name, explanation] of cases) {
      const view = renderNotes(name);
      const notes = screen.getByRole('region', { name: `${name} / параметры оружия` });
      expect(within(notes).getByText(explanation, { selector: 'p' })).toBeVisible();
      for (const paragraph of notes.querySelectorAll('p')) {
        if (!paragraph.closest('details'))
          expect(paragraph.textContent).not.toMatch(
            /m_[a-zA-Z]|HitOnce|cycle_time|WindUpTime|citadel_weapon/,
          );
      }
      view.unmount();
    }
  });

  it('keeps the expanded panel and selected level when mobile columns change', async () => {
    const media = Object.assign(new EventTarget(), { matches: true });
    vi.stubGlobal('matchMedia', () => media);
    const user = userEvent.setup();
    render(<HeroesPage data={data} onMethod={() => {}} />);
    await user.click(screen.getByRole('button', { name: 'Примечания: Solomon' }));
    fireEvent.change(screen.getByRole('slider'), { target: { value: '11' } });
    await user.click(screen.getByRole('button', { name: 'Приросты за LVL' }));
    const notes = screen.getByRole('region', { name: 'Solomon / параметры оружия' });
    expect(notes).toBeVisible();
    expect(notes.closest('td')).toHaveAttribute('colspan', '5');
    expect(metric(notes, 'Урон выстрела')).toHaveTextContent('35,54 HP');
    expect(screen.getByRole('button', { name: 'Примечания: Solomon' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
  });

  it('renders every hero and its source disclosure in English without untranslated notes', async () => {
    await setLanguage('en');
    render(
      <table>
        <tbody>
          {data.heroes.map((selected) => (
            <HeroNotesRow
              key={selected.id}
              hero={selected}
              stats={statsAtLevel(selected, 11)}
              level={11}
              columnCount={10}
            />
          ))}
        </tbody>
      </table>,
    );
    expect(screen.getAllByRole('region', { name: /\/ weapon parameters$/ })).toHaveLength(44);
    const notes = screen.getByRole('region', { name: 'Solomon / weapon parameters' });
    expect(metric(notes, 'Damage per level')).toHaveTextContent('+0.554 HP');
    expect(within(notes).getByText(/Direct growth.*0.4.*0.154.*0.554/)).toBeVisible();
    expect(document.body.textContent).not.toMatch(/[А-Яа-яЁё]/);
  });
});
