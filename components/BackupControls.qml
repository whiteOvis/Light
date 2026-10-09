import QtQuick
import Quickshell
import Quickshell.Io
import qs.Commons
import "I18n.js" as I18n

Column {
  id: root
  property var api: null
  property string appLanguage: "en-US"
  property bool radioOnly: false
  property bool busy: false
  property string message: ""
  property var pendingImport: null
  readonly property string defaultFilePath: "~/"
    + (radioOnly ? "light-radio-" : "light-data-")
    + new Date().toISOString().slice(0, 10) + ".md"
  signal restored()
  spacing: Style.spacing.controlGap

  function normalizedPath(path) {
    var value = String(path || "").trim()
    if (value.indexOf("~/") === 0) value = Quickshell.env("HOME") + value.slice(1)
    return decodeURIComponent(value.replace(/^file:\/\//, ""))
  }
  function markdownPath(path) {
    var value = normalizedPath(path)
    if (/\.md$/i.test(value)) return value
    return value.replace(/\.[^/.]+$/, "") + ".md"
  }
  function isMarkdownPath(path) {
    return /\.md$/i.test(normalizedPath(path))
  }
  function inline(value) {
    return String(value === undefined || value === null ? "" : value)
      .replace(/[\r\n]+/g, " ").replace(/\\/g, "\\\\").replace(/\|/g, "\\|")
  }
  function valueText(value) {
    return "`" + inline(typeof value === "string" ? value : JSON.stringify(value)) + "`"
  }
  function list(items, emptyText, render) {
    return !items || items.length === 0 ? "_" + emptyText + "_" : items.map(render).join("\n")
  }
  function restoreMetadata(data) {
    var encoded = JSON.stringify(data, null, 2).replace(/</g, "\\u003c").replace(/>/g, "\\u003e")
    return "<!-- light-backup-data -->\n```json\n" + encoded + "\n```"
  }
  function markdownDocument(data) {
    var created = data.createdAt ? new Date(data.createdAt).toLocaleString() : "Unknown"
    if (radioOnly) {
      return "# Light radio export\n\n"
        + "> Created " + created + ". This is a portable Markdown document; import it into Light by choosing this `.md` file.\n\n"
        + "## Overview\n\n| Data | Count |\n| --- | ---: |\n"
        + "| Custom stations | " + (data.stations || []).length + " |\n\n"
        + "## Custom stations\n\n"
        + list(data.stations, "No saved custom stations.", function(item) {
            return "### " + inline(item.name || "Unnamed station") + "\n\n"
              + "- **Stream:** " + valueText(item.streamUrl) + "\n"
              + (item.description ? "- **Description:** " + inline(item.description) + "\n" : "")
          }) + "\n\n"
        + "---\n\n## Technical restore data\n\n"
        + "The JSON below preserves exact values when this Markdown file is imported into Light.\n\n"
        + restoreMetadata(data) + "\n"
    }
    return "# Light data export\n\n"
      + "> Created " + created + ". This is a portable Markdown document; import it into Light by choosing this `.md` file.\n\n"
      + "## Overview\n\n| Data | Count |\n| --- | ---: |\n"
      + "| Bookmarks | " + (data.bookmarks || []).length + " |\n"
      + "| Notes | " + (data.notes || []).length + " |\n"
      + "| Recent passages | " + (data.history || []).length + " |\n\n"
      + "## Bookmarks\n\n" + list(data.bookmarks, "No saved bookmarks.", function(item) {
          return "- **" + inline(item.label || item.passage || "Bookmark") + "** — " + valueText(item.passage)
            + " (version " + valueText(item.version) + ")"
        }) + "\n\n"
      + "## Notes\n\n" + list(data.notes, "No saved notes.", function(item) {
          return "### " + inline(item.passage || "Note") + "\n\n"
            + "- **Version:** " + valueText(item.version) + "\n"
            + "- **Light note ID:** " + valueText(item.id) + "\n\n"
            + String(item.body || "")
        }) + "\n\n"
      + "## Recent passages\n\n" + list(data.history, "No recent passages.", function(item) {
          return "- " + inline(item.label || item.passage || "Passage") + " — " + valueText(item.passage)
            + " (version " + valueText(item.version) + ")"
        }) + "\n\n"
      + "---\n\n## Technical restore data\n\n"
      + "The JSON below preserves exact values when this Markdown file is imported into Light. It contains no account credentials.\n\n"
      + restoreMetadata(data) + "\n"
  }
  function markdownData(source) {
    var text = String(source || "").trim()
    var match = text.match(/<!--\s*light-backup-data\s*-->\s*\n```json\s*\n([\s\S]*?)\n```/)
    if (!match) throw new Error(I18n.t(appLanguage, "invalidBackup"))
    return JSON.parse(match[1])
  }
  function importFromPath(path) {
    if (!isMarkdownPath(path)) { message = I18n.t(appLanguage, "invalidBackup"); return }
    pendingImport = null
    busy = true
    if (inputFile.path === path) inputFile.reload()
    else inputFile.path = path
  }
  function exportToPath(path) {
    var destination = markdownPath(path)
    if (!api || !destination) { message = I18n.t(appLanguage, "fileWriteFailed"); return }
    filePath.text = destination
    outputFile.path = destination
    busy = true
    api.get(radioOnly ? "/v1/user-data/preferences/custom-radio-stations" : "/v1/study/backup",
            radioOnly ? "backup.radio-export" : "backup.export")
  }
  function loadImport() {
    try {
      var data = markdownData(inputFile.text())
      if (radioOnly ? data.format !== "light-radio" || data.version !== 1 || !(data.stations instanceof Array)
                    : data.format !== "light-backup" || data.version !== 2)
        throw new Error(I18n.t(appLanguage, "invalidBackup"))
      pendingImport = data
      message = I18n.t(appLanguage, radioOnly ? "radioImportReview" : "backupReview")
      busy = false
    } catch (error) { message = String(error); busy = false }
  }

  Row {
    spacing: Style.spacing.controlGap
    SettingsControlButton {
      text: I18n.t(root.appLanguage, "exportMarkdown")
      focusable: true
      enabled: !root.busy
      onClicked: root.exportToPath(filePath.text)
    }
    SettingsControlButton {
      text: I18n.t(root.appLanguage, "importMarkdown")
      focusable: true
      enabled: !root.busy
      onClicked: {
        var path = root.normalizedPath(filePath.text)
        if (!path) { root.message = I18n.t(root.appLanguage, "fileReadFailed"); return }
        root.importFromPath(path)
      }
    }
  }
  LightTextField {
    id: filePath
    width: parent.width
    // Paths need full ascender/descender room at every app scale. Give this
    // editable field extra vertical breathing room rather than relying only
    // on the generic compact control height.
    implicitHeight: Math.max(Style.spacing.controlHeight + Style.space(4),
                             fontSize + Style.spacing.controlPaddingY * 2 + Style.space(4))
    text: root.defaultFilePath
    placeholderText: I18n.t(root.appLanguage, "portableDataPath")
    fontSize: Style.font.bodySmall
  }
  Text {
    width: parent.width
    text: root.message || I18n.t(root.appLanguage, root.radioOnly ? "radioBackupHelp" : "backupHelp")
    textFormat: Text.PlainText
    color: LightPalette.muted
    wrapMode: Text.WordWrap
    font.family: Style.font.family
    font.pixelSize: Style.font.bodySmall
  }
  Row {
    visible: root.pendingImport !== null
    spacing: Style.spacing.controlGap
    SettingsControlButton {
      text: I18n.t(root.appLanguage, "restoreBackup")
      focusable: true
      enabled: !root.busy
      onClicked: {
        if (!root.api) return
        root.busy = true
        if (root.radioOnly)
          root.api.post("/v1/study/radio-import", root.pendingImport, "backup.radio-restore")
        else root.api.post("/v1/study/restore", root.pendingImport, "backup.restore")
      }
    }
    SettingsControlButton {
      text: I18n.t(root.appLanguage, "cancel")
      focusable: true
      enabled: !root.busy
      onClicked: { root.pendingImport = null; root.message = "" }
    }
  }
  FileView {
    id: inputFile
    preload: true
    printErrors: false
    onLoaded: root.loadImport()
    onLoadFailed: { root.busy = false; root.message = I18n.t(root.appLanguage, "fileReadFailed") }
  }
  FileView {
    id: outputFile
    preload: false
    printErrors: false
    atomicWrites: true
    onSaved: { root.busy = false; root.message = I18n.t(root.appLanguage, "fileSaved") + " " + path }
    onSaveFailed: { root.busy = false; root.message = I18n.t(root.appLanguage, "fileWriteFailed") }
  }
  Connections {
    target: root.api
    function onSucceeded(tag, payload, status) {
      if ((!root.radioOnly && tag === "backup.export") || (root.radioOnly && tag === "backup.radio-export")) {
        outputFile.setText(root.markdownDocument(root.radioOnly
          ? { format: "light-radio", version: 1, stations: payload.customRadioStations } : payload))
      } else if ((!root.radioOnly && tag === "backup.restore") || (root.radioOnly && tag === "backup.radio-restore")) {
        root.busy = false; root.pendingImport = null
        root.message = I18n.t(root.appLanguage, "backupRestored")
        root.restored()
      }
    }
    function onFailed(tag, message, status, payload) {
      if (String(tag).indexOf("backup.") === 0) { root.busy = false; root.message = message }
    }
  }
}
