#!/usr/bin/env node
// Offline validation against installed Omarchy/Quickshell. Native audio is optional.
import { spawn, spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const shell = join(process.env.OMARCHY_PATH || '/usr/share/omarchy', 'shell');
const packagedLayout = existsSync(join(root, 'manifest.json'));
const pluginDir = packagedLayout ? '.' : 'plugin/light';
const qmlDirs = [pluginDir, join(pluginDir, 'components')];
const qmlFiles = qmlDirs.flatMap((dir) => readdirSync(join(root, dir))
  .filter((file) => file.endsWith('.qml')).map((file) => join(root, dir, file)));
const staging = mkdtempSync(join(tmpdir(), 'light-validation-'));
mkdirSync(join(staging, 'runtime'), { mode: 0o700 });

function run(command, args) {
  const result = spawnSync(command, args, { cwd: root, encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`${command} failed: ${result.error || result.stderr || result.stdout}`);
  return result.stdout;
}

function declaredThemeToken(source, warning) {
  if (warning.id !== 'missing-property') return false;
  const line = source.split('\n')[warning.line - 1];
  const access = line.slice(0, warning.column - 1).match(/\b(Color|Style)\.(\w+)\.$/);
  if (!access) return false;
  const token = line.slice(warning.column - 1).match(/^\w+/)?.[0];
  const theme = readFileSync(join(shell, 'Commons', `${access[1]}.qml`), 'utf8');
  const group = theme.match(new RegExp(`property QtObject ${access[2]}: QtObject \\{([^]*?)\\n  }`));
  // Never silence misspellings or removed tokens. Only QtObject metadata's
  // inability to expose a member that still exists in the installed source.
  return !!group && new RegExp(`\\bproperty \\w+ ${token}:`).test(group[1]);
}

async function qmlTest(file) {
  const config = `import QtQuick
import Quickshell
ShellRoot {
  FloatingWindow {
    visible: true
    implicitWidth: 1000
    implicitHeight: 800
    Loader { id: testLoader; source: ${JSON.stringify(pathToFileURL(file).href)} }
    Timer { interval: 250; running: true; onTriggered: if (testLoader.item) testLoader.item.windowShown = true }
    Connections {
      target: testLoader.item
      function onCompletedChanged() {
        if (testLoader.item.completed)
          console.log("LIGHT_TEST_RESULT " + JSON.stringify({passes: testLoader.item.qtest_results.passCount, failures: testLoader.item.qtest_results.failCount}))
      }
    }
  }
}`;
  writeFileSync(join(staging, 'shell.qml'), config);
  const output = await new Promise((resolvePromise, reject) => {
    const child = spawn('quickshell', ['-p', join(staging, 'shell.qml')], {
      env: { ...process.env, QT_QPA_PLATFORM: 'offscreen', QT_QPA_PLATFORMTHEME: 'none', QT_STYLE_OVERRIDE: 'Fusion', XDG_RUNTIME_DIR: join(staging, 'runtime'), GSETTINGS_BACKEND: 'memory' }, cwd: root,
    });
    let output = '';
    const timeout = setTimeout(() => { child.kill('SIGTERM'); reject(new Error(`QML test timed out: ${file}\n${output}`)); }, 15000);
    const collect = (chunk) => {
      output += chunk;
      if (/LIGHT_TEST_RESULT \{[^\n]*\}/.test(output)) child.kill('SIGTERM');
    };
    child.stdout.on('data', collect);
    child.stderr.on('data', collect);
    child.on('error', (error) => { clearTimeout(timeout); reject(error); });
    child.on('close', () => { clearTimeout(timeout); resolvePromise(output); });
  });
  const marker = output.match(/LIGHT_TEST_RESULT (\{[^\n]*\})/);
  if (!marker || JSON.parse(marker[1]).failures > 0
      || /ReferenceError|TypeError|Unable to assign|Cannot assign|Binding loop|Error loading|Failed to load/i.test(output))
    throw new Error(`QML test failed: ${file}\n${output}`);
  console.log(`${file.slice(root.length + 1)}: ${marker[1]}`);
}

try {
  if (process.argv.includes('--native-audio'))
    console.log(run('bash', [join(root, pluginDir, 'components/LightAudio/build.sh')]));
  console.log(`Omarchy ${run('omarchy', ['version']).trim()}`);
  console.log(run('quickshell', ['--version']).trim());
  for (const file of readdirSync(join(root, 'service/src')).filter((file) => file.endsWith('.js')))
    run(process.execPath, ['--check', join(root, 'service/src', file)]);
  const shellScripts = [
    packagedLayout ? 'install.sh' : 'plugin/install.sh',
    packagedLayout ? 'uninstall.sh' : 'plugin/uninstall.sh',
    'scripts/create-public-copy.sh',
    'service/start.sh',
  ].filter((file) => existsSync(join(root, file)));
  run('bash', ['-n', ...shellScripts]);
  const serviceDependenciesReady = existsSync(join(root, 'service/node_modules/@youversion/platform-core'));
  const testDirectories = packagedLayout && !serviceDependenciesReady
    ? ['test']
    : ['service/test', 'plugin/test', 'test'];
  const tests = testDirectories.filter((dir) => existsSync(join(root, dir)))
    .flatMap((dir) => readdirSync(join(root, dir))
    .filter((file) => /\.test\.(?:js|mjs)$/.test(file)).map((file) => join(root, dir, file)));
  if (tests.length > 0) console.log(run(process.execPath, ['--test', ...tests]));
  const release = join(staging, 'release');
  cpSync(join(root, pluginDir), release, { recursive: true,
    filter: path => !/(?:\/node_modules|\/\.git)(?:\/|$)/.test(path) });
  run('omarchy', ['plugin', 'validate', release]);
  const report = join(staging, 'lint.json');
  const lint = spawnSync(process.env.QMLLINT || '/usr/lib/qt6/bin/qmllint', [
    '-W', '0', '--json', report, '-i', join(shell, 'Commons/qmldir'),
    '-i', join(shell, 'Ui/qmldir'), ...qmlFiles,
  ], { cwd: root, encoding: 'utf8' });
  if (lint.error) throw lint.error;
  const diagnostics = JSON.parse(readFileSync(report, 'utf8'));
  let verifiedThemeDiagnostics = 0;
  let unexpected = 0;
  for (const file of diagnostics.files) {
    const source = readFileSync(file.filename, 'utf8');
    for (const warning of file.warnings) {
      if (warning.type === 'info') continue;
      if (declaredThemeToken(source, warning)) { verifiedThemeDiagnostics++; continue; }
      console.error(`${file.filename}:${warning.line}: ${warning.id}: ${warning.message}`);
      unexpected++;
    }
  }
  if (unexpected || diagnostics.files.length !== qmlFiles.length) throw new Error('QML validation failed');
  console.log(`QML: 0 unverified warnings; ${verifiedThemeDiagnostics} installed theme members verified (QtObject metadata limitation).`);
  if (!process.argv.includes('--static-only')) {
    console.log(run(process.execPath, ['scripts/validate-qml-runtime.mjs',
      ...(process.argv.includes('--native-audio') ? ['--native-audio'] : [])]));
    symlinkSync(join(shell, 'Commons'), join(staging, 'Commons'));
    symlinkSync(join(shell, 'Ui'), join(staging, 'Ui'));
    const testDir = join(root, pluginDir, 'components/tests');
    if (existsSync(testDir)) {
      for (const file of readdirSync(testDir).filter((file) => /^tst_.*\.qml$/.test(file)))
        await qmlTest(join(testDir, file));
    }
  }
  console.log('Light validation passed.');
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  rmSync(staging, { recursive: true, force: true });
}
