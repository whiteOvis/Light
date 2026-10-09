import { getHttpStatus } from '@youversion/platform-core';

const DEFAULT_REQUEST_INTERVAL_MS = 1_100;
const DEFAULT_COOLDOWN_MS = 5 * 60 * 1000;

// One gate is shared by interactive reads, update checks, and downloads. It
// spaces requests, coalesces identical in-flight reads, and stops all network
// traffic during a YouVersion 429 cooldown instead of repeatedly extending it.
export class RateLimitedBibleClient {
  constructor({
    client,
    languagesClient = null,
    apiClient = null,
    requestIntervalMs = DEFAULT_REQUEST_INTERVAL_MS,
    cooldownMs = DEFAULT_COOLDOWN_MS,
    now = () => Date.now(),
    sleep = delay,
  }) {
    if (!client) throw new Error('A Bible client is required.');
    this.client = client;
    this.languagesClient = languagesClient;
    this.apiClient = apiClient;
    this.requestIntervalMs = nonNegativeInteger(requestIntervalMs, 'request interval');
    this.cooldownMs = positiveInteger(cooldownMs, 'rate-limit cooldown');
    this.now = now;
    this.sleep = sleep;
    this.nextRequestAt = 0;
    this.cooldownUntil = 0;
    this.inFlight = new Map();
  }

  get cooldownRemainingMs() {
    return Math.max(0, this.cooldownUntil - this.now());
  }

  getVersions(...args) {
    return this.#request('getVersions', args);
  }

  getVersion(...args) {
    return this.#request('getVersion', args);
  }

  getBooks(...args) {
    return this.#request('getBooks', args);
  }

  getIndex(...args) {
    return this.#request('getIndex', args);
  }

  getChapters(...args) {
    return this.#request('getChapters', args);
  }

  getPassage(...args) {
    return this.#request('getPassage', args);
  }

  searchVerses(version, query, pageToken = '') {
    return this.#requestOperation('searchVerses', [version, query, pageToken], () => this.apiClient.get(
      '/v1/search-verses', { bible_id: version, query, page_size: 25, page_token: pageToken || undefined },
    ));
  }

  getVOTD(...args) {
    return this.#request('getVOTD', args);
  }

  getLanguages(options = {}) {
    if (this.apiClient && options.bibles_available === true) {
      return this.#requestOperation('getLanguages', [options], () => this.apiClient.get(
        '/v1/languages',
        {
          page_size: options.page_size,
          'fields[]': options.fields,
          bibles_available: 'true',
        },
        { 'Accept-Language': options.locale || 'en-US' },
      ));
    }
    if (!this.languagesClient) throw new Error('A languages client is required.');
    return this.#request('getLanguages', [options], this.languagesClient);
  }

  #request(method, args, client = this.client) {
    return this.#requestOperation(
      method,
      args,
      () => client[method](...args),
    );
  }

  #requestOperation(method, args, operationCallback) {
    const key = `${method}:${JSON.stringify(args)}`;
    const existing = this.inFlight.get(key);
    if (existing) return existing;

    const operation = this.#execute(operationCallback)
      .finally(() => this.inFlight.delete(key));
    this.inFlight.set(key, operation);
    return operation;
  }

  async #execute(operation) {
    this.#throwIfCoolingDown();

    const scheduledAt = Math.max(this.now(), this.nextRequestAt);
    this.nextRequestAt = scheduledAt + this.requestIntervalMs;
    const waitMs = Math.max(0, scheduledAt - this.now());
    if (waitMs > 0) await this.sleep(waitMs);

    // A request ahead of this one may have received 429 while we waited.
    this.#throwIfCoolingDown();

    try {
      const result = await operation();
      this.consecutiveRateLimits = 0;
      return result;
    } catch (error) {
      if (getHttpStatus(error) === 429) {
        this.consecutiveRateLimits = (this.consecutiveRateLimits || 0) + 1;
        const suppliedRetryAfter = Number(error?.retryAfterMs);
        const fallback = Math.min(
          this.cooldownMs * (2 ** (this.consecutiveRateLimits - 1)),
          60 * 60 * 1000,
        );
        const retryAfterMs = Number.isFinite(suppliedRetryAfter)
          && suppliedRetryAfter > 0
          ? suppliedRetryAfter
          : fallback;
        this.cooldownUntil = Math.max(
          this.cooldownUntil,
          this.now() + retryAfterMs,
        );
        error.retryAfterMs = this.cooldownRemainingMs;
      }
      throw error;
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

function nonNegativeInteger(value, name) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error(`${name} must be a non-negative integer.`);
  }
  return parsed;
}

function positiveInteger(value, name) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw new Error(`${name} must be a positive integer.`);
  }
  return parsed;
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
