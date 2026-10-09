import { ServiceError } from './service.js';
import { randomUUID } from 'node:crypto';
import { YOUVERSION_APPLICATION_KEY } from './platform-config.js';

const DEFAULT_REFRESH_SKEW_MS = 60_000;

export class AuthenticationManager {
  constructor({
    tokenStore,
    appKey = YOUVERSION_APPLICATION_KEY,
    env = process.env,
    fetchImplementation = globalThis.fetch,
    refreshSkewMs = DEFAULT_REFRESH_SKEW_MS,
  }) {
    this.tokenStore = tokenStore;
    this.appKey = appKey;
    this.env = env;
    this.fetch = fetchImplementation;
    this.refreshSkewMs = refreshSkewMs;
    this.refreshPromise = null;
  }

  status() {
    const stored = this.tokenStore.status();
    return {
      ...stored,
      authenticated: stored.configured
        && (stored.expired !== true || stored.hasRefreshToken),
    };
  }

  async getAccessToken({ forceRefresh = false } = {}) {
    const tokens = this.tokenStore.load();
    if (!tokens) throw authRequired('No Light user session is stored.');
    const expiresSoon = tokens.expiresAt
      && Date.parse(tokens.expiresAt) <= Date.now() + this.refreshSkewMs;
    if (forceRefresh || expiresSoon) return this.refresh();
    return tokens.accessToken;
  }

  async getAuthorizationHeader(options) {
    return `Bearer ${await this.getAccessToken(options)}`;
  }

  getSessionId() {
    if (typeof this.tokenStore.getLocalSessionId === 'function') {
      return this.tokenStore.getLocalSessionId();
    }
    const tokens = this.tokenStore.load();
    if (!tokens) throw authRequired('No Light user session is stored.');
    if (tokens.sessionId) return tokens.sessionId;
    const sessionId = randomUUID();
    this.tokenStore.save({ ...tokens, sessionId });
    return sessionId;
  }

  async refresh() {
    if (this.refreshPromise) return this.refreshPromise;
    this.refreshPromise = this.#performRefresh();
    try {
      return await this.refreshPromise;
    } finally {
      this.refreshPromise = null;
    }
  }

  signOut() {
    return {
      cleared: this.tokenStore.clear(),
      pendingAuthorizationCleared: this.tokenStore.clearPendingAuth(),
    };
  }

  async #performRefresh() {
    const current = this.tokenStore.load();
    if (!current?.refreshToken) {
      throw authRequired('The Light session has no refresh token. Sign in again.');
    }
    const appKey = this.appKey;
    if (!appKey) {
      throw new ServiceError('YouVersion sign-in is unavailable.', {
        code: 'APP_KEY_MISSING',
        status: 503,
      });
    }
    const apiHost = this.env.YVP_API_HOST || current.apiHost || 'api.youversion.com';
    const response = await this.fetch(`https://${apiHost}/auth/token`, {
      method: 'POST',
      signal: AbortSignal.timeout(10_000),
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: current.refreshToken,
        client_id: appKey,
      }),
    });

    if (!response.ok) {
      if ([400, 401, 403].includes(response.status)) this.tokenStore.clear();
      throw new ServiceError(
        `Light token refresh failed with HTTP ${response.status}.`,
        {
          code: [400, 401, 403].includes(response.status)
            ? 'SESSION_EXPIRED'
            : 'TOKEN_REFRESH_FAILED',
          status: [400, 401, 403].includes(response.status) ? 401 : 502,
        },
      );
    }

    const refreshed = await response.json();
    if (typeof refreshed.access_token !== 'string' || !refreshed.access_token) {
      throw new ServiceError('The identity provider returned an invalid refresh response.', {
        code: 'TOKEN_RESPONSE_INVALID',
        status: 502,
      });
    }
    const expiresIn = Number(refreshed.expires_in);
    const expiresAt = Number.isFinite(expiresIn)
      ? new Date(Date.now() + expiresIn * 1000).toISOString()
      : null;
    this.tokenStore.save({
      accessToken: refreshed.access_token,
      refreshToken: refreshed.refresh_token || current.refreshToken,
      expiresAt,
      appKey,
      apiHost,
      tokenType: refreshed.token_type || current.tokenType || 'Bearer',
      scope: refreshed.scope || current.scope || null,
      sessionId: current.sessionId || randomUUID(),
      profile: current.profile || null,
    });
    return refreshed.access_token;
  }
}

function authRequired(message) {
  return new ServiceError(message, { code: 'AUTHENTICATION_REQUIRED', status: 401 });
}
