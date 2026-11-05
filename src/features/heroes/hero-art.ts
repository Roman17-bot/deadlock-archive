import media from './hero-art.json';

export const heroArtwork: Readonly<
  Record<number, { render?: string; nameplate?: string; accent?: string } | undefined>
> = media;
