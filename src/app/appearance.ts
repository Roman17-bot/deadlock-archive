export type Appearance = 'noir' | 'heritage';

export function appearanceFromSearch(search: string): Appearance {
  return new URLSearchParams(search).get('theme') === 'heritage' ? 'heritage' : 'noir';
}

/** A link-scoped preview; hash navigation keeps it, other tabs retain their own choice. */
export function applyAppearance(search: string, page: Document = document) {
  const appearance = appearanceFromSearch(search);
  page.documentElement.dataset.theme = appearance;
  page
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', appearance === 'heritage' ? '#17231f' : '#121a23');
  const icon = page.querySelector('link[rel="icon"]');
  if (icon) {
    const filename =
      appearance === 'heritage' ? 'archive-emblem-heritage.svg' : 'archive-emblem.svg';
    icon.setAttribute(
      'href',
      (icon.getAttribute('href') ?? '').replace(/archive-emblem(?:-heritage)?\.svg$/, filename),
    );
  }
  return appearance;
}
