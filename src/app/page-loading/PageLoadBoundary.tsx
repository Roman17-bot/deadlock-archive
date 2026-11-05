import { useCallback, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import {
  ArchivePageSkeleton,
  type ArchivePageSkeletonKind,
} from '../../components/ui/ArchivePageSkeleton/ArchivePageSkeleton';
import { useI18n } from '../../i18n';
import { observePageImages } from './observePageImages';
import { PageDataContext } from '../../hooks/usePageDataPending';
import './page-loading.css';

export function PageLoading({ kind }: { kind: ArchivePageSkeletonKind }) {
  const { t } = useI18n();
  return (
    <>
      <span className="sr-only" role="status">
        {t('Загружаем данные…')}
      </span>
      <ArchivePageSkeleton kind={kind} />
    </>
  );
}

export function PageLoadBoundary({
  kind,
  onLoadingChange,
  children,
}: {
  kind: ArchivePageSkeletonKind;
  onLoadingChange: (loading: boolean) => void;
  children: ReactNode;
}) {
  const [ready, setReady] = useState(false);
  const stage = useRef<HTMLDivElement>(null);
  const pending = useRef(0);
  const observer = useRef<ReturnType<typeof observePageImages>>(null);
  const begin = useCallback(() => {
    pending.current += 1;
    return () => {
      pending.current -= 1;
      observer.current?.schedule();
    };
  }, []);

  useLayoutEffect(() => {
    if (ready || !stage.current) return;
    onLoadingChange(true);
    const media = observePageImages(
      stage.current,
      () => pending.current > 0,
      () => {
        setReady(true);
        onLoadingChange(false);
      },
    );
    observer.current = media;
    return () => {
      media.stop();
      observer.current = null;
    };
  }, [onLoadingChange, ready]);

  return (
    <div className="page-load">
      {!ready && <PageLoading kind={kind} />}
      <div
        className="page-load-content"
        data-staged={!ready || undefined}
        aria-hidden={!ready || undefined}
        inert={!ready}
        ref={stage}
      >
        <PageDataContext.Provider value={ready ? null : begin}>{children}</PageDataContext.Provider>
      </div>
    </div>
  );
}
