import type { ReactNode } from 'react';
import type { HeroSnapshot } from '../../../shared/types';
import type { PageRoute } from '../../app/useHashRoute';
import { useI18n } from '../../i18n';
import { useActionMotion } from '../../hooks/useActionMotion';
import { Header } from './Header';
import { Footer } from './Footer';

export function SiteLayout({
  data,
  route,
  onMethod,
  children,
}: {
  data: HeroSnapshot | null;
  route: PageRoute;
  onMethod: () => void;
  children: ReactNode;
}) {
  const { t } = useI18n();
  const onClickCapture = useActionMotion();
  return (
    <>
      <a
        className="skip-link"
        href="#main"
        onClick={(event) => {
          event.preventDefault();
          document.getElementById('main')?.focus();
        }}
      >
        {t('К содержимому')}
      </a>
      <Header data={data} route={route} />
      <main id="main" tabIndex={-1} onClickCapture={onClickCapture}>
        {children}
      </main>
      <Footer data={data} onMethod={onMethod} />
    </>
  );
}
