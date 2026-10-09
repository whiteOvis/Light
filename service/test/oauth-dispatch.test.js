import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { dispatchCallback } from '../src/oauth-dispatch.js';

test('OAuth callback goes only to the application owning its state', context => {
  const directory = mkdtempSync(join(tmpdir(), 'light-callback-'));
  context.after(() => rmSync(directory, { recursive: true, force: true }));
  const fallback = join(directory, 'other.desktop');
  writeFileSync(fallback, '[Desktop Entry]\n');
  const calls = [];
  const run = (...args) => { calls.push(args); return { status: 0 }; };
  const options = { pending: { state: 'light-state' }, fallback, run, daemon: '/light/daemon.js' };
  const uri = 'omarchy://oauth/callback?state=light-state&code=secret';
  assert.equal(dispatchCallback(uri, options), 0);
  assert.deepEqual(calls[0].slice(0, 2), [process.execPath, ['/light/daemon.js', 'oauth', 'callback', uri]]);
  assert.equal(dispatchCallback('omarchy://oauth/callback?state=other-state', options), 0);
  assert.deepEqual(calls[1].slice(0, 2), ['gio', ['launch', fallback, 'omarchy://oauth/callback?state=other-state']]);
  assert.throws(() => dispatchCallback('https://example.com/?state=light-state', options), /Invalid/);
  assert.throws(() => dispatchCallback('omarchy://oauth/callback?state=unknown', { run }), /No matching/);
  assert.equal(calls.length, 2);
});
