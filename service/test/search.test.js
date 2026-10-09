import { authenticatedFetch as fetch } from './helpers/http-client.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { DownloadManager } from '../src/download-manager.js';
import { LightService } from '../src/service.js';
import { RateLimitedBibleClient } from '../src/rate-limited-bible-client.js';

test('downloaded search returns verse text immediately and prefers the selected translation', () => {
  const database = new DatabaseSync(':memory:');
  const downloads = new DownloadManager({ database, recoverInterruptedDownloads: false });
  try {
    for (const version of [111, 222]) {
      database.prepare(`INSERT INTO download_packages
        (version_id, status, format, include_headings, include_notes, completed_items, created_at, updated_at)
        VALUES (?, 'complete', 'html', 0, 0, 1, 1, 1)`).run(version);
      database.prepare(`INSERT INTO download_passages
        (version_id, passage_id, book_id, chapter_id, kind, payload, downloaded_at)
        VALUES (?, 'JHN.3', 'JHN', '3', 'chapter', ?, 1)`).run(version, JSON.stringify({
        content: '<div><span class="yv-v" v="16"></span><span class="yv-vlbl">16</span>For God so loved the world. '
          + '<span class="yv-v" v="17"></span><span class="yv-vlbl">17</span>God sent his Son.</div>',
      }));
    }
    const service = new LightService({ downloadManager: downloads });
    const result = service.searchDownloaded(222, 'god');
    assert.equal(result.verses.length, 4);
    assert.deepEqual(result.verses.map((verse) => verse.version), [222, 222, 111, 111]);
    assert.equal(result.verses[0].reference, 'JHN.3.16');
    assert.equal(result.verses[0].text, 'For God so loved the world.');
    assert.equal(downloads.getVerseText(222, 'JHN.3.16'), 'For God so loved the world.');
    assert.equal(downloads.getVerseText(222, 'JHN.3.99'), null);
    assert.deepEqual(service.searchDownloaded(222, 'absent').verses, []);
  } finally { database.close(); }
});

test('online search uses documented endpoint, selected Bible and opaque pagination', async () => {
  const calls = [];
  const bibleClient = new RateLimitedBibleClient({ client: {}, requestIntervalMs: 0,
    apiClient: { get: async (...args) => {
      calls.push(args);
      return { verses: [{ reference: 'JHN.3.16' }], next_page_token: 'next' };
    } },
  });
  const service = new LightService({ bibleClient });
  const result = await service.search(3034, 'for god so loved', 'opaque');
  assert.equal(result.version, 3034);
  assert.deepEqual(calls[0], ['/v1/search-verses', {
    bible_id: 3034, query: 'for god so loved', page_size: 25, page_token: 'opaque',
  }]);
  await assert.rejects(service.search(3034, 'x'.repeat(101)), /1–100/);
  await service.search(1, 'for god so loved');
  assert.equal(calls.length, 2);
});

test('HTTP search routes phrases and rejects malformed queries', async (context) => {
  const { createHttpServer } = await import('../src/http-server.js');
  const server = createHttpServer({ clientToken: 'test-client', service: new LightService({
    bibleClient: { searchVerses: async () => ({ verses: [{ reference: 'JHN.3.16' }] }) },
  }), requireAccount: false });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  context.after(async () => { await new Promise(resolve => server.close(resolve)); });
  const url = `http://127.0.0.1:${server.address().port}/v1/search`;
  let response = await fetch(`${url}?version=1&query=for%20god%20so%20loved`);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).verses[0].reference, 'JHN.3.16');
  response = await fetch(`${url}?version=3034&query=G25`);
  assert.equal(response.status, 200);
  const phrase = await response.json();
  assert.equal(phrase.version, 3034);
  assert.equal(phrase.verses[0].reference, 'JHN.3.16');
  response = await fetch(`${url.replace('/search', '/word-study')}?version=1&passage=JHN.3.16&offset=0`);
  assert.equal(response.status, 404);
  response = await fetch(`${url}?version=1&query=`);
  assert.equal(response.status, 400);
});
