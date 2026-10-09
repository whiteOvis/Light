import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { generateKeyPairSync, sign } from 'node:crypto';
import { OAuthManager } from '../src/oauth.js';
import { TokenStore } from '../src/token-store.js';

function setup(t, options = {}) {
  const directory = mkdtempSync(join(tmpdir(), 'light-oauth-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const tokenStore = new TokenStore({ directory });
  const manager = new OAuthManager({ tokenStore, appKey: 'test-client', env: {}, ...options });
  return { tokenStore, manager };
}

function callback(started) {
  return `omarchy://oauth/callback?state=${new URL(started.authorizationUrl).searchParams.get('state')}`;
}

test('desktop authorization requests browser confirmation and leaves browser launch to the client', async t => {
  const { manager } = setup(t, { openUrl: () => assert.fail('service must not launch browser') });
  const started = await manager.start({ open: false, permissions: ['highlights'] });
  const url = new URL(started.authorizationUrl);
  assert.equal(url.searchParams.get('require_user_interaction'), 'true');
  assert.equal(url.searchParams.get('code_challenge_method'), 'S256');
  assert.deepEqual(url.searchParams.getAll('requested_permissions[]'), ['highlights']);
  assert.equal(started.openedBrowser, false);
});

test('reopening pending sign-in preserves PKCE and state for the existing browser tab', async t => {
  const { manager, tokenStore } = setup(t);
  const first = await manager.start({ open: false });
  const pending = tokenStore.loadPendingAuth();
  const second = await manager.start({ open: false });
  assert.equal(first.authorizationUrl, second.authorizationUrl);
  assert.equal(pending.codeVerifier, tokenStore.loadPendingAuth().codeVerifier);
});

test('callback network failure is visible across processes and a retry creates a new attempt', async t => {
  const { manager, tokenStore } = setup(t, { fetchImplementation: async (_url, options) => {
    assert.ok(options.signal);
    throw new DOMException('timed out', 'TimeoutError');
  } });
  const first = await manager.start({ open: false });
  await assert.rejects(manager.handleCallback(`${callback(first)}&code=one-time-code`));
  const observer = new OAuthManager({ tokenStore });
  assert.equal(observer.status().pending, false);
  assert.equal(observer.status().error.code, 'OAUTH_NETWORK_FAILED');
  const second = await manager.start({ open: false });
  assert.notEqual(first.authorizationUrl, second.authorizationUrl);
  assert.equal(observer.status().error, null);
});

test('invalid state cannot poison a pending sign-in', async t => {
  const { manager } = setup(t);
  await manager.start({ open: false });
  await assert.rejects(manager.handleCallback('omarchy://oauth/callback?state=wrong'), { code: 'OAUTH_STATE_MISMATCH' });
  assert.deepEqual(manager.status(), { pending: true, error: null });
});

test('state replay uses the browser once and never fetches the continuation in the handler', async t => {
  const opened = [];
  const { manager } = setup(t, {
    openUrl: async url => opened.push(url),
    fetchImplementation: () => assert.fail('continuation must stay in the browser'),
  });
  const started = await manager.start({ open: false });
  const first = await manager.handleCallback(callback(started));
  const second = await manager.handleCallback(callback(started));
  assert.equal(first.stage, 'awaiting-code');
  assert.equal(first.openedBrowser, true);
  assert.equal(second.openedBrowser, false);
  assert.equal(opened.length, 1);
  assert.equal(new URL(opened[0]).pathname, '/auth/callback');
  assert.equal(manager.status().pending, true);
  const retry = await manager.start({ open: false });
  assert.equal(retry.authorizationUrl, opened[0], 'Continue sign-in reopens the continuation, not consent');
});

test('provider denial is reported to Settings', async t => {
  const { manager } = setup(t);
  const started = await manager.start({ open: false });
  await assert.rejects(manager.handleCallback(`${callback(started)}&error=access_denied`), { code: 'OAUTH_DENIED' });
  assert.equal(manager.status().error.code, 'OAUTH_DENIED');
  assert.equal(manager.status().pending, false);
});

test('failed browser launch is not reported as a successful start', async t => {
  const { manager } = setup(t, { openUrl: async () => { throw new Error('launcher failed'); } });
  await assert.rejects(manager.start(), { code: 'BROWSER_OPEN_FAILED' });
  assert.equal(manager.status().pending, false);
});

test('a cancelled sign-in cannot save tokens after a delayed exchange', async t => {
  const { manager, tokenStore } = setup(t, { fetchImplementation: async (_url, options) => {
    assert.ok(options.signal);
    tokenStore.clearPendingAuth();
    return { ok: true, json: async () => ({ access_token: 'test-token', expires_in: 3600 }) };
  } });
  const started = await manager.start({ open: false });
  await assert.rejects(manager.handleCallback(`${callback(started)}&code=code`), { code: 'OAUTH_NOT_PENDING' });
  assert.equal(tokenStore.load(), null);
});

for (const claim of ['issuer', 'audience', 'nonce', 'expiry']) {
  test(`invalid signed ${claim} is identified without storing a session`, async t => {
    const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
    let idToken;
    const { manager, tokenStore } = setup(t, { fetchImplementation: async url => {
      if (String(url).endsWith('/.well-known/jwks.json')) return {
        ok: true, json: async () => ({ keys: [{ ...publicKey.export({ format: 'jwk' }), kid: 'test-key' }] }),
      };
      return { ok: true, json: async () => ({ access_token: 'access', id_token: idToken, expires_in: 3600 }) };
    } });
    const started = await manager.start({ open: false });
    const claims = {
      iss: 'https://api.youversion.com', aud: 'test-client',
      nonce: tokenStore.loadPendingAuth().nonce,
      exp: Math.floor(Date.now() / 1000) + 3600, sub: 'test-reader',
    };
    const names = { issuer: 'iss', audience: 'aud', nonce: 'nonce', expiry: 'exp' };
    claims[names[claim]] = claim === 'expiry' ? 1 : 'incorrect';
    const header = Buffer.from(JSON.stringify({ alg: 'RS256', kid: 'test-key' })).toString('base64url');
    const body = Buffer.from(JSON.stringify(claims)).toString('base64url');
    const signature = sign('RSA-SHA256', Buffer.from(`${header}.${body}`), privateKey).toString('base64url');
    idToken = `${header}.${body}.${signature}`;
    await assert.rejects(manager.handleCallback(`${callback(started)}&code=code`), {
      code: 'ID_TOKEN_VERIFICATION_FAILED', message: `The signed identity token failed validation: ${claim}.`,
    });
    assert.equal(tokenStore.status().configured, false);
    assert.equal(manager.status().pending, false);
  });
}

for (const issuer of ['https://api.youversion.com', 'https://api.youversion.com/auth/token']) {
  test(`accepts the exact YouVersion issuer ${issuer} and retries staged verification`, async t => {
    const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
    let idToken;
    let tokenRequests = 0;
    let keysAvailable = false;
    const { manager, tokenStore } = setup(t, { fetchImplementation: async url => {
      if (String(url).endsWith('/.well-known/jwks.json')) {
        if (!keysAvailable) throw new Error('temporary key service failure');
        return { ok: true, json: async () => ({ keys: [{ ...publicKey.export({ format: 'jwk' }), kid: 'test-key' }] }) };
      }
      tokenRequests++;
      return { ok: true, json: async () => ({ access_token: 'access', id_token: idToken, expires_in: 3600 }) };
    } });
    const started = await manager.start({ open: false });
    const claims = {
      iss: issuer, aud: 'test-client', nonce: tokenStore.loadPendingAuth().nonce,
      exp: Math.floor(Date.now() / 1000) + 3600, sub: 'test-reader', name: 'Test Reader',
    };
    const header = Buffer.from(JSON.stringify({ alg: 'RS256', kid: 'test-key' })).toString('base64url');
    const body = Buffer.from(JSON.stringify(claims)).toString('base64url');
    const signature = sign('RSA-SHA256', Buffer.from(`${header}.${body}`), privateKey).toString('base64url');
    idToken = `${header}.${body}.${signature}`;
    await assert.rejects(manager.handleCallback(`${callback(started)}&code=code`));
    assert.equal(tokenStore.status().configured, false);
    assert.ok(tokenStore.loadPendingAuth().tokenResponse);
    keysAvailable = true;
    const completed = await manager.handleCallback(callback(started), { open: false });
    assert.equal(completed.stage, 'complete');
    assert.equal(tokenRequests, 1);
    assert.equal(tokenStore.status().configured, true);
    assert.equal(tokenStore.status().profile.id, 'test-reader');
    assert.equal(tokenStore.loadPendingAuth(), null);
  });
}
