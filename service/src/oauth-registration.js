// Register only when the user explicitly starts sign-in. Preserve unrelated
// omarchy:// callbacks through oauth-dispatch.js; never modify Hyprland files.
import { execFileSync } from 'node:child_process';
import { chmodSync, copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getConfigDir, ensureSecureDirectory } from './paths.js';

const desktop = 'omarchy-light-public-oauth.desktop';
export function registerOAuthCallback({ env = process.env,
  node,
  // The service is bundled at service/dist/daemon.mjs. Copy a built-in-only
  // dispatcher outside the checkout so other apps' callbacks still work after
  // a standard plugin removal. Node is resolved through PATH across mise updates.
  callback = fileURLToPath(new URL('../dist/oauth-dispatch.mjs', import.meta.url)),
  daemon = fileURLToPath(new URL('../dist/daemon.mjs', import.meta.url)),
  run = (command, args) => execFileSync(command, args, { encoding: 'utf8', env, timeout: 5000 }),
} = {}) {
  const dataHome = env.XDG_DATA_HOME || join(env.HOME || homedir(), '.local/share');
  const stableNode = join(env.MISE_DATA_DIR || join(dataHome, 'mise'), 'shims/node');
  node ||= existsSync(stableNode) ? stableNode : 'node';
  const applications = join(dataHome, 'applications');
  const bridgeDirectory = join(dataHome, 'omarchy/light-public');
  const bridge = join(bridgeDirectory, 'oauth-dispatch.mjs');
  const target = join(applications, desktop);
  const directory = ensureSecureDirectory(getConfigDir(env));
  // Escape first for Exec argument quoting, then for desktop-entry string values.
  const quote = value => '"' + String(value).replace(/(["`$\\])/g, '\\$1')
    .replaceAll('\\', '\\\\').replaceAll('%', '%%') + '"';
  const content = '[Desktop Entry]\nType=Application\nName=Light sign-in\nNoDisplay=true\n'
    + `Exec=/usr/bin/env ${quote('LIGHT_CONFIG_DIR=' + directory)} ${quote(node)} ${quote(bridge)} %u\n`
    + 'MimeType=x-scheme-handler/omarchy;\n';
  const previous = String(run('xdg-mime', ['query', 'default', 'x-scheme-handler/omarchy'])).trim();
  const fallback = join(directory, 'oauth-fallback.json');
  if (previous !== desktop) {
    if (previous && (!/^[a-zA-Z0-9._-]+\.desktop$/.test(previous)))
      throw new Error('The current callback handler could not be preserved.');
    writeFileSync(fallback, JSON.stringify({ desktop: previous }), { mode: 0o600 });
    chmodSync(fallback, 0o600);
  }
  ensureSecureDirectory(bridgeDirectory);
  const temporaryBridge = `${bridge}.${process.pid}.tmp`;
  copyFileSync(callback, temporaryBridge);
  chmodSync(temporaryBridge, 0o600);
  renameSync(temporaryBridge, bridge);
  const runtime = join(directory, 'oauth-runtime.json');
  writeFileSync(runtime, JSON.stringify({ daemon: resolve(daemon) }), { mode: 0o600 });
  chmodSync(runtime, 0o600);
  if (!existsSync(target) || readFileSync(target, 'utf8') !== content) {
    mkdirSync(applications, { recursive: true });
    const temporary = `${target}.${process.pid}.tmp`;
    writeFileSync(temporary, content, { mode: 0o644 });
    renameSync(temporary, target);
  }
  if (previous !== desktop) run('xdg-mime', ['default', desktop, 'x-scheme-handler/omarchy']);
  if (String(run('xdg-mime', ['query', 'default', 'x-scheme-handler/omarchy'])).trim() !== desktop)
    throw new Error('Light could not register its sign-in callback.');
}

// Upgrade only an already registered Light handler. Fresh installs perform no
// MIME registration until the user chooses Sign in.
export function repairExistingOAuthCallback({ env = process.env,
  run = (command, args) => execFileSync(command, args, { encoding: 'utf8', env, timeout: 5000 }),
} = {}) {
  const dataHome = env.XDG_DATA_HOME || join(env.HOME || homedir(), '.local/share');
  if (!existsSync(join(dataHome, 'applications', desktop))) return;
  if (String(run('xdg-mime', ['query', 'default', 'x-scheme-handler/omarchy'])).trim() === desktop)
    registerOAuthCallback({ env, run });
}
