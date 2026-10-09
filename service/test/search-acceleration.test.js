import assert from 'node:assert/strict';
import test from 'node:test';
import { SearchAcceleration } from '../src/search-acceleration.js';

function fixture(overrides = {}) {
  const stored = new Map();
  const cache = { get: key => stored.has(key) ? { data: stored.get(key), expired: false } : null,
    set: (key, resource, value) => stored.set(key, value) };
  const service = { cache, ...overrides };
  return { service, stored, acceleration: new SearchAcceleration(service) };
}
const marker = (number, text) => `<span class="yv-v" v="${number}"></span><span class="yv-vlbl">${number}</span>${text}`;

test('repeat and simultaneous searches reuse one request while keeping versions and pages separate', async () => {
  const { acceleration } = fixture();
  let calls = 0;
  const fetch = async () => { calls++; await new Promise(resolve => setImmediate(resolve));
    return { verses: [{ reference: 'JHN.3.16' }], next_page_token: 'next' }; };
  const results = await Promise.all([acceleration.search(3034, 'love', '', fetch), acceleration.search(3034, 'love', '', fetch)]);
  assert.equal(calls, 1);
  assert.equal(results[0].next_page_token, 'next');
  await acceleration.search(3034, 'love', '', fetch);
  assert.equal(calls, 1);
  await acceleration.search(111, 'love', '', fetch);
  await acceleration.search(3034, 'love', 'next', fetch);
  assert.equal(calls, 3);
});

test('failed searches are retried and expired results refresh', async () => {
  const { acceleration } = fixture();
  await assert.rejects(acceleration.search(3034, 'love', '', () => { throw new Error('offline'); }));
  let calls = 0;
  const fetch = () => { calls++; return { verses: [] }; };
  await acceleration.search(3034, 'love', '', fetch);
  acceleration.results.values().next().value.expires = 0;
  await acceleration.search(3034, 'love', '', fetch);
  assert.equal(calls, 2);
});

test('search responses attach already cached chapter text without passage requests', async () => {
  const { acceleration, stored } = fixture();
  stored.set('passage:' + JSON.stringify({ version: 3034, usfm: 'JHN.3', format: 'html', headings: false, notes: true }),
    { content: marker(16, 'God loved the world.') + marker(17, 'God sent his Son.') });
  const result = await acceleration.search(3034, 'love', '', () => ({ verses: [{ reference: 'JHN.3.16' }] }));
  assert.equal(result.verses[0].text, 'God loved the world.');
});

test('visible verses in one chapter share a licensed passage request and repeat previews are local', async () => {
  const calls = [];
  const { acceleration } = fixture({ passage: async (version, reference, options) => {
    calls.push([version, reference, options.format]);
    return { data: { content: marker(16, 'First verse.') + marker(17, 'Second verse.') } };
  } });
  const entries = [{ version: 3034, reference: 'JHN.3.16' }, { version: 3034, reference: 'JHN.3.17' }];
  const result = await acceleration.previews(entries);
  assert.deepEqual(calls, [[3034, 'JHN.3.16-17', 'html']]);
  assert.deepEqual(result.previews, { '3034:JHN.3.16': 'First verse.', '3034:JHN.3.17': 'Second verse.' });
  assert.deepEqual((await acceleration.previews(entries)).previews, result.previews);
  assert.equal(calls.length, 1);
});

test('preview workers are bounded, preserve successful results, and report rate limiting', async () => {
  let active = 0, peak = 0;
  const { acceleration } = fixture({ passage: async (version, reference) => {
    active++; peak = Math.max(peak, active);
    await new Promise(resolve => setImmediate(resolve)); active--;
    if (reference === 'ROM.1.1') throw Object.assign(new Error('cooldown'), { status: 429 });
    return { data: { content: 'Verse text.' } };
  } });
  const entries = ['JHN.1.1', 'ROM.1.1', 'MAT.1.1', 'LUK.1.1'].map(reference => ({ version: 3034, reference }));
  const result = await acceleration.previews(entries);
  assert.ok(peak <= 3);
  assert.equal(result.rateLimited, true);
  assert.equal(result.previews['3034:JHN.1.1'], 'Verse text.');
  assert.equal(result.failed['3034:ROM.1.1'], true);
});

test('preview validation rejects unbounded and malformed requests', async () => {
  const { acceleration } = fixture();
  await assert.rejects(acceleration.previews([{ version: 0, reference: 'JHN.3.16' }]), /valid verse/);
  await assert.rejects(acceleration.previews(Array(11).fill({ version: 3034, reference: 'JHN.3.16' })), /at most ten/);
  assert.deepEqual(await acceleration.previews([]), { previews: {}, failed: {}, rateLimited: false });
});
