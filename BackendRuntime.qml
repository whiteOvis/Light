import QtQuick
import Quickshell
import Quickshell.Io

// One shell-owned backend for all monitors. Its stdin closes on shell exit;
// stopping this component also terminates it on disable or plugin reload.
Scope {
  id: root
  readonly property string host: Quickshell.env("LIGHT_HOST") || "127.0.0.1"
  readonly property string baseUrl: "http://" + (host === "::1" ? "[::1]" : host)
    + ":" + (Quickshell.env("LIGHT_PORT") || "8788")
  property bool ready: false
  property bool nativeAudioAvailable: false
  property url nativeAudioUrl: ""
  property string error: ""
  property int attempts: 0
  readonly property string runtimePath: decodeURIComponent(Qt.resolvedUrl("service/start.sh").toString().slice(7))

  function start() {
    ready = false
    error = ""
    attempts++
    backend.running = true
    startupTimeout.restart()
  }
  Component.onCompleted: start()
  Component.onDestruction: {
    restartTimer.stop()
    backend.running = false
  }
  Process {
    id: backend
    command: ["bash", root.runtimePath]
    stdinEnabled: true
    stdout: SplitParser {
      onRead: function(line) {
        if (line === "LIGHT_RESTARTING") root.ready = false
        if (line.indexOf("LIGHT_READY ") === 0) {
          var state = JSON.parse(line.slice(12))
          root.nativeAudioAvailable = Boolean(state.nativeAudioAvailable)
          root.nativeAudioUrl = state.nativeAudioUrl || ""
          root.ready = true
          root.error = ""
          stableTimer.restart()
          startupTimeout.stop()
        }
      }
    }
    stderr: SplitParser {
      onRead: function(line) {
        if (line.indexOf("ERROR:") === 0 || line.indexOf("EADDRINUSE") >= 0)
          root.error = line
      }
    }
    // Quickshell omits QProcess::ExitStatus from its tooling metadata.
    // qmllint disable signal-handler-parameters
    onExited: function(exitCode) {
      root.ready = false
      stableTimer.stop()
      startupTimeout.stop()
      if (!root.error) root.error = "Light's background process stopped."
      if (root.attempts < 3) restartTimer.restart()
    }
    // qmllint enable signal-handler-parameters
  }
  Timer {
    id: startupTimeout
    interval: 10000
    onTriggered: {
      root.error = "Light could not start. Check that Node.js 22.13 or newer is available."
      if (backend.running) backend.running = false
      else if (root.attempts < 3) restartTimer.restart()
    }
  }
  Timer { id: stableTimer; interval: 30000; onTriggered: root.attempts = 0 }
  Timer { id: restartTimer; interval: 1500; onTriggered: root.start() }
}
