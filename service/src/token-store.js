import {
  chmodSync,
  closeSync,
  constants,
  existsSync,
  openSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
  writeSync,
} from 'node:fs';
import { join } from 'node:path';
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  randomUUID,
} from 'node:crypto';

import { ensureSecureDirectory } from './paths.js';

const ALGORITHM = 'aes-256-gcm';

export class TokenStore {
  constructor({ directory } = {}) {
    if (!directory) throw new Error('A token directory is required.');
    this.directory = ensureSecureDirectory(directory);
    this.keyPath = join(directory, 'token.key');
    this.tokenPath = join(directory, 'tokens.enc');
    this.pendingAuthPath = join(directory, 'oauth-pending.enc');
    this.localSessionPath = join(directory, 'local-session');
  }

  save({
    accessToken,
    refreshToken = null,
    expiresAt = null,
    appKey = null,
    apiHost = null,
    tokenType = 'Bearer',
    scope = null,
    sessionId = null,
    profile = null,
  }) {
    if (typeof accessToken !== 'string' || accessToken.length === 0) {
      throw new Error('accessToken must be a non-empty string.');
    }
    if (refreshToken !== null && typeof refreshToken !== 'string') {
      throw new Error('refreshToken must be a string or null.');
    }
    if (expiresAt !== null && Number.isNaN(Date.parse(expiresAt))) {
      throw new Error('expiresAt must be an ISO-8601 date or null.');
    }
    for (const [name, value] of Object.entries({
      appKey,
      apiHost,
      tokenType,
      scope,
      sessionId,
    })) {
      if (value !== null && typeof value !== 'string') {
        throw new Error(`${name} must be a string or null.`);
      }
    }
    const normalizedProfile = normalizeProfile(profile);

    this.#saveEncrypted(this.tokenPath, {
      accessToken,
      refreshToken,
      expiresAt,
      appKey,
      apiHost,
      tokenType,
      scope,
      sessionId,
      profile: normalizedProfile,
    });
  }

  load() {
    return this.#loadEncrypted(this.tokenPath);
  }

  status() {
    const tokens = this.load();
    if (!tokens) return { configured: false };
    return {
      configured: true,
      hasRefreshToken: Boolean(tokens.refreshToken),
      expiresAt: tokens.expiresAt,
      expired: tokens.expiresAt ? Date.parse(tokens.expiresAt) <= Date.now() : null,
      profile: tokens.profile || null,
    };
  }

  getLocalSessionId() {
    if (existsSync(this.localSessionPath)) {
      const stored = readFileSync(this.localSessionPath, 'utf8').trim();
      if (stored) {
        chmodSync(this.localSessionPath, 0o600);
        return stored;
      }
    }

    // Preserve the session identifier used by earlier Light releases so
    // existing local highlights remain visible after this migration.
    const sessionId = this.load()?.sessionId || randomUUID();
    writeFileSync(this.localSessionPath, `${sessionId}\n`, { mode: 0o600 });
    chmodSync(this.localSessionPath, 0o600);
    return sessionId;
  }

  clear() {
    if (!existsSync(this.tokenPath)) return false;
    unlinkSync(this.tokenPath);
    return true;
  }

  savePendingAuth(pendingAuth) {
    this.#saveEncrypted(this.pendingAuthPath, pendingAuth);
  }

  loadPendingAuth() {
    return this.#loadEncrypted(this.pendingAuthPath);
  }

  clearPendingAuth() {
    if (!existsSync(this.pendingAuthPath)) return false;
    unlinkSync(this.pendingAuthPath);
    return true;
  }

  #loadKey() {
    const key = readFileSync(this.keyPath);
    if (key.length !== 32) throw new Error('The token encryption key is invalid.');
    chmodSync(this.keyPath, 0o600);
    return key;
  }

  #loadOrCreateKey() {
    if (existsSync(this.keyPath)) return this.#loadKey();
    const key = randomBytes(32);
    let descriptor;
    try {
      descriptor = openSync(
        this.keyPath,
        constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL,
        0o600,
      );
      writeSync(descriptor, key);
    } catch (error) {
      if (error.code === 'EEXIST') return this.#loadKey();
      throw error;
    } finally {
      if (descriptor !== undefined) closeSync(descriptor);
    }
    return key;
  }

  #saveEncrypted(path, value) {
    const key = this.#loadOrCreateKey();
    const iv = randomBytes(12);
    const cipher = createCipheriv(ALGORITHM, key, iv);
    const plaintext = JSON.stringify(value);
    const ciphertext = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);
    const document = JSON.stringify({
      version: 1,
      iv: iv.toString('base64'),
      tag: cipher.getAuthTag().toString('base64'),
      ciphertext: ciphertext.toString('base64'),
    });
    this.#atomicPrivateWrite(path, document);
  }

  #loadEncrypted(path) {
    if (!existsSync(path)) return null;
    const key = this.#loadKey();
    const document = JSON.parse(readFileSync(path, 'utf8'));
    if (document.version !== 1) {
      throw new Error(`Unsupported encrypted file version: ${document.version}`);
    }

    const decipher = createDecipheriv(
      ALGORITHM,
      key,
      Buffer.from(document.iv, 'base64'),
    );
    decipher.setAuthTag(Buffer.from(document.tag, 'base64'));
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(document.ciphertext, 'base64')),
      decipher.final(),
    ]).toString('utf8');
    return JSON.parse(plaintext);
  }

  #atomicPrivateWrite(path, contents) {
    const temporaryPath = `${path}.${randomUUID()}.tmp`;
    try {
      writeFileSync(temporaryPath, contents, { mode: 0o600, flag: 'wx' });
      renameSync(temporaryPath, path);
      chmodSync(path, 0o600);
    } finally {
      if (existsSync(temporaryPath)) unlinkSync(temporaryPath);
    }
  }
}

function normalizeProfile(profile) {
  if (profile === null) return null;
  if (!profile || typeof profile !== 'object' || Array.isArray(profile)) {
    throw new Error('profile must be an object or null.');
  }
  const id = stringField(profile.id, 'profile.id', 160, true);
  const name = stringField(profile.name, 'profile.name', 240);
  const email = stringField(profile.email, 'profile.email', 320);
  const avatarUrl = stringField(profile.avatarUrl, 'profile.avatarUrl', 2048);
  if (avatarUrl !== null) {
    let url;
    try { url = new URL(avatarUrl); } catch { throw new Error('profile.avatarUrl must be a valid HTTPS URL.'); }
    if (url.protocol !== 'https:') throw new Error('profile.avatarUrl must be a valid HTTPS URL.');
  }
  return { id, name, email, avatarUrl };
}

function stringField(value, name, maximum, required = false) {
  if (value === undefined || value === null || value === '') {
    if (required) throw new Error(`${name} must be a non-empty string.`);
    return null;
  }
  if (typeof value !== 'string' || value.length > maximum) {
    throw new Error(`${name} must be a string no longer than ${maximum} characters.`);
  }
  return value;
}
