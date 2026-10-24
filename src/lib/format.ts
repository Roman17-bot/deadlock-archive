export const asset = (path: string) => `${import.meta.env.BASE_URL}${path.replace(/^\//, '')}`;
export const format = (value: number, precision = 2) =>
  new Intl.NumberFormat('ru-RU', { maximumFractionDigits: precision }).format(value);
