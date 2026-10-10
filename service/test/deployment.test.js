import test from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { TokenStore } from '../src/token-store.js';

async function availablePort() {
  const server = createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  await new Promise(resolve => server.close(resolve));
  return port;
}
function waitReady(child) {
  return new Promise((resolve, reject) => {
    let output = '', errors = '';
    const timeout = setTimeout(() => { child.kill(); reject(new Error(`Backend startup timed out: ${errors}`)); }, 10000);
    child.stderr.on('data', chunk => { errors += chunk; });
    child.stdout.on('data', chunk => {
      output += chunk;
      const line = output.match(/LIGHT_READY (\{[^\n]+\})/);
      if (line) { clearTimeout(timeout); resolve(JSON.parse(line[1])); }
    });
    child.once('error', error => { clearTimeout(timeout); reject(error); });
    child.once('exit', code => { clearTimeout(timeout); reject(new Error(`Backend exited ${code}: ${errors}`)); });
  });
}
async function stop(child) {
  const exited = new Promise(resolve => child.once('exit', resolve));
  child.stdin.end();
  const timeout = setTimeout(() => child.kill('SIGKILL'), 5000);
  try { assert.equal(await exited, 0, 'backend must stop when its shell pipe closes'); }
  finally { clearTimeout(timeout); }
}

test('fresh release starts without npm/native audio, preserves data and owns its lifecycle', async context => {
  const directory = mkdtempSync(join(tmpdir(), 'light-standard-install-'));
  context.after(() => rmSync(directory, { recursive: true, force: true }));
  const source = join(directory, 'checkout with spaces');
  cpSync(new URL('../../', import.meta.url), source, { recursive: true,
    filter: path => !/(?:\/node_modules|\/\.git)(?:\/|$)/.test(path) && !path.endsWith('.so') });
  const config = join(directory, 'config');
  mkdirSync(join(config, 'hypr'), { recursive: true });
  const bindings = join(config, 'hypr/bindings.lua');
  writeFileSync(bindings, 'user shortcuts remain unchanged');
  const state = join(config, 'omarchy/light-public');
  new TokenStore({ directory: state }).save({ accessToken: 'test-fixture-session', expiresAt: '2999-01-01T00:00:00.000Z' });
  const port = await availablePort();
  const env = { ...process.env, HOME: directory, XDG_CONFIG_HOME: config,
    XDG_DATA_HOME: join(directory, 'data'), LIGHT_CONFIG_DIR: state,
    LIGHT_PORT: String(port), HYPRLAND_INSTANCE_SIGNATURE: '' };
  const start = () => {
    const child = spawn(process.execPath, [join(source, 'service/dist/daemon.mjs'), 'serve', '--managed'], {
      env, stdio: ['pipe', 'pipe', 'pipe'],
    });
    context.after(() => { if (child.exitCode === null) child.kill('SIGKILL'); });
    return child;
  };
  const first = start();
  assert.equal((await waitReady(first)).nativeAudioAvailable, false);
  assert.equal(existsSync(join(source, 'service/node_modules')), false);
  const header = readFileSync(join(state, 'client-auth-header'), 'utf8');
  const base = `http://127.0.0.1:${port}`;
  assert.equal((await fetch(base + '/health')).status, 401);
  assert.equal((await fetch(base + '/health', { headers: { authorization: header.trim().slice(15) } })).status, 200);
  // A second shell/component can attach without rotating the owner's secret.
  const attached = start();
  assert.equal((await waitReady(attached)).existingService, true);
  assert.equal(readFileSync(join(state, 'client-auth-header'), 'utf8'), header);
  await stop(attached);
  assert.equal((await fetch(base + '/health', { headers: { authorization: header.trim().slice(15) } })).status, 200);
  const replacement = start();
  assert.equal((await waitReady(replacement)).existingService, true);
  const takeover = waitReady(replacement);
  await stop(first);
  assert.equal((await takeover).existingService, undefined, 'a reload follower takes ownership when the old shell exits');
  const replacedHeader = readFileSync(join(state, 'client-auth-header'), 'utf8');
  assert.notEqual(replacedHeader, header);
  assert.equal((await fetch(base + '/health', { headers: { authorization: replacedHeader.trim().slice(15) } })).status, 200);
  await stop(replacement);
  await assert.rejects(fetch(base + '/health'));
  const key = readFileSync(join(state, 'token.key'));
  const restarted = start();
  await waitReady(restarted);
  assert.notEqual(readFileSync(join(state, 'client-auth-header'), 'utf8'), header);
  assert.deepEqual(readFileSync(join(state, 'token.key')), key);
  await stop(restarted);
  assert.equal(readFileSync(bindings, 'utf8'), 'user shortcuts remain unchanged');
  assert.equal(existsSync(join(config, 'systemd')), false);
  assert.equal(existsSync(join(directory, 'data/applications')), false, 'OAuth handler is registered only on sign-in');
});
