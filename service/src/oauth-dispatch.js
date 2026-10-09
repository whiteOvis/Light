#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { homedir } from 'node:os';
import { delimiter, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getConfigDir } from './paths.js';
import { TokenStore } from './token-store.js';

export function dispatchCallback(uri, { pending, fallback = '', run = spawnSync,
  daemon = fileURLToPath(new URL('./daemon.js', import.meta.url)), env = process.env,
} = {}) {
  const callback = new URL(uri);
  if (callback.protocol !== 'omarchy:' || callback.hostname !== 'oauth' || callback.pathname !== '/callback')
    throw new Error('Invalid OAuth callback URI.');
  if (pending?.state && callback.searchParams.get('state') === pending.state) {
    const result = run(process.execPath, [daemon, 'oauth', 'callback', uri], { stdio: 'inherit', env });
    if (result.error) throw result.error;
    return result.status ?? 1;
  }
  if (!fallback || !existsSync(fallback)) throw new Error('No matching sign-in request was found.');
  const result = run('gio', ['launch', fallback, uri], { stdio: 'inherit', env });
  if (result.error) throw result.error;
  return result.status ?? 1;
}

export function fallbackDesktop(env = process.env) {
  const config = env.XDG_CONFIG_HOME || join(homedir(), '.config');
  const setting = join(config, 'omarchy/light-public/oauth-fallback.json');
  if (!existsSync(setting)) return '';
  const { desktop } = JSON.parse(readFileSync(setting, 'utf8'));
  if (!desktop || desktop === 'omarchy-light-public-oauth.desktop' || desktop.includes('/') || desktop.includes('\\')) return '';
  const roots = [env.XDG_DATA_HOME || join(homedir(), '.local/share'),
    ...(env.XDG_DATA_DIRS || '/usr/local/share:/usr/share').split(delimiter)];
  return roots.map(root => join(root, 'applications', desktop)).find(existsSync) || '';
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const environmentFile = fileURLToPath(new URL('../.env', import.meta.url));
    if (existsSync(environmentFile)) process.loadEnvFile(environmentFile);
    const directory = getConfigDir();
    const pending = new TokenStore({ directory }).loadPendingAuth();
    process.exitCode = dispatchCallback(process.argv[2], { pending, fallback: fallbackDesktop() });
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
