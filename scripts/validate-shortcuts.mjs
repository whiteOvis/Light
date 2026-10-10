// Real Qt key events against the production shortcut declarations. Only the
// layer-shell window and HTTP transport are replaced for isolated offscreen QA.
import { cpSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync, symlinkSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { DEFAULT_KEYBINDINGS } from '../service/src/user-data-manager.js';
const root = resolve(import.meta.dirname, '..');
const stage = mkdtempSync(join(tmpdir(), 'light-shortcuts-'));
const shell = join(process.env.OMARCHY_PATH || '/usr/share/omarchy', 'shell');
try {
  cpSync(root, join(stage, 'plugin'), { recursive: true, filter: p => !/(?:\/node_modules|\/\.git)(?:\/|$)/.test(p) && !p.endsWith('.so') });
  for (const name of ['Commons', 'Ui']) symlinkSync(join(shell, name), join(stage, name));
  mkdirSync(join(stage, 'runtime'), {mode: 0o700});
  writeFileSync(join(stage, 'plugin/TestKeyboardPanel.qml'), `import QtQuick
Item {
  property var anchorItem; property var owner; property var bar
  property int padding: 0; property bool open: false
  property var focusTarget; property real contentWidth: 0; property real contentHeight: 0
  width: contentWidth; height: contentHeight; visible: open
  function fittedContentWidth(v) { return v }
  function fittedContentHeight(v, cap) { return Math.min(v, cap) }
}`);
  writeFileSync(join(stage, 'plugin/components/LightApi.qml'), `import QtQuick
QtObject {
  property string baseUrl: "http://127.0.0.1:1"; property string appLanguage
  signal succeeded(string tag, var payload, int status)
  signal failed(string tag, string message, int status, var payload)
  function get(path, tag) {} function post(path, body, tag) {}
  function put(path, body, tag) {} function remove(path, tag) {}
  function cancelReads(prefix) {} function cancelQueued(prefix) {}
}`);
  writeFileSync(join(stage, 'plugin/qmldir'), readFileSync(join(stage, 'plugin/qmldir'), 'utf8') + '\nTestKeyboardPanel 1.0 TestKeyboardPanel.qml\n');
  let panel = readFileSync(join(root, 'Panel.qml'), 'utf8').replace('KeyboardPanel {', 'TestKeyboardPanel {');
  // Observe real activation without altering key sequences, guards, or actions.
  panel = panel.replace('  id: root', '  id: root\n  signal shortcutDispatched(string name)');
  panel = panel.replace(/Shortcut \{([\s\S]*?)onActivated: /g, (whole, body) => {
    const name = body.match(/keybindings\.(\w+)/)?.[1];
    return name ? whole + `root.shortcutDispatched(${JSON.stringify(name)}); ` : whole;
  });
  // QML single-expression handlers need a block; existing block handlers need
  // the observation inside the opening brace, not before it.
  panel = panel.replace(/onActivated: root.shortcutDispatched\(([^\n]+?)\); \{/g, 'onActivated: { root.shortcutDispatched($1);');
  panel = panel.replace(/onActivated: root.shortcutDispatched\(([^\n]+?)\); ([^\n]+)/g, 'onActivated: { root.shortcutDispatched($1); $2 }');
  writeFileSync(join(stage, 'plugin/Panel.qml'), panel);
  const wav = Buffer.alloc(44 + 88200);
  wav.write('RIFF'); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8);
  wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(44100, 24); wav.writeUInt32LE(88200, 28); wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(88200, 40);
  writeFileSync(join(stage, 'silence.wav'), wav);
  const stationsPath = join(stage, 'plugin/components/RadioStations.js');
  writeFileSync(stationsPath, readFileSync(stationsPath, 'utf8').replace(/streamUrl: "[^"]+"/g, 'streamUrl: "file://' + join(stage, 'silence.wav') + '"'));
  const defaults = JSON.stringify(DEFAULT_KEYBINDINGS);
  const fixture = readFileSync(join(root, 'test/qml/shortcuts.qml'), 'utf8').replace('/*DEFAULTS*/',defaults);
  writeFileSync(join(stage, 'shortcuts.qml'),fixture);
  writeFileSync(join(stage, 'shell.qml'), `import QtQuick
import Quickshell
ShellRoot {
 FloatingWindow { visible: true; implicitWidth: 1100; implicitHeight: 1000
  Loader { id: test; source: "shortcuts.qml" }
  Timer { interval: 200; running: true; onTriggered: test.item.windowShown = true }
  Connections { target: test.item
   function onCompletedChanged() { if (test.item.completed) {
    console.log("LIGHT_SHORTCUT_RESULT " + JSON.stringify({passes: test.item.qtest_results.passCount, failures: test.item.qtest_results.failCount})); Qt.quit()
   } }
  }
 }
}`);
  const output = await new Promise((resolvePromise,reject) => {
    const child=spawn('quickshell',['-p',join(stage,'shell.qml')],{env:{...process.env,HOME:stage,XDG_CONFIG_HOME:join(stage,'config'),XDG_DATA_HOME:join(stage,'data'),LIGHT_CONFIG_DIR:join(stage,'state'),HYPRLAND_INSTANCE_SIGNATURE:'',QT_QPA_PLATFORM:'offscreen',QT_QPA_PLATFORMTHEME:'none',QT_STYLE_OVERRIDE:'Fusion',XDG_RUNTIME_DIR:join(stage,'runtime'),GSETTINGS_BACKEND:'memory'}});
    let logs='';const timer=setTimeout(()=>{child.kill();reject(new Error('Shortcut test timed out:\n'+logs));},60000);
    child.stdout.on('data', c=>logs+=c);child.stderr.on('data', c=>logs+=c);
    child.on('error',reject);child.on('close',()=>{clearTimeout(timer);resolvePromise(logs);});
  });
  const result=output.match(/LIGHT_SHORTCUT_RESULT (\{[^\n]+\})/);
  if(!result || JSON.parse(result[1]).failures || /ReferenceError|TypeError|Cannot assign|Binding loop|is not a type/.test(output)) throw new Error(output);
  console.log('Qt keyboard shortcut checks:',result[1]);
} finally { rmSync(stage,{recursive:true,force:true}); }
