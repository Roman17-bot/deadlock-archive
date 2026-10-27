import type { HeroSnapshot } from '../../../shared/types';
import { HomeHero } from './components/HomeHero';
import { ArchiveStrip } from './components/ArchiveStrip';
import { RegisterIntro } from './components/RegisterIntro';
import { FeaturedRecords } from './components/FeaturedRecords';
import { ArchiveNote } from './components/ArchiveNote';

export function HomePage({ data, onMethod }: { data: HeroSnapshot; onMethod: () => void }) {
  return (
    <div className="home-page">
      <HomeHero data={data} />
      <ArchiveStrip data={data} onMethod={onMethod} />
      <RegisterIntro />
      <FeaturedRecords data={data} />
      <ArchiveNote onMethod={onMethod} />
    </div>
  );
}
