import { authenticatedFetch as fetch } from './helpers/http-client.js';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { request } from 'node:http';
import test from 'node:test';
import { SQLiteCache } from '../src/cache.js';
import { createHttpServer, MAX_BODY_BYTES } from '../src/http-server.js';
import { hyprlandChord, setLightGlobalHotkey, setLightVerseOfTheDayHotkey } from '../src/global-hotkey.js';
import { reconcileGlobalHotkeySource, reconcileVerseHotkeySource } from '../src/shortcut-installer.js';
import { removeLightHotkeysSource } from '../src/shortcut-uninstaller.js';
import { UserDataManager, normalizeCustomRadioStations } from '../src/user-data-manager.js';
import { DownloadManager } from '../src/download-manager.js';

test('read-only CLI and OAuth managers do not pause a daemon-owned download', (context) => {
  const cache = new SQLiteCache({ directory: mkdtempSync(join(tmpdir(), 'light-download-owner-')) });
  context.after(() => cache.close());
  new DownloadManager({ database: cache.database });
  cache.database.prepare(`INSERT INTO download_packages
    (version_id, status, format, include_headings, include_notes, created_at, updated_at)
    VALUES (111, 'downloading', 'html', 1, 1, 0, 0)`).run();
  const observer = new DownloadManager({ database: cache.database, recoverInterruptedDownloads: false });
  assert.equal(observer.getPackage(111).status, 'downloading');
  const restartedDaemon = new DownloadManager({ database: cache.database });
  assert.equal(restartedDaemon.getPackage(111).status, 'paused');
});

test('default shortcuts, including plus and minus, can be saved and reloaded', (context) => {
  const cache = new SQLiteCache({ directory: mkdtempSync(join(tmpdir(), 'light-keys-')) });
  context.after(() => cache.close());
  const data = new UserDataManager({ database: cache.database, authentication: {} });
  const defaults = data.getKeybindings();
  data.setKeybindings(defaults);
  assert.deepEqual(data.getKeybindings(), defaults);
  assert.throws(() => data.setKeybindings({ ...defaults, newTab: 'Unknown+Q' }));
  data.setKeybindings({ ...defaults, newTab: 'Q' });
  assert.throws(() => data.setKeybindings({ ...defaults, newTab: 'Ctrl+S' }));
  assert.equal(defaults.verseOfTheDay, 'Super+Alt+V');
  assert.equal(defaults.radioPrevious, 'Left');
  assert.equal(defaults.radioNext, 'Right');
  assert.equal(defaults.radioPlayPause, 'Space');
  data.setKeybindings({
    ...defaults,
    radioPrevious: 'Space',
    radioNext: 'Left',
    radioPlayPause: 'Right',
  });
  data.setKeybindings({ ...defaults, radioPrevious: 'P' });
});

test('canonical duplicate radio stream URLs are rejected instead of silently discarded', () => {
  assert.throws(
    () => normalizeCustomRadioStations([
      { name: 'Existing', streamUrl: 'https://Radio.Example.TEST:443#player' },
      { name: 'Duplicate', streamUrl: 'https://radio.example.test/' },
    ]),
    (error) => error.status === 400
      && error.code === 'BAD_REQUEST'
      && /unique/.test(error.message),
  );
});

test('global key parser rejects unknown modifiers and preserves punctuation keys', () => {
  assert.equal(hyprlandChord('Super+B'), 'SUPER + B');
  assert.equal(hyprlandChord('Super++'), 'SUPER + PLUS');
  assert.equal(hyprlandChord('Super+-'), 'SUPER + MINUS');
  assert.equal(hyprlandChord('Super+Enter'), 'SUPER + RETURN');
  for (const key of ['B', 'Unknown+B', 'Super++B', 'Super+'])
    assert.throws(() => hyprlandChord(key));
});

test('global rebinding preserves other bindings and rolls back rejected desktop config', () => {
  const bindingsPath = join(mkdtempSync(join(tmpdir(), 'light-hypr-')), 'bindings.lua');
  const initial = 'o.bind("SUPER + A", "Other", "app")\n-- Light global shortcut\no.bind("SUPER + B", "Light", "omarchy-shell shell toggle light.bible-reader \'{}\'")\n';
  writeFileSync(bindingsPath, initial);
  assert.throws(() => setLightGlobalHotkey('Super+A', { bindingsPath, run: () => '' }), /already used/);
  assert.equal(readFileSync(bindingsPath, 'utf8'), initial);
  assert.throws(() => setLightGlobalHotkey('Super+L', {
    bindingsPath, run: (_, args) => args[0] === 'configerrors' ? 'invalid Lua' : '',
  }), /rejected/);
  assert.equal(readFileSync(bindingsPath, 'utf8'), initial);
  setLightGlobalHotkey('Super+L', { bindingsPath, run: () => '' });
  const saved = readFileSync(bindingsPath, 'utf8');
  assert.ok(saved.startsWith(initial.split('\n')[0]));
  assert.match(saved, /SUPER \+ L/);
  assert.doesNotMatch(saved, /SUPER \+ B/);
  writeFileSync(bindingsPath, '-- Light global shortcut\no.bind("SUPER + A", "Other", "app")\n');
  assert.throws(() => setLightGlobalHotkey('Super+L', { bindingsPath, run: () => '' }), /block has changed/);
});

test('Verse of the Day rebinding updates only its dedicated desktop binding', () => {
  const bindingsPath = join(mkdtempSync(join(tmpdir(), 'light-votd-hypr-')), 'bindings.lua');
  const initial = 'o.bind("SUPER + B", "Light", "toggle")\n'
    + '-- Light Verse of the Day shortcut\n'
    + 'o.bind("SUPER + ALT + V", "Light Verse of the Day", "omarchy-shell -q light.bible-reader verseOfTheDay")\n'
    + '-- End Light Verse of the Day shortcut\n';
  writeFileSync(bindingsPath, initial);
  setLightVerseOfTheDayHotkey('Super+Alt+N', { bindingsPath, run: () => '' });
  const saved = readFileSync(bindingsPath, 'utf8');
  assert.match(saved, /SUPER \+ B/);
  assert.match(saved, /SUPER \+ ALT \+ N/);
  assert.doesNotMatch(saved, /SUPER \+ ALT \+ V/);
  assert.throws(() => setLightVerseOfTheDayHotkey('Super+B', { bindingsPath, run: () => '' }), /already used/);
});

test('installer preserves customized Verse shortcuts and is byte-idempotent', () => {
  const customized = 'o.bind("SUPER + B", "Light", "toggle")\n\n'
    + '-- Light Verse of the Day shortcut\n'
    + 'o.bind("SUPER + ALT + N", "Light Verse of the Day", "omarchy-shell -q light.bible-reader verseOfTheDay")\n'
    + '-- End Light Verse of the Day shortcut\n';
  const first = reconcileVerseHotkeySource(customized);
  assert.deepEqual(first, { action: 'preserved', changed: false, source: customized });
  const second = reconcileVerseHotkeySource(first.source);
  assert.deepEqual(second, first);

  const accumulatedBlanks = 'o.bind("SUPER + B", "Light", "toggle")\n\n\n\n'
    + '-- Light Verse of the Day shortcut\n'
    + 'o.bind("SUPER + ALT + N", "Light Verse of the Day", "omarchy-shell -q light.bible-reader verseOfTheDay")\n'
    + '-- End Light Verse of the Day shortcut\n';
  const cleaned = reconcileVerseHotkeySource(accumulatedBlanks);
  assert.equal(cleaned.action, 'cleaned');
  assert.match(cleaned.source, /"toggle"\)\n\n-- Light Verse/);
  assert.deepEqual(reconcileVerseHotkeySource(cleaned.source), {
    action: 'preserved', changed: false, source: cleaned.source,
  });
});

test('installer migrates only the obsolete Verse shortcut and repairs its legacy marker', () => {
  const legacy = '-- Light Verse of the Day shortcut\n'
    + 'o.bind("SUPER + B + V", "Light Verse of the Day", "omarchy-shell -q light.bible-reader verseOfTheDay")\n'
    + 'o.bind("SUPER + X", "Other", "other")\n';
  const migrated = reconcileVerseHotkeySource(legacy);
  assert.equal(migrated.action, 'migrated');
  assert.match(migrated.source, /SUPER \+ ALT \+ V/);
  assert.doesNotMatch(migrated.source, /SUPER \+ B \+ V/);
  assert.match(migrated.source, /-- End Light Verse of the Day shortcut\no\.bind\("SUPER \+ X"/);
  assert.deepEqual(reconcileVerseHotkeySource(migrated.source), {
    action: 'preserved', changed: false, source: migrated.source,
  });
});

test('installer and uninstaller preserve LHT shortcuts', () => {
  const developmentId = ['local', 'light'].join('.');
  const local = '-- Light global shortcut\n'
    + `o.bind("SUPER + L", "Light", "omarchy-shell shell toggle ${developmentId} '{}'")\n`
    + '-- End Light global shortcut\n\n'
    + '-- Light Verse of the Day shortcut\n'
    + `o.bind("SUPER + ALT + N", "Light Verse of the Day", "omarchy-shell -q ${developmentId} verseOfTheDay")\n`
    + '-- End Light Verse of the Day shortcut\n';
  const global = reconcileGlobalHotkeySource(local, 'light.bible-reader');
  const verse = reconcileVerseHotkeySource(global.source, 'light.bible-reader');
  assert.equal(global.action, 'conflict');
  assert.equal(verse.action, 'conflict');
  assert.equal(verse.source, local);
  assert.equal(removeLightHotkeysSource(local).source, local);

});

test('installer does not overwrite conflicts or malformed Verse shortcut blocks', () => {
  const conflict = 'o.bind("ALT + SUPER + V", "Other", "other")\n';
  assert.deepEqual(reconcileVerseHotkeySource(conflict), {
    action: 'conflict', changed: false, source: conflict,
  });
  const malformed = '-- Light Verse of the Day shortcut\n'
    + 'o.bind("SUPER + ALT + N", "Other", "other")\n'
    + '-- End Light Verse of the Day shortcut\n';
  assert.throws(() => reconcileVerseHotkeySource(malformed), /block has changed/);
  const ambiguous = '-- Light Verse of the Day shortcut\n'
    + 'o.bind("SUPER + ALT + N", "Light Verse of the Day", "omarchy-shell -q light.bible-reader verseOfTheDay")\n'
    + 'o.bind("SUPER + X", "Other", "other")\n'
    + '-- End Light Verse of the Day shortcut\n';
  assert.throws(() => reconcileVerseHotkeySource(ambiguous), /block has changed/);

  const unmanaged = 'o.bind("SUPER + ALT + N", "Light Verse of the Day", "custom-command")\n';
  assert.deepEqual(reconcileVerseHotkeySource(unmanaged), {
    action: 'unmanaged', changed: false, source: unmanaged,
  });
});

test('uninstaller removes only structurally valid Light-managed shortcuts', () => {
  const source = 'o.bind("SUPER + A", "Other", "app")\n\n'
    + '-- Light global shortcut\n'
    + 'o.bind("SUPER + L", "Light", "omarchy-shell shell toggle light.bible-reader \'{}\'")\n'
    + '-- End Light global shortcut\n\n'
    + '-- Light Verse of the Day shortcut\n'
    + 'o.bind("SUPER + ALT + N", "Light Verse of the Day", "omarchy-shell -q light.bible-reader verseOfTheDay")\n'
    + '-- End Light Verse of the Day shortcut\n';
  const removed = removeLightHotkeysSource(source);
  assert.equal(removed.removed, 2);
  assert.equal(removed.source, 'o.bind("SUPER + A", "Other", "app")\n');
  assert.deepEqual(removeLightHotkeysSource(removed.source), {
    changed: false, removed: 0, source: removed.source,
  });

  const malformed = '-- Light global shortcut\n'
    + 'o.bind("SUPER + L", "Other", "app")\n'
    + '-- End Light global shortcut\n';
  assert.throws(() => removeLightHotkeysSource(malformed), /left untouched/);
});

test('HTTP rejects web origins and rebinding hosts; failed global updates do not persist', async (context) => {
  const cache = new SQLiteCache({ directory: mkdtempSync(join(tmpdir(), 'light-http-')) });
  const data = new UserDataManager({ database: cache.database, authentication: {} });
  let mutations = 0;
  let globalChanges = 0;
  let verseOfTheDayChanges = 0;
  const server = createHttpServer({ clientToken: 'test-client',
    requireAccount: false,
    userData: data,
    listSystemBindings: () => [],
    downloadManager: { queueResume: () => { mutations++; return {}; } },
    applyGlobalHotkey: () => { globalChanges++; throw new Error('simulated unavailable desktop API'); },
    applyVerseOfTheDayHotkey: () => { verseOfTheDayChanges++; throw new Error('simulated unavailable desktop API'); },
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  context.after(async () => { await new Promise((resolve) => server.close(resolve)); cache.close(); });
  const base = `http://127.0.0.1:${server.address().port}`;
  for (const headers of [{ Origin: 'https://example.com' }, { Origin: 'null' }, { Host: 'rebind.example.com' }, { 'Sec-Fetch-Site': 'cross-site' }]) {
    const status = await new Promise((resolve, reject) => {
      const req = request(`${base}/v1/downloads/111/resume`, { method: 'POST', headers: { ...headers, authorization: 'Bearer test-client' } }, (response) => {
        response.resume();
        response.on('end', () => resolve(response.statusCode));
      });
      req.on('error', reject);
      req.end();
    });
    assert.equal(status, 403, JSON.stringify(headers));
  }
  assert.equal(mutations, 0);
  const defaults = data.getKeybindings();
  const put = (bindings) => fetch(`${base}/v1/user-data/preferences/keybindings`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ keybindings: bindings }),
  });
  assert.equal((await put({ ...defaults, newTab: 'Ctrl+N' })).status, 200);
  assert.equal(globalChanges, 0);
  assert.equal(data.getKeybindings().newTab, 'Ctrl+N');
  assert.equal((await put({ ...defaults, globalToggle: 'Super+L' })).status, 500);
  assert.equal(globalChanges, 2); // failed update, then rollback to the prior binding
  assert.equal(data.getKeybindings().globalToggle, defaults.globalToggle);
  assert.equal(data.getKeybindings().newTab, 'Ctrl+N');
  assert.equal((await put({ ...data.getKeybindings(), verseOfTheDay: 'Super+Alt+N' })).status, 500);
  assert.equal(verseOfTheDayChanges, 1);
  assert.equal(data.getKeybindings().verseOfTheDay, defaults.verseOfTheDay);
  const setHighlightOpacity = (opacity) => fetch(`${base}/v1/user-data/preferences/highlight-opacity`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ opacity }),
  });
  const savedHighlightOpacity = await setHighlightOpacity(0.35);
  assert.equal(savedHighlightOpacity.status, 200);
  const savedHighlightOpacityPayload = await savedHighlightOpacity.json();
  assert.equal(savedHighlightOpacityPayload.defaultHighlightOpacity, 0.35);
  assert.match(savedHighlightOpacityPayload.updatedAt, /^\d{4}-\d{2}-\d{2}T/);
  const storedHighlightOpacity = await fetch(
    `${base}/v1/user-data/preferences/highlight-opacity`,
  );
  assert.equal(storedHighlightOpacity.status, 200);
  assert.deepEqual(await storedHighlightOpacity.json(), { defaultHighlightOpacity: 0.35 });
  assert.equal((await setHighlightOpacity(0.8)).status, 400);
});

test('HTTP saves and orders radio collections beyond former count and body limits', async (context) => {
  const cache = new SQLiteCache({ directory: mkdtempSync(join(tmpdir(), 'light-radio-capacity-')) });
  const data = new UserDataManager({ database: cache.database, authentication: {} });
  const server = createHttpServer({ clientToken: 'test-client', userData: data, requireAccount: false });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  context.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    cache.close();
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  const stations = Array.from({ length: 2500 }, (_, index) => ({
    name: `Station ${index + 1} ${'界'.repeat(60)}`,
    description: '界'.repeat(160),
    streamUrl: `https://radio.example.test/stream/${index + 1}?token=${'a'.repeat(430)}`,
  }));
  const body = JSON.stringify({ stations });
  assert.ok(Buffer.byteLength(body) > MAX_BODY_BYTES, 'fixture must exceed the ordinary body limit');

  const saved = await fetch(`${base}/v1/user-data/preferences/custom-radio-stations`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body,
  });
  assert.equal(saved.status, 200);
  assert.equal((await saved.json()).customRadioStations.length, stations.length);

  const stored = await fetch(`${base}/v1/user-data/preferences/custom-radio-stations`);
  const storedStations = (await stored.json()).customRadioStations;
  assert.equal(storedStations.length, stations.length);
  assert.equal(storedStations.at(-1).streamUrl, stations.at(-1).streamUrl);

  const descriptionTooLong = await fetch(
    `${base}/v1/user-data/preferences/custom-radio-stations`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stations: [{
        name: 'Too descriptive',
        description: 'x'.repeat(161),
        streamUrl: 'https://radio.example.test/too-descriptive',
      }] }),
    },
  );
  assert.equal(descriptionTooLong.status, 400);

  const stationKeys = Array.from({ length: 15 }, (_, index) => `builtin:default-${index + 1}`)
    .concat(stations.map((station) => `custom:${station.streamUrl.toLowerCase()}`));
  assert.ok(Buffer.byteLength(JSON.stringify({ stationKeys })) > MAX_BODY_BYTES);
  stationKeys.reverse();
  const ordered = await fetch(`${base}/v1/user-data/preferences/radio-station-order`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ stationKeys }),
  });
  assert.equal(ordered.status, 200);
  assert.deepEqual((await ordered.json()).radioStationOrder, stationKeys);
  const storedOrder = await fetch(`${base}/v1/user-data/preferences/radio-station-order`);
  assert.deepEqual((await storedOrder.json()).radioStationOrder, stationKeys);

  const sectionIds = [
    'radio', 'shortcuts', 'reading', 'appearance', 'languages', 'account', 'backup',
  ];
  const savedSections = await fetch(`${base}/v1/user-data/preferences/settings-section-order`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sectionIds }),
  });
  assert.equal(savedSections.status, 200);
  assert.deepEqual((await savedSections.json()).settingsSectionOrder, sectionIds);
  const storedSections = await fetch(`${base}/v1/user-data/preferences/settings-section-order`);
  assert.deepEqual((await storedSections.json()).settingsSectionOrder, sectionIds);

  const oversized = await fetch(`${base}/v1/user-data/preferences/music-player`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: 'x'.repeat(MAX_BODY_BYTES + 1),
  });
  assert.equal(oversized.status, 413);
});


test('Light can choose its own global shortcut alongside LHT without taking ownership', () => {
  const directory = mkdtempSync(join(tmpdir(), 'light-coexist-'));
  const bindingsPath = join(directory, 'bindings.lua');
  const initial = '-- Light global shortcut\n'
    + `o.bind("SUPER + B", "Light", "omarchy-shell shell toggle local.light '{}'")\n`
    + '-- End Light global shortcut\n';
  writeFileSync(bindingsPath, initial);
  assert.throws(() => setLightGlobalHotkey('Super+B', { bindingsPath, run: () => '' }), /already used/);
  assert.equal(readFileSync(bindingsPath, 'utf8'), initial);
  setLightGlobalHotkey('Super+L', { bindingsPath, run: () => '' });
  const combined = readFileSync(bindingsPath, 'utf8');
  assert.ok(combined.startsWith(initial));
  assert.match(combined, /-- Light public global shortcut/);
  assert.equal(removeLightHotkeysSource(combined).source, initial);
});
