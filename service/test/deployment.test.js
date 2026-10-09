import test from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

test('install, reinstall and uninstall isolate Light and preserve LHT', context => {
  const directory = mkdtempSync(join(tmpdir(), 'light-deployment-'));
  context.after(() => rmSync(directory, { recursive: true, force: true }));
  const source = join(directory, 'checkout');
  cpSync(fileURLToPath(new URL('../../', import.meta.url)), source, { recursive: true,
    filter: path => !/\/(?:node_modules|\.git)(?:\/|$)/.test(path) });
  writeFileSync(join(source, 'components/LightAudio/liblightaudio.so'), 'test fixture');
  const config = join(directory, 'config');
  const data = join(directory, 'data');
  const bin = join(directory, 'bin');
  for (const part of [bin, join(config, 'hypr'), join(config, 'systemd/user'), join(data, 'applications')])
    mkdirSync(part, { recursive: true });
  const bindings = '-- Light global shortcut\no.bind("SUPER + B", "Light", "omarchy-shell shell toggle local.light \'{}\'")\n-- End Light global shortcut\n';
  const bindingsPath = join(config, 'hypr/bindings.lua');
  writeFileSync(bindingsPath, bindings);
  const lhtService = join(config, 'systemd/user/omarchy-light.service');
  writeFileSync(lhtService, 'LHT untouched');
  const handler = join(directory, 'handler');
  writeFileSync(handler, 'lht.desktop\n');
  const commandLog = join(directory, 'commands');
  const shellQuote = text => "'" + text.replaceAll("'", "'\\''") + "'";
  const mock = (name, body) => writeFileSync(join(bin, name), '#!/bin/bash\nset -e\n' + body + '\n', { mode: 0o755 });
  mock('node', `if [[ "$1" == */scripts/validate.mjs ]]; then exit 0; fi\nexec ${shellQuote(process.execPath)} "$@"`);
  mock('xdg-mime', 'if [[ "$1" == query ]]; then cat "$LIGHT_TEST_HANDLER"; else echo "$2" > "$LIGHT_TEST_HANDLER"; fi');
  for (const name of ['systemctl', 'omarchy']) mock(name, `echo ${name} "$@" >> "$LIGHT_TEST_COMMANDS"`);
  mock('omarchy-shell', `echo omarchy-shell \"$@\" >> \"$LIGHT_TEST_COMMANDS\"\nif [[ \"$2\" == listPlugins ]]; then echo '[{\"id\":\"light.bible-reader\"}]'; fi`);
  for (const name of ['hyprctl', 'update-desktop-database', 'curl', 'wl-copy', 'gio', 'xdg-open', 'quickshell']) mock(name, 'exit 0');
  const env = { ...process.env, HOME: directory, XDG_CONFIG_HOME: config, XDG_DATA_HOME: data,
    PATH: `${bin}:${process.env.PATH}`, LIGHT_TEST_HANDLER: handler, LIGHT_TEST_COMMANDS: commandLog };
  const install = () => execFileSync('bash', [join(source, 'install.sh')], { env });
  install();
  assert.equal(readFileSync(lhtService, 'utf8'), 'LHT untouched');
  assert.equal(readFileSync(bindingsPath, 'utf8').includes(bindings.trim()), true);
  const afterFirst = readFileSync(bindingsPath, 'utf8');
  assert.match(readFileSync(join(config, 'systemd/user/omarchy-light-public.service'), 'utf8'), /LIGHT_PORT=8788/);
  const saved = join(config, 'omarchy/light-public/oauth-fallback.json');
  assert.equal(JSON.parse(readFileSync(saved)).desktop, 'lht.desktop');
  assert.match(readFileSync(commandLog, 'utf8'), /omarchy plugin enable light.bible-reader/);
  install();
  assert.equal(JSON.parse(readFileSync(saved)).desktop, 'lht.desktop');
  assert.equal(readFileSync(bindingsPath, 'utf8'), afterFirst);
  execFileSync('bash', [join(source, 'uninstall.sh')], { env });
  assert.equal(readFileSync(lhtService, 'utf8'), 'LHT untouched');
  assert.equal(readFileSync(bindingsPath, 'utf8'), bindings);
  assert.equal(readFileSync(handler, 'utf8').trim(), 'lht.desktop');
  assert.equal(existsSync(join(config, 'systemd/user/omarchy-light-public.service')), false);
  assert.doesNotMatch(readFileSync(commandLog, 'utf8'), /systemctl .* omarchy-light\.service/);
});
