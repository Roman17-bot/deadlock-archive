# Hero roster artwork

The dossier folder, bookplate and registry seal in `public/assets/roster/` are original project SVGs. The folder displays only a fixed-height cap; CSS extends its body. The bookplate stretches with its text and keeps an ivory fallback background.

`public/assets/roster/heroes/` contains 44 optimized WebP character scenes and 44 original name SVGs. The scene sources are Valve's in-game renders published in the [Deadlock Wiki galleries](https://deadlock.wiki/Drifter/Gallery), via `File:<Hero_Name>_Render.png` and the wiki image API. Name lettering comes from each hero's `images.name_image` in the [assets API](https://api.deadlock-api.com/v1/assets/heroes?client_version=6848&only_active=true&language=english). Character artwork belongs to Valve; original game art is separate from the wiki's text licence.

The images are posed scenes with their original graphic backgrounds, matching the game selection screen. They are not complete transparent full-body models. WebP versions preserve the composition, fit within1100×1100 and use quality85. The44 scene files total4,379,532bytes; only the currently previewed hero's large image and name lettering are requested. Private source dimensions and preparation evidence remain in the coordinator's archive.

`src/features/heroes/hero-art.json` maps hero IDs to local artwork and a decorative accent shared by the roster and the hero dossier. Ability icons and names come from the updatable catalogue. When a new hero or visual rework arrives, review the render and lettering and update the mapping. The dossier uses the portrait if the local render is missing.

The weapon prints use 44 transparent game images from the installed Valve client 6848. The chosen image for each hero comes from `m_strWeaponImage` in the matching game configuration. The optimized WebP files in `public/assets/hero-weapons/` total 582,492 bytes. The dossier loads its own weapon image when it approaches the viewport. [Game configuration](https://github.com/SteamTracking/GameTracking-Deadlock/blob/fed007c2f240713754bb4fe6c6f2e9b8fe56e93a/game/citadel/pak01_dir/scripts/heroes.vdata)

`src/pages/HeroDetailPage/weapon-art.json` maps the primary weapon class to the local image and localized caption. Review the mapping when the game changes a weapon. A class without an image uses the cartridge engraving. The print border, wear and brass pin are original project graphics.
