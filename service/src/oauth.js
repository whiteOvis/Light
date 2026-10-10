import { createHash, createPublicKey, randomBytes, randomUUID, timingSafeEqual, verify } from 'node:crypto';
import { spawn } from 'node:child_process';

import { ServiceError } from './service.js';
import { YOUVERSION_APPLICATION_KEY, YOUVERSION_REDIRECT_URI } from './platform-config.js';

const PENDING_AUTH_LIFETIME_MS = 10 * 60 * 1000;
const ALLOWED_SCOPES = new Set(['profile', 'email']);
const ALLOWED_PERMISSIONS = new Set(['highlights']);

export class OAuthManager {
  constructor({
    tokenStore,
    appKey = YOUVERSION_APPLICATION_KEY,
    env = process.env,
    fetchImplementation = globalThis.fetch,
    openUrl = openExternalUrl,
    prepareCallback = () => {},
  }) {
    this.tokenStore = tokenStore;
    this.appKey = appKey;
    this.env = env;
    this.fetch = fetchImplementation;
    this.openUrl = openUrl;
    this.prepareCallback = prepareCallback;
  }

  async start({ scopes = ['profile', 'email'], permissions = [], open = true } = {}) {
    const appKey = this.appKey;
    if (!appKey) {
      throw oauthError('YouVersion sign-in is unavailable.', 'APP_KEY_MISSING');
    }
    const redirectUri = normalizeRedirectUri(
      this.env.YVP_REDIRECT_URI || YOUVERSION_REDIRECT_URI,
    );
    const apiHost = validateApiHost(this.env.YVP_API_HOST || 'api.youversion.com');
    const selectedScopes = validateList(scopes, ALLOWED_SCOPES, 'scope');
    const selectedPermissions = validateList(
      permissions,
      ALLOWED_PERMISSIONS,
      'permission',
    );
    // Reopening sign-in must not invalidate the browser tab already in use.
    const existing = this.tokenStore.loadPendingAuth();
    if (existing && !existing.error && Date.parse(existing.expiresAt) > Date.now()
        && existing.authorizationUrl && existing.appKey === appKey
        && existing.apiHost === apiHost && existing.redirectUri === redirectUri
        && JSON.stringify(existing.requestedScopes) === JSON.stringify(selectedScopes)
        && JSON.stringify(existing.requestedPermissions) === JSON.stringify(selectedPermissions)) {
      await this.prepareCallback();
      if (open) await this.openPendingAuthorization(existing);
      return { stage: 'authorization-started', redirectUri,
        authorizationUrl: existing.continuationUrl || existing.authorizationUrl, openedBrowser: open, expiresAt: existing.expiresAt };
    }
    await this.prepareCallback();
    const state = randomUrlSafe(24);
    const nonce = randomUrlSafe(24);
    const codeVerifier = randomUrlSafe(48);
    const codeChallenge = createHash('sha256')
      .update(codeVerifier)
      .digest('base64url');
    const expiresAt = new Date(Date.now() + PENDING_AUTH_LIFETIME_MS).toISOString();

    const pending = {
      version: 1,
      appKey,
      apiHost,
      redirectUri,
      state,
      nonce,
      codeVerifier,
      requestedScopes: selectedScopes,
      requestedPermissions: selectedPermissions,
      grantedPermissions: [],
      sessionId: typeof this.tokenStore.getLocalSessionId === 'function'
        ? this.tokenStore.getLocalSessionId()
        : randomUUID(),
      expiresAt,
    };

    const authorizationUrl = new URL(`https://${apiHost}/auth/authorize`);
    authorizationUrl.searchParams.set('response_type', 'code');
    authorizationUrl.searchParams.set('require_user_interaction', 'true');
    authorizationUrl.searchParams.set('client_id', appKey);
    authorizationUrl.searchParams.set('redirect_uri', redirectUri);
    authorizationUrl.searchParams.set(
      'scope',
      ['openid', ...selectedScopes].sort().join(' '),
    );
    authorizationUrl.searchParams.set('nonce', nonce);
    authorizationUrl.searchParams.set('state', state);
    authorizationUrl.searchParams.set('code_challenge', codeChallenge);
    authorizationUrl.searchParams.set('code_challenge_method', 'S256');
    // Data-exchange permissions are not OIDC scopes. YouVersion requires a
    // separately repeated requested_permissions[] query parameter for each
    // permission, rather than a comma-separated scalar value.
    for (const permission of selectedPermissions.sort()) {
      authorizationUrl.searchParams.append('requested_permissions[]', permission);
    }

    pending.authorizationUrl = authorizationUrl.toString();
    this.tokenStore.savePendingAuth(pending);
    if (open) await this.openPendingAuthorization(pending);
    return {
      stage: 'authorization-started',
      redirectUri,
      authorizationUrl: authorizationUrl.toString(),
      openedBrowser: open,
      expiresAt,
    };
  }

  async openPendingAuthorization(pending) {
    try { await this.openUrl(pending.continuationUrl || pending.authorizationUrl); } catch {
      const current = this.tokenStore.loadPendingAuth();
      if (current && safeEqual(current.state, pending.state)) {
        this.tokenStore.savePendingAuth({ ...current, error: {
          code: 'BROWSER_OPEN_FAILED', message: 'Unable to open the browser. Try sign-in again.',
        } });
      }
      throw oauthError('Unable to open the browser. Try sign-in again.', 'BROWSER_OPEN_FAILED', 502);
    }
  }

  async handleCallback(callbackUri, { open = true } = {}) {
    try {
      return await this.completeCallback(callbackUri, { open });
    } catch (error) {
      // The handler runs in a separate process. Persist a safe error so the
      // Settings poll can report it; unrelated callbacks cannot alter a login.
      const pending = this.tokenStore.loadPendingAuth();
      let callback;
      try { callback = new URL(callbackUri); } catch {}
      if (pending && !pending.error && callback && safeEqual(callback.searchParams.get('state'), pending.state)
          && callbackOrigin(callback) === callbackOrigin(new URL(pending.redirectUri))) {
        this.tokenStore.savePendingAuth({ ...pending, error: {
          code: error instanceof ServiceError ? error.code : 'OAUTH_NETWORK_FAILED',
          ...(error.details ? { details: error.details } : {}),
          message: error instanceof ServiceError ? error.message
            : 'Unable to complete YouVersion sign-in. Check your connection and try again.',
        } });
      }
      throw error;
    }
  }

  async completeCallback(callbackUri, { open = true } = {}) {
    const pending = this.tokenStore.loadPendingAuth();
    if (!pending) {
      throw oauthError(
        'No pending OAuth request was found. Start sign-in again.',
        'OAUTH_NOT_PENDING',
      );
    }
    if (Date.parse(pending.expiresAt) <= Date.now()) {
      throw oauthError('The OAuth request expired. Start sign-in again.', 'OAUTH_EXPIRED');
    }

    const callback = parseCallbackUri(callbackUri);
    if (callbackOrigin(callback) !== callbackOrigin(new URL(pending.redirectUri))) {
      throw oauthError('The callback URI does not match the pending redirect URI.', 'CALLBACK_MISMATCH');
    }
    const returnedState = callback.searchParams.get('state');
    if (!safeEqual(returnedState, pending.state)) {
      throw oauthError('OAuth state validation failed.', 'OAUTH_STATE_MISMATCH');
    }

    const providerError = callback.searchParams.get('error');
    if (providerError) {
      const description = callback.searchParams.get('error_description');
      throw oauthError(
        `Light authorization failed: ${providerError}${description ? ` (${description})` : ''}`,
        'OAUTH_DENIED',
      );
    }

    const returnedGrants = parseGrantedPermissions(callback.searchParams);
    const code = callback.searchParams.get('code');
    if (!code && !pending.tokenResponse) {
      if (pending.error) throw oauthError(pending.error.message, pending.error.code, 502);
      const continuationUrl = new URL(`https://${pending.apiHost}/auth/callback`);
      continuationUrl.searchParams.set('state', pending.state);
      // Follow YouVersion's browser continuation flow after validating state.
      // Keep the PKCE verifier local and exchange only the final code here.
      const alreadyContinued = Boolean(pending.continuationUrl);
      pending.continuationUrl = continuationUrl.toString();
      pending.grantedPermissions = returnedGrants.length ? returnedGrants : pending.grantedPermissions;
      this.tokenStore.savePendingAuth(pending);
      if (open && !alreadyContinued) await this.openPendingAuthorization(pending);
      return {
        stage: 'awaiting-code',
        authorizationUrl: pending.continuationUrl,
        openedBrowser: open && !alreadyContinued,
        expiresAt: pending.expiresAt,
      };
    }

    // Stage the response only in the encrypted pending request. It is never
    // an authenticated session until signature and all identity checks pass.
    // This permits retrying verification without reusing a one-time code.
    let tokens = pending.tokenResponse;
    if (!tokens) {
      const response = await this.fetch(`https://${pending.apiHost}/auth/token`, {
        method: 'POST',
        signal: AbortSignal.timeout(10_000),
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          redirect_uri: pending.redirectUri,
          client_id: pending.appKey,
          code_verifier: pending.codeVerifier,
        }),
      });
      if (!response.ok) {
        throw oauthError(
          `Light token exchange failed with HTTP ${response.status}.`,
          'TOKEN_EXCHANGE_FAILED',
          502,
        );
      }

      tokens = await response.json();
      if (typeof tokens.access_token !== 'string' || !tokens.access_token) {
        throw oauthError(
          'The identity provider returned an invalid token response.',
          'TOKEN_RESPONSE_INVALID',
          502,
        );
      }
      const current = this.tokenStore.loadPendingAuth();
      if (!current || !safeEqual(current.state, pending.state))
        throw oauthError('This sign-in attempt was replaced or cancelled.', 'OAUTH_NOT_PENDING');
      this.tokenStore.savePendingAuth({ ...current, tokenResponse: tokens });
    }
    const expiresIn = Number(tokens.expires_in);
    const tokenExpiresAt = Number.isFinite(expiresIn)
      ? new Date(Date.now() + expiresIn * 1000).toISOString()
      : null;
    const profile = typeof tokens.id_token === 'string' && tokens.id_token
      ? await verifyProfileToken({
        idToken: tokens.id_token,
        apiHost: pending.apiHost,
        appKey: pending.appKey,
        nonce: pending.nonce,
        fetchImplementation: this.fetch,
      })
      : null;
    // A newer attempt or sign-out may have happened during network requests.
    const current = this.tokenStore.loadPendingAuth();
    if (!current || !safeEqual(current.state, pending.state))
      throw oauthError('This sign-in attempt was replaced or cancelled.', 'OAUTH_NOT_PENDING');
    this.tokenStore.save({
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token || null,
      expiresAt: tokenExpiresAt,
      appKey: pending.appKey,
      apiHost: pending.apiHost,
      tokenType: tokens.token_type || 'Bearer',
      scope: tokens.scope || null,
      sessionId: pending.sessionId,
      profile,
    });
    this.tokenStore.clearPendingAuth();

    return {
      stage: 'complete',
      token: this.tokenStore.status(),
      grantedPermissions: returnedGrants.length
        ? returnedGrants
        : pending.grantedPermissions,
    };
  }

  status() {
    const pending = this.tokenStore.loadPendingAuth();
    return {
      pending: Boolean(pending && !pending.error && Date.parse(pending.expiresAt) > Date.now()),
      error: pending?.error || (pending && Date.parse(pending.expiresAt) <= Date.now()
        ? { code: 'OAUTH_EXPIRED', message: 'Sign-in expired. Please try again.' } : null),
    };
  }
}

async function verifyProfileToken({ idToken, apiHost, appKey, nonce, fetchImplementation }) {
  const parts = idToken.split('.');
  if (parts.length !== 3) throw oauthError('The identity provider returned an invalid ID token.', 'ID_TOKEN_INVALID', 502);
  const header = decodeJwtPart(parts[0], 'header');
  const claims = decodeJwtPart(parts[1], 'claims');
  if (header.alg !== 'RS256' || typeof header.kid !== 'string') {
    throw oauthError('The identity provider returned an unsupported ID token.', 'ID_TOKEN_INVALID', 502);
  }
  const response = await fetchImplementation(`https://${apiHost}/.well-known/jwks.json`, {
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw oauthError('Unable to verify the identity token.', 'ID_TOKEN_VERIFICATION_FAILED', 502);
  const document = await response.json();
  const key = Array.isArray(document?.keys) ? document.keys.find((candidate) => candidate?.kid === header.kid) : null;
  if (!key || key.kty !== 'RSA') throw oauthError('The identity token signing key is unavailable.', 'ID_TOKEN_VERIFICATION_FAILED', 502);
  let publicKey;
  try { publicKey = createPublicKey({ key, format: 'jwk' }); } catch {
    throw oauthError('The identity token signing key is invalid.', 'ID_TOKEN_VERIFICATION_FAILED', 502);
  }
  const signature = Buffer.from(parts[2], 'base64url');
  if (!verify('RSA-SHA256', Buffer.from(`${parts[0]}.${parts[1]}`), publicKey, signature)) {
    throw oauthError('The identity token signature is invalid.', 'ID_TOKEN_VERIFICATION_FAILED', 502);
  }
  const invalidClaims = [];
  // YouVersion's live RS256 tokens use the token endpoint as issuer; its
  // published OIDC metadata also documents the API origin. Accept these two
  // exact values, never an arbitrary path or a host/suffix match.
  const issuers = [`https://${apiHost}`, `https://${apiHost}/auth/token`];
  if (!issuers.includes(claims.iss)) invalidClaims.push('issuer');
  if (!audienceIncludes(claims.aud, appKey)) invalidClaims.push('audience');
  if (claims.nonce !== nonce) invalidClaims.push('nonce');
  if (!Number.isFinite(claims.exp) || claims.exp * 1000 <= Date.now()) invalidClaims.push('expiry');
  if (invalidClaims.length) {
    throw Object.assign(
      oauthError(`The signed identity token failed validation: ${invalidClaims.join(', ')}.`, 'ID_TOKEN_VERIFICATION_FAILED', 502),
      { details: { issuer: typeof claims.iss === 'string' ? claims.iss.slice(0, 200) : null } },
    );
  }
  const id = safeClaim(claims.yvp_id || claims.sub, 160);
  if (!id) throw oauthError('The identity token did not include a user identifier.', 'ID_TOKEN_VERIFICATION_FAILED', 502);
  return {
    id,
    name: safeClaim(claims.name, 240),
    email: safeClaim(claims.email, 320),
    avatarUrl: safeHttpsUrl(claims.profile_picture),
  };
}

function decodeJwtPart(value, label) {
  try { return JSON.parse(Buffer.from(value, 'base64url').toString('utf8')); } catch {
    throw oauthError(`The identity token ${label} is invalid.`, 'ID_TOKEN_INVALID', 502);
  }
}

function audienceIncludes(audience, appKey) {
  return audience === appKey || (Array.isArray(audience) && audience.includes(appKey));
}

function safeClaim(value, maximum) {
  return typeof value === 'string' && value.length > 0 && value.length <= maximum ? value : null;
}

function safeHttpsUrl(value) {
  if (typeof value !== 'string' || value.length === 0 || value.length > 2048) return null;
  try { return new URL(value).protocol === 'https:' ? value : null; } catch { return null; }
}

export function openExternalUrl(url) {
  return new Promise((resolve, reject) => {
    const child = spawn('xdg-open', [url], {
      detached: true,
      stdio: 'ignore',
    });
    child.once('error', reject);
    const timeout = setTimeout(() => {
      child.kill();
      reject(oauthError('Opening the browser timed out.', 'BROWSER_OPEN_FAILED', 502));
    }, 10_000);
    child.once('error', () => clearTimeout(timeout));
    child.once('exit', (code) => {
      clearTimeout(timeout);
      if (code === 0) resolve();
      else reject(oauthError('Unable to open the browser.', 'BROWSER_OPEN_FAILED', 502));
    });
  });
}

function randomUrlSafe(byteCount) {
  return randomBytes(byteCount).toString('base64url');
}

function normalizeRedirectUri(value) {
  const redirect = parseCallbackUri(value);
  if (redirect.protocol !== 'omarchy:' || callbackOrigin(redirect) !== YOUVERSION_REDIRECT_URI) {
    throw oauthError(
      `The YouVersion callback must be ${YOUVERSION_REDIRECT_URI}.`,
      'REDIRECT_URI_INVALID',
    );
  }
  if (redirect.search || redirect.hash) {
    throw oauthError('YVP_REDIRECT_URI cannot contain a query or fragment.', 'REDIRECT_URI_INVALID');
  }
  return YOUVERSION_REDIRECT_URI;
}

function parseCallbackUri(value) {
  try {
    return new URL(value);
  } catch {
    throw oauthError('Invalid OAuth callback URI.', 'CALLBACK_INVALID');
  }
}

function callbackOrigin(url) {
  return `${url.protocol}//${url.host}${url.pathname}`.replace(/\/$/, '');
}

function validateApiHost(value) {
  if (!/^[a-z0-9.-]+(?::\d+)?$/i.test(value)) {
    throw oauthError('YVP_API_HOST must be a host name without a URL scheme.', 'API_HOST_INVALID');
  }
  return value;
}

function validateList(values, allowed, label) {
  const normalized = Array.isArray(values) ? values : String(values || '').split(',');
  const unique = [...new Set(normalized.map((value) => value.trim()).filter(Boolean))];
  const invalid = unique.find((value) => !allowed.has(value));
  if (invalid) throw oauthError(`Unsupported OAuth ${label}: ${invalid}`, 'OAUTH_OPTION_INVALID');
  return unique;
}

function parseGrantedPermissions(parameters) {
  const permissions = new Set();
  for (const [key, value] of parameters) {
    // YouVersion has emitted bare, repeated, and bracket-array variants.
    if (!/^granted_permissions(?:\[\d*\])?$/.test(key)) continue;
    for (const permission of value.split(/[\s,]+/)) {
      if (permission) permissions.add(permission);
    }
  }
  return [...permissions];
}

function safeEqual(actual, expected) {
  if (!actual || typeof expected !== 'string') return false;
  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(expected);
  return actualBuffer.length === expectedBuffer.length
    && timingSafeEqual(actualBuffer, expectedBuffer);
}

function oauthError(message, code, status = 400) {
  return new ServiceError(message, { code, status });
}
