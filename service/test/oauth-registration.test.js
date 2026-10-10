import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, rmSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { registerOAuthCallback } from '../src/oauth-registration.js';
import { fallbackDesktop } from '../src/oauth-dispatch.js';

test('sign-in registration preserves the previous handler and repairs moved paths without npm', context => {
  const directory = mkdtempSync(join(tmpdir(), 'light-signin-'));
  context.after(() => rmSync(directory, { recursive: true, force: true }));
  const env = { HOME: directory, XDG_DATA_HOME: join(directory, 'data'), LIGHT_CONFIG_DIR: join(directory, 'private') };
  let handler = 'other-plugin.desktop';
  const run = (command, args) => {
    assert.equal(command, 'xdg-mime');
    if (args[0] === 'query') return handler + '\n';
    handler = args[1];
    return '';
  };
  const callback = join(directory, 'checkout with spaces.mjs');
  writeFileSync(callback, '// fixture');
  registerOAuthCallback({ env, run, callback, daemon: '/old checkout/daemon.mjs' });
  const desktop = join(env.XDG_DATA_HOME, 'applications/omarchy-light-public-oauth.desktop');
  assert.match(readFileSync(desktop, 'utf8'), /Exec=\/usr\/bin\/env "LIGHT_CONFIG_DIR=[^"]+" "node" "[^"]+oauth-dispatch.mjs" %u/);
  const bridge = join(env.XDG_DATA_HOME, 'omarchy/light-public/oauth-dispatch.mjs');
  assert.equal(readFileSync(bridge, 'utf8'), '// fixture');
  const saved = join(env.LIGHT_CONFIG_DIR, 'oauth-fallback.json');
  assert.equal(JSON.parse(readFileSync(saved)).desktop, 'other-plugin.desktop');
  assert.equal(statSync(saved).mode & 0o777, 0o600);
  registerOAuthCallback({ env, run, callback, daemon: '/new checkout/daemon.mjs' });
  assert.equal(JSON.parse(readFileSync(saved)).desktop, 'other-plugin.desktop');
  assert.equal(JSON.parse(readFileSync(join(env.LIGHT_CONFIG_DIR, 'oauth-runtime.json'))).daemon, '/new checkout/daemon.mjs');
  assert.equal(existsSync(join(directory, '.config/hypr')), false);
  assert.equal(fallbackDesktop(env), '', 'a missing fallback desktop is never executed');
});
test('invalid fallback handlers abort before changing the registered handler', context => {
  const directory = mkdtempSync(join(tmpdir(), 'light-bad-handler-'));
  context.after(() => rmSync(directory, { recursive: true, force: true }));
  const calls = [];
  assert.throws(() => registerOAuthCallback({ env: { HOME: directory }, run: (_, args) => {
    calls.push(args);
    return '../unsafe.desktop';
  } }), /preserved/);
  assert.equal(calls.length, 1);
  assert.equal(existsSync(join(directory, '.local/share/applications')), false);
});

test('copied callback bridge forwards unrelated callbacks after the checkout is gone', async context => {
  // Exercise the shipped bundle with no node_modules and without changing the
  // machine's MIME registry. The real gio parses our escaped Desktop Exec line.
  const { mkdirSync } = await import('node:fs');
  const { execFileSync } = await import('node:child_process');
  const { fileURLToPath } = await import('node:url');
  const directory = mkdtempSync(join(tmpdir(), 'light-bridge-'));
  context.after(() => rmSync(directory, { recursive: true, force: true }));
  const env = { ...process.env, HOME: directory, XDG_DATA_HOME: join(directory, 'data "quoted" %'),
    LIGHT_CONFIG_DIR: join(directory, 'private state') };
  let handler = 'other.desktop';
  const run = (_, args) => args[0] === 'query' ? handler : (handler = args[1], '');
  registerOAuthCallback({ env, run,
    callback: fileURLToPath(new URL('../dist/oauth-dispatch.mjs', import.meta.url)),
    daemon: '/removed-checkout/daemon.mjs' });
  const apps = join(env.XDG_DATA_HOME, 'applications');
  writeFileSync(join(apps, 'other.desktop'), '[Desktop Entry]\n');
  const bin = join(directory, 'bin');
  mkdirSync(bin);
  writeFileSync(join(bin, 'gio'), '#!/bin/sh\nprintf "%s\\n" "$@" > "$LIGHT_TEST_FORWARD"\n', { mode: 0o755 });
  env.PATH = bin + ':' + process.env.PATH;
  env.LIGHT_TEST_FORWARD = join(directory, 'forwarded');
  const uri = 'omarchy://oauth/callback?state=other-application';
  execFileSync('/usr/bin/gio', ['launch', join(apps, 'omarchy-light-public-oauth.desktop'), uri], { env, timeout: 5000 });
  assert.deepEqual(readFileSync(env.LIGHT_TEST_FORWARD, 'utf8').trim().split('\n'), ['launch', join(apps, 'other.desktop'), uri]);
});
