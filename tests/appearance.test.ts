// @vitest-environment jsdom
import { expect, it } from 'vitest';
import { applyAppearance, appearanceFromSearch } from '../src/app/appearance';

it('selects only the explicit supported preview and ignores arbitrary attribute values', () => {
  expect(appearanceFromSearch('?theme=heritage')).toBe('heritage');
  for (const query of [
    '',
    '?theme=noir',
    '?theme=other',
    '?theme=%22%3E%3Cscript%3E',
    '?theme=HERITAGE',
  ]) {
    expect(appearanceFromSearch(query)).toBe('noir');
  }
});

it('applies the palette before rendering while preserving a Pages asset prefix', () => {
  const page = document.implementation.createHTMLDocument();
  page.head.innerHTML =
    '<meta name="theme-color" content="#121a23"><link rel="icon" href="/deadlock-archive/assets/brand/archive-emblem.svg">';
  applyAppearance('?theme=heritage', page);
  expect(page.documentElement.dataset.theme).toBe('heritage');
  expect(page.querySelector('meta')?.getAttribute('content')).toBe('#17231f');
  expect(page.querySelector('link')?.getAttribute('href')).toBe(
    '/deadlock-archive/assets/brand/archive-emblem-heritage.svg',
  );
});

it('restores the normal appearance and favicon without persisting a preview choice', () => {
  const page = document.implementation.createHTMLDocument();
  page.head.innerHTML =
    '<meta name="theme-color"><link rel="icon" href="/assets/brand/archive-emblem.svg">';
  applyAppearance('?theme=heritage', page);
  applyAppearance('', page);
  expect(page.documentElement.dataset.theme).toBe('noir');
  expect(page.querySelector('meta')?.getAttribute('content')).toBe('#121a23');
  expect(page.querySelector('link')?.getAttribute('href')).toBe('/assets/brand/archive-emblem.svg');
});

it('works when optional browser metadata is absent', () => {
  const page = document.implementation.createHTMLDocument();
  expect(() => applyAppearance('?theme=heritage', page)).not.toThrow();
  expect(page.documentElement.dataset.theme).toBe('heritage');
});
