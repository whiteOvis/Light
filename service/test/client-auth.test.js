import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'node:net';
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, statSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHttpServer } from '../src/http-server.js';

test('local client authentication precedes account access on every endpoint', async (context) => {
  let accountChecks = 0;
  const server = createHttpServer({
    clientToken: 'private-test-client',
    authentication: { getAccessToken: async () => { accountChecks++; return 'owner-account'; } },
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  context.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  for (const path of ['/health', '/v1/auth/status', '/v1/auth/logout', '/v1/study/backup', '/v1/study/restore', '/v1/user-data/notes']) {
    for (const authorization of [undefined, 'Bearer incorrect', 'Bearer '+ 'x'.repeat(19)]) {
      const response = await fetch(base + path, {
        method: path.endsWith('logout') || path.endsWith('restore') ? 'POST' : 'GET',
        headers: authorization ? { authorization } : {},
      });
      assert.equal(response.status, 401, path);
      assert.equal((await response.json()).error.code, 'CLIENT_AUTHENTICATION_REQUIRED');
    }
  }
  assert.equal(accountChecks, 0);
  const response = await fetch(base + '/v1/unknown', { headers: { authorization: 'Bearer private-test-client' } });
  assert.equal(response.status, 404);
  assert.equal(accountChecks, 1);
});

test('daemon rotates its client credential and stores it with owner-only permissions', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'light-client-auth-'));
  async function start() {
    const probe = createServer();
    await new Promise(resolve => probe.listen(0, '127.0.0.1', resolve));
    const port = probe.address().port;
    await new Promise(resolve => probe.close(resolve));
    const child = spawn(process.execPath, ['src/daemon.js', 'serve'], {
      cwd: new URL('..', import.meta.url),
      env: { ...process.env, LIGHT_CONFIG_DIR: directory, LIGHT_PORT: String(port) },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    try {
      await new Promise((resolve, reject) => {
        let errors = '';
        child.stderr.on('data', chunk => { errors += chunk; });
        child.once('error', reject);
        child.once('exit', code => reject(new Error(`Daemon exited ${code}: ${errors}`)));
        child.stdout.on('data', chunk => { if (String(chunk).includes('listening')) resolve(); });
      });
      const header = readFileSync(join(directory, 'client-auth-header'), 'utf8');
      assert.match(header, /^Authorization: Bearer [a-f0-9]{64}\n$/);
      assert.equal(statSync(directory).mode & 0o777, 0o700);
      assert.equal(statSync(join(directory, 'client-auth-header')).mode & 0o777, 0o600);
      return header;
    } finally {
      if (child.exitCode === null) {
        const closed = new Promise(resolve => child.once('close', resolve));
        child.kill('SIGTERM');
        await closed;
      }
    }
  }
  try { assert.notEqual(await start(), await start()); }
  finally { rmSync(directory, { recursive: true, force: true }); }
});
