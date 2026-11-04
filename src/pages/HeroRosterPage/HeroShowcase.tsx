import { useState } from 'react';
import type { CSSProperties } from 'react';
import type { Hero } from '../../../shared/types';
import type { HeroAbility } from '../../../shared/ability-types';
import type { HeroProfile } from '../../../shared/hero-reference';
import { asset } from '../../lib/format';
import { referenceMedia } from '../../services/heroReferenceApi';
import { ArrowUpRight } from '../../components/ui/ArchiveIcon/ArchiveIcons';
import media from './roster-media.json';

type RosterMedia = { render?: string; nameplate?: string; accent?: string };
const artwork: Record<string, RosterMedia> = media;

function ShowcaseArtwork({ hero, profile }: { hero: Hero; profile?: HeroProfile }) {
  const [fallback, setFallback] = useState(0);
  const render = artwork[hero.id]?.render;
  const candidates = [
    render && referenceMedia(render),
    profile && referenceMedia(profile.art.card),
    asset(hero.portrait),
  ].filter((value): value is string => !!value);
  const src = candidates[Math.min(fallback, candidates.length - 1)];
  const isRender = !!render && fallback === 0;
  return (
    <img
      className={`roster-showcase-art${isRender ? '' : ' roster-showcase-art--fallback'}`}
      src={src}
      onError={() => setFallback((index) => Math.min(index + 1, candidates.length - 1))}
      alt=""
      decoding="async"
      fetchPriority="high"
    />
  );
}

function Nameplate({ hero }: { hero: Hero }) {
  const [failed, setFailed] = useState(false);
  const nameplate = artwork[hero.id]?.nameplate;
  return (
    <h2>
      {nameplate && !failed ? (
        <img
          className="roster-hero-lettering"
          src={referenceMedia(nameplate)}
          onError={() => setFailed(true)}
          alt={hero.name}
        />
      ) : (
        hero.name
      )}
    </h2>
  );
}

export function HeroShowcase({
  hero,
  profile,
  language,
  abilities,
  arriving,
}: {
  hero: Hero;
  profile?: HeroProfile;
  language: 'ru' | 'en';
  abilities?: HeroAbility[];
  arriving: boolean;
}) {
  const en = language === 'en';
  return (
    <aside
      className="roster-showcase"
      style={{ '--hero-accent': artwork[hero.id]?.accent ?? '#b79d66' } as CSSProperties}
      aria-label={en ? 'Hero preview' : 'Обзор героя'}
    >
      <div className="roster-showcase-content" key={hero.id} data-arriving={arriving || undefined}>
        <div className="roster-showcase-stage">
          <img
            className="roster-showcase-seal"
            src={asset('assets/roster/dossier-seal.svg')}
            alt=""
          />
          <ShowcaseArtwork hero={hero} profile={profile} />
        </div>
        <div className="roster-bookplate">
          <img src={asset('assets/roster/dossier-bookplate.svg')} alt="" />
          <Nameplate hero={hero} />
          {profile && <p>{profile.summary[language]}</p>}
        </div>
        <div
          className="roster-abilities"
          aria-label={en ? 'Hero abilities' : 'Способности героя'}
          aria-busy={!abilities}
        >
          {abilities
            ? abilities.map((a) => (
                <div key={a.id} className="roster-ability" title={a.name[language]}>
                  <span className="roster-ability-icon">
                    <img src={asset(a.icon)} alt="" />
                    <span>{a.slot}</span>
                  </span>
                  <span className="roster-ability-name">{a.name[language]}</span>
                </div>
              ))
            : [1, 2, 3, 4].map((slot) => (
                <span
                  className="roster-ability roster-ability-placeholder"
                  key={slot}
                  aria-hidden="true"
                />
              ))}
        </div>
        <div className="roster-actions">
          <a className="roster-open-dossier" href={`#/heroes/${hero.slug}`}>
            <svg
              className="roster-file-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              aria-hidden="true"
            >
              <path d="M3 8h7l2 2h9v11H3z" />
              <g className="file-leaf">
                <path d="M6 3h9l4 4v11H6z" fill="var(--surface)" />
                <path d="M15 3v5h4M9 11h7M9 14h5" />
              </g>
              <path d="M3 12h18v9H3z" fill="var(--surface)" />
            </svg>
            {en ? 'Open dossier' : 'Открыть досье'}
            <ArrowUpRight size={18} />
          </a>
          <a className="roster-calculator-link" href={`#/mechanics?hero=${hero.slug}`}>
            {en ? 'Build calculator' : 'Калькулятор билда'}
          </a>
        </div>
      </div>
    </aside>
  );
}
