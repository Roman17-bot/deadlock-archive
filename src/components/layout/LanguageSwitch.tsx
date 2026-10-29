import { useI18n } from '../../i18n';
import './LanguageSwitch.css';

export function LanguageSwitch() {
  const { t, language, setLanguage } = useI18n();
  return (
    <div
      className="language-switch"
      data-language={language}
      role="group"
      aria-label={t('Язык сайта')}
    >
      {(['ru', 'en'] as const).map((locale) => (
        <button
          key={locale}
          type="button"
          lang={locale}
          aria-label={locale === 'ru' ? 'Русский' : 'English'}
          aria-pressed={language === locale}
          onClick={() => void setLanguage(locale)}
        >
          <span>{locale.toUpperCase()}</span>
        </button>
      ))}
    </div>
  );
}
