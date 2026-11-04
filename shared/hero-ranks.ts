/** Tier identities from the game's asset API. Tier zero is unranked, not a ranked cohort. */
export const HERO_RANKS = [
  ['Initiate', 'Послушник'],
  ['Seeker', 'Искатель'],
  ['Acolyte', 'Аколит'],
  ['Sentinel', 'Страж'],
  ['Mystic', 'Мистик'],
  ['Ritualist', 'Ритуалист'],
  ['Emissary', 'Эмиссар'],
  ['Oracle', 'Оракул'],
  ['Phantom', 'Фантом'],
  ['Ascendant', 'Владыка'],
  ['Eternus', 'Этернус'],
].map(([en, ru], index) => ({
  tier: index + 1,
  name: { en, ru },
  icon: `assets/ranks/rank${String(index + 1).padStart(2, '0')}.webp`,
}));
