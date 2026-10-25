import { describe, expect, it } from 'vitest';
import { parseKv3 } from './kv3.ts';

describe('strict data-only KV3 parser', () => {
  it('reads nested materialized objects without applying inheritance metadata', () => {
    expect(
      parseKv3(
        '<!-- header --> { base={hp=999} hero={_multibase=["base"] hp=730 path=resource_name:"a/b" flags=[true,0,false,1,] } }',
      ),
    ).toEqual({
      base: { hp: 999 },
      hero: { _multibase: ['base'], hp: 730, path: 'a/b', flags: [true, 0, false, 1] },
    });
  });
  it('preserves schema subclass objects as data', () => {
    expect(
      parseKv3('{ primary = subclass:{ _class="CCitadelWeaponInfo" m_flBulletDamage=8.8 } }'),
    ).toEqual({ primary: { _class: 'CCitadelWeaponInfo', m_flBulletDamage: 8.8 } });
  });
  it.each([
    '{ a=1 a=2 }',
    '{ a=1 } trailing',
    '{ a=remote_code:"x" }',
    '{ a=[1,2 }',
    '{ a="unterminated }',
  ])('rejects malformed or ambiguous data %s', (source) => {
    expect(() => parseKv3(source)).toThrow();
  });
});
