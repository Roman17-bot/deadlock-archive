import { createHash } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import type { Hero, HeroSnapshot } from '../../shared/types';
import type { VersionHistory } from '../../shared/version-history';
import type {
  ArchiveStatus,
  CuratedBundle,
  MechanicsCatalog,
  MechanicsFormula,
} from '../../shared/database-types';
import { validateCuratedBundle } from './bundle';
import { ARCHIVE_LOCK, migrateArchive } from './migrations';

const integer = (value: unknown): number => {
  const number = Number(value);
  if (!Number.isSafeInteger(number))
    throw new Error('Database identifier exceeds safe integer range');
  return number;
};
const json = (value: unknown): string => JSON.stringify(value);
const placeholders = (n: number): string =>
  Array.from({ length: n }, (_, i) => `$${i + 1}`).join(', ');

const heroColumns = [
  'snapshot_id',
  'ordinal',
  'hero_id',
  'slug',
  'name',
  'aliases',
  'tags',
  'is_new',
  'portrait',
  'base_health',
  'base_spirit',
  'base_regen',
  'base_bullet_damage',
  'base_move_speed',
  'base_stamina',
  'growth_health',
  'growth_spirit',
  'growth_regen',
  'growth_bullet_damage',
  'scaling_bullet_damage_per_spirit',
  'scaling_regen_per_spirit',
  'scaling_fire_rate_percent_per_spirit',
  'weapon_class_name',
  'weapon_projectiles',
  'weapon_burst',
  'weapon_cycle_time',
  'weapon_intra_burst_time',
  'weapon_shots_per_second',
  'weapon_spins_up',
  'weapon_full_spin_cycle',
  'weapon_hit_once',
  'weapon_clip_size',
  'weapon_reload_seconds',
  'weapon_notes',
  'source_hero_url',
  'source_weapon_url',
  'source_hero_line',
  'source_weapon_line',
] as const;

function heroValues(snapshotId: number, ordinal: number, hero: Hero): unknown[] {
  return [
    snapshotId,
    ordinal,
    hero.id,
    hero.slug,
    hero.name,
    hero.aliases,
    json(hero.tags),
    hero.isNew,
    hero.portrait,
    hero.base.health,
    hero.base.spirit,
    hero.base.regen,
    hero.base.bulletDamage,
    hero.base.moveSpeed,
    hero.base.stamina,
    hero.growth.health,
    hero.growth.spirit,
    hero.growth.regen,
    hero.growth.bulletDamage,
    hero.scaling.bulletDamagePerSpirit,
    hero.scaling.regenPerSpirit,
    hero.scaling.fireRatePercentPerSpirit,
    hero.weapon.className,
    hero.weapon.projectiles,
    hero.weapon.burst,
    hero.weapon.cycleTime,
    hero.weapon.intraBurstTime,
    hero.weapon.shotsPerSecond,
    hero.weapon.spinsUp,
    hero.weapon.fullSpinCycle,
    hero.weapon.hitOnce,
    hero.weapon.clipSize,
    hero.weapon.reloadSeconds,
    json(hero.weapon.notes),
    hero.source.heroUrl,
    hero.source.weaponUrl,
    hero.source.heroLine,
    hero.source.weaponLine,
  ];
}

function decodeHero(row: Record<string, unknown>): Hero {
  return {
    id: integer(row.hero_id),
    slug: String(row.slug),
    name: String(row.name),
    aliases: String(row.aliases),
    tags: row.tags as string[],
    isNew: Boolean(row.is_new),
    portrait: String(row.portrait),
    base: {
      health: Number(row.base_health),
      spirit: Number(row.base_spirit),
      regen: Number(row.base_regen),
      bulletDamage: Number(row.base_bullet_damage),
      moveSpeed: Number(row.base_move_speed),
      stamina: Number(row.base_stamina),
    },
    growth: {
      health: Number(row.growth_health),
      spirit: Number(row.growth_spirit),
      regen: Number(row.growth_regen),
      bulletDamage: Number(row.growth_bullet_damage),
    },
    scaling: {
      bulletDamagePerSpirit: Number(row.scaling_bullet_damage_per_spirit),
      regenPerSpirit: Number(row.scaling_regen_per_spirit),
      fireRatePercentPerSpirit: Number(row.scaling_fire_rate_percent_per_spirit),
    },
    weapon: {
      className: String(row.weapon_class_name),
      projectiles: integer(row.weapon_projectiles),
      burst: integer(row.weapon_burst),
      cycleTime: Number(row.weapon_cycle_time),
      intraBurstTime: Number(row.weapon_intra_burst_time),
      shotsPerSecond: Number(row.weapon_shots_per_second),
      spinsUp: Boolean(row.weapon_spins_up),
      fullSpinCycle:
        row.weapon_full_spin_cycle === null ? null : Number(row.weapon_full_spin_cycle),
      hitOnce: Boolean(row.weapon_hit_once),
      clipSize: Number(row.weapon_clip_size),
      reloadSeconds: Number(row.weapon_reload_seconds),
      notes: row.weapon_notes as string[],
    },
    source: {
      heroUrl: String(row.source_hero_url),
      weaponUrl: String(row.source_weapon_url),
      heroLine: integer(row.source_hero_line),
      weaponLine: integer(row.source_weapon_line),
    },
  };
}

type ArchiveReader = Pick<PoolClient, 'query'>;

async function currentId(reader: ArchiveReader): Promise<number | null> {
  const result = await reader.query<{ snapshot_id: string }>(
    'SELECT snapshot_id FROM archive_current WHERE singleton = true',
  );
  return result.rows[0] ? integer(result.rows[0].snapshot_id) : null;
}

export class PostgresArchive {
  constructor(private readonly pool: Pool) {}

  migrate(): Promise<void> {
    return migrateArchive(this.pool);
  }
  close(): Promise<void> {
    return this.pool.end();
  }

  async importBundle(
    bundle: CuratedBundle,
    reason?: string,
  ): Promise<{ imported: boolean; snapshotId: number; clientVersion: number }> {
    validateCuratedBundle(bundle);
    const contentHash = createHash('sha256').update(json(bundle)).digest('hex');
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SELECT pg_advisory_xact_lock($1, $2)', ARCHIVE_LOCK);
      const existing = await client.query<{ id: string }>(
        'SELECT id FROM archive_snapshots WHERE content_hash = $1',
        [contentHash],
      );
      const current = await client.query<{ snapshot_id: string; client_version: number }>(
        'SELECT c.snapshot_id, s.client_version FROM archive_current c JOIN archive_snapshots s ON s.id = c.snapshot_id WHERE c.singleton = true',
      );
      if (current.rows[0] && bundle.heroes.meta.clientVersion < current.rows[0].client_version)
        throw new Error('Cannot import an older client version over the active archive snapshot');
      let snapshotId: number;
      let outcome: 'imported' | 'unchanged' | 'repointed';
      if (existing.rows.length) {
        snapshotId = integer(existing.rows[0].id);
        outcome =
          current.rows[0] && integer(current.rows[0].snapshot_id) === snapshotId
            ? 'unchanged'
            : 'repointed';
      } else {
        const created = await client.query<{ id: string }>(
          'INSERT INTO archive_snapshots (content_hash, client_version, hero_meta, provenance, import_reason) VALUES ($1, $2, $3, $4, $5) RETURNING id',
          [
            contentHash,
            bundle.heroes.meta.clientVersion,
            json(bundle.heroes.meta),
            json(bundle.provenance),
            reason ?? null,
          ],
        );
        snapshotId = integer(created.rows[0].id);
        await this.insertBundleRows(client, snapshotId, bundle);
        outcome = 'imported';
      }
      if (outcome !== 'unchanged')
        await client.query(
          'INSERT INTO archive_current (singleton, snapshot_id) VALUES (true, $1) ON CONFLICT (singleton) DO UPDATE SET snapshot_id = EXCLUDED.snapshot_id',
          [snapshotId],
        );
      await client.query(
        'INSERT INTO archive_import_runs (snapshot_id, outcome, reason) VALUES ($1, $2, $3)',
        [snapshotId, outcome, reason ?? null],
      );
      await client.query('COMMIT');
      return {
        imported: outcome !== 'unchanged',
        snapshotId,
        clientVersion: bundle.heroes.meta.clientVersion,
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  private async insertBundleRows(
    client: PoolClient,
    snapshotId: number,
    bundle: CuratedBundle,
  ): Promise<void> {
    for (const [ordinal, hero] of bundle.heroes.heroes.entries()) {
      const values = heroValues(snapshotId, ordinal, hero);
      await client.query(
        `INSERT INTO heroes (${heroColumns.join(', ')}) VALUES (${placeholders(values.length)})`,
        values,
      );
    }
    for (const language of ['ru', 'en'] as const) {
      const catalog = bundle.mechanics[language];
      await client.query(
        'INSERT INTO mechanics_catalogues (snapshot_id, language, meta) VALUES ($1, $2, $3)',
        [snapshotId, language, json(catalog.meta)],
      );
      for (const [ordinal, source] of catalog.sources.entries())
        await client.query(
          'INSERT INTO mechanics_sources (snapshot_id, language, ordinal, source_id, label, url, kind) VALUES ($1, $2, $3, $4, $5, $6, $7)',
          [snapshotId, language, ordinal, source.id, source.label, source.url, source.kind],
        );
      for (const [ordinal, formula] of catalog.formulas.entries()) {
        await client.query(
          `INSERT INTO mechanics_formulas
          (snapshot_id, language, ordinal, formula_id, category, title, expression, variables, explanation, example, caveats, confidence)
          VALUES (${placeholders(12)})`,
          [
            snapshotId,
            language,
            ordinal,
            formula.id,
            formula.category,
            formula.title,
            formula.expression,
            json(formula.variables),
            json(formula.explanation),
            formula.example,
            json(formula.caveats),
            formula.confidence,
          ],
        );
        for (const [sourceOrdinal, sourceId] of formula.sourceIds.entries())
          await client.query(
            'INSERT INTO mechanics_formula_sources (snapshot_id, language, formula_id, ordinal, source_id) VALUES ($1, $2, $3, $4, $5)',
            [snapshotId, language, formula.id, sourceOrdinal, sourceId],
          );
      }
    }
    for (const [ordinal, entry] of bundle.history.versions.entries())
      await client.query(
        `INSERT INTO history_entries
        (snapshot_id, ordinal, client_version, build_date, first_published_at, provenance_kind, provenance_reference)
        VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          snapshotId,
          ordinal,
          entry.clientVersion,
          entry.buildDate,
          entry.firstPublishedAt,
          entry.provenance.kind,
          entry.provenance.reference,
        ],
      );
  }

  private async heroesFor(
    snapshotId: number,
    reader: ArchiveReader = this.pool,
  ): Promise<HeroSnapshot> {
    const snapshot = await reader.query<{ hero_meta: HeroSnapshot['meta'] }>(
      'SELECT hero_meta FROM archive_snapshots WHERE id = $1',
      [snapshotId],
    );
    const heroes = await reader.query<Record<string, unknown>>(
      'SELECT * FROM heroes WHERE snapshot_id = $1 ORDER BY ordinal',
      [snapshotId],
    );
    if (!snapshot.rows.length) throw new Error('Current archive snapshot is missing');
    return { meta: snapshot.rows[0].hero_meta, heroes: heroes.rows.map(decodeHero) };
  }

  async getHeroes(): Promise<HeroSnapshot | null> {
    const id = await currentId(this.pool);
    return id === null ? null : this.heroesFor(id);
  }

  private async mechanicsFor(
    snapshotId: number,
    language: 'ru' | 'en',
    reader: ArchiveReader = this.pool,
  ): Promise<MechanicsCatalog> {
    const meta = await reader.query<{ meta: MechanicsCatalog['meta'] }>(
      'SELECT meta FROM mechanics_catalogues WHERE snapshot_id = $1 AND language = $2',
      [snapshotId, language],
    );
    const sources = await reader.query<MechanicsCatalog['sources'][number]>(
      'SELECT source_id AS id, label, url, kind FROM mechanics_sources WHERE snapshot_id = $1 AND language = $2 ORDER BY ordinal',
      [snapshotId, language],
    );
    const formulas = await reader.query<Record<string, unknown>>(
      'SELECT * FROM mechanics_formulas WHERE snapshot_id = $1 AND language = $2 ORDER BY ordinal',
      [snapshotId, language],
    );
    const links = await reader.query<{ formula_id: string; source_id: string }>(
      'SELECT formula_id, source_id FROM mechanics_formula_sources WHERE snapshot_id = $1 AND language = $2 ORDER BY formula_id, ordinal',
      [snapshotId, language],
    );
    if (!meta.rows.length) throw new Error('Mechanics catalogue is missing');
    const byFormula = new Map<string, string[]>();
    for (const link of links.rows) {
      const list = byFormula.get(link.formula_id) ?? [];
      list.push(link.source_id);
      byFormula.set(link.formula_id, list);
    }
    return {
      meta: meta.rows[0].meta,
      sources: sources.rows,
      formulas: formulas.rows.map((row) => ({
        id: String(row.formula_id),
        category: String(row.category),
        title: String(row.title),
        expression: String(row.expression),
        variables: row.variables as string[],
        explanation: row.explanation as string[],
        example: String(row.example),
        caveats: row.caveats as string[],
        sourceIds: byFormula.get(String(row.formula_id)) ?? [],
        confidence: String(row.confidence),
      })),
    };
  }

  async getMechanics(language: 'ru' | 'en'): Promise<MechanicsCatalog | null> {
    const id = await currentId(this.pool);
    return id === null ? null : this.mechanicsFor(id, language);
  }

  private async historyFor(
    snapshotId: number,
    reader: ArchiveReader = this.pool,
  ): Promise<VersionHistory> {
    const rows = await reader.query<Record<string, unknown>>(
      'SELECT * FROM history_entries WHERE snapshot_id = $1 ORDER BY ordinal',
      [snapshotId],
    );
    return {
      schemaVersion: 1,
      versions: rows.rows.map((row) => ({
        clientVersion: integer(row.client_version),
        buildDate: String(row.build_date),
        firstPublishedAt: String(row.first_published_at),
        provenance: {
          kind: row.provenance_kind as 'repository-commit' | 'snapshot-save',
          reference: String(row.provenance_reference),
        },
      })),
    };
  }

  async getHistory(): Promise<VersionHistory | null> {
    const id = await currentId(this.pool);
    return id === null ? null : this.historyFor(id);
  }

  async getBundle(): Promise<CuratedBundle | null> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
      const id = await currentId(client);
      if (id === null) {
        await client.query('COMMIT');
        return null;
      }
      const heroes = await this.heroesFor(id, client);
      const ru = await this.mechanicsFor(id, 'ru', client);
      const en = await this.mechanicsFor(id, 'en', client);
      const history = await this.historyFor(id, client);
      const provenance = await client.query<{ provenance: unknown }>(
        'SELECT provenance FROM archive_snapshots WHERE id = $1',
        [id],
      );
      const bundle = {
        heroes,
        mechanics: { ru, en },
        provenance: provenance.rows[0].provenance,
        history,
      };
      validateCuratedBundle(bundle);
      await client.query('COMMIT');
      return bundle;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async status(): Promise<ArchiveStatus> {
    const result = await this.pool.query<Record<string, unknown>>(`SELECT
      (SELECT count(*) FROM archive_migrations) AS schema_version,
      (SELECT count(*) FROM archive_snapshots) AS snapshots,
      c.snapshot_id AS current_snapshot_id, s.client_version AS current_client_version,
      (SELECT count(*) FROM heroes h WHERE h.snapshot_id = c.snapshot_id) AS heroes,
      (SELECT count(*) FROM mechanics_formulas f WHERE f.snapshot_id = c.snapshot_id AND f.language = 'ru') AS formulas,
      (SELECT count(*) FROM mechanics_sources m WHERE m.snapshot_id = c.snapshot_id AND m.language = 'ru') AS sources,
      (SELECT count(*) FROM history_entries v WHERE v.snapshot_id = c.snapshot_id) AS history_versions
      FROM (SELECT snapshot_id FROM archive_current WHERE singleton = true) c
      LEFT JOIN archive_snapshots s ON s.id = c.snapshot_id`);
    const row = result.rows[0];
    if (!row) {
      const counts = await this.pool.query<{ schema_version: string; snapshots: string }>(
        'SELECT (SELECT count(*) FROM archive_migrations) AS schema_version, (SELECT count(*) FROM archive_snapshots) AS snapshots',
      );
      return {
        storage: 'postgresql',
        schemaVersion: integer(counts.rows[0].schema_version),
        snapshots: integer(counts.rows[0].snapshots),
        currentSnapshotId: null,
        currentClientVersion: null,
        heroes: 0,
        formulas: 0,
        sources: 0,
        historyVersions: 0,
      };
    }
    return {
      storage: 'postgresql',
      schemaVersion: integer(row.schema_version),
      snapshots: integer(row.snapshots),
      currentSnapshotId: integer(row.current_snapshot_id),
      currentClientVersion: integer(row.current_client_version),
      heroes: integer(row.heroes),
      formulas: integer(row.formulas),
      sources: integer(row.sources),
      historyVersions: integer(row.history_versions),
    };
  }

  async searchHeroes(query: string, limit = 20): Promise<Hero[]> {
    const capped = Number.isSafeInteger(limit) ? Math.min(20, Math.max(1, limit)) : 20;
    const term = query
      .trim()
      .slice(0, 100)
      .toLocaleLowerCase()
      .replaceAll('ё', 'е')
      .replace(/[\\%_]/g, '\\$&');
    const rows = await this.pool.query<Record<string, unknown>>(
      `SELECT h.* FROM heroes h
      JOIN archive_current c ON c.snapshot_id = h.snapshot_id
      WHERE replace(lower(h.name || ' ' || h.slug || ' ' || h.aliases), 'ё', 'е') LIKE $1 ESCAPE '\\'
      ORDER BY h.name, h.hero_id LIMIT $2`,
      [`%${term}%`, capped],
    );
    return rows.rows.map(decodeHero);
  }

  async getFormula(id: string, language: 'ru' | 'en'): Promise<MechanicsFormula | null> {
    if (id.length > 100) return null;
    const rows = await this.pool.query<Record<string, unknown>>(
      `SELECT f.* FROM mechanics_formulas f
      JOIN archive_current c ON c.snapshot_id = f.snapshot_id
      WHERE f.formula_id = $1 AND f.language = $2 LIMIT 1`,
      [id, language],
    );
    if (!rows.rows.length) return null;
    const row = rows.rows[0];
    const links = await this.pool.query<{ source_id: string }>(
      `SELECT source_id FROM mechanics_formula_sources
      WHERE snapshot_id = $1 AND language = $2 AND formula_id = $3 ORDER BY ordinal`,
      [row.snapshot_id, language, id],
    );
    return {
      id: String(row.formula_id),
      category: String(row.category),
      title: String(row.title),
      expression: String(row.expression),
      variables: row.variables as string[],
      explanation: row.explanation as string[],
      example: String(row.example),
      caveats: row.caveats as string[],
      confidence: String(row.confidence),
      sourceIds: links.rows.map((link) => link.source_id),
    };
  }
}
