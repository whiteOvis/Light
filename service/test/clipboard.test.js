import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import test from 'node:test';
import { MAX_CLIPBOARD_BYTES, readClipboard } from '../src/clipboard.js';

function producer(source, inspect = () => {}) {
  return (command, args, options) => {
    inspect(command, args, options);
    return spawn(process.execPath, ['-e', source], options);
  };
}

test('clipboard reads only an explicit text offer, with optional primary selection', async () => {
  assert.equal(await readClipboard({ primary: true, spawnImplementation: producer(
    'process.stdout.write("John 3:16 — שלום")', (command, args, options) => {
      assert.equal(command, 'wl-paste');
      assert.deepEqual(args, ['--no-newline', '--type', 'text', '--primary']);
      assert.equal(options.shell, undefined);
    }) }), 'John 3:16 — שלום');
});

test('clipboard accepts the exact byte cap and rejects oversized or continuous producers', async () => {
  const text = await readClipboard({ spawnImplementation: producer(`process.stdout.write(Buffer.alloc(${MAX_CLIPBOARD_BYTES}, 120))`) });
  assert.equal(text.length, MAX_CLIPBOARD_BYTES);
  for (const source of [
    `process.stdout.write(Buffer.alloc(${MAX_CLIPBOARD_BYTES + 1}, 120))`,
    'setInterval(() => process.stdout.write(Buffer.alloc(8192)), 1)',
  ]) {
    await assert.rejects(readClipboard({ spawnImplementation: producer(source) }), { code: 'CLIPBOARD_TOO_LARGE' });
  }
});

test('clipboard has an overall deadline for both idle and slow producers', async () => {
  for (const source of [
    'setInterval(() => {}, 10)',
    'setInterval(() => process.stdout.write("x"), 20)',
  ]) {
    const start = Date.now();
    await assert.rejects(readClipboard({ timeoutMs: 200, spawnImplementation: producer(source) }), { code: 'CLIPBOARD_TIMEOUT' });
    assert.ok(Date.now() - start < 2000);
  }
});

test('clipboard spawn and transfer failures reject without returning partial text', async () => {
  await assert.rejects(readClipboard({ spawnImplementation: () => { throw new Error('missing'); } }), { code: 'CLIPBOARD_UNAVAILABLE' });
  await assert.rejects(readClipboard({ spawnImplementation: () => spawn('/nonexistent/light-wl-paste') }), { code: 'CLIPBOARD_UNAVAILABLE' });
  await assert.rejects(readClipboard({ spawnImplementation: producer('process.stdout.write("partial"); process.exitCode = 1') }), { code: 'CLIPBOARD_FAILED' });
});
