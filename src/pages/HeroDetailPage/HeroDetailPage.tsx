import { useState, type ReactNode } from 'react';
import type { HeroSnapshot } from '../../../shared/types';
import type { HeroProfile } from '../../../shared/hero-reference';
import { HeroAbilities } from '../../features/hero-calculator/HeroAbilities';
import { DemoPlayer } from '../../features/heroes/DemoPlayer';
import { heroArtwork } from '../../features/heroes/hero-art';
import { useReference } from '../../features/heroes/useReference';
import { loadHeroProfiles } from '../../services/heroReferenceApi';
import { useI18n, type Language } from '../../i18n';
import { asset } from '../../lib/format';
import {
  ArrowLeft,
  ArrowUpRight,
  BookOpen,
  Crosshair,
} from '../../components/ui/ArchiveIcon/ArchiveIcons';
import { DossierScene } from './HeroDossierArt';
import { DossierStats } from './DossierStats';
import { DossierHeroLink, DossierMatchups, DossierPurchases } from './DossierReports';
import './hero-dossier.css';

function DossierLore({
  profile,
  data,
  language,
}: {
  profile?: HeroProfile;
  data: HeroSnapshot;
  language: Language;
}) {
  const en = language === 'en';
  const chapters = profile?.loreChapters;
  const relationships = (profile?.relationships ?? []).flatMap((relation) => {
    const hero = data.heroes.find((entry) => entry.id === relation.heroId);
    return hero ? [{ hero, description: relation.description[language] }] : [];
  });
  const paragraphText = (text: string) => {
    const parts: ReactNode[] = [];
    let cursor = 0;
    for (const match of text.matchAll(/\[([^\]\r\n]+)\]\(hero:([a-z0-9-]+)\)/g)) {
      const [, label, slug] = match;
      const hero = data.heroes.find((entry) => entry.slug === slug);
      parts.push(text.slice(cursor, match.index));
      parts.push(hero ? <DossierHeroLink key={match.index} hero={hero} label={label} /> : label);
      cursor = match.index + match[0].length;
    }
    parts.push(text.slice(cursor));
    return parts;
  };
  return (
    <section className="dossier-section dossier-lore-sheet" aria-labelledby="dossier-lore-title">
      <div className="dossier-lore-title">
        <BookOpen size={30} />
        <h2 id="dossier-lore-title">{en ? 'The story' : 'История героя'}</h2>
      </div>
      <div className="dossier-lore-content">
        <div>
          {chapters?.length ? (
            chapters.map((chapter) => (
              <section className="dossier-lore-chapter" key={chapter.title.en}>
                <h3>{chapter.title[language]}</h3>
                {chapter.paragraphs.map((paragraph, index) => (
                  <p key={index}>{paragraphText(paragraph[language])}</p>
                ))}
              </section>
            ))
          ) : (
            <p>
              {profile?.lore[language] ||
                (en ? 'The story is not available yet.' : 'История пока недоступна.')}
            </p>
          )}
        </div>
        {relationships.length > 0 && (
          <aside className="dossier-lore-connections">
            <h3>{en ? 'Connections' : 'Связи с героями'}</h3>
            <ul>
              {relationships.map((relation) => (
                <li key={relation.hero.id}>
                  <DossierHeroLink hero={relation.hero} />
                  <p>{relation.description}</p>
                </li>
              ))}
            </ul>
          </aside>
        )}
      </div>
    </section>
  );
}

export function HeroDetailPage({ data, slug }: { data: HeroSnapshot; slug: string }) {
  const { language } = useI18n();
  const en = language === 'en';
  const profiles = useReference(loadHeroProfiles);
  const [tab, setTab] = useState<'play' | 'lore'>('play');
  const [level, setLevel] = useState(1);
  const [demo, setDemo] = useState<{ id: number | 'weapon'; title: string }>();
  const hero = data.heroes.find((entry) => entry.slug === slug);
  if (!hero) {
    return (
      <div className="hero-reference-page">
        <h1>{en ? 'Hero not found' : 'Герой не найден'}</h1>
      </div>
    );
  }
  const profile =
    profiles.data?.clientVersion === data.meta.clientVersion
      ? profiles.data.heroes.find((entry) => entry.heroId === hero.id)
      : undefined;
  const art = heroArtwork[hero.id];
  const tips =
    profile?.reviewedClientVersion == null ||
    profile.reviewedClientVersion === data.meta.clientVersion
      ? profile?.tips
      : undefined;
  const video =
    demo &&
    profile?.videos.find(
      (entry) =>
        entry.abilityId === demo.id &&
        (entry.clientVersion === null || entry.clientVersion === data.meta.clientVersion),
    );
  return (
    <div className="hero-reference-page hero-dossier-page">
      <a className="item-back dossier-back" href="#/heroes/roster">
        <ArrowLeft size={16} />
        {en ? 'All heroes' : 'Все герои'}
      </a>
      <DossierScene
        key={hero.id}
        name={hero.name}
        lettering={art?.nameplate ? asset(art.nameplate) : undefined}
        portrait={asset(art?.render ?? hero.portrait)}
        fallbackPortrait={asset(hero.portrait)}
        summary={profile?.summary[language]}
        kicker={en ? 'Hero dossier' : 'Досье героя'}
      >
        <a className="button dossier-build-link" href={`#/mechanics?hero=${hero.slug}`}>
          {en ? 'Build calculator' : 'Калькулятор билда'}
          <ArrowUpRight size={18} />
        </a>
      </DossierScene>
      {profiles.error ? (
        <p role="alert" className="dossier-notice">
          {en ? 'Hero story could not be loaded.' : 'Не удалось загрузить описание героя.'}{' '}
          <button onClick={profiles.retry}>{en ? 'Retry' : 'Повторить'}</button>
        </p>
      ) : profiles.data && !profile ? (
        <p role="status" className="hero-caption">
          {en
            ? 'The hero story is being updated for this version.'
            : 'Описание героя обновляется для этой версии.'}
        </p>
      ) : null}
      <div
        className="hero-detail-tabs"
        role="group"
        aria-label={en ? 'Dossier sections' : 'Разделы досье'}
      >
        <button aria-pressed={tab === 'play'} onClick={() => setTab('play')}>
          <Crosshair size={19} />
          {en ? 'Gameplay' : 'Игра за героя'}
        </button>
        <button aria-pressed={tab === 'lore'} onClick={() => setTab('lore')}>
          <BookOpen size={19} />
          {en ? 'Lore' : 'Лор'}
        </button>
      </div>
      {tab === 'lore' ? (
        <DossierLore profile={profile} data={data} language={language} />
      ) : (
        <>
          <DossierStats
            hero={hero}
            data={data}
            level={level}
            en={en}
            onLevel={setLevel}
            onDemo={() => setDemo({ id: 'weapon', title: en ? 'Primary attack' : 'Обычная атака' })}
          />
          <HeroAbilities
            dossier
            data={data}
            hero={hero}
            level={level}
            items={[]}
            rules={data.calculatorRules}
            context={{}}
            onDemo={(id, title) => setDemo({ id, title })}
          />
          <section className="dossier-section" aria-labelledby="dossier-tips-title">
            <h2 id="dossier-tips-title">{en ? 'Playing the hero' : 'Советы по игре'}</h2>
            {tips?.length ? (
              <div className="dossier-tip-grid">
                {tips.map((tip, index) => (
                  <article className="dossier-tip" key={index}>
                    {tip.title && <h3>{tip.title[language]}</h3>}
                    <p>{tip[language]}</p>
                  </article>
                ))}
              </div>
            ) : (
              <p className="hero-caption">
                {en ? 'Tips are being prepared.' : 'Советы готовятся.'}
              </p>
            )}
          </section>
          <DossierMatchups hero={hero} data={data} en={en} />
          <DossierPurchases hero={hero} data={data} language={language} />
        </>
      )}
      {demo && <DemoPlayer title={demo.title} video={video} onClose={() => setDemo(undefined)} />}
    </div>
  );
}
