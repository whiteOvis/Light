import { chmodSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';

export function getConfigDir(env = process.env) {
  return resolve(
    env.LIGHT_CONFIG_DIR || `${env.XDG_CONFIG_HOME || `${homedir()}/.config`}/omarchy/light-public`,
  );
}

export function ensureSecureDirectory(directory) {
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  chmodSync(directory, 0o700);
  return directory;
}
