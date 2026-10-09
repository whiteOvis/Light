import { chmodSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import { ensureSecureDirectory } from './paths.js';

export class SQLiteCache {
  constructor({ directory, ttlSeconds = 7 * 24 * 60 * 60 } = {}) {
    if (!directory) throw new Error('A cache directory is required.');
    if (!Number.isFinite(ttlSeconds) || ttlSeconds < 0) {
      throw new Error('Cache TTL must be a non-negative number of seconds.');
    }

    ensureSecureDirectory(directory);
    this.path = join(directory, 'cache.sqlite');
    this.ttlMs = ttlSeconds * 1000;
    this.database = new DatabaseSync(this.path);
    chmodSync(this.path, 0o600);
    this.database.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA busy_timeout = 5000;
      CREATE TABLE IF NOT EXISTS cache_entries (
        cache_key TEXT PRIMARY KEY,
        resource TEXT NOT NULL,
        payload TEXT NOT NULL,
        stored_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS cache_entries_resource_idx
        ON cache_entries(resource);
    `);

    this.selectStatement = this.database.prepare(`
      SELECT payload, stored_at, expires_at
      FROM cache_entries
      WHERE cache_key = ?
    `);
    this.upsertStatement = this.database.prepare(`
      INSERT INTO cache_entries(cache_key, resource, payload, stored_at, expires_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(cache_key) DO UPDATE SET
        resource = excluded.resource,
        payload = excluded.payload,
        stored_at = excluded.stored_at,
        expires_at = excluded.expires_at
    `);
    this.deleteStatement = this.database.prepare(
      'DELETE FROM cache_entries WHERE cache_key = ?',
    );
    this.latestStatement = this.database.prepare(`
      SELECT cache_key, payload, stored_at, expires_at
      FROM cache_entries
      WHERE resource = ?
      ORDER BY stored_at DESC
      LIMIT 1
    `);
  }

  get(key) {
    const row = this.selectStatement.get(key);
    if (!row) return null;

    try {
      return {
        data: JSON.parse(row.payload),
        storedAt: new Date(row.stored_at).toISOString(),
        expiresAt: new Date(row.expires_at).toISOString(),
        expired: row.expires_at <= Date.now(),
      };
    } catch {
      this.deleteStatement.run(key);
      return null;
    }
  }

  set(key, resource, data) {
    const storedAt = Date.now();
    const expiresAt = storedAt + this.ttlMs;
    this.upsertStatement.run(
      key,
      resource,
      JSON.stringify(data),
      storedAt,
      expiresAt,
    );
    return {
      storedAt: new Date(storedAt).toISOString(),
      expiresAt: new Date(expiresAt).toISOString(),
    };
  }

  latest(resource) {
    const row = this.latestStatement.get(String(resource));
    if (!row) return null;
    try {
      return {
        key: row.cache_key,
        data: JSON.parse(row.payload),
        storedAt: new Date(row.stored_at).toISOString(),
        expiresAt: new Date(row.expires_at).toISOString(),
        expired: row.expires_at <= Date.now(),
      };
    } catch {
      this.deleteStatement.run(row.cache_key);
      return null;
    }
  }

  clear() {
    return this.database.prepare('DELETE FROM cache_entries').run().changes;
  }

  stats() {
    const row = this.database.prepare(`
      SELECT
        COUNT(*) AS entries,
        COALESCE(SUM(LENGTH(payload)), 0) AS payload_bytes,
        SUM(CASE WHEN expires_at <= ? THEN 1 ELSE 0 END) AS expired_entries
      FROM cache_entries
    `).get(Date.now());
    return {
      path: this.path,
      entries: Number(row.entries),
      expiredEntries: Number(row.expired_entries || 0),
      payloadBytes: Number(row.payload_bytes),
    };
  }

  close() {
    this.database.close();
  }
}
