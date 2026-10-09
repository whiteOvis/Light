import assert from 'node:assert/strict';
import { mkdtempSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { generateKeyPairSync, sign } from 'node:crypto';

import { AuthenticationManager } from '../src/auth.js';
import { SQLiteCache } from '../src/cache.js';
import { DownloadManager } from '../src/download-manager.js';
import { createHttpServer } from '../src/http-server.js';
import { OAuthManager } from '../src/oauth.js';
import { PlatformApiClient } from '../src/platform-api-client.js';
import { YOUVERSION_APPLICATION_KEY } from '../src/platform-config.js';
import { RateLimitedBibleClient } from '../src/rate-limited-bible-client.js';
import { createPlatformClients, LightService } from '../src/service.js';
import { TokenStore } from '../src/token-store.js';
import { UserDataManager } from '../src/user-data-manager.js';

function fixture() {
  const directory = mkdtempSync(join(tmpdir(), 'light-service-'));
  const cache = new SQLiteCache({ directory, ttlSeconds: 3600 });
  return { directory, cache };
}

function signedIdToken(privateKey, claims, kid = 'light-test-key') {
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', kid })).toString('base64url');
  const payload = Buffer.from(JSON.stringify(claims)).toString('base64url');
  const signature = sign('RSA-SHA256', Buffer.from(`${header}.${payload}`), privateKey).toString('base64url');
  return `${header}.${payload}.${signature}`;
}

test('catalog fetching and cache refresh work without bundled Bible content', async (context) => {
  const { cache } = fixture();
  context.after(() => cache.close());
  let calls = 0;
  const service = new LightService({
    cache,
    bibleClient: { async getVersions() {
      calls += 1;
      return { data: [{ id: 111, localized_abbreviation: 'NIV' }] };
    } },
  });
  const first = await service.versions('en');
  assert.equal(first.meta.source, 'online');
  assert.deepEqual(first.data.data.map((item) => item.id), [111]);
  assert.equal((await service.versions('en')).meta.source, 'cache');
  assert.equal(calls, 1);
  cache.database.exec('UPDATE cache_entries SET expires_at = 0');
  assert.equal((await service.versions('en')).meta.source, 'online');
  assert.equal(calls, 2);
});

test('downloaded versions supplement every catalog source and track package changes', async (context) => {
  const { cache } = fixture();
  context.after(() => cache.close());
  let packages = [{
    version: 111, title: 'New International Version', abbreviation: 'NIV',
    languageTag: 'en', copyright: 'NIV copyright', completedItems: 1255,
  }, {
    version: 222, title: 'Partial Bible', abbreviation: 'PART', completedItems: 1,
  }, {
    version: 333, completedItems: 0,
  }];
  const service = new LightService({
    cache,
    downloadManager: { listPackages: () => packages },
  });
  const ids = (result) => result.data.data.map((item) => item.id).sort((a, b) => a - b);
  const expected = [111, 222];
  for (const mode of ['auto', 'offline']) {
    assert.deepEqual(ids(await service.versions('fr', { mode })), expected);
  }
  service.bibleClient = { async getVersions() { throw new Error('Unavailable'); } };
  assert.deepEqual(ids(await service.versions('en')), expected);
  await assert.rejects(service.versions('en', { mode: 'online' }), { code: 'UPSTREAM_ERROR' });
  service.bibleClient = { async getVersions() {
    return { data: [{ id: 111, localized_abbreviation: 'NIV online' }, { id: 444 }] };
  } };
  const online = await service.versions('en');
  assert.deepEqual(ids(online), [111, 222, 444]);
  assert.equal(online.data.data.find((item) => item.id === 111).localized_abbreviation, 'NIV online');
  assert.deepEqual(ids(await service.versions('en', { mode: 'offline' })), ids(online));
  cache.database.exec('UPDATE cache_entries SET expires_at = 0');
  service.bibleClient.getVersions = async () => { throw new Error('Unavailable'); };
  const stale = await service.versions('en');
  assert.equal(stale.meta.source, 'stale-cache');
  assert.deepEqual(ids(stale), ids(online));
  packages = [];
  assert.deepEqual(ids(await service.versions('en')), [111, 444]);
});

test('Verse of the Day uses the documented calendar reference and licensed passage API', async (context) => {
  const { cache } = fixture();
  context.after(() => cache.close());
  const calls = [];
  const service = new LightService({
    cache,
    bibleClient: {
      async getVOTD(day) {
        calls.push(['votd', day]);
        return { day, passage_id: 'JHN.3.16' };
      },
      async getPassage(version, reference, format, headings, notes) {
        calls.push(['passage', version, reference, format, headings, notes]);
        return { id: reference, reference: 'John 3:16', content: '<div class="p">For God so loved.</div>' };
      },
    },
  });

  const result = await service.verseOfTheDay(3034, { mode: 'online', day: 250 });
  assert.equal(result.data.day, 250);
  assert.equal(result.data.passageId, 'JHN.3.16');
  assert.equal(result.data.passage.reference, 'John 3:16');
  assert.deepEqual(calls, [
    ['votd', 250],
    ['passage', 3034, 'JHN.3.16', 'html', false, true],
  ]);
});

test('complete all-language version catalog is cached for translation selection', async (context) => {
  const { cache } = fixture();
  context.after(() => cache.close());
  let request;
  const service = new LightService({
    cache,
    bibleClient: {
      async getVersions(language, license, options) {
        request = { language, license, options };
        return {
          data: [{
            id: 111,
            localized_abbreviation: 'NIV',
            localized_title: 'New International Version',
          }],
        };
      },
    },
  });

  const online = await service.versions('*', { mode: 'online' });
  const offline = await service.versions('*', { mode: 'offline' });

  assert.deepEqual(request, {
    language: '*',
    license: undefined,
    options: {
      page_size: '*',
      fields: ['id', 'localized_abbreviation', 'localized_title'],
      all_available: false,
    },
  });
  assert.equal(online.meta.source, 'online');
  assert.equal(offline.meta.source, 'cache');
  assert.equal(offline.data.data[0].id, 111);
});

test('Light uses its bundled YouVersion application identity without user configuration', () => {
  const { apiClient, bibleClient, highlightsClient } = createPlatformClients({
    YVP_APP_KEY: 'ignored-legacy-user-key',
  }, {
    installationId: 'test-installation',
  });
  assert.ok(apiClient);
  assert.ok(bibleClient);
  assert.ok(highlightsClient);
  assert.equal(apiClient.defaultHeaders['X-YVP-App-Key'], YOUVERSION_APPLICATION_KEY);
});

test('English catalog uses the licensed collection and ignores older discovery caches', async (context) => {
  const { cache } = fixture();
  context.after(() => cache.close());
  cache.set('versions:{"language":"en"}', 'versions', {
    data: [{ id: 999, localized_abbreviation: 'UNLICENSED' }],
  });
  let requestedUrl;
  const versions = [
    { id: 111, localized_abbreviation: 'NIV', localized_title: 'New International Version' },
    { id: 3034, localized_abbreviation: 'BSB', localized_title: 'Berean Standard Bible' },
  ];
  const { bibleClient } = createPlatformClients({}, {
    appKey: 'test-key',
    installationId: 'test-installation',
    fetchImplementation: async (url) => {
      requestedUrl = new URL(url);
      return new Response(JSON.stringify({ data: versions, next_page_token: null, total_size: 2 }), {
        headers: { 'Content-Type': 'application/json' },
      });
    },
  });
  const service = new LightService({ cache, bibleClient });
  const result = await service.versions('en');
  assert.equal(result.meta.source, 'online');
  assert.deepEqual(result.data.data, versions);
  assert.deepEqual(requestedUrl.searchParams.getAll('language_ranges[]'), ['en']);
  assert.equal(requestedUrl.searchParams.get('all_available'), null);
  assert.equal(requestedUrl.searchParams.get('page_size'), '*');
  assert.equal(requestedUrl.searchParams.getAll('fields[]').length, 3);
  assert.deepEqual((await service.versions('en', { mode: 'offline' })).data.data, versions);
});

test('Bible language directory is fetched once and cached', async (context) => {
  const { cache } = fixture();
  context.after(() => cache.close());
  let options;
  const service = new LightService({
    cache,
    bibleClient: {
      async getLanguages(value) {
        options = value;
        return { data: [{ id: 'en', display_names: { en: 'English' } }] };
      },
    },
  });

  const online = await service.languages('es-419', { mode: 'online' });
  const offline = await service.languages('es-419', { mode: 'offline' });

  assert.deepEqual(options, {
    page_size: '*',
    fields: ['id', 'localized_name', 'default_bible_id'],
    bibles_available: true,
    locale: 'es-419',
  });
  assert.equal(online.meta.source, 'online');
  assert.equal(offline.data.data[0].id, 'en');
});

test('online data is cached and available offline', async (context) => {
  const { cache } = fixture();
  context.after(() => cache.close());
  let calls = 0;
  const bibleClient = {
    async getBooks(version) {
      calls += 1;
      return { data: [{ id: 'JHN', version }] };
    },
  };
  const service = new LightService({ cache, bibleClient });

  const online = await service.books(3034, { mode: 'online' });
  const offline = await service.books(3034, { mode: 'offline' });

  assert.equal(calls, 1);
  assert.equal(online.meta.source, 'online');
  assert.equal(offline.meta.source, 'cache');
  assert.deepEqual(offline.data, online.data);
});

test('auto mode reuses a fresh cached response', async (context) => {
  const { cache } = fixture();
  context.after(() => cache.close());
  let calls = 0;
  const service = new LightService({
    cache,
    bibleClient: {
      async getPassage() {
        calls += 1;
        return { reference: 'John 3', content: `Online response ${calls}` };
      },
    },
  });

  const first = await service.passage(111, 'JHN.3', { mode: 'auto' });
  const second = await service.passage(111, 'JHN.3', { mode: 'auto' });

  assert.equal(calls, 1);
  assert.equal(first.meta.source, 'online');
  assert.equal(second.meta.source, 'cache');
  assert.equal(second.data.content, 'Online response 1');
});

test('auto mode uses an exact download without spending an online request', async (context) => {
  const { cache } = fixture();
  context.after(() => cache.close());
  let onlineCalls = 0;
  const service = new LightService({
    cache,
    bibleClient: {
      async getPassage() {
        onlineCalls += 1;
        return { content: 'online' };
      },
    },
    downloadManager: {
      getPassage(_version, reference) {
        return reference === 'JHN.3'
          ? { data: { content: 'downloaded' }, meta: { source: 'download' } }
          : null;
      },
    },
  });

  const result = await service.passage(111, 'JHN.3', { mode: 'auto' });

  assert.equal(onlineCalls, 0);
  assert.equal(result.meta.source, 'download');
  assert.equal(result.data.content, 'downloaded');
});

test('auto mode prefers a fresh exact cache entry before a download', async (context) => {
  const { cache } = fixture();
  context.after(() => cache.close());
  const successful = new LightService({
    cache,
    bibleClient: {
      async getPassage() { return { content: 'cached response' }; },
    },
  });
  await successful.passage(111, 'JHN.3', { mode: 'online' });

  const service = new LightService({
    cache,
    bibleClient: {
      async getPassage() { throw Object.assign(new Error('rate limited'), { status: 429 }); },
    },
    downloadManager: {
      getPassage() {
        return { data: { content: 'downloaded' }, meta: { source: 'download' } };
      },
    },
  });
  const result = await service.passage(111, 'JHN.3', { mode: 'auto' });

  assert.equal(result.meta.source, 'cache');
  assert.equal(result.data.content, 'cached response');
});

test('auto mode uses an exact download without probing a limited upstream', async (context) => {
  const { cache } = fixture();
  context.after(() => cache.close());
  let onlineCalls = 0;
  const service = new LightService({
    cache,
    bibleClient: {
      async getPassage() {
        onlineCalls += 1;
        throw Object.assign(new Error('rate limited'), { status: 429 });
      },
    },
    downloadManager: {
      getPassage() {
        return { data: { content: 'downloaded' }, meta: { source: 'download' } };
      },
    },
  });
  const result = await service.passage(111, 'JHN.3', { mode: 'auto' });

  assert.equal(onlineCalls, 0);
  assert.equal(result.meta.source, 'download');
  assert.equal(result.data.content, 'downloaded');
});

test('shared Bible client cooldown suppresses requests after a 429', async () => {
  let now = 0;
  let calls = 0;
  const rawClient = {
    async getBooks() {
      calls += 1;
      if (calls === 1) {
        throw Object.assign(new Error('Rate limit exceeded.'), { status: 429 });
      }
      return { data: [{ id: 'JHN' }] };
    },
    async getChapters() {
      calls += 1;
      return { data: [{ id: '1' }] };
    },
  };
  const client = new RateLimitedBibleClient({
    client: rawClient,
    requestIntervalMs: 0,
    cooldownMs: 5_000,
    now: () => now,
  });

  await assert.rejects(client.getBooks(111), (error) => error.status === 429);
  await assert.rejects(client.getChapters(111, 'JHN'), (error) => (
    error.status === 429 && error.code === 'YVP_RATE_LIMIT_COOLDOWN'
  ));
  assert.equal(calls, 1);

  now = 5_000;
  const recovered = await client.getBooks(111);
  assert.equal(calls, 2);
  assert.equal(recovered.data[0].id, 'JHN');
});

test('shared Bible client honors an upstream Retry-After duration', async () => {
  let now = 1_000;
  const client = new RateLimitedBibleClient({
    client: {
      async getBooks() {
        throw Object.assign(new Error('Rate limit exceeded.'), {
          status: 429,
          retryAfterMs: 12_000,
        });
      },
    },
    requestIntervalMs: 0,
    cooldownMs: 5_000,
    now: () => now,
  });

  await assert.rejects(client.getBooks(111), (error) => (
    error.status === 429 && error.retryAfterMs === 12_000
  ));
  now = 5_000;
  await assert.rejects(client.getBooks(111), (error) => (
    error.code === 'YVP_RATE_LIMIT_COOLDOWN' && error.retryAfterMs === 8_000
  ));
});

test('platform client identifies the installation and shares Retry-After cooldown', async () => {
  let calls = 0;
  let request;
  let now = 10_000;
  const client = new PlatformApiClient({
    appKey: 'test-app-key',
    installationId: 'test-installation-id',
    now: () => now,
    fetchImplementation: async (url, options) => {
      calls += 1;
      request = { url, options };
      return new Response(JSON.stringify({ message: 'Slow down' }), {
        status: 429,
        headers: {
          'content-type': 'application/json',
          'retry-after': '7',
        },
      });
    },
  });

  await assert.rejects(
    client.get('/v1/bibles', { 'language_ranges[]': ['en*'] }),
    (error) => error.status === 429 && error.retryAfterMs === 7_000,
  );
  assert.equal(request.options.headers['X-YVP-Installation-Id'], 'test-installation-id');
  assert.match(request.url, /language_ranges%5B%5D=en\*/);
  await assert.rejects(
    client.get('/v1/bibles/111'),
    (error) => error.code === 'YVP_RATE_LIMIT_COOLDOWN',
  );
  assert.equal(calls, 1);
  now = 17_000;
});

test('chapter lists fall back to a cached book index during rate limiting', async (context) => {
  const { cache } = fixture();
  context.after(() => cache.close());
  const online = new LightService({
    cache,
    bibleClient: {
      async getBooks() {
        return { data: [{ id: 'JHN', chapters: [{ id: '3', passage_id: 'JHN.3' }] }] };
      },
    },
  });
  await online.books(111, { mode: 'online' });

  const throttled = new LightService({
    cache,
    bibleClient: { async getChapters() { throw new Error('HTTP 429'); } },
  });
  const chapters = await throttled.chapters(111, 'JHN', { mode: 'auto' });

  assert.equal(chapters.meta.source, 'cache');
  assert.equal(chapters.data.data[0].passage_id, 'JHN.3');
});

test('most recently cached passage can restore reader state', async (context) => {
  const { cache } = fixture();
  context.after(() => cache.close());
  const service = new LightService({
    cache,
    bibleClient: {
      async getPassage() {
        return { reference: 'Romans 8', content: 'Cached passage' };
      },
    },
  });
  await service.passage(111, 'ROM.8', {
    mode: 'online',
    format: 'html',
    includeHeadings: true,
    includeNotes: true,
  });

  const recent = service.recentPassage();
  assert.equal(recent.selection.version, 111);
  assert.equal(recent.selection.usfm, 'ROM.8');
  assert.equal(recent.data.content, 'Cached passage');
});

test('auto mode falls back to stale data when the upstream fails', async (context) => {
  const { cache } = fixture();
  context.after(() => cache.close());
  const successful = new LightService({
    cache,
    bibleClient: { async getChapters() { return { data: [{ id: '1' }] }; } },
  });
  await successful.chapters(3034, 'JHN', { mode: 'online' });

  cache.database.exec('UPDATE cache_entries SET expires_at = 0');
  const failing = new LightService({
    cache,
    bibleClient: { async getChapters() { throw new Error('network down'); } },
  });
  const result = await failing.chapters(3034, 'JHN', { mode: 'auto' });

  assert.equal(result.meta.source, 'stale-cache');
  assert.match(result.meta.warning, /network down/);
});

test('token store encrypts tokens and uses private permissions', () => {
  const { directory, cache } = fixture();
  cache.close();
  const store = new TokenStore({ directory });
  store.save({
    accessToken: 'secret-access-token',
    refreshToken: 'secret-refresh-token',
    expiresAt: '2030-01-01T00:00:00.000Z',
  });

  assert.equal(store.load().accessToken, 'secret-access-token');
  assert.equal(statSync(directory).mode & 0o777, 0o700);
  assert.equal(statSync(store.keyPath).mode & 0o777, 0o600);
  assert.equal(statSync(store.tokenPath).mode & 0o777, 0o600);
  assert.equal(store.status().hasRefreshToken, true);
  const localSessionId = store.getLocalSessionId();
  assert.equal(statSync(store.localSessionPath).mode & 0o777, 0o600);
  assert.equal(store.clear(), true);
  assert.equal(store.getLocalSessionId(), localSessionId);
});

test('custom-scheme PKCE flow survives separate callback process stages', async () => {
  const { directory, cache } = fixture();
  cache.close();
  const tokenStore = new TokenStore({ directory });
  let tokenRequest;
  const manager = new OAuthManager({
    tokenStore,
    appKey: 'test-client-id',
    env: {
      YVP_REDIRECT_URI: 'omarchy://oauth/callback',
    },
    fetchImplementation: async (url, options) => {
      const requestUrl = new URL(url);
      if (requestUrl.pathname === '/auth/callback') {
        return {
          ok: false,
          status: 302,
          headers: {
            get(name) {
              return name.toLowerCase() === 'location'
                ? `omarchy://oauth/callback?state=${requestUrl.searchParams.get('state')}&code=one-time-code`
                : null;
            },
          },
        };
      }
      tokenRequest = { url, options };
      return {
        ok: true,
        status: 200,
        async json() {
          return {
            access_token: 'oauth-access-token',
            refresh_token: 'oauth-refresh-token',
            expires_in: 3600,
          };
        },
      };
    },
  });

  const started = await manager.start({
    permissions: ['highlights'],
    open: false,
  });
  const authorizationUrl = new URL(started.authorizationUrl);
  const state = authorizationUrl.searchParams.get('state');
  assert.equal(authorizationUrl.pathname, '/auth/authorize');
  assert.equal(authorizationUrl.searchParams.get('redirect_uri'), 'omarchy://oauth/callback');
  assert.equal(authorizationUrl.searchParams.get('code_challenge_method'), 'S256');
  assert.equal(authorizationUrl.searchParams.get('requested_permissions'), null);
  assert.deepEqual(authorizationUrl.searchParams.getAll('requested_permissions[]'), ['highlights']);

  const continuation = await manager.handleCallback(
    `omarchy://oauth/callback?state=${state}&granted_permissions%5B%5D=highlights`,
    { open: false },
  );
  assert.equal(continuation.stage, 'awaiting-code');
  assert.equal(continuation.authorizationUrl, `https://api.youversion.com/auth/callback?state=${state}`);
  // A separately launched native handler receives the browser's final code.
  const handler = new OAuthManager({ tokenStore, fetchImplementation: manager.fetch });
  const completed = await handler.handleCallback(`omarchy://oauth/callback?state=${state}&code=one-time-code`);
  assert.equal(completed.stage, 'complete');
  assert.equal(completed.token.hasRefreshToken, true);
  assert.deepEqual(completed.grantedPermissions, ['highlights']);
  assert.equal(tokenRequest.url, 'https://api.youversion.com/auth/token');
  assert.equal(tokenRequest.options.body.get('code_verifier').length >= 43, true);
  assert.equal(tokenStore.loadPendingAuth(), null);
  assert.equal(tokenStore.load().accessToken, 'oauth-access-token');
});

test('the native OAuth handler replays state in the default browser before exchanging the final code', async () => {
  const { directory, cache } = fixture();
  cache.close();
  const tokenStore = new TokenStore({ directory });
  const openedUrls = [];
  let continuationUrl = '';
  const manager = new OAuthManager({
    tokenStore,
    appKey: 'test-client-id',
    env: { YVP_REDIRECT_URI: 'omarchy://oauth/callback' },
    openUrl: async (url) => { openedUrls.push(url); },
    fetchImplementation: async (url) => {
      const requestUrl = new URL(url);
      if (requestUrl.pathname === '/auth/callback') {
        continuationUrl = requestUrl.toString();
        return {
          status: 302,
          headers: {
            get: () => `omarchy://oauth/callback?state=${requestUrl.searchParams.get('state')}&code=one-time-code`,
          },
        };
      }
      return {
        ok: true,
        async json() {
          return { access_token: 'oauth-access-token', expires_in: 3600 };
        },
      };
    },
  });
  const started = await manager.start({ open: false });
  const state = new URL(started.authorizationUrl).searchParams.get('state');

  const continuation = await manager.handleCallback(`omarchy://oauth/callback?state=${state}`);
  assert.equal(continuation.stage, 'awaiting-code');
  assert.equal(continuationUrl, '', 'the continuation must not be fetched outside the browser');
  assert.deepEqual(openedUrls, [`https://api.youversion.com/auth/callback?state=${state}`]);
  const completed = await manager.handleCallback(`omarchy://oauth/callback?state=${state}&code=one-time-code`);
  assert.equal(completed.stage, 'complete');
  assert.equal(tokenStore.loadPendingAuth(), null);
  assert.equal(tokenStore.load().accessToken, 'oauth-access-token');
});

test('OAuth verifies and stores the signed-in YouVersion profile', async () => {
  const { directory, cache } = fixture();
  cache.close();
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const key = { ...publicKey.export({ format: 'jwk' }), kid: 'light-test-key', use: 'sig', alg: 'RS256' };
  const tokenStore = new TokenStore({ directory });
  let nonce = '';
  const manager = new OAuthManager({
    tokenStore,
    appKey: 'test-client-id',
    env: { YVP_REDIRECT_URI: 'omarchy://oauth/callback' },
    fetchImplementation: async (url) => {
      const requestUrl = new URL(url);
      if (requestUrl.pathname === '/auth/callback') {
        return { status: 302, headers: { get: () => `omarchy://oauth/callback?state=${requestUrl.searchParams.get('state')}&code=one-time-code` } };
      }
      if (requestUrl.pathname === '/.well-known/jwks.json') {
        return { ok: true, async json() { return { keys: [key] }; } };
      }
      return {
        ok: true,
        async json() {
          return {
            access_token: 'oauth-access-token', refresh_token: 'oauth-refresh-token', expires_in: 3600,
            id_token: signedIdToken(privateKey, {
              iss: 'https://api.youversion.com', aud: 'test-client-id', nonce,
              exp: Math.floor(Date.now() / 1000) + 3600, sub: 'yv-user-1',
              name: 'Light Reader', email: 'reader@example.test', profile_picture: 'https://images.example.test/reader.png',
            }),
          };
        },
      };
    },
  });
  const started = await manager.start({ open: false });
  nonce = tokenStore.loadPendingAuth().nonce;
  const state = new URL(started.authorizationUrl).searchParams.get('state');
  await manager.handleCallback(`omarchy://oauth/callback?state=${state}&code=one-time-code`, { open: false });

  assert.deepEqual(tokenStore.status().profile, {
    id: 'yv-user-1', name: 'Light Reader', email: 'reader@example.test', avatarUrl: 'https://images.example.test/reader.png',
  });
});

test('authentication manager deduplicates refresh and stores rotated tokens', async () => {
  const { directory, cache } = fixture();
  cache.close();
  const tokenStore = new TokenStore({ directory });
  tokenStore.save({
    accessToken: 'expired-token',
    refreshToken: 'old-refresh-token',
    expiresAt: '2020-01-01T00:00:00.000Z',
    appKey: 'stored-app-key',
    apiHost: 'api.youversion.com',
  });
  let refreshCalls = 0;
  let refreshBody;
  const authentication = new AuthenticationManager({
    tokenStore,
    appKey: 'test-app-key',
    fetchImplementation: async (_url, options) => {
      refreshCalls += 1;
      refreshBody = options.body;
      await Promise.resolve();
      return {
        ok: true,
        status: 200,
        async json() {
          return {
            access_token: 'fresh-token',
            refresh_token: 'rotated-refresh-token',
            expires_in: '3599',
            token_type: 'Bearer',
          };
        },
      };
    },
  });

  const tokens = await Promise.all([
    authentication.getAccessToken(),
    authentication.getAccessToken(),
  ]);

  assert.deepEqual(tokens, ['fresh-token', 'fresh-token']);
  assert.equal(refreshCalls, 1);
  assert.equal(refreshBody.get('grant_type'), 'refresh_token');
  assert.equal(refreshBody.get('client_id'), 'test-app-key');
  assert.equal(tokenStore.load().refreshToken, 'rotated-refresh-token');
  assert.equal(authentication.status().authenticated, true);
});

test('download manager builds a resumable SQLite translation package', async (context) => {
  const { cache } = fixture();
  context.after(() => cache.close());
  const requestedPassages = [];
  let versionCalls = 0;
  const bibleClient = {
    async getVersion(id) {
      versionCalls += 1;
      if (versionCalls === 1) {
        throw Object.assign(new Error('temporary upstream failure'), { status: 503 });
      }
      return {
        id,
        title: 'Test Bible',
        localized_title: 'Test Bible',
        abbreviation: 'TST',
        localized_abbreviation: 'TST',
        language_tag: 'en',
        copyright: 'Test copyright',
      };
    },
    async getIndex() {
      return {
        text_direction: 'ltr',
        books: [{
          id: 'JHN',
          title: 'John',
          full_title: 'John',
          abbreviation: 'Jn',
          canon: 'new_testament',
          intro: { id: 'INTRO', passage_id: 'JHN.INTRO', title: 'Intro' },
          chapters: [
            { id: '1', passage_id: 'JHN.1', title: '1', verses: [] },
            { id: '2', passage_id: 'JHN.2', title: '2', verses: [] },
          ],
        }],
      };
    },
    async getPassage(_version, passageId) {
      requestedPassages.push(passageId);
      return { id: passageId, reference: passageId, content: `Text for ${passageId}` };
    },
  };
  const downloads = new DownloadManager({
    database: cache.database,
    bibleClient,
    concurrency: 2,
    maxRetries: 1,
    retryBaseMs: 0,
    requestIntervalMs: 0,
  });

  const completed = await downloads.downloadPackage(3034);
  const offlinePassage = downloads.getPassage(3034, 'JHN.2');
  const service = new LightService({
    cache,
    bibleClient: null,
    downloadManager: downloads,
  });
  const offlineBooks = await service.books(3034, { mode: 'offline' });
  const offlineVersions = await service.versions('en', { mode: 'offline' });
  assert.equal(offlineVersions.meta.source, 'download');
  assert.equal(offlineVersions.data.data[0].id, 3034);
  assert.equal(offlineVersions.data.data[0].localized_abbreviation, 'TST');

  assert.equal(completed.status, 'complete');
  assert.equal(versionCalls, 2);
  assert.equal(completed.totalItems, 3);
  assert.equal(completed.completedItems, 3);
  assert.deepEqual(requestedPassages.sort(), ['JHN.1', 'JHN.2', 'JHN.INTRO']);
  assert.equal(offlinePassage.data.content, 'Text for JHN.2');
  assert.equal(offlinePassage.meta.source, 'download');
  assert.equal(offlineBooks.data.data[0].id, 'JHN');
  const unchanged = await downloads.checkForUpdate(3034);
  assert.equal(unchanged.updateAvailable, false);
  bibleClient.getIndex = async () => ({
    text_direction: 'ltr',
    books: [{
      id: 'JHN',
      title: 'John',
      full_title: 'John',
      abbreviation: 'Jn',
      canon: 'new_testament',
      intro: null,
      chapters: [{ id: '3', passage_id: 'JHN.3', title: '3', verses: [] }],
    }],
  });
  const changed = await downloads.checkForUpdate(3034);
  assert.equal(changed.updateAvailable, true);
  assert.equal(changed.indexChanged, true);
  assert.equal(downloads.removePackage(3034).removed, true);
  assert.equal(downloads.getPackage(3034), null);
});

test('download manager pauses immediately when YouVersion returns 429', async (context) => {
  const { cache } = fixture();
  context.after(() => cache.close());
  let versionCalls = 0;
  const downloads = new DownloadManager({
    database: cache.database,
    bibleClient: {
      async getVersion() {
        versionCalls += 1;
        throw Object.assign(new Error('Rate limit exceeded.'), { status: 429 });
      },
      async getIndex() { return { books: [] }; },
    },
    maxRetries: 3,
    requestIntervalMs: 0,
  });

  await assert.rejects(
    downloads.downloadPackage(111),
    (error) => error.status === 429 && error.code === 'UPSTREAM_RATE_LIMITED',
  );

  const packageState = downloads.getPackage(111);
  assert.equal(versionCalls, 1);
  assert.equal(packageState.status, 'paused');
  assert.match(packageState.error, /rate-limiting/);

  cache.database.prepare(`
    UPDATE download_packages
    SET status = 'failed', error = 'HTTP error! status: 429'
    WHERE version_id = 111
  `).run();
  const restarted = new DownloadManager({ database: cache.database });
  assert.equal(restarted.getPackage(111).status, 'paused');
});

test('paused downloads resume with their saved options and retain completed chapters', async (context) => {
  const { cache } = fixture();
  context.after(() => cache.close());
  let pauseSecondChapter = true;
  const requestedPassages = [];
  const bibleClient = {
    async getVersion(id) {
      return {
        id,
        title: 'Resume Test Bible',
        abbreviation: 'RTB',
        language_tag: 'en',
      };
    },
    async getIndex() {
      return {
        books: [{
          id: 'JHN',
          title: 'John',
          chapters: [
            { id: '1', passage_id: 'JHN.1' },
            { id: '2', passage_id: 'JHN.2' },
          ],
        }],
      };
    },
    async getPassage(_version, passageId) {
      requestedPassages.push(passageId);
      if (passageId === 'JHN.2' && pauseSecondChapter) {
        throw Object.assign(new Error('Rate limit exceeded.'), { status: 429 });
      }
      return { id: passageId, content: `Text for ${passageId}` };
    },
  };
  const downloads = new DownloadManager({
    database: cache.database,
    bibleClient,
    concurrency: 1,
    maxRetries: 0,
    requestIntervalMs: 0,
  });

  await assert.rejects(
    downloads.downloadPackage(222, {
      format: 'html',
      includeHeadings: true,
      includeNotes: true,
    }),
    (error) => error.code === 'UPSTREAM_RATE_LIMITED',
  );
  const paused = downloads.getPackage(222);
  assert.equal(paused.status, 'paused');
  assert.equal(paused.completedItems, 1);
  assert.equal(paused.format, 'html');
  assert.equal(paused.includeHeadings, true);
  assert.equal(paused.includeNotes, true);

  pauseSecondChapter = false;
  const completed = await downloads.resumePackage(222);

  assert.equal(completed.status, 'complete');
  assert.equal(completed.completedItems, 2);
  assert.equal(requestedPassages.filter((id) => id === 'JHN.1').length, 1);
  assert.equal(requestedPassages.filter((id) => id === 'JHN.2').length, 2);
  assert.throws(
    () => downloads.resumePackage(222),
    (error) => error.status === 409 && error.code === 'DOWNLOAD_NOT_PAUSED',
  );
});

test('HTTP resume endpoint queues a paused download', async (context) => {
  let resumedVersion = null;
  const server = createHttpServer({
    requireAccount: false,
    service: { onlineConfigured: true },
    cache: { stats() { return {}; } },
    authentication: { status() { return { authenticated: false }; } },
    downloadManager: {
      queueResume(version) {
        resumedVersion = Number(version);
        return { version: resumedVersion, status: 'queued', resumed: true };
      },
    },
    oauth: {},
    userData: {},
  });
  context.after(() => new Promise((resolve) => server.close(resolve)));
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });

  const address = server.address();
  const response = await fetch(
    `http://127.0.0.1:${address.port}/v1/downloads/222/resume`,
    { method: 'POST' },
  );
  const payload = await response.json();

  assert.equal(response.status, 202);
  assert.equal(resumedVersion, 222);
  assert.deepEqual(payload, { version: 222, status: 'queued', resumed: true });
});

test('user data manager syncs highlights and manages local notes and color preference', async (context) => {
  const { cache } = fixture();
  context.after(() => cache.close());
  let remoteHighlights = [{
    version_id: 3034,
    passage_id: 'JHN.3.16',
    color: 'fffe00',
  }];
  let highlightQuery;
  const highlightsClient = {
    async getHighlights(query, token) {
      highlightQuery = { query, token };
      return { data: remoteHighlights, next_page_token: null };
    },
    async createHighlight(highlight) {
      const created = { ...highlight, color: highlight.color.toLowerCase() };
      remoteHighlights = remoteHighlights
        .filter((item) => item.passage_id !== created.passage_id)
        .concat(created);
      return created;
    },
    async deleteHighlight(passageId) {
      remoteHighlights = remoteHighlights
        .filter((item) => item.passage_id !== passageId);
    },
  };
  const authentication = {
    getSessionId() { return 'test-session'; },
    async getAccessToken() { return 'test-access-token'; },
  };
  const userData = new UserDataManager({
    database: cache.database,
    highlightsClient,
    authentication,
  });

  userData.setDefaultHighlightColor('#abc123');
  assert.equal(userData.getDefaultHighlightOpacity(), 0.45);
  userData.setDefaultHighlightOpacity(0.55);
  assert.equal(userData.getDefaultHighlightOpacity(), 0.55);
  assert.throws(() => userData.setDefaultHighlightOpacity(0.15));
  assert.throws(() => userData.setDefaultHighlightOpacity(0.8));
  assert.equal(userData.getAppScale(), 1.2);
  userData.setAppScale(1.45);
  assert.equal(userData.getReaderTextScale(), 1);
  userData.setReaderTextScale(1.3);
  assert.equal(userData.getReaderFontStyle(), 'youversion');
  userData.setReaderFontStyle('system');
  assert.equal(userData.getRedLetters(), false);
  userData.setRedLetters(true);
  assert.equal(userData.getMusicPlayerEnabled(), false);
  userData.setMusicPlayerEnabled(true);
  assert.deepEqual(userData.getCustomRadioStations(), []);
  userData.setCustomRadioStations([
    {
      name: 'Test Radio',
      description: 'Contemporary Christian pop and worship',
      streamUrl: 'https://radio.example/live.mp3',
    },
  ]);
  assert.deepEqual(userData.getHiddenRadioStationIds(), []);
  userData.setHiddenRadioStationIds([
    'k-love', 'abiding-radio-peaceful', 'k-love',
  ]);
  assert.deepEqual(userData.getRadioStationOrder(), []);
  userData.setRadioStationOrder([
    'custom:https://radio.example/live.mp3', 'builtin:air1', 'builtin:air1',
  ]);
  assert.deepEqual(userData.getSettingsSectionOrder(), [
    'reading', 'appearance', 'radio', 'languages', 'account', 'shortcuts', 'backup',
  ]);
  userData.setSettingsSectionOrder([
    'radio', 'reading', 'backup', 'appearance', 'languages', 'account', 'shortcuts',
  ]);
  assert.equal(userData.getAppLanguage(), 'system');
  userData.setAppLanguage('es-419');
  assert.deepEqual(userData.getSecondaryBibleLanguages(), []);
  userData.setSecondaryBibleLanguages(['es', 'fr', 'es']);
  assert.deepEqual(userData.getReaderTabs(), { tabs: [], activeTabIndex: -1 });
  userData.setReaderTabs({
    tabs: [
      { version: 3034, passage: 'JHN.3', verse: '16', scrollY: 248 },
      { version: 111, passage: 'GEN.1' },
      { version: 3034, passage: 'JHN.3', verse: '16', scrollY: 248 },
    ],
    activeTabIndex: 1,
  });
  const created = await userData.createHighlight({
    versionId: 3034,
    passageId: 'JHN.3.17',
    selectionRanges: [{ passage: 'JHN.3.17', start: 4, end: 15 }],
  });
  const note = userData.createNote({
    versionId: 3034,
    passageId: 'JHN.3.16',
    body: 'A local study note',
  });
  const contextData = await userData.getContext(3034, 'JHN.3', { refresh: true });
  const deleted = await userData.deleteHighlight({
    versionId: 3034,
    passageId: 'JHN.3.16',
  });

  assert.equal(created.queued, false);
  assert.equal(created.highlight.color, 'abc123');
  assert.deepEqual(created.highlight.selectionRanges, [
    { passage: 'JHN.3.17', start: 4, end: 15 },
  ]);
  assert.equal(contextData.highlights.length, 2);
  assert.deepEqual(highlightQuery, {
    query: { version_id: 3034, passage_id: 'JHN.3' },
    token: 'test-access-token',
  });
  const accountHighlight = contextData.highlights.find(
    (highlight) => highlight.passage === 'JHN.3.16',
  );
  assert.equal(accountHighlight.version, 3034);
  assert.equal(accountHighlight.color, 'fffe00');
  assert.equal(accountHighlight.syncState, 'synced');
  assert.equal(accountHighlight.error, null);
  const selectedHighlight = contextData.highlights.find(
    (highlight) => highlight.passage === 'JHN.3.17',
  );
  assert.deepEqual(selectedHighlight.selectionRanges, [
    { passage: 'JHN.3.17', start: 4, end: 15 },
  ]);
  assert.equal(contextData.notes[0].syncState, 'local_only');
  assert.equal(contextData.capabilities.remoteNotes, false);
  assert.equal(contextData.preferences.defaultHighlightColor, 'abc123');
  assert.equal(contextData.preferences.defaultHighlightOpacity, 0.55);
  assert.equal(contextData.preferences.appScale, 1.45);
  assert.equal(contextData.preferences.readerTextScale, 1.3);
  assert.equal(contextData.preferences.readerFontStyle, 'system');
  assert.equal(contextData.preferences.redLetters, true);
  assert.equal(contextData.preferences.musicPlayerEnabled, true);
  assert.deepEqual(contextData.preferences.customRadioStations, [{
    name: 'Test Radio',
    description: 'Contemporary Christian pop and worship',
    streamUrl: 'https://radio.example/live.mp3',
    siteUrl: '',
    custom: true,
  }]);
  assert.deepEqual(contextData.preferences.hiddenRadioStationIds, [
    'k-love', 'abiding-radio-peaceful',
  ]);
  assert.deepEqual(contextData.preferences.radioStationOrder, [
    'custom:https://radio.example/live.mp3', 'builtin:air1',
  ]);
  assert.deepEqual(contextData.preferences.settingsSectionOrder, [
    'radio', 'reading', 'backup', 'appearance', 'languages', 'account', 'shortcuts',
  ]);
  assert.equal(contextData.preferences.appLanguage, 'es-419');
  assert.deepEqual(contextData.preferences.secondaryBibleLanguages, ['es', 'fr']);
  assert.deepEqual(contextData.preferences.readerTabs, {
    tabs: [
      { version: 3034, passage: 'JHN.3', verse: '16', scrollY: 248 },
      { version: 111, passage: 'GEN.1' },
    ],
    activeTabIndex: 1,
  });
  assert.equal(userData.getAppScale(), 1.45);
  assert.equal(userData.getReaderTextScale(), 1.3);
  assert.equal(userData.getReaderFontStyle(), 'system');
  assert.equal(userData.getRedLetters(), true);
  assert.equal(userData.getMusicPlayerEnabled(), true);
  assert.equal(userData.getCustomRadioStations()[0].name, 'Test Radio');
  assert.deepEqual(userData.getHiddenRadioStationIds(), [
    'k-love', 'abiding-radio-peaceful',
  ]);
  assert.deepEqual(userData.getRadioStationOrder(), [
    'custom:https://radio.example/live.mp3', 'builtin:air1',
  ]);
  assert.equal(userData.getAppLanguage(), 'es-419');
  assert.deepEqual(userData.getSecondaryBibleLanguages(), ['es', 'fr']);
  assert.equal(userData.getReaderTabs().tabs.length, 2);
  assert.throws(
    () => userData.setAppScale(0.7),
    (error) => error.status === 400 && error.code === 'BAD_REQUEST',
  );
  assert.throws(
    () => userData.setReaderTextScale(1.9),
    (error) => error.status === 400 && error.code === 'BAD_REQUEST',
  );
  assert.throws(
    () => userData.setReaderFontStyle('comic-sans'),
    (error) => error.status === 400 && error.code === 'BAD_REQUEST',
  );
  assert.throws(
    () => userData.setRedLetters('true'),
    (error) => error.status === 400 && error.code === 'BAD_REQUEST',
  );
  assert.throws(
    () => userData.setMusicPlayerEnabled('true'),
    (error) => error.status === 400 && error.code === 'BAD_REQUEST',
  );
  assert.throws(
    () => userData.setCustomRadioStations([
      { name: 'Unsafe', streamUrl: 'file:///tmp/music.mp3' },
    ]),
    (error) => error.status === 400 && error.code === 'BAD_REQUEST',
  );
  assert.throws(
    () => userData.setHiddenRadioStationIds(['Not Valid']),
    (error) => error.status === 400 && error.code === 'BAD_REQUEST',
  );
  assert.throws(
    () => userData.setRadioStationOrder(['unknown:station']),
    (error) => error.status === 400 && error.code === 'BAD_REQUEST',
  );
  assert.throws(
    () => userData.setAppLanguage('not-a-language'),
    (error) => error.status === 400 && error.code === 'BAD_REQUEST',
  );
  assert.throws(
    () => userData.setSecondaryBibleLanguages(['english']),
    (error) => error.status === 400 && error.code === 'BAD_REQUEST',
  );
  const sevenTabs = Array.from({ length: 7 }, (_, index) => ({
    version: 3034,
    passage: `JHN.${index + 1}`,
  }));
  userData.setReaderTabs({ tabs: sevenTabs, activeTabIndex: 6 });
  assert.deepEqual(userData.getReaderTabs(), { tabs: sevenTabs, activeTabIndex: 6 });
  assert.equal(userData.getKeybindings().tab6, 'Ctrl+6');
  assert.equal(userData.getKeybindings().tab7, 'Ctrl+7');
  assert.throws(
    () => userData.setReaderTabs({
      tabs: [
        { version: 3034, passage: 'JHN.3' },
        { version: 3034, passage: 'JHN.4' },
        { version: 3034, passage: 'JHN.5' },
        { version: 3034, passage: 'JHN.6' },
        { version: 3034, passage: 'JHN.7' },
        { version: 3034, passage: 'JHN.8' },
        { version: 3034, passage: 'JHN.9' },
        { version: 3034, passage: 'JHN.10' },
      ],
      activeTabIndex: 0,
    }),
    (error) => error.status === 400 && error.code === 'BAD_REQUEST',
  );
  assert.equal(deleted.deleted, true);
  assert.equal(deleted.queued, false);
  assert.equal(userData.deleteNote(note.id).deleted, true);
});

test('radio is off for a fresh profile and preserves an explicit opt-in', (context) => {
  const { cache } = fixture();
  context.after(() => cache.close());
  const authentication = { getSessionId() { return 'radio-preference-test'; } };
  const freshUserData = new UserDataManager({
    database: cache.database,
    authentication,
  });

  assert.equal(freshUserData.getMusicPlayerEnabled(), false);
  freshUserData.setMusicPlayerEnabled(true);

  const restartedUserData = new UserDataManager({
    database: cache.database,
    authentication,
  });
  assert.equal(restartedUserData.getMusicPlayerEnabled(), true);
});

test('highlights remain local and queued when YouVersion sync is unavailable', async (context) => {
  const { directory, cache } = fixture();
  context.after(() => cache.close());
  const authentication = new AuthenticationManager({
    tokenStore: new TokenStore({ directory }),
  });
  const userData = new UserDataManager({
    database: cache.database,
    authentication,
  });

  const created = await userData.createHighlight({
    versionId: 3034,
    passageId: 'JHN.3.16-17',
    color: 'ff9900',
  });
  const stored = await userData.getHighlights(3034, 'JHN.3');
  const deleted = await userData.deleteHighlight({
    versionId: 3034,
    passageId: 'JHN.3.16-17',
  });
  const afterDelete = await userData.getHighlights(3034, 'JHN.3');
  const pendingDeletes = cache.database.prepare(`
    SELECT passage_id FROM user_highlights
    WHERE sync_state = 'pending_delete'
    ORDER BY passage_id
  `).all();

  assert.equal(created.queued, true);
  assert.equal(created.highlight.syncState, 'pending_create');
  assert.equal(stored.length, 1);
  assert.equal(stored[0].passage, 'JHN.3.16-17');
  assert.equal(stored[0].color, 'ff9900');
  assert.equal(deleted.deleted, true);
  assert.equal(deleted.queued, true);
  assert.deepEqual(afterDelete, []);
  assert.deepEqual(
    pendingDeletes.map((item) => item.passage_id),
    ['JHN.3.16', 'JHN.3.17'],
  );
});
