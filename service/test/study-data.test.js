import { authenticatedFetch as fetch } from './helpers/http-client.js';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import { UserDataManager } from '../src/user-data-manager.js';
import { StudyData } from '../src/study-data.js';
import { createHttpServer } from '../src/http-server.js';

function fixture(t) {
  const database = new DatabaseSync(':memory:');
  t.after(() => database.close());
  const userData = new UserDataManager({ database, authentication: { getSessionId: () => 'local' } });
  return { userData, study: new StudyData(userData) };
}

test('study library includes notes, bookmarks and only current-account visible highlights', t => {
  const { userData, study } = fixture(t);
  assert.equal(study.options().resumeReading, true);
  userData.createNote({ versionId: 1, passageId: 'JHN.3.16', body: 'Remember this promise' });
  study.bookmark({ version: 1, passage: 'PSA.23', label: 'Psalm 23' });
  const insert = userData.database.prepare('INSERT INTO user_highlights(session_id, version_id, passage_id, color, sync_state, updated_at) VALUES (?, 1, ?, ?, ?, 1000)');
  insert.run('local', 'JHN.3.16', 'fffe00', 'synced');
  insert.run('other', 'JHN.3.17', 'fffe00', 'synced');
  insert.run('local', 'JHN.3.18', 'fffe00', 'pending_delete');
  const entries = study.library().entries;
  assert.deepEqual(entries.map(item => item.kind), ['bookmark', 'note', 'highlight']);
  assert.equal(entries[1].preview, 'Remember this promise');
  assert.equal(entries[2].passage, 'JHN.3.16');
  study.bookmark({ version: 1, passage: 'PSA.23', remove: true });
  assert.equal(study.library().entries.length, 2);
});

test('night mode persists and its shortcut can be rebound', t => {
  const { userData, study } = fixture(t);
  assert.equal(study.options().nightMode, false);
  study.setOptions({ nightMode: true });
  assert.equal(new StudyData(userData).options().nightMode, true);
  assert.throws(() => study.setOptions({ nightMode: 'yes' }));
  const bindings = userData.getKeybindings();
  assert.equal(bindings.toggleNightMode, 'Ctrl+D');
  userData.setKeybindings({ ...bindings, toggleNightMode: 'Ctrl+J' });
  assert.equal(userData.getKeybindings().toggleNightMode, 'Ctrl+J');
});

test('recent history deduplicates visits while preserving most recent order', t => {
  const { study } = fixture(t);
  for (let chapter = 1; chapter <= 60; chapter++) study.visit({ version: 1, passage: `PSA.${chapter}` });
  study.visit({ version: 1, passage: 'PSA.40' });
  const history = study.library().history;
  assert.equal(history.length, 50);
  assert.equal(history[0].passage, 'PSA.40');
  assert.equal(history[1].passage, 'PSA.60');
  assert.equal(history.filter(item => item.passage === 'PSA.40').length, 1);
});

test('study library keeps complete highlight text for in-place reading', async t => {
  const { userData, study } = fixture(t);
  userData.database.prepare(`
    INSERT INTO user_highlights(session_id, version_id, passage_id, color, sync_state, updated_at)
    VALUES ('local', 1, 'JHN.3.16', 'fffe00', 'synced', 1000)
  `).run();
  const fullText = 'A'.repeat(700);
  let requestOptions = null;
  const library = await study.libraryWithPreviews({
    passage: async (version, passage, options) => {
      requestOptions = options;
      return { data: { content: fullText, reference: 'John 3:16' } };
    },
  });
  assert.equal(library.entries.find((item) => item.kind === 'highlight').preview, fullText);
  assert.equal(requestOptions.mode, 'auto');
  assert.equal(requestOptions.format, 'html');
  assert.equal(library.entries.find((item) => item.kind === 'highlight').previewFormat, 'html');
  assert.equal(library.entries.find((item) => item.kind === 'highlight').fullPreview, true);
});

test('portable backup round trip merges notes and excludes accounts, highlights and desktop shortcuts', t => {
  const { userData, study } = fixture(t);
  const note = userData.createNote({ versionId: 1, passageId: 'JHN.3.16', body: 'Portable note' });
  study.bookmark({ version: 1, passage: 'JHN.3.16', preview: 'For God so loved' });
  study.visit({ version: 1, passage: 'PSA.23', label: 'Psalm 23' });
  study.setOptions({ resumeReading: true, favoriteStations: ['custom:https://example.org/stream'], radioSkin: 6 });
  userData.setCustomRadioStations([{ name: 'Example', streamUrl: 'https://example.org/stream' }]);
  const backup = JSON.parse(JSON.stringify(study.exportBackup()));
  assert.equal(backup.version, 2);
  assert.equal(backup.preferences, undefined);
  assert.equal(backup.options, undefined);
  assert.equal(backup.highlights, undefined);
  assert.equal(backup.authentication, undefined);
  const target = fixture(t);
  target.study.restoreBackup(backup);
  target.study.restoreBackup(backup);
  assert.equal(target.userData.getNotes(1, 'JHN.3').length, 1);
  assert.equal(target.userData.getNotes(1, 'JHN.3')[0].id, note.id);
  assert.equal(target.study.library().entries.length, 2);
  assert.equal(target.study.library().history.length, 1);
  assert.equal(target.study.options().resumeReading, true);
  assert.equal(target.study.options().radioSkin, 1);
  assert.equal(target.userData.getCustomRadioStations().length, 0);
});

test('invalid or conflicting backup rolls back all library changes', t => {
  const { userData, study } = fixture(t);
  const note = userData.createNote({ versionId: 1, passageId: 'JHN.3.16', body: 'Keep me' });
  const backup = study.exportBackup();
  backup.bookmarks.push({ version: 1, passage: 'PSA.23' });
  backup.notes[0].body = 'Overwrite me';
  assert.throws(() => study.restoreBackup(backup), /conflict/);
  assert.equal(study.library().entries.length, 1);
  assert.equal(userData.getNotes(1, 'JHN.3')[0].body, 'Keep me');
  backup.notes[0].body = 'Keep me';
  backup.notes.push({ id: note.id, version: 1, passage: 'invalid', body: 'Invalid' });
  assert.throws(() => study.restoreBackup(backup), /Invalid passage/);
});

test('study endpoints retain loopback browser protection and validate option updates', async t => {
  const { userData } = fixture(t);
  const server = createHttpServer({ clientToken: 'test-client', userData, requireAccount: false });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  const send = (path, body, headers = {}) => fetch(base + path, { method: 'PUT', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });
  assert.equal((await send('/v1/study/options', { resumeReading: true }, { Origin: 'https://example.org' })).status, 403);
  assert.equal((await send('/v1/study/options', { resumeReading: 'yes' })).status, 400);
  assert.equal((await send('/v1/study/options', { radioSkin: 8 })).status, 400);
  assert.equal((await send('/v1/study/options', { resumeReading: true })).status, 200);
  assert.equal((await send('/v1/study/options', { radioSkin: 7 })).status, 200);
  assert.equal((await (await fetch(base + '/v1/study/options')).json()).resumeReading, true);
  assert.equal((await (await fetch(base + '/v1/study/options')).json()).radioSkin, 7);
  assert.equal((await fetch(base + '/v1/study/backup')).status, 200);
});

test('library previews use only local passages and deduplicate repeated references', async t => {
  const { study } = fixture(t);
  study.bookmark({ version: 1, passage: 'PSA.23' });
  study.visit({ version: 1, passage: 'PSA.23' });
  let calls = 0;
  const library = await study.libraryWithPreviews({
    async passage(version, passage, options) {
      calls++;
      assert.equal(options.mode, 'offline');
      return { data: { content: 'The Lord is my shepherd.', reference: 'Psalm 23' } };
    },
  });
  assert.equal(calls, 1);
  assert.equal(library.entries[0].preview, 'The Lord is my shepherd.');
  assert.equal(library.history[0].label, 'Psalm 23');
});

test('radio import merges canonical URLs and leaves the collection intact on invalid input', t => {
  const { userData, study } = fixture(t);
  userData.setCustomRadioStations([{ name: 'Keep', streamUrl: 'https://radio.example/' }]);
  const result = study.importRadio({ format: 'light-radio', version: 1, stations: [
    { name: 'Duplicate', streamUrl: 'https://RADIO.example:443/#player' },
    { name: 'New', streamUrl: 'https://radio.example/new' },
  ] });
  assert.equal(result.customRadioStations.length, 2);
  assert.equal(result.customRadioStations[0].name, 'Keep');
  assert.throws(() => study.importRadio({ format: 'light-radio', version: 1, stations: [
    { name: 'Invalid', streamUrl: 'file:///tmp/invalid' },
  ] }), /http or https/);
  assert.equal(userData.getCustomRadioStations().length, 2);
});


test('text brightness defaults to full, persists its range, and rejects invalid values', t => {
  const { userData, study } = fixture(t);
  assert.equal(study.options().textBrightness, 1);
  for (const value of [0.2, 0.55, 1]) {
    study.setOptions({ textBrightness: value });
    assert.equal(new StudyData(userData).options().textBrightness, value);
  }
  for (const value of [0.19, 1.01, NaN, Infinity, '0.5', null]) {
    assert.throws(() => study.setOptions({ textBrightness: value }));
    assert.equal(study.options().textBrightness, 1);
  }
});
