const DEFAULT_API_HOST = 'api.youversion.com';
const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_RATE_LIMIT_COOLDOWN_MS = 5 * 60 * 1000;

// The upstream SDK's ApiClient currently discards Retry-After before throwing.
// This compatible client preserves it, uses a real per-installation identity,
// and shares a 429 cooldown across Bible content and account-data clients.
export class PlatformApiClient {
  constructor({
    appKey,
    apiHost = DEFAULT_API_HOST,
    timeout = DEFAULT_TIMEOUT_MS,
    installationId,
    cooldownMs = DEFAULT_RATE_LIMIT_COOLDOWN_MS,
    fetchImplementation = globalThis.fetch,
    now = () => Date.now(),
  } = {}) {
    if (!appKey) throw new Error('PlatformApiClient requires an app key.');
    if (!installationId) {
      throw new Error('PlatformApiClient requires a stable installation ID.');
    }
    if (typeof fetchImplementation !== 'function') {
      throw new Error('PlatformApiClient requires fetch support.');
    }

    this.baseUrl = `https://${apiHost}`;
    this.timeout = positiveInteger(timeout, 'request timeout');
    this.cooldownMs = positiveInteger(cooldownMs, 'rate-limit cooldown');
    this.fetch = fetchImplementation;
    this.now = now;
    this.cooldownUntil = 0;
    this.defaultHeaders = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-YVP-App-Key': appKey,
      'X-YVP-Installation-Id': installationId,
    };
  }

  get cooldownRemainingMs() {
    return Math.max(0, this.cooldownUntil - this.now());
  }

  get(path, params, headers) {
    return this.#request(path, { method: 'GET', headers }, params);
  }

  post(path, data, params, headers) {
    return this.#request(path, {
      method: 'POST',
      body: data === undefined ? undefined : JSON.stringify(data),
      headers,
    }, params);
  }

  delete(path, params, headers) {
    return this.#request(path, { method: 'DELETE', headers }, params);
  }

  async #request(path, options, params) {
    this.#throwIfCoolingDown();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);
    try {
      const response = await this.fetch(
        `${this.baseUrl}${path}${queryString(params)}`,
        {
          ...options,
          signal: controller.signal,
          headers: { ...this.defaultHeaders, ...(options.headers || {}) },
        },
      );
      if (!response.ok) {
        const message = await responseMessage(response);
        const error = Object.assign(
          new Error(message || `Request failed with status ${response.status}`),
          { status: response.status, statusText: response.statusText },
        );
        if (response.status === 429) {
          const retryAfterMs = parseRetryAfter(
            response.headers?.get?.('retry-after'),
            this.now(),
          ) || this.cooldownMs;
          this.cooldownUntil = Math.max(
            this.cooldownUntil,
            this.now() + retryAfterMs,
          );
          error.retryAfterMs = this.cooldownRemainingMs;
        }
        throw error;
      }

      if (response.status === 204) return undefined;
      const contentType = response.headers?.get?.('content-type') || '';
      const text = await response.text();
      if (!text) return undefined;
      return contentType.includes('application/json') ? JSON.parse(text) : text;
    } catch (error) {
      if (error?.name === 'AbortError') {
        throw new Error(`Request timeout after ${this.timeout}ms`);
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  #throwIfCoolingDown() {
    const remaining = this.cooldownRemainingMs;
    if (remaining <= 0) return;
    const seconds = Math.max(1, Math.ceil(remaining / 1000));
    throw Object.assign(
      new Error(`YouVersion rate-limit cooldown is active. Retry in ${seconds} seconds.`),
      {
        status: 429,
        code: 'YVP_RATE_LIMIT_COOLDOWN',
        retryAfterMs: remaining,
      },
    );
  }
}

function queryString(params) {
  if (!params) return '';
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) {
      for (const item of value) query.append(key, String(item));
    } else if (value !== undefined && value !== null) {
      query.append(key, String(value));
    }
  }
  const encoded = query.toString();
  return encoded ? `?${encoded}` : '';
}

async function responseMessage(response) {
  try {
    const text = await response.text();
    if (!text) return '';
    try {
      const body = JSON.parse(text);
      return String(body.message || body.error || text);
    } catch {
      return text;
    }
  } catch {
    return '';
  }
}

function parseRetryAfter(value, now) {
  const header = String(value || '').trim();
  if (!header) return 0;
  if (/^\d+(?:\.\d+)?$/.test(header)) {
    return Math.max(1, Math.ceil(Number(header) * 1000));
  }
  const retryAt = Date.parse(header);
  return Number.isFinite(retryAt) ? Math.max(1, retryAt - now) : 0;
}

function positiveInteger(value, name) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw new Error(`${name} must be a positive integer.`);
  }
  return parsed;
}
