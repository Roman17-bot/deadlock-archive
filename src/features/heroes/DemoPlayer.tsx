import { useEffect, useRef } from 'react';
import type { HeroVideo } from '../../../shared/hero-reference';
import { useI18n } from '../../i18n';
import { referenceMedia } from '../../services/heroReferenceApi';

export function DemoPlayer({
  title,
  video,
  onClose,
}: {
  title: string;
  video?: HeroVideo;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const { language } = useI18n();
  const en = language === 'en';
  useEffect(() => {
    if (
      !opener.current &&
      document.activeElement instanceof HTMLElement &&
      !ref.current?.contains(document.activeElement)
    )
      opener.current = document.activeElement;
    ref.current?.showModal();
    return () => {
      // Native dialog removal restores focus after React's cleanup; restore the
      // trigger once that removal has finished as well.
      queueMicrotask(() => {
        if (opener.current?.isConnected) opener.current.focus();
      });
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="hero-demo"
      onCancel={onClose}
      onClick={(event) => {
        if (event.target === ref.current) onClose();
      }}
      aria-labelledby="demo-title"
    >
      <header>
        <h2 id="demo-title">{title}</h2>
        <button type="button" onClick={onClose} aria-label={en ? 'Close video' : 'Закрыть видео'}>
          ×
        </button>
      </header>
      {video ? (
        <>
          <video
            controls
            preload="none"
            poster={referenceMedia(video.poster)}
            src={`${referenceMedia(video.url)}#t=${video.startSeconds},${video.endSeconds}`}
            onLoadedMetadata={(event) => {
              event.currentTarget.currentTime = video.startSeconds;
            }}
            onTimeUpdate={(event) => {
              if (event.currentTarget.currentTime >= video.endSeconds) event.currentTarget.pause();
            }}
          >
            {en ? 'Your browser cannot play this video.' : 'Браузер не поддерживает это видео.'}
          </video>
          <a href={video.sourceUrl} target="_blank" rel="noreferrer">
            {en ? 'Original video' : 'Оригинал видео'}
          </a>
        </>
      ) : (
        <p className="hero-empty">{en ? 'No video yet' : 'Видео пока нет'}</p>
      )}
    </dialog>
  );
}
