// Exercise a clean release through real QML loading, without touching user state.
import { cpSync, mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawn } from 'node:child_process';
import { createServer, connect } from 'node:net';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const directory = mkdtempSync(join(tmpdir(), 'light-clean-qml-'));
const probe = createServer();
await new Promise(resolve => probe.listen(0, '127.0.0.1', resolve));
const port = probe.address().port;
await new Promise(resolve => probe.close(resolve));
const nativeAudio = process.argv.includes('--native-audio');
const wayland = Boolean(process.env.WAYLAND_DISPLAY);
try {
  cpSync(root, join(directory, 'plugin'), { recursive: true,
    filter: path => !/(?:\/node_modules|\/\.git)(?:\/|$)/.test(path) && (nativeAudio || !path.endsWith('.so')) });
  const shell = join(process.env.OMARCHY_PATH || '/usr/share/omarchy', 'shell');
  for (const name of ['Commons', 'Ui']) symlinkSync(join(shell, name), join(directory, name));
  mkdirSync(join(directory, 'runtime'), { mode: 0o700 });
  // A silent WAV exercises actual Qt decoding/playback, with volume forced to 0.
  const wav = Buffer.alloc(44 + 88200);
  wav.write('RIFF'); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8);
  wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(44100, 24); wav.writeUInt32LE(88200, 28); wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(88200, 40);
  const sample = join(directory, 'silence.wav');
  writeFileSync(sample, wav);
  writeFileSync(join(directory, 'shell.qml'), `import QtQuick
import Quickshell
import "plugin"
ShellRoot {
  property var radio: null
  FloatingWindow {
    visible: false
    Loader { id: widget; source: "plugin/${wayland ? 'BarWidget' : 'BackendRuntime'}.qml" }
    Loader { id: secondWidget; source: ${wayland ? '"plugin/BarWidget.qml"' : '""'} }
    Loader { id: basicRadio }
  }
  Timer { interval: 100; repeat: true; running: true
    onTriggered: {
      var backend = ${wayland ? 'LightSession.backend' : 'widget.item'}
      if (backend && backend.ready) {
        if (backend.nativeAudioAvailable !== ${nativeAudio}) throw new Error("Unexpected native audio availability")
        console.log("LIGHT_QML_READY")
        ${wayland ? `if (!LightSession.panel) throw new Error("Panel failed to load")
        LightSession.panel.musicPlayerEnabled = true
        LightSession.panel.radioPlayerLoaded = true` : 'basicRadio.source = "plugin/components/RadioPlayer.qml"'}
        radioCheck.start()
        stop()
      }
    }
  }
  Timer { id: radioCheck; interval: 1200; onTriggered: {
    radio = ${wayland ? 'LightSession.panel.radioPlayer' : 'basicRadio.item'}
    if (!radio) throw new Error("Radio failed without native audio")
    ${nativeAudio ? `var tap = radio.children.find(function(child) { return child.objectName === "radioAudioTap" })
    if (!tap || !tap.available) throw new Error("Native audio enhancement failed to load")` : ''}
    radio.volume = 0
    radio.audioSourcePlayer.source = ${JSON.stringify(pathToFileURL(sample).href)}
    radio.audioSourcePlayer.play()
    playbackCheck.start()
  } }
  Timer { id: playbackCheck; interval: 700; onTriggered: {
    if (radio.audioSourcePlayer.duration <= 0) throw new Error("Qt could not decode the radio test sample")
    console.log("LIGHT_RADIO_DECODED")
    radio.audioSourcePlayer.stop()
    widget.active = false
    lastWidgetCheck.start()
  } }
  Timer { id: lastWidgetCheck; interval: 300; onTriggered: {
    ${wayland ? 'if (!LightSession.backend || !LightSession.backend.ready || LightSession.widgets.length !== 1) throw new Error("Backend stopped before the last monitor widget unloaded")' : ''}
    secondWidget.active = false
    basicRadio.active = false
    done.start()
  } }
  Timer { id: done; interval: 1000; onTriggered: {
    console.log("LIGHT_QML_STOPPED")
    Qt.quit()
  } }
  Timer { interval: 14000; running: true; onTriggered: Qt.quit() }
}`);
  const output = await new Promise((resolve, reject) => {
    const child = spawn('quickshell', ['-p', join(directory, 'shell.qml')], {
      env: { ...process.env, HOME: directory, XDG_CONFIG_HOME: join(directory, 'config'),
        XDG_DATA_HOME: join(directory, 'data'), LIGHT_CONFIG_DIR: join(directory, 'state'),
        LIGHT_PORT: String(port), LIGHT_HOST: '127.0.0.1', HYPRLAND_INSTANCE_SIGNATURE: '',
        QT_QPA_PLATFORM: wayland ? 'wayland' : 'offscreen', QT_QPA_PLATFORMTHEME: 'none',
        QT_STYLE_OVERRIDE: 'Fusion', GSETTINGS_BACKEND: 'memory',
        XDG_RUNTIME_DIR: wayland ? process.env.XDG_RUNTIME_DIR : join(directory, 'runtime'),
      },
    });
    let logs = '';
    const timeout = setTimeout(() => { child.kill(); reject(new Error(`QML runtime timed out:\n${logs}`)); }, 20000);
    child.stdout.on('data', chunk => { logs += chunk; });
    child.stderr.on('data', chunk => { logs += chunk; });
    child.once('error', error => { clearTimeout(timeout); reject(error); });
    child.once('close', () => { clearTimeout(timeout); resolve(logs); });
  });
  if (!['LIGHT_QML_READY', 'LIGHT_RADIO_DECODED', 'LIGHT_QML_STOPPED'].every(marker => output.includes(marker))
      || /ReferenceError|TypeError|Binding loop|Error loading|Unable to create|Cannot assign|is not a type/.test(output))
    throw new Error(`Clean QML release failed:\n${output}`);
  await new Promise((resolve, reject) => {
    const socket = connect(port, '127.0.0.1');
    socket.once('connect', () => { socket.destroy(); reject(new Error('Backend survived plugin disable')); });
    socket.once('error', error => error.code === 'ECONNREFUSED' ? resolve() : reject(error));
  });
  console.log(`Clean QML release: startup, ${wayland ? 'full widget, ' : ''}${nativeAudio ? 'optional native audio' : 'native-free audio'} playback, and shutdown passed.`);
} finally {
  rmSync(directory, { recursive: true, force: true });
}
