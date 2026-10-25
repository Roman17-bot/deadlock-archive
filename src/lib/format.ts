import { i18n, translate } from '../i18n';

const locale = () => (i18n.language === 'en' ? 'en-US' : 'ru-RU');
export const asset = (path: string) => `${import.meta.env.BASE_URL}${path.replace(/^\//, '')}`;
export const format = (value: number, precision = 2) =>
  new Intl.NumberFormat(locale(), { maximumFractionDigits: precision }).format(value);

export const formatDate = (value: string, short = false) => {
  const date = new Date(`${value.slice(0, 10)}T12:00:00Z`);
  return Number.isNaN(date.getTime())
    ? translate('дата не указана')
    : new Intl.DateTimeFormat(
        locale(),
        short
          ? { day: '2-digit', month: '2-digit', year: '2-digit', timeZone: 'UTC' }
          : { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' },
      ).format(date);
};
