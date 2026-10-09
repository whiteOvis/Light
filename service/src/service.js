import { SearchAcceleration } from './search-acceleration.js';
import {
  BibleClient,
  getHttpStatus,
  HighlightsClient,
  LanguagesClient,
} from '@youversion/platform-core';

import { PlatformApiClient } from './platform-api-client.js';
import { YOUVERSION_APPLICATION_KEY } from './platform-config.js';
import { RateLimitedBibleClient } from './rate-limited-bible-client.js';

import { ServiceError } from './service-error.js';
export { ServiceError } from './service-error.js';

export function createBibleClient(env = process.env, options = {}) {
  return createPlatformClients(env, options).bibleClient;
}

export function createPlatformClients(env = process.env, {
  appKey = YOUVERSION_APPLICATION_KEY,
  installationId = env.LIGHT_INSTALLATION_ID,
  fetchImplementation = globalThis.fetch,
} = {}) {
  if (!appKey) {
    return { apiClient: null, bibleClient: null, highlightsClient: null };
  }
  const config = { appKey, installationId, fetchImplementation };
  if (env.YVP_API_HOST) config.apiHost = env.YVP_API_HOST;
  if (env.YVP_TIMEOUT_MS) {
    config.timeout = positiveInteger(env.YVP_TIMEOUT_MS, 'YVP_TIMEOUT_MS');
  }
  if (env.LIGHT_YVP_COOLDOWN_MS) {
    config.cooldownMs = positiveInteger(
      env.LIGHT_YVP_COOLDOWN_MS,
      'LIGHT_YVP_COOLDOWN_MS',
    );
  }
  const apiClient = new PlatformApiClient(config);
  const bibleClient = new RateLimitedBibleClient({
    client: new BibleClient(apiClient),
    languagesClient: new LanguagesClient(apiClient),
    apiClient,
    requestIntervalMs: env.LIGHT_YVP_REQUEST_INTERVAL_MS
      ? nonNegativeInteger(env.LIGHT_YVP_REQUEST_INTERVAL_MS, 'LIGHT_YVP_REQUEST_INTERVAL_MS')
      : undefined,
    cooldownMs: env.LIGHT_YVP_COOLDOWN_MS
      ? positiveInteger(env.LIGHT_YVP_COOLDOWN_MS, 'LIGHT_YVP_COOLDOWN_MS')
      : undefined,
  });
  return {
    apiClient,
    bibleClient,
    highlightsClient: new HighlightsClient(apiClient),
  };
}

export class LightService {
  constructor({ cache, bibleClient = null, downloadManager = null }) {
    this.cache = cache;
    this.searchAcceleration = new SearchAcceleration(this);
    this.bibleClient = bibleClient;
    this.downloadManager = downloadManager;
  }

  async search(version, query, pageToken = '') {
    const versionId = positiveInteger(version, 'version');
    const text = String(query || '').trim().replace(/^text:\s*/i, '');
    if (!text || text.length > 100 || String(pageToken).length > 2048)
      throw badRequest('Search requires 1–100 characters and a valid page token.');
    if (!this.bibleClient) throw new ServiceError('Online search is unavailable. Download a translation for offline search.', {
      code: 'SEARCH_UNAVAILABLE', status: 503,
    });
    try {
      const result = await this.searchAcceleration.search(versionId, text, pageToken,
        () => this.bibleClient.searchVerses(versionId, text, pageToken));
      return { ...result, version: versionId, source: 'youversion' };
    } catch (cause) {
      throw new ServiceError(`Search unavailable for this version: ${cause.message}. Downloaded translations support offline search.`, {
        code: 'SEARCH_UNAVAILABLE', status: getHttpStatus(cause) === 429 ? 429 : 502, cause,
      });
    }
  }

  searchPreviews(entries) { return this.searchAcceleration.previews(entries); }

  searchDownloaded(version, query, pageToken = '') {
    const versionId = positiveInteger(version, 'version');
    const text = String(query || '').trim().replace(/^text:\s*/i, '');
    if (!text || text.length > 100 || String(pageToken).length > 2048)
      throw badRequest('Search requires 1–100 characters and a valid page token.');
    return this.downloadManager?.search(text, pageToken, versionId)
      || { verses: [], source: 'download', next_page_token: null };
  }

  get onlineConfigured() {
    return this.bibleClient !== null;
  }

  async versions(language = '*', { mode = 'auto' } = {}) {
    const languageRange = String(language || '').trim();
    if (languageRange !== '*'
        && !/^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})?$/.test(languageRange)) {
      throw badRequest('language must be * or a BCP-47 language code such as en or en-US.');
    }
    const result = await this.#resolve(
      'versions',
      { language: languageRange, access: 'licensed' },
      mode,
      () => fetchAllVersions(
        this.bibleClient,
        languageRange,
      ),
      // Local versions supplement the catalog; they must not short-circuit
      // its online fetch as downloaded passage content does.
      undefined,
      () => this.#localVersions(),
    );
    return this.#mergeLocalVersions(result);
  }

  languages(locale = 'en-US', { mode = 'auto' } = {}) {
    const acceptedLocale = String(locale || '').trim();
    if (!/^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})?$/.test(acceptedLocale)) {
      throw badRequest('locale must be a BCP-47 language code such as en-US.');
    }
    return this.#resolve(
      'available-languages',
      { locale: acceptedLocale },
      mode,
      () => this.bibleClient.getLanguages({
        page_size: '*',
        fields: ['id', 'localized_name', 'default_bible_id'],
        bibles_available: true,
        locale: acceptedLocale,
      }),
      () => null,
    );
  }

  books(versionId, { mode = 'auto' } = {}) {
    const version = positiveInteger(versionId, 'version');
    return this.#resolve(
      'books',
      { version },
      mode,
      () => this.bibleClient.getBooks(version),
      () => this.downloadManager?.getBooks(version),
    );
  }

  chapters(versionId, book, { mode = 'auto' } = {}) {
    const version = positiveInteger(versionId, 'version');
    const bookCode = usfmBook(book);
    return this.#resolve(
      'chapters',
      { version, book: bookCode },
      mode,
      () => this.bibleClient.getChapters(version, bookCode),
      () => this.downloadManager?.getChapters(version, bookCode),
      () => this.#chaptersFromCachedBooks(version, bookCode),
    );
  }

  recentPassage() {
    const cached = this.cache.latest('passage');
    if (!cached) {
      throw new ServiceError('No recently viewed passage is cached.', {
        code: 'RECENT_PASSAGE_NOT_FOUND',
        status: 404,
      });
    }
    const prefix = 'passage:';
    if (!cached.key.startsWith(prefix)) {
      throw new ServiceError('The recent passage cache entry is invalid.', {
        code: 'CACHE_ENTRY_INVALID',
        status: 500,
      });
    }
    let selection;
    try {
      selection = JSON.parse(cached.key.slice(prefix.length));
    } catch {
      throw new ServiceError('The recent passage cache entry is invalid.', {
        code: 'CACHE_ENTRY_INVALID',
        status: 500,
      });
    }
    return {
      selection,
      data: cached.data,
      meta: {
        source: 'cache',
        stale: cached.expired,
        storedAt: cached.storedAt,
        expiresAt: cached.expiresAt,
      },
    };
  }

  passage(
    versionId,
    usfm,
    {
      mode = 'auto',
      format = 'text',
      includeHeadings = false,
      includeNotes = false,
    } = {},
  ) {
    const version = positiveInteger(versionId, 'version');
    const reference = usfmReference(usfm);
    if (!['text', 'html'].includes(format)) {
      throw badRequest('format must be "text" or "html".');
    }
    const headings = booleanValue(includeHeadings, 'includeHeadings');
    const notes = booleanValue(includeNotes, 'includeNotes');
    return this.#resolve(
      'passage',
      { version, usfm: reference, format, headings, notes },
      mode,
      () => this.bibleClient.getPassage(
        version,
        reference,
        format,
        headings,
        notes,
        false,
      ),
      () => this.downloadManager?.getPassage(version, reference, {
        format,
        includeHeadings: headings,
        includeNotes: notes,
      }),
    );
  }

  async verseOfTheDay(versionId, { mode = 'auto', day = currentDayOfYear() } = {}) {
    const version = positiveInteger(versionId, 'version');
    const calendarDay = positiveInteger(day, 'day');
    if (calendarDay > 366) throw badRequest('day must be between 1 and 366.');
    const daily = await this.#resolve(
      'verse-of-the-day',
      { day: calendarDay, year: new Date().getFullYear() },
      mode,
      () => this.bibleClient.getVOTD(calendarDay),
    );
    const passageId = String(daily.data?.passage_id || '').toUpperCase();
    if (!/^[A-Z0-9]{3}\.\d+(?:\.\d+(?:-\d+)?)?$/.test(passageId)) {
      throw new ServiceError('YouVersion returned an invalid Verse of the Day reference.', {
        code: 'UPSTREAM_INVALID_RESPONSE', status: 502,
      });
    }
    const passage = await this.passage(version, passageId, {
      mode, format: 'html', includeHeadings: false, includeNotes: true,
    });
    return {
      data: { day: calendarDay, passageId, passage: passage.data },
      meta: { source: passage.meta.source, stale: passage.meta.stale, votd: daily.meta },
    };
  }

  async #resolve(
    resource,
    parameters,
    requestedMode,
    fetchOnline,
    readDownloaded,
    readFallback,
  ) {
    const mode = cacheMode(requestedMode);
    const key = `${resource}:${JSON.stringify(parameters)}`;
    const cached = this.cache.get(key);

    if (mode === 'offline') {
      const downloaded = readDownloaded?.();
      if (downloaded) return downloaded;
      if (cached) return response(cached.data, 'cache', cached);
      const fallback = readFallback?.();
      if (fallback) return fallback;
      throw new ServiceError('No cached response is available for this request.', {
        code: 'OFFLINE_CACHE_MISS',
        status: 404,
      });
    }

    // Auto is cache-first: valid local content should not consume a shared
    // application-quota request
    // request merely because the reader reopened or revisited a chapter.
    if (mode === 'auto' && cached && !cached.expired) {
      return response(cached.data, 'cache', cached);
    }
    if (mode === 'auto') {
      const downloaded = readDownloaded?.();
      if (downloaded) return downloaded;
    }

    if (!this.bibleClient) {
      if (mode === 'auto') {
        if (cached) return response(cached.data, 'stale-cache', cached);
        const downloaded = readDownloaded?.();
        if (downloaded) return downloaded;
        const fallback = readFallback?.();
        if (fallback) return fallback;
      }
      throw new ServiceError('YouVersion online access is unavailable.', {
        code: 'APP_KEY_MISSING',
        status: 503,
      });
    }

    try {
      const data = await fetchOnline();
      const timestamps = this.cache.set(key, resource, data);
      return response(data, 'online', { ...timestamps, expired: false });
    } catch (cause) {
      if (mode === 'auto' && cached) {
        return response(cached.data, 'stale-cache', cached, cause.message);
      }
      if (mode === 'auto') {
        const downloaded = readDownloaded?.();
        if (downloaded) return downloaded;
        const fallback = readFallback?.();
        if (fallback) return fallback;
      }
      const upstreamStatus = getHttpStatus(cause);
      if (upstreamStatus === 429) {
        const retryAfterMs = Number(cause?.retryAfterMs) || (5 * 60 * 1000);
        const retryAfterSeconds = Math.max(1, Math.ceil(retryAfterMs / 1000));
        throw new ServiceError(
          `YouVersion is rate-limiting Light, and this selection has no cached or downloaded copy. Retry in about ${retryAfterSeconds} seconds.`,
          {
            code: 'UPSTREAM_RATE_LIMITED',
            status: 429,
            cause,
          },
        );
      }
      throw new ServiceError(`Light upstream request failed: ${cause.message}`, {
        code: 'UPSTREAM_ERROR',
        status: 502,
        cause,
      });
    }
  }

  #chaptersFromCachedBooks(version, bookCode) {
    const cached = this.cache.get(`books:${JSON.stringify({ version })}`);
    if (!cached) return null;
    const books = collectionItems(cached.data);
    const book = books.find((candidate) => candidate?.id === bookCode);
    if (!book || !Array.isArray(book.chapters)) return null;
    return response({ data: book.chapters }, 'cache', cached);
  }

  #localVersions() {
    const downloaded = (this.downloadManager?.listPackages() || [])
      .filter((item) => item.completedItems > 0)
      .map((item) => ({
        id: item.version,
        title: item.title,
        localized_title: item.title,
        abbreviation: item.abbreviation,
        localized_abbreviation: item.abbreviation,
        language_tag: item.languageTag,
        copyright: item.copyright,
      }));
    const data = downloaded;
    if (data.length === 0) return null;
    return {
      data: { data },
      meta: {
        source: 'download', stale: false, storedAt: null, expiresAt: null,
      },
    };
  }

  #mergeLocalVersions(result) {
    const payload = result?.data;
    const existing = collectionItems(payload);
    // Keep installed content selectable regardless of catalog language,
    // expiration, or connectivity. Never persist this merged view in cache:
    // package additions/removals must be reflected on the next catalog read.
    const local = collectionItems(this.#localVersions());
    if (local.length === 0) return result;
    const ids = new Set(existing.map((item) => String(item?.id)));
    const merged = local.filter((item) => !ids.has(String(item.id))).concat(existing);
    if (Array.isArray(payload)) return { ...result, data: merged };
    return { ...result, data: { ...(payload || {}), data: merged } };
  }
}

function collectionItems(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.data?.data)) return payload.data.data;
  return [];
}

export function currentDayOfYear(now = new Date()) {
  return (Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())
    - Date.UTC(now.getFullYear(), 0, 0)) / 86_400_000;
}

async function fetchAllVersions(client, languageRange) {
  // YouVersion supports an unpaginated response when a small field set is
  // requested. The selector only needs these fields, so startup costs one API
  // request instead of walking every page in the all-language catalog.
  return client.getVersions(languageRange, undefined, {
    page_size: '*',
    fields: ['id', 'localized_abbreviation', 'localized_title'],
    // The all_available catalog also contains metadata for unlicensed Bibles.
    // Reader choices must come from the app-scoped collection (API Usage).
    all_available: false,
  });
}

function response(data, source, cache, warning) {
  return {
    data,
    meta: {
      source,
      stale: source === 'stale-cache' || Boolean(cache.expired),
      storedAt: cache.storedAt,
      expiresAt: cache.expiresAt,
      ...(warning ? { warning } : {}),
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

function nonNegativeInteger(value, name) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw badRequest(`${name} must be a non-negative integer.`);
  }
  return parsed;
}

function usfmBook(value) {
  const normalized = String(value || '').toUpperCase();
  if (!/^[A-Z0-9]{3}$/.test(normalized)) {
    throw badRequest('book must be a three-character USFM code, such as JHN.');
  }
  return normalized;
}

function usfmReference(value) {
  const normalized = String(value || '').toUpperCase();
  if (!/^[A-Z0-9]{3}\.(?:INTRO|\d+)(?:\.\d+(?:-\d+)?)?$/.test(normalized)) {
    throw badRequest('usfm must look like JHN.3.16, GEN.1.1-5, or MAT.1.');
  }
  return normalized;
}

function booleanValue(value, name) {
  if (typeof value === 'boolean') return value;
  if (value === 'true' || value === '1') return true;
  if (value === 'false' || value === '0' || value === undefined) return false;
  throw badRequest(`${name} must be true or false.`);
}

function cacheMode(value) {
  if (!['auto', 'online', 'offline'].includes(value)) {
    throw badRequest('mode must be auto, online, or offline.');
  }
  return value;
}

function badRequest(message) {
  return new ServiceError(message, { code: 'BAD_REQUEST', status: 400 });
}
