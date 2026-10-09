import { createHash } from 'node:crypto';

import { getHttpStatus } from '@youversion/platform-core';

import { ServiceError } from './service.js';

const DEFAULT_CONCURRENCY = 1;
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_REQUEST_INTERVAL_MS = 1_250;

export class DownloadManager {
  constructor({
    database,
    bibleClient = null,
    concurrency = DEFAULT_CONCURRENCY,
    maxRetries = DEFAULT_MAX_RETRIES,
    retryBaseMs = 500,
    requestIntervalMs = DEFAULT_REQUEST_INTERVAL_MS,
    recoverInterruptedDownloads = true,
  }) {
    if (!database) throw new Error('A SQLite database is required.');
    this.database = database;
    this.bibleClient = bibleClient;
    this.concurrency = boundedInteger(concurrency, 'download concurrency', 1, 8);
    this.maxRetries = boundedInteger(maxRetries, 'download retries', 0, 10);
    this.retryBaseMs = boundedInteger(retryBaseMs, 'retry delay', 0, 60_000);
    this.requestIntervalMs = boundedInteger(
      requestIntervalMs,
      'download request interval',
      0,
      60_000,
    );
    this.nextRequestAt = 0;
    this.activeDownloads = new Map();
    this.searchIndex = null;

    this.database.exec(`
      PRAGMA foreign_keys = ON;
      CREATE TABLE IF NOT EXISTS download_packages (
        version_id INTEGER PRIMARY KEY,
        status TEXT NOT NULL,
        format TEXT NOT NULL,
        include_headings INTEGER NOT NULL,
        include_notes INTEGER NOT NULL,
        metadata TEXT,
        manifest TEXT,
        total_items INTEGER NOT NULL DEFAULT 0,
        completed_items INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        completed_at INTEGER,
        error TEXT
      );
      CREATE TABLE IF NOT EXISTS download_passages (
        version_id INTEGER NOT NULL,
        passage_id TEXT NOT NULL,
        book_id TEXT NOT NULL,
        chapter_id TEXT NOT NULL,
        kind TEXT NOT NULL,
        payload TEXT NOT NULL,
        downloaded_at INTEGER NOT NULL,
        PRIMARY KEY (version_id, passage_id),
        FOREIGN KEY (version_id) REFERENCES download_packages(version_id)
          ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS download_passages_book_idx
        ON download_passages(version_id, book_id, chapter_id);
    `);
    // Only the daemon taking ownership may recover interrupted jobs. CLI
    // reads and short-lived OAuth callbacks share this database with it.
    if (recoverInterruptedDownloads) this.database.exec(`
      UPDATE download_packages
      SET status = 'paused', error = 'Download interrupted; run download add to resume.'
      WHERE status IN ('queued', 'downloading');
      UPDATE download_packages
      SET status = 'paused',
        error = 'Paused because YouVersion is rate-limiting requests. Resume after the cooldown.'
      WHERE status = 'failed'
        AND (error LIKE '%status: 429%' OR error LIKE '%rate limit%');
    `);
  }

  downloadPackage(
    versionId,
    {
      format = 'text',
      includeHeadings = false,
      includeNotes = false,
      refresh = false,
      onProgress,
    } = {},
  ) {
    const version = positiveInteger(versionId, 'version');
    if (this.activeDownloads.has(version)) return this.activeDownloads.get(version);
    if (!this.bibleClient) {
      throw new ServiceError('YouVersion downloads are unavailable.', {
        code: 'APP_KEY_MISSING',
        status: 503,
      });
    }
    if (!['text', 'html'].includes(format)) {
      throw badRequest('format must be "text" or "html".');
    }
    const options = {
      format,
      includeHeadings: booleanValue(includeHeadings, 'includeHeadings'),
      includeNotes: booleanValue(includeNotes, 'includeNotes'),
      refresh: booleanValue(refresh, 'refresh'),
      onProgress,
    };
    this.#markQueued(version, options);
    const operation = this.#performDownload(version, options)
      .finally(() => this.activeDownloads.delete(version));
    this.activeDownloads.set(version, operation);
    return operation;
  }

  queuePackage(versionId, options) {
    const version = positiveInteger(versionId, 'version');
    const operation = this.downloadPackage(version, options);
    operation.catch(() => {});
    return { version, status: 'queued' };
  }

  resumePackage(versionId) {
    const version = positiveInteger(versionId, 'version');
    const existing = this.database.prepare(`
      SELECT status, format, include_headings, include_notes
      FROM download_packages
      WHERE version_id = ?
    `).get(version);
    if (!existing) {
      throw new ServiceError('Translation package not found.', {
        code: 'DOWNLOAD_NOT_FOUND',
        status: 404,
      });
    }
    if (existing.status !== 'paused') {
      throw new ServiceError('Only a paused translation download can be resumed.', {
        code: 'DOWNLOAD_NOT_PAUSED',
        status: 409,
      });
    }
    return this.downloadPackage(version, {
      format: existing.format,
      includeHeadings: Boolean(existing.include_headings),
      includeNotes: Boolean(existing.include_notes),
      refresh: false,
    });
  }

  queueResume(versionId) {
    const version = positiveInteger(versionId, 'version');
    const operation = this.resumePackage(version);
    operation.catch(() => {});
    return { version, status: 'queued', resumed: true };
  }

  listPackages() {
    return this.database.prepare(`
      SELECT version_id, status, format, include_headings, include_notes,
        metadata, total_items, completed_items, created_at, updated_at,
        completed_at, error
      FROM download_packages
      ORDER BY updated_at DESC
    `).all().map(packageSummary);
  }

  getPackage(versionId) {
    const version = positiveInteger(versionId, 'version');
    const row = this.database.prepare(`
      SELECT version_id, status, format, include_headings, include_notes,
        metadata, total_items, completed_items, created_at, updated_at,
        completed_at, error
      FROM download_packages
      WHERE version_id = ?
    `).get(version);
    return row ? packageSummary(row) : null;
  }

  async checkForUpdate(versionId) {
    const version = positiveInteger(versionId, 'version');
    if (!this.bibleClient) {
      throw new ServiceError('YouVersion update checks are unavailable.', {
        code: 'APP_KEY_MISSING',
        status: 503,
      });
    }
    const local = this.database.prepare(`
      SELECT status, metadata, manifest
      FROM download_packages
      WHERE version_id = ?
    `).get(version);
    if (!local) {
      throw new ServiceError('Translation package not found.', {
        code: 'DOWNLOAD_NOT_FOUND',
        status: 404,
      });
    }
    if (!local.metadata || !local.manifest) {
      throw new ServiceError('Finish the initial download before checking for updates.', {
        code: 'DOWNLOAD_INCOMPLETE',
        status: 409,
      });
    }

    try {
      const [metadata, manifest] = await Promise.all([
        this.bibleClient.getVersion(version),
        this.bibleClient.getIndex(version),
      ]);
      const metadataChanged = fingerprint(metadata) !== fingerprint(JSON.parse(local.metadata));
      const indexChanged = fingerprint(manifest) !== fingerprint(JSON.parse(local.manifest));
      return {
        version,
        updateAvailable: metadataChanged || indexChanged,
        metadataChanged,
        indexChanged,
        checkedAt: new Date().toISOString(),
      };
    } catch (cause) {
      const status = getHttpStatus(cause);
      throw new ServiceError(
        status === 429
          ? 'YouVersion is rate-limiting update checks. Try again after five minutes.'
          : `Unable to check for translation updates: ${cause.message}`,
        {
          code: status === 429 ? 'UPSTREAM_RATE_LIMITED' : 'UPDATE_CHECK_FAILED',
          status: status === 429 ? 429 : 502,
          cause,
        },
      );
    }
  }

  removePackage(versionId) {
    const version = positiveInteger(versionId, 'version');
    if (this.activeDownloads.has(version)) {
      throw new ServiceError('Cannot remove a translation while it is downloading.', {
        code: 'DOWNLOAD_ACTIVE',
        status: 409,
      });
    }
    const changes = this.database.prepare(
      'DELETE FROM download_packages WHERE version_id = ?',
    ).run(version).changes;
    if (changes) this.searchIndex = null;
    return { removed: changes > 0, version };
  }

  getBooks(versionId) {
    const bundle = this.#manifest(versionId);
    if (!bundle) return null;
    return offlineResult({ data: bundle.manifest.books }, bundle);
  }

  getChapters(versionId, bookId) {
    const bundle = this.#manifest(versionId);
    if (!bundle) return null;
    const book = bundle.manifest.books.find(
      (candidate) => candidate.id === String(bookId).toUpperCase(),
    );
    if (!book) return null;
    return offlineResult({ data: book.chapters }, bundle);
  }

  getPassage(
    versionId,
    passageId,
    { format = 'text', includeHeadings = false, includeNotes = false } = {},
  ) {
    const version = positiveInteger(versionId, 'version');
    const row = this.database.prepare(`
      SELECT p.payload, p.downloaded_at, d.status, d.format,
        d.include_headings, d.include_notes
      FROM download_passages p
      JOIN download_packages d ON d.version_id = p.version_id
      WHERE p.version_id = ? AND p.passage_id = ?
    `).get(version, String(passageId).toUpperCase());
    if (!row) return null;
    if (
      row.format !== format
      || Boolean(row.include_headings) !== Boolean(includeHeadings)
      || Boolean(row.include_notes) !== Boolean(includeNotes)
    ) return null;
    return {
      data: JSON.parse(row.payload),
      meta: {
        source: 'download',
        stale: false,
        storedAt: new Date(row.downloaded_at).toISOString(),
        expiresAt: null,
        packageStatus: row.status,
      },
    };
  }

  getVerseText(versionId, passageId) {
    const version = positiveInteger(versionId, 'version');
    const reference = String(passageId || '').toUpperCase();
    const match = reference.match(/^([A-Z0-9]{3}\.\d+)\.\d+$/);
    if (!match) return null;
    const row = this.database.prepare(`
      SELECT p.payload FROM download_passages p
      JOIN download_packages d ON d.version_id = p.version_id
      WHERE p.version_id = ? AND p.passage_id = ? AND p.kind = 'chapter'
        AND d.completed_items > 0
    `).get(version, match[1]);
    if (!row) return null;
    const content = JSON.parse(row.payload).content || '';
    return searchableVerses(content, match[1]).find((verse) => verse.reference === reference)?.text || null;
  }

  search(query, pageToken = '', preferredVersion = null) {
    const offset = Number(pageToken || 0);
    if (!Number.isSafeInteger(offset) || offset < 0 || offset > 100000)
      throw badRequest('Invalid local search page token.');
    if (!this.searchIndex) {
      this.searchIndex = [];
      const rows = this.database.prepare(`
        SELECT version_id, passage_id, payload FROM download_passages
        WHERE kind = 'chapter' ORDER BY version_id, rowid
      `).all();
      for (const row of rows) {
        const content = JSON.parse(row.payload).content || '';
        for (const verse of searchableVerses(content, row.passage_id))
          this.searchIndex.push({ ...verse, version: Number(row.version_id) });
      }
    }
    const needle = normalizeSearchText(query);
    if (!needle) return { verses: [], source: 'download', next_page_token: null };
    const preferred = Number(preferredVersion);
    const matches = this.searchIndex.filter((verse) => verse.normalized.includes(needle));
    matches.sort((a, b) => (Number(b.version === preferred) - Number(a.version === preferred)));
    return { verses: matches.slice(offset, offset + 25).map(({ reference, text, version }) =>
      ({ reference, text, version })), source: 'download',
      next_page_token: offset + 25 < matches.length ? String(offset + 25) : null };
  }

  async #performDownload(versionId, options) {
    try {
      const [metadata, manifest] = await Promise.all([
        this.#requestWithRetry(() => this.bibleClient.getVersion(versionId)),
        this.#requestWithRetry(() => this.bibleClient.getIndex(versionId)),
      ]);
      const items = packageItems(manifest);
      this.#preparePackage(versionId, metadata, manifest, items.length, options);
      const existing = new Set(this.database.prepare(
        'SELECT passage_id FROM download_passages WHERE version_id = ?',
      ).all(versionId).map((row) => row.passage_id));
      const remaining = items.filter((item) => !existing.has(item.passageId));
      let cursor = 0;

      const worker = async () => {
        while (cursor < remaining.length) {
          const item = remaining[cursor];
          cursor += 1;
          const passage = await this.#fetchPassage(versionId, item.passageId, options);
          this.#storePassage(versionId, item, passage);
          if (options.onProgress) options.onProgress(this.getPackage(versionId));
        }
      };
      await Promise.all(
        Array.from(
          { length: Math.min(this.concurrency, Math.max(remaining.length, 1)) },
          worker,
        ),
      );
      const now = Date.now();
      this.database.prepare(`
        UPDATE download_packages
        SET status = 'complete', completed_items = total_items,
          updated_at = ?, completed_at = ?, error = NULL
        WHERE version_id = ?
      `).run(now, now, versionId);
      return this.getPackage(versionId);
    } catch (cause) {
      const status = getHttpStatus(cause);
      const rateLimited = status === 429;
      const message = rateLimited
        ? 'Paused because YouVersion is rate-limiting requests. Resume after the cooldown.'
        : String(cause?.message || cause).slice(0, 500);
      this.database.prepare(`
        UPDATE download_packages
        SET status = ?, updated_at = ?, error = ?
        WHERE version_id = ?
      `).run(rateLimited ? 'paused' : 'failed', Date.now(), message, versionId);
      if (cause instanceof ServiceError) throw cause;
      if (rateLimited) {
        throw new ServiceError(message, {
          code: 'UPSTREAM_RATE_LIMITED',
          status: 429,
          cause,
        });
      }
      throw new ServiceError(`Translation download failed: ${message}`, {
        code: 'DOWNLOAD_FAILED',
        status: 502,
        cause,
      });
    }
  }

  #preparePackage(versionId, metadata, manifest, totalItems, options) {
    const now = Date.now();
    const current = this.database.prepare(`
      SELECT format, include_headings, include_notes
      FROM download_packages WHERE version_id = ?
    `).get(versionId);
    const optionsChanged = current && (
      current.format !== options.format
      || Boolean(current.include_headings) !== options.includeHeadings
      || Boolean(current.include_notes) !== options.includeNotes
    );
    if (optionsChanged || options.refresh) {
      this.database.prepare(
        'DELETE FROM download_passages WHERE version_id = ?',
      ).run(versionId);
    }
    this.database.prepare(`
      INSERT INTO download_packages(
        version_id, status, format, include_headings, include_notes,
        metadata, manifest, total_items, completed_items,
        created_at, updated_at, completed_at, error
      ) VALUES (?, 'downloading', ?, ?, ?, ?, ?, ?, 0, ?, ?, NULL, NULL)
      ON CONFLICT(version_id) DO UPDATE SET
        status = 'downloading', format = excluded.format,
        include_headings = excluded.include_headings,
        include_notes = excluded.include_notes,
        metadata = excluded.metadata, manifest = excluded.manifest,
        total_items = excluded.total_items,
        completed_items = (
          SELECT COUNT(*) FROM download_passages
          WHERE version_id = excluded.version_id
        ),
        updated_at = excluded.updated_at, completed_at = NULL, error = NULL
    `).run(
      versionId,
      options.format,
      Number(options.includeHeadings),
      Number(options.includeNotes),
      JSON.stringify(metadata),
      JSON.stringify(manifest),
      totalItems,
      now,
      now,
    );
  }

  #markQueued(versionId, options) {
    const now = Date.now();
    this.database.prepare(`
      INSERT INTO download_packages(
        version_id, status, format, include_headings, include_notes,
        metadata, manifest, total_items, completed_items,
        created_at, updated_at, completed_at, error
      ) VALUES (?, 'queued', ?, ?, ?, NULL, NULL, 0, 0, ?, ?, NULL, NULL)
      ON CONFLICT(version_id) DO UPDATE SET
        status = 'queued', updated_at = excluded.updated_at, error = NULL
    `).run(
      versionId,
      options.format,
      Number(options.includeHeadings),
      Number(options.includeNotes),
      now,
      now,
    );
  }

  async #fetchPassage(versionId, passageId, options) {
    return this.#requestWithRetry(() => this.bibleClient.getPassage(
      versionId,
      passageId,
      options.format,
      options.includeHeadings,
      options.includeNotes,
      false,
    ));
  }

  async #requestWithRetry(operation) {
    return this.#withRetry(async () => {
      const scheduledAt = Math.max(Date.now(), this.nextRequestAt);
      this.nextRequestAt = scheduledAt + this.requestIntervalMs;
      await delay(Math.max(0, scheduledAt - Date.now()));
      return operation();
    });
  }

  async #withRetry(operation) {
    let attempt = 0;
    while (true) {
      try {
        return await operation();
      } catch (error) {
        const status = getHttpStatus(error);
        // A shared client gate owns the YouVersion cooldown. Retrying a bulk
        // download here would keep the job active and compete with reading.
        if (status === 429) throw error;
        const retryable = status === undefined
          || status === 408
          || status >= 500;
        if (!retryable || attempt >= this.maxRetries) throw error;
        const retryDelay = Math.min(this.retryBaseMs * (2 ** attempt), 60_000);
        await delay(retryDelay);
        attempt += 1;
      }
    }
  }

  #storePassage(versionId, item, passage) {
    this.searchIndex = null;
    const now = Date.now();
    this.database.prepare(`
      INSERT INTO download_passages(
        version_id, passage_id, book_id, chapter_id, kind,
        payload, downloaded_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(version_id, passage_id) DO UPDATE SET
        payload = excluded.payload, downloaded_at = excluded.downloaded_at
    `).run(
      versionId,
      item.passageId,
      item.bookId,
      item.chapterId,
      item.kind,
      JSON.stringify(passage),
      now,
    );
    this.database.prepare(`
      UPDATE download_packages
      SET completed_items = (
        SELECT COUNT(*) FROM download_passages WHERE version_id = ?
      ), updated_at = ?
      WHERE version_id = ?
    `).run(versionId, now, versionId);
  }

  #manifest(versionId) {
    const version = positiveInteger(versionId, 'version');
    const row = this.database.prepare(`
      SELECT manifest, status, updated_at
      FROM download_packages WHERE version_id = ?
    `).get(version);
    if (!row?.manifest) return null;
    return {
      manifest: JSON.parse(row.manifest),
      status: row.status,
      updatedAt: row.updated_at,
    };
  }
}

function packageItems(manifest) {
  const items = [];
  for (const book of manifest.books) {
    if (book.intro?.passage_id) {
      items.push({
        passageId: book.intro.passage_id,
        bookId: book.id,
        chapterId: 'INTRO',
        kind: 'intro',
      });
    }
    for (const chapter of book.chapters) {
      items.push({
        passageId: chapter.passage_id,
        bookId: book.id,
        chapterId: chapter.id,
        kind: 'chapter',
      });
    }
  }
  return items;
}

function normalizeSearchText(value) {
  return String(value).toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

export function searchableVerses(content, chapterReference) {
  const source = String(content);
  const verses = [];
  const add = (number, value) => {
    const text = String(value).replace(/<[^>]*>/g, ' ')
      .replace(/&(?:nbsp|#160);/gi, ' ')
      .replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')
      .replace(/&quot;/gi, '"').replace(/&#(?:39|x27);/gi, "'")
      .replace(/\s+/g, ' ').trim().replace(/^\d+\s*/, '');
    if (text) verses.push({ reference: `${chapterReference}.${number}`, text,
      normalized: normalizeSearchText(text) });
  };
  if (/<[^>]+>/.test(source)) {
    const marker = /<span\b[^>]*class=["'][^"']*\byv-v\b[^"']*["'][^>]*\bv=["']?(\d+)["']?[^>]*><\/span>/gi;
    let previous = null;
    let match;
    while ((match = marker.exec(source))) {
      if (previous) add(previous.number, source.slice(previous.end, match.index));
      previous = { number: match[1], end: marker.lastIndex };
    }
    if (previous) add(previous.number, source.slice(previous.end));
  } else {
    for (const line of source.split(/\r?\n/)) {
      const match = line.match(/^\s*(\d+)\s+(.+)/);
      if (match) add(match[1], match[2]);
    }
  }
  return verses;
}

function packageSummary(row) {
  const metadata = row.metadata ? JSON.parse(row.metadata) : null;
  return {
    version: Number(row.version_id),
    status: row.status,
    format: row.format,
    includeHeadings: Boolean(row.include_headings),
    includeNotes: Boolean(row.include_notes),
    title: metadata?.localized_title || metadata?.title || null,
    abbreviation: metadata?.localized_abbreviation || metadata?.abbreviation || null,
    languageTag: metadata?.language_tag || null,
    copyright: metadata?.copyright || null,
    totalItems: Number(row.total_items),
    completedItems: Number(row.completed_items),
    progress: row.total_items ? Number(row.completed_items) / Number(row.total_items) : 0,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
    completedAt: row.completed_at ? new Date(row.completed_at).toISOString() : null,
    error: row.error,
  };
}

function offlineResult(data, bundle) {
  return {
    data,
    meta: {
      source: 'download',
      stale: false,
      storedAt: new Date(bundle.updatedAt).toISOString(),
      expiresAt: null,
      packageStatus: bundle.status,
    },
  };
}

function positiveInteger(value, name) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw badRequest(`${name} must be a positive integer.`);
  }
  return parsed;
}

function booleanValue(value, name) {
  if (typeof value === 'boolean') return value;
  if (value === 'true' || value === '1') return true;
  if (value === 'false' || value === '0' || value === undefined) return false;
  throw badRequest(`${name} must be true or false.`);
}

function boundedInteger(value, name, minimum, maximum) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error(`${name} must be an integer from ${minimum} to ${maximum}.`);
  }
  return parsed;
}

function badRequest(message) {
  return new ServiceError(message, { code: 'BAD_REQUEST', status: 400 });
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function fingerprint(value) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}
