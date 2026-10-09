import QtQuick
import Quickshell
import Quickshell.Io
import "I18n.js" as I18n

// Serialized loopback HTTP client. Direct argv execution keeps request data
// out of shell parsing while a queue prevents overlapping Process output.
Item {
  id: root

  property string baseUrl: "http://127.0.0.1:8788"
  property string appLanguage: "en-US"
  property var queue: []
  property var activeRequest: null
  property string responseText: ""
  property string errorText: ""
  readonly property bool busy: activeRequest !== null || queue.length > 0 || requestProcess.running

  signal succeeded(string tag, var payload, int status)
  signal failed(string tag, string message, int status, var payload)

  function request(method, path, body, tag) {
    queue = queue.concat([{
      method: String(method || "GET").toUpperCase(),
      path: String(path || "/"),
      body: body === undefined ? null : body,
      tag: String(tag || path || "request")
    }])
    pump()
  }

  function get(path, tag) { request("GET", path, null, tag) }
  // Only discard queued reads; mutations must retain their original order.
  function cancelQueued(prefix) {
    queue = queue.filter(function(entry) {
      return entry.method !== "GET" || entry.tag.indexOf(prefix) !== 0
    })
  }
  function cancelReads(prefix) {
    cancelQueued(prefix)
    if (activeRequest && activeRequest.method === "GET"
        && activeRequest.tag.indexOf(prefix) === 0 && requestProcess.running)
      requestProcess.running = false
  }
  function post(path, body, tag) { request("POST", path, body || {}, tag) }
  function put(path, body, tag) { request("PUT", path, body || {}, tag) }
  function remove(path, tag) { request("DELETE", path, null, tag) }

  function pump() {
    if (requestProcess.running || activeRequest !== null || queue.length === 0) return
    activeRequest = queue[0]
    queue = queue.slice(1)
    responseText = ""
    errorText = ""

    // Never send the local credential to a configurable remote service.
    if (!/^http:\/\/(127\.0\.0\.1|localhost|\[::1\])(?::[0-9]+)?\/?$/.test(baseUrl)) {
      errorText = "Light requires a loopback service URL."
      finish(-1)
      return
    }
    var configDir = Quickshell.env("LIGHT_CONFIG_DIR")
      || ((Quickshell.env("XDG_CONFIG_HOME") || (Quickshell.env("HOME") + "/.config")) + "/omarchy/light-public")
    var command = [
      "curl", "-sS", "--max-time", "30", "--fail-with-body",
      "-w", "\n%{http_code}", "-X", activeRequest.method,
      "-H", "Accept: application/json",
      "-H", "@" + configDir + "/client-auth-header"
    ]
    if (activeRequest.body !== null) {
      command = command.concat([
        "-H", "Content-Type: application/json",
        "--data-binary", "@-"
      ])
    }
    command.push(baseUrl.replace(/\/$/, "") + activeRequest.path)
    requestProcess.command = command
    requestProcess.stdinEnabled = true
    requestProcess.running = true
    requestWatchdog.restart()
  }

  function finish(exitCode) {
    var request = activeRequest
    if (!request) return
    requestWatchdog.stop()

    var raw = String(responseText || "")
    var separator = raw.lastIndexOf("\n")
    var status = separator >= 0 ? Number(raw.slice(separator + 1).trim()) : 0
    var bodyText = separator >= 0 ? raw.slice(0, separator) : raw
    var payload = null
    if (bodyText.trim() !== "") {
      try { payload = JSON.parse(bodyText) }
      catch (error) {
        activeRequest = null
        failed(request.tag, I18n.t(root.appLanguage, "invalidJson"), status, null)
        Qt.callLater(pump)
        return
      }
    }

    activeRequest = null
    if (exitCode === 0 && status >= 200 && status < 300) {
      succeeded(request.tag, payload, status)
    } else {
      var message = payload && payload.error && payload.error.message
        ? String(payload.error.message)
        : String(errorText || I18n.t(root.appLanguage, "serviceUnreachable")).trim()
      failed(request.tag, message, status, payload)
    }
    Qt.callLater(pump)
  }

  Process {
    id: requestProcess

    stdinEnabled: true
    onStarted: {
      if (root.activeRequest && root.activeRequest.body !== null)
        write(JSON.stringify(root.activeRequest.body))
      stdinEnabled = false
    }

    stdout: StdioCollector {
      waitForEnd: true
      onStreamFinished: root.responseText = text
    }
    stderr: StdioCollector {
      waitForEnd: true
      onStreamFinished: root.errorText = text
    }
    // Quickshell's installed qmltypes omit QProcess::ExitStatus. The handler
    // uses only the documented integer exitCode, never that enum parameter.
    // qmllint disable signal-handler-parameters
    onExited: function(exitCode) {
      // Let both waitForEnd collectors publish their final text first.
      Qt.callLater(function() { root.finish(exitCode) })
    }
    // qmllint enable signal-handler-parameters
  }

  Timer {
    id: requestWatchdog
    // curl normally exits within 30 seconds. Also recover if an updated or
    // missing executable fails to start without emitting Process.exited.
    interval: 35000
    onTriggered: {
      root.errorText = I18n.t(root.appLanguage, "serviceUnreachable")
      if (requestProcess.running) {
        // Let onExited finish this request before starting another process.
        requestProcess.running = false
        restart()
      } else {
        root.finish(-1)
      }
    }
  }
}
