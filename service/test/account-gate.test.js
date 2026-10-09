import { authenticatedFetch as fetch } from './helpers/http-client.js';
import assert from 'node:assert/strict';
import test from 'node:test';

import { createHttpServer } from '../src/http-server.js';
import { ServiceError } from '../src/service-error.js';

test('Bible catalog, content, downloads, and study require an active YouVersion session', async (context) => {
  let signedIn = false;
  let versionCalls = 0;
  const authentication = {
    status: () => ({ authenticated: signedIn, configured: signedIn }),
    getAccessToken: async () => {
      if (!signedIn) throw new ServiceError('Sign in with YouVersion to use Light.', {
        code: 'AUTHENTICATION_REQUIRED', status: 401,
      });
      return 'test-access-token';
    },
  };
  const server = createHttpServer({ clientToken: 'test-client',
    authentication,
    oauth: { status: () => ({ pending: false }) },
    cache: { stats: () => ({ rows: 1 }) },
    downloadManager: { listPackages: () => [{ version: 777 }] },
    service: {
      onlineConfigured: true,
      versions: async () => { versionCalls++; return { data: [{ id: 777 }] }; },
    },
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  context.after(() => new Promise((resolve) => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  const protectedPaths = [
    '/v1/versions?language=en', '/v1/passage?version=777&usfm=JHN.3.16',
    '/v1/downloads',
    '/v1/study/library', '/v1/recent-passage',
    '/v1/user-data/preferences/reader-tabs',
  ];
  for (const path of protectedPaths) {
    const response = await fetch(base + path);
    assert.equal(response.status, 401, path);
    assert.equal((await response.json()).error.code, 'AUTHENTICATION_REQUIRED');
  }
  assert.equal(versionCalls, 0);
  assert.equal((await (await fetch(base + '/v1/auth/status')).json()).authenticated, false);
  const health = await (await fetch(base + '/health')).json();
  assert.equal(health.downloads, undefined);
  assert.equal(health.cache, undefined);

  signedIn = true;
  assert.equal((await (await fetch(base + '/v1/versions?language=en')).json()).data[0].id, 777);
  assert.equal(versionCalls, 1);
  signedIn = false;
  assert.equal((await fetch(base + '/v1/versions?language=en')).status, 401);
  assert.equal(versionCalls, 1);
});
