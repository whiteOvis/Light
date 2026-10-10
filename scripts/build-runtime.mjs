// Build once for publication; end users never need npm or a compiler.
import { build } from '../service/node_modules/esbuild/lib/main.js';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
await build({
  absWorkingDir: root,
  entryPoints: { daemon: 'service/src/daemon.js', 'oauth-dispatch': 'service/src/oauth-dispatch.js' },
  outdir: 'service/dist', outExtension: { '.js': '.mjs' },
  bundle: true, platform: 'node', format: 'esm', target: 'node22',
  legalComments: 'eof', charset: 'utf8',
});
