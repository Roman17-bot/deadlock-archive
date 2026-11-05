import { useState } from 'react';
import type { ReactNode } from 'react';

export function DossierSceneFrame() {
  return (
    <span className="dossier-scene-frame" aria-hidden="true">
      {['tl', 'tr', 'br', 'bl'].map((corner) => (
        <svg
          className={`dossier-mat-corner dossier-mat-corner--${corner}`}
          key={corner}
          viewBox="0 0 70 70"
          fill="none"
        >
          <path d="M2 68V2h66L56 14H24L14 24v32z" fill="#25372a" stroke="currentColor" />
          <path
            d="M7 53V7h46M20 17l-3 3M13 10l-3 3M45 11h-9M11 45v-9"
            stroke="currentColor"
            opacity=".65"
          />
          <circle cx="11" cy="11" r="3.25" fill="#d1ad66" />
          <path d="M33 2h9M2 33v9" stroke="#e7d4a1" />
        </svg>
      ))}
    </span>
  );
}

export function DossierScene({
  name,
  lettering,
  portrait,
  fallbackPortrait,
  summary,
  kicker,
  children,
}: {
  name: string;
  lettering?: string;
  portrait: string;
  fallbackPortrait: string;
  summary?: string;
  kicker: string;
  children: ReactNode;
}) {
  const [letteringFailed, setLetteringFailed] = useState(false);
  const [portraitFailed, setPortraitFailed] = useState(false);
  const smallPortrait = portraitFailed || portrait === fallbackPortrait;
  return (
    <header className="dossier-scene">
      <img
        className={
          smallPortrait
            ? 'dossier-scene-figure dossier-scene-figure--portrait'
            : 'dossier-scene-figure'
        }
        src={smallPortrait ? fallbackPortrait : portrait}
        alt=""
        decoding="async"
        fetchPriority="high"
        onError={() => setPortraitFailed(true)}
      />
      <DossierSceneFrame />
      <div className="dossier-scene-copy">
        <p className="dossier-scene-kicker">{kicker}</p>
        <h1>
          {lettering && !letteringFailed ? (
            <img src={lettering} alt={name} onError={() => setLetteringFailed(true)} />
          ) : (
            name
          )}
        </h1>
        {summary && <p className="dossier-scene-summary">{summary}</p>}
        {children}
      </div>
    </header>
  );
}

type StatKind = 'weapon' | 'vitality' | 'spirit' | 'growth';

export function DossierStatEngraving({ kind }: { kind: StatKind }) {
  return (
    <svg className="dossier-stat-engraving" viewBox="0 0 176 106" fill="none" aria-hidden="true">
      <g stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 18h21M18 18v18m119-18h21v18M18 70v18h21m119-18v18h-21" opacity=".46" />
        <path d="M29 53h118M88 21v64" strokeDasharray="1 4" opacity=".4" />
        {kind === 'weapon' && (
          <>
            <path d="M42 44h53l26 4c9 1 16 4 19 5-3 1-10 4-19 5l-26 4H42z" />
            <path d="M42 44h6v18h-6zm9 1v16m43-16v16M53 48h36m-36 4h36m-36 5h36M105 50l18 2m-18 3 18-2M34 40v26m-6-22v18" />
            <path d="M51 74h43m-43-3v6m43-6v6m-35-3v2m9-2v2m9-2v2m9-2v2" opacity=".65" />
          </>
        )}
        {kind === 'vitality' && (
          <>
            <path d="M88 78S54 60 54 44c0-10 7-16 16-16 8 0 15 4 18 11 3-7 10-11 18-11 9 0 16 6 16 16 0 16-34 34-34 34Z" />
            <path d="M46 53h23l5-8 8 17 8-20 7 11h32M61 44c0-6 4-9 9-9m37 30-9 7m13-11-1 1" />
            <path d="M55 79h-8v-8m74 8h8v-8" opacity=".65" />
          </>
        )}
        {kind === 'spirit' && (
          <>
            <circle cx="88" cy="53" r="30" opacity=".6" />
            <path d="M88 24l20 17v25L88 82 68 66V41zm0 0 10 17v25L88 82 78 66V41zm-20 17h40M68 66h40m-20-25v25" />
            <path
              d="M47 40l7 6-7 6-7-6zm81 13 7 6-7 6-7-6zm-12-28 3 3-3 3-3-3zm-56 50 3 3-3 3-3-3z"
              opacity=".75"
            />
          </>
        )}
        {kind === 'growth' && (
          <>
            <path d="M48 74h22V62h22V50h22V38h18M48 74v7h84V38m-62 36v7m22-19v19m22-31v31" />
            <path d="M48 62h11V50h22V38h22V26h19m-9-8 9 8-9 8" />
            <path d="M52 77h13m10-7h12m10-11h12m10-12h9" opacity=".65" />
          </>
        )}
      </g>
    </svg>
  );
}

export function DossierStatPlate({
  kind,
  title,
  notes,
  weaponPrint,
  children,
}: {
  kind: StatKind;
  title: string;
  notes?: readonly string[];
  weaponPrint?: { src: string; name: string };
  children: ReactNode;
}) {
  return (
    <section className="dossier-stat-plate" data-kind={kind} aria-label={title}>
      <header>
        <h3>{title}</h3>
        {weaponPrint ? (
          <DossierWeaponPrint key={weaponPrint.src} {...weaponPrint} />
        ) : (
          <DossierStatEngraving kind={kind} />
        )}
      </header>
      <dl>{children}</dl>
      {notes?.map((note) => (
        <p className="dossier-stat-note" key={note}>
          {note}
        </p>
      ))}
    </section>
  );
}

function DossierWeaponPrint({ src, name }: { src: string; name: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <DossierStatEngraving kind="weapon" />;

  return (
    <div className="dossier-weapon-print">
      <figure className="dossier-weapon-paper">
        <div className="dossier-weapon-negative">
          <img src={src} alt="" loading="lazy" decoding="async" onError={() => setFailed(true)} />
        </div>
        <svg
          className="dossier-weapon-wear"
          viewBox="0 0 196 104"
          preserveAspectRatio="none"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M1 87l6 1 9 10 7 1M174 1l9 5 7 10 5 1M1 7l7-4 14-1m142 97 14-3 17 1"
            stroke="#775a39"
            strokeWidth=".75"
            opacity=".75"
          />
          <path
            d="M3 86l7 4 8 8m161-95 8 9 7 2M3 41l2 8m186 19-2 11M28 101l19-2"
            stroke="#f9edce"
            strokeWidth=".85"
            opacity=".85"
          />
          <path
            d="M13 15l4-1m-3 4 1 2m164 48 3-2m-7 4 1-.8m10-44-.6 3.1"
            stroke="#f9edce"
            strokeWidth=".72"
            strokeLinecap="round"
            opacity=".64"
          />
          <path
            d="m20 27 2 1m149 32 1-2m-32-44 2 .4m-97 57 3-1"
            stroke="#372b22"
            strokeWidth=".55"
            strokeLinecap="round"
            opacity=".45"
          />
        </svg>
        <figcaption>{name}</figcaption>
      </figure>
      <svg className="dossier-weapon-pin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M11 14.8c3.4-2.1 8.5-2.1 10.2-.2 2.3 2.6-3.6 7.6-8.3 8-5.7.5-7.1-4.5-1.9-7.8Z"
          fill="#382318"
          fillOpacity=".55"
        />
        <path
          d="M8.5 12.5c.9-2.1 3.9-3.7 6.8-3.1 2.7.5 4.2 2.7 3.3 5.1l-.4 1.7c-1 2.8-7 4.3-9.7 2.2-1.1-.9-.8-3.7 0-5.9Z"
          fill="#6b4524"
          stroke="#46301d"
          strokeWidth=".65"
        />
        <path d="M9.9 13.1c-.4 1.6-.5 2.9.4 3.7.7.6 1.8.8 2.9.6l.8-4.1Z" fill="#b58a52" />
        <path
          d="M4.6 8.4C4 5.1 7.5 2.4 12 2.1s8.7 1.7 9.1 4.8l.2 1.6c.4 3.1-3.1 5.7-7.8 6.1-4.7.4-8.5-1.6-8.9-4.7Z"
          fill="#9c6936"
          stroke="#543a23"
          strokeWidth=".7"
        />
        <ellipse
          cx="12.8"
          cy="7.4"
          rx="8.1"
          ry="5.2"
          transform="rotate(-8 12.8 7.4)"
          fill="#d9b775"
          stroke="#b38a51"
          strokeWidth=".65"
        />
        <path
          d="M6.5 7.6c.3-2 3-3.9 6.5-4.2"
          stroke="#f9e9bd"
          strokeWidth=".85"
          strokeLinecap="round"
        />
        <path
          d="M14 11.1c2.3-.3 4-1.4 4.9-2.8"
          stroke="#ac8048"
          strokeWidth=".7"
          strokeLinecap="round"
        />
        <path
          d="m7.6 9.6 1.6-.5m5.8-4.4 1.1.2"
          stroke="#8d663f"
          strokeOpacity=".65"
          strokeWidth=".47"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}
