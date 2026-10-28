import { createInstance } from 'i18next';
import { initReactI18next, useTranslation } from 'react-i18next';
import { useCallback } from 'react';
import { enCommon } from './en-common';
import { enData } from './en-data';
import { enCalculator } from './en-calculator';
import { enHistory } from './en-history';
import { enHeroes } from './en-heroes';
import { enPublic } from './en-public';
import { enItems } from './en-items';
import { publicMessage } from './publicMessages';

const englishTranslations = {
  ...enCommon,
  ...enData,
  ...enCalculator,
  ...enHistory,
  ...enHeroes,
  ...enPublic,
  ...enItems,
};

export type Language = 'ru' | 'en';
const storageKey = 'deadlock-language';
export function savedLanguage(): Language {
  try {
    return localStorage.getItem(storageKey) === 'en' ? 'en' : 'ru';
  } catch {
    return 'ru';
  }
}

export const i18n = createInstance();
void i18n.use(initReactI18next).init({
  lng: savedLanguage(),
  fallbackLng: 'ru',
  supportedLngs: ['ru', 'en'],
  initAsync: false,
  keySeparator: false,
  nsSeparator: false,
  returnNull: false,
  interpolation: { escapeValue: false },
  react: { useSuspense: false },
  resources: {
    ru: { translation: {} },
    en: { translation: englishTranslations },
  },
});

function syncLanguage(language: string) {
  if (typeof document !== 'undefined')
    document.documentElement.lang = language === 'en' ? 'en' : 'ru';
}
i18n.on('languageChanged', syncLanguage);
syncLanguage(i18n.language);

export async function setLanguage(language: Language) {
  try {
    localStorage.setItem(storageKey, language);
  } catch {
    // The selected language still works when browser storage is unavailable.
  }
  await i18n.changeLanguage(language);
}

export function translate(key: string, values?: Record<string, unknown>): string {
  return String(i18n.t(key, values ?? {}));
}

export function useI18n() {
  const { t: bound, i18n: instance } = useTranslation();
  const t = useCallback(
    (key: string, values?: Record<string, unknown>) => String(bound(key, values ?? {})),
    [bound],
  );
  return {
    t,
    language: (instance.resolvedLanguage === 'en' || instance.language === 'en'
      ? 'en'
      : 'ru') as Language,
    setLanguage,
  };
}

/** Translate validated server sentences and domain errors without losing their numeric details. */
export function translateError(message: string): string {
  message = publicMessage(message);
  if (i18n.language !== 'en') return message;
  if (i18n.exists(message, { lng: 'en' })) return translate(message);
  const numberError = message.match(/^(.*): введи число; десятичная запятая разрешена\.$/);
  if (numberError)
    return `${translate(numberError[1])}: enter a number; a decimal comma is allowed.`;
  const rangeError = message.match(/^(.*): допустимо от (.+) до (.+)\.$/);
  if (rangeError)
    return `${translate(rangeError[1])}: use a value from ${rangeError[2]} to ${rangeError[3]}.`;
  let translated = message;
  // Compound status messages may append an indexing/history warning to a successful save.
  for (const [ru, en] of Object.entries(englishTranslations).sort(
    (a, b) => b[0].length - a[0].length,
  )) {
    if (/[А-Яа-яЁё]/.test(ru) && translated.includes(ru))
      translated = translated.replaceAll(ru, en);
  }
  return /[А-Яа-яЁё]/.test(translated)
    ? 'The operation could not be completed. Check the input or reconnect and try again.'
    : translated;
}

export function translateDataText(text: string): string {
  if (i18n.language !== 'en') return text;
  if (i18n.exists(text, { lng: 'en' })) return translate(text);
  const client = text.match(/^(Параметры героев|Оружие и способности) · клиент (\d+)$/);
  if (client)
    return `${client[1] === 'Параметры героев' ? 'Hero parameters' : 'Weapons and abilities'} · client ${client[2]}`;
  return /[А-Яа-яЁё]/.test(text)
    ? 'This source note has not been translated yet. See the original parameters.'
    : text;
}
