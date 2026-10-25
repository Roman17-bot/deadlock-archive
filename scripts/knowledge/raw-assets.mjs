import { existsSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

const filename = /^all_ability_item_assets_(\d+)\.json$/;

export function rawAssetsForVersion(root, clientVersion) {
  const directory = resolve(root, 'knowledge/current/data');
  const versions = existsSync(directory)
    ? readdirSync(directory, { withFileTypes: true })
        .filter((entry) => entry.isFile() && filename.test(entry.name))
        .map((entry) => Number(filename.exec(entry.name)[1]))
        .sort((a, b) => b - a)
    : [];
  const path = Number.isInteger(clientVersion)
    ? resolve(directory, `all_ability_item_assets_${clientVersion}.json`)
    : null;
  return { path: path && versions.includes(clientVersion) ? path : null, versions };
}
