import { useEffect, useRef, useState } from 'react';
import type { HeroVideo } from '../../../shared/hero-reference';
import { useI18n } from '../../i18n';
import { referenceMedia } from '../../services/heroReferenceApi';
import { X } from '../../components/ui/ArchiveIcon/ArchiveIcons';

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
  const [failed, setFailed] = useState(false);
  const { language } = useI18n();
  const en = language === 'en';
  useEffect(() => {
    if (
      !opener.current &&
      document.activeElement instanceof HTMLElement &&
      !ref.current?.contains(document.activeElement)
    )
      opener.current = document.activeElement;
    const dialog = ref.current;
    dialog?.showModal();
    return () => {
      const media = dialog?.querySelector('video');
      if (media && !media.paused) media.pause();
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
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === ref.current) onClose();
      }}
      onKeyDown={(event) => {
        if (!video && event.key === 'Tab') event.preventDefault();
      }}
      aria-labelledby="demo-title"
    >
      <header className="dossier-video-header">
        <div>
          <p>{en ? 'Demonstration' : 'Демонстрация'}</p>
          <h2 id="demo-title">{title}</h2>
        </div>
        <button type="button" onClick={onClose} aria-label={en ? 'Close video' : 'Закрыть видео'}>
          <X size={22} />
        </button>
      </header>
      <div className="dossier-video-stage">
        {video && !failed ? (
          <video
            controls
            playsInline
            preload="none"
            poster={referenceMedia(video.poster)}
            src={`${referenceMedia(video.url)}#t=${video.startSeconds},${video.endSeconds}`}
            onLoadedMetadata={(event) => {
              event.currentTarget.currentTime = video.startSeconds;
            }}
            onPlay={(event) => {
              const player = event.currentTarget;
              if (player.currentTime < video.startSeconds || player.currentTime >= video.endSeconds)
                player.currentTime = video.startSeconds;
            }}
            onSeeking={(event) => {
              const player = event.currentTarget;
              if (player.currentTime < video.startSeconds) player.currentTime = video.startSeconds;
              if (player.currentTime > video.endSeconds) player.currentTime = video.endSeconds;
            }}
            onTimeUpdate={(event) => {
              if (event.currentTarget.currentTime >= video.endSeconds) event.currentTarget.pause();
            }}
            onError={() => setFailed(true)}
          >
            {en ? 'Your browser cannot play this video.' : 'Браузер не поддерживает это видео.'}
          </video>
        ) : (
          <div className="dossier-video-empty">
            <svg viewBox="0 0 80 58" width="80" height="58" fill="none" aria-hidden="true">
              <path
                d="M2 2h76v54H2zM2 12h76M2 46h76M12 2v10m14-10v10m14-10v10m14-10v10m14-10v10M12 46v10m14-10v10m14-10v10m14-10v10m14-10v10"
                stroke="currentColor"
                strokeWidth="1.5"
              />
              <path d="m34 20 16 9-16 9z" stroke="currentColor" strokeWidth="1.5" />
            </svg>
            <p>
              {failed
                ? en
                  ? 'The clip could not be loaded.'
                  : 'Не удалось загрузить видео.'
                : en
                  ? 'No video yet'
                  : 'Видео пока нет'}
            </p>
            {failed && (
              <button className="hero-demo-button" type="button" onClick={() => setFailed(false)}>
                {en ? 'Retry' : 'Повторить'}
              </button>
            )}
          </div>
        )}
      </div>
      {video && (
        <div className="dossier-video-footer">
          <a href={video.sourceUrl} target="_blank" rel="noreferrer">
            {en ? 'Original video' : 'Оригинал видео'}
          </a>
        </div>
      )}
    </dialog>
  );
}
