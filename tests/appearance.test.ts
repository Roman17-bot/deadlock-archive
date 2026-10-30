// @vitest-environment jsdom
import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { applyAppearance, appearanceFromSearch } from '../src/app/appearance';

it('uses heritage by default and accepts only an explicit noir alternative', () => {
  expect(appearanceFromSearch('?theme=heritage')).toBe('heritage');
  expect(appearanceFromSearch('?theme=noir')).toBe('noir');
  for (const query of ['', '?theme=other', '?theme=%22%3E%3Cscript%3E', '?theme=HERITAGE']) {
    expect(appearanceFromSearch(query)).toBe('heritage');
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

it('restores heritage after an explicit noir link without persisting that choice', () => {
  const page = document.implementation.createHTMLDocument();
  page.head.innerHTML =
    '<meta name="theme-color"><link rel="icon" href="/assets/brand/archive-emblem.svg">';
  applyAppearance('?theme=noir', page);
  expect(page.documentElement.dataset.theme).toBe('noir');
  applyAppearance('', page);
  expect(page.documentElement.dataset.theme).toBe('heritage');
  expect(page.querySelector('meta')?.getAttribute('content')).toBe('#17231f');
  expect(page.querySelector('link')?.getAttribute('href')).toBe(
    '/assets/brand/archive-emblem-heritage.svg',
  );
});

it('ships a heritage HTML shell so the first paint matches the default appearance', () => {
  const html = readFileSync('index.html', 'utf8');
  const page = new DOMParser().parseFromString(html, 'text/html');
  expect(page.documentElement.dataset.theme).toBe('heritage');
  expect(page.querySelector('meta[name="theme-color"]')?.getAttribute('content')).toBe('#17231f');
  expect(page.querySelector('link[rel="icon"]')?.getAttribute('href')).toBe(
    '/assets/brand/archive-emblem-heritage.svg',
  );
});

it('works when optional browser metadata is absent', () => {
  const page = document.implementation.createHTMLDocument();
  expect(() => applyAppearance('?theme=heritage', page)).not.toThrow();
  expect(page.documentElement.dataset.theme).toBe('heritage');
});
