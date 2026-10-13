import { spawn } from 'node:child_process';
import { ServiceError } from './service.js';

export const MAX_CLIPBOARD_BYTES = 64 * 1024;
export const CLIPBOARD_TIMEOUT_MS = 1500;

// Called only for an authenticated, explicit paste request. Never use Qt's
// synchronous clipboard text reader in the shared shell process.
export function readClipboard({ primary = false, spawnImplementation = spawn,
  timeoutMs = CLIPBOARD_TIMEOUT_MS } = {}) {
  return new Promise((resolve, reject) => {
    const args = ['--no-newline', '--type', 'text'];
    if (primary) args.push('--primary');
    let child;
    try { child = spawnImplementation('wl-paste', args, { stdio: ['ignore', 'pipe', 'ignore'] }); }
    catch { reject(failure('Clipboard reader is unavailable.', 'CLIPBOARD_UNAVAILABLE')); return; }
    const chunks = [];
    let size = 0;
    let settled = false;
    const timer = setTimeout(() => finish(failure('Clipboard transfer timed out.', 'CLIPBOARD_TIMEOUT')), timeoutMs);
    function finish(error, text) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      child.stdout.destroy();
      if (error) child.kill('SIGKILL');
      chunks.length = 0;
      if (error) reject(error); else resolve(text);
    }
    child.on('error', () => finish(failure('Clipboard reader is unavailable.', 'CLIPBOARD_UNAVAILABLE')));
    child.stdout.on('error', () => finish(failure('Clipboard transfer failed.', 'CLIPBOARD_FAILED')));
    child.stdout.on('data', chunk => {
      if (settled) return;
      if (chunk.length > MAX_CLIPBOARD_BYTES - size) {
        finish(failure('Clipboard text exceeds 64 KiB.', 'CLIPBOARD_TOO_LARGE'));
        return;
      }
      chunks.push(chunk);
      size += chunk.length;
    });
    child.on('close', code => {
      if (settled) return;
      if (code !== 0) finish(failure('No clipboard text is available.', 'CLIPBOARD_FAILED'));
      else finish(null, Buffer.concat(chunks, size).toString('utf8'));
    });
  });
}

function failure(message, code) {
  return new ServiceError(message, { code, status: 422 });
}
