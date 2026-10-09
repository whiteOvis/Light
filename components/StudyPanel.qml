pragma ComponentBehavior: Bound
import QtQuick
import QtQuick.Controls as QQC
import qs.Commons
import "I18n.js" as I18n
import "PassageFormat.js" as PassageFormat

FocusScope {
  id: root
  property var api: null
  property bool opened: false
  property string mode: "library"
  property string appLanguage: "en-US"
  property real appScale: 1.2
  property real readerTextPixelSize: Style.font.body + Style.space(4)
  property string readerFontStyle: "youversion"
  property bool redLetters: false
  property real defaultHighlightOpacity: 0.45
  property var highlights: []
  property var reference: ({})
  property string versionLabel: ""
  property var versions: []
  property var entries: []
  property var history: []
  property string message: ""
  property string originalComparison: ""
  property int originalRevision: 0
  property string comparison: ""
  property string comparisonCopyright: ""
  property string comparisonVersion: ""
  property int comparisonRevision: 0
  property bool loading: false
  property bool saving: false
  property var noteDrafts: ({})
  property string noteDraftKey: ""
  property string pendingNoteKey: ""
  property string pendingNoteBody: ""
  property var entryPreviewRequests: ({})
  property var expandedEntryKeys: ({})
  property var collapsedDefaultEntryKeys: ({})
  readonly property int expandedHighlightCount: 7
  readonly property var visibleEntries: (mode === "history" ? history : entries).filter(function(item) {
    var query = search.text.trim().toLowerCase()
    return !query || (String(item.label || item.passage) + " " + String(item.preview || "") + " " + root.labelForVersion(item.version)).toLowerCase().indexOf(query) >= 0
  })
  signal closeRequested()
  signal passageRequested(var reference)
  visible: opened
  z: 500
  LightTypography { id: typography; appScale: root.appScale }
  readonly property string readerFontFamily: readerFontStyle === "system"
    ? Style.font.family : "Source Serif 4"
  readonly property bool darkReaderTheme: (
    LightPalette.popupBackground.r * 0.2126
    + LightPalette.popupBackground.g * 0.7152
    + LightPalette.popupBackground.b * 0.0722
  ) < 0.5
  readonly property string redLetterColor: LightPalette.nightMode ? String(LightPalette.bibleText)
    : darkReaderTheme ? "#e4bfc2" : "#94000c"
  function labelForVersion(version) {
    for (var i = 0; i < versions.length; i++)
      if (String(versions[i].value) === String(version)) return versions[i].label
    return String(version)
  }
  function open(page) {
    mode = page
    noteDraftKey = String(reference.version) + ":" + String(reference.passage)
    noteInput.text = String(noteDrafts[noteDraftKey] || "")
    opened = true
    message = ""
    comparison = ""
    comparisonCopyright = ""
    originalComparison = ""
    originalRevision++
    comparisonRevision++
    loading = false
    search.text = ""
    if (api && page === "compare" && reference.passage)
      api.get("/v1/passage?version=" + encodeURIComponent(reference.version)
        + "&usfm=" + encodeURIComponent(reference.passage)
        + "&format=html&include_headings=false&include_notes=false&mode=auto",
        "study.original:" + originalRevision)
    if (api) api.get("/v1/study/library", "study.library")
    Qt.callLater(function() { closeButton.forceActiveFocus() })
  }
  function compare(version) {
    if (!api || !reference.passage) return
    comparisonRevision++
    comparison = ""
    comparisonCopyright = ""
    comparisonVersion = labelForVersion(version)
    for (var i = 0; i < versions.length; i++)
      if (String(versions[i].value) === String(version))
        comparisonCopyright = String(versions[i].copyright || "")
    message = ""
    loading = true
    api.get("/v1/passage?version=" + encodeURIComponent(version)
      + "&usfm=" + encodeURIComponent(reference.passage)
      + "&format=html&include_headings=false&include_notes=false&mode=auto",
      "study.compare:" + comparisonRevision)
  }
  function saveBookmark() {
    if (!api || !reference.passage || saving) return
    saving = true
    api.post("/v1/study/bookmarks", reference, "study.bookmark")
  }
  function saveNote() {
    if (!api || !reference.passage || !noteInput.text.trim() || saving) return
    saving = true
    pendingNoteKey = noteDraftKey
    pendingNoteBody = noteInput.text
    api.post("/v1/user-data/notes", {
      version: reference.version, passage: reference.passage, body: noteInput.text
    }, "study.note")
  }
  function entryPreviewTag(item) {
    return "study.entry-preview:" + String(item.version) + ":" + String(item.passage)
  }
  function entryKey(item) {
    return String(item.version) + ":" + String(item.passage)
  }
  function entryExpanded(item) {
    return !!expandedEntryKeys[entryKey(item)]
  }
  function defaultEntryCollapsed(item) {
    return !!collapsedDefaultEntryKeys[entryKey(item)]
  }
  function toggleDefaultEntry(item) {
    if (!item) return
    var key = entryKey(item)
    var collapsed = Object.assign({}, collapsedDefaultEntryKeys)
    if (collapsed[key]) delete collapsed[key]
    else collapsed[key] = true
    collapsedDefaultEntryKeys = collapsed
  }
  function highlightRank(item) {
    if (!item || item.kind !== "highlight") return -1
    var rank = 0
    for (var i = 0; i < entries.length; i++) {
      var candidate = entries[i]
      if (!candidate || candidate.kind !== "highlight") continue
      if (String(candidate.version) === String(item.version)
          && String(candidate.passage) === String(item.passage)) return rank
      rank++
    }
    return -1
  }
  function toggleEntry(item, alwaysExpanded) {
    if (!item) return
    var key = entryKey(item)
    var expanded = Object.assign({}, expandedEntryKeys)
    if (alwaysExpanded || !expanded[key]) expanded[key] = true
    else delete expanded[key]
    expandedEntryKeys = expanded
    if (expanded[key] && item.fullPreview !== true) loadEntryPreview(item)
  }
  function loadEntryPreview(item) {
    if (!api || !item) return
    var tag = entryPreviewTag(item)
    if (entryPreviewRequests[tag]) return
    var requests = Object.assign({}, entryPreviewRequests)
    requests[tag] = { version: item.version, passage: item.passage }
    entryPreviewRequests = requests
    api.get("/v1/passage?version=" + encodeURIComponent(item.version)
      + "&usfm=" + encodeURIComponent(item.passage)
      + "&format=html&include_headings=true&include_notes=true&mode=auto", tag)
  }
  function applyEntryPreview(tag, payload) {
    var target = entryPreviewRequests[tag]
    if (!target) return
    var requests = Object.assign({}, entryPreviewRequests)
    delete requests[tag]
    entryPreviewRequests = requests
    var content = payload && payload.data ? String(payload.data.content || "") : ""
    var label = payload && payload.data ? String(payload.data.reference || "") : ""
    function update(item) {
      if (String(item.version) !== String(target.version)
          || String(item.passage) !== String(target.passage)) return item
      var updated = Object.assign({}, item, {
        preview: content, previewFormat: "html", fullPreview: true
      })
      if (label) updated.label = label
      return updated
    }
    entries = entries.map(update)
    history = history.map(update)
  }
  function clearEntryPreviewRequest(tag) {
    if (!entryPreviewRequests[tag]) return
    var requests = Object.assign({}, entryPreviewRequests)
    delete requests[tag]
    entryPreviewRequests = requests
  }
  Connections {
    target: root.api
    function onSucceeded(tag, payload, status) {
      if (tag === "study.library") {
        root.entries = payload.entries || []
        root.history = payload.history || []
      } else if (tag === "study.original:" + root.originalRevision) {
        root.originalComparison = payload && payload.data ? String(payload.data.content || "") : ""
      } else if (tag === "study.compare:" + root.comparisonRevision) {
        root.loading = false
        root.comparison = payload && payload.data ? String(payload.data.content || "") : ""
        root.comparisonCopyright = payload && payload.data && payload.data.copyright ? String(payload.data.copyright) : root.comparisonCopyright
      } else if (String(tag).indexOf("study.entry-preview:") === 0) {
        root.applyEntryPreview(tag, payload)
      } else if (tag === "study.bookmark" || tag === "study.note" || tag === "study.remove") {
        root.saving = false
        if (tag === "study.note") {
          if (root.noteDrafts[root.pendingNoteKey] === root.pendingNoteBody)
            delete root.noteDrafts[root.pendingNoteKey]
          if (root.noteDraftKey === root.pendingNoteKey && noteInput.text === root.pendingNoteBody)
            noteInput.text = ""
          root.pendingNoteKey = ""
          root.pendingNoteBody = ""
        }
        root.message = I18n.t(root.appLanguage, "savedLocally")
        root.api.get("/v1/study/library", "study.library")
      }
    }
    function onFailed(tag, message, status, payload) {
      if (String(tag).indexOf("study.") !== 0) return
      if (String(tag).indexOf("study.entry-preview:") === 0)
        root.clearEntryPreviewRequest(tag)
      if (String(tag).indexOf("study.compare:") === 0 && tag !== "study.compare:" + root.comparisonRevision) return
      if (String(tag).indexOf("study.original:") === 0 && tag !== "study.original:" + root.originalRevision) return
      root.loading = false; root.saving = false; root.message = message
    }
  }
  Rectangle {
    anchors.fill: parent
    color: LightPalette.popupBackground
    gradient: Gradient {
      GradientStop { position: 0; color: LightPalette.nightMode ? "#000000" : Qt.tint(LightPalette.popupBackground, Util.alpha(LightPalette.popupText, 0.035)) }
      GradientStop { position: 0.25; color: LightPalette.popupBackground }
      GradientStop { position: 1; color: LightPalette.popupBackground }
    }
    Rectangle {
      anchors.left: parent.left
      anchors.right: parent.right
      anchors.top: parent.top
      height: 1
      color: Util.alpha(LightPalette.accent, 0.38)
    }
    MouseArea { anchors.fill: parent; onClicked: {} }
  }
  Column {
    id: header
    anchors.top: parent.top; anchors.left: parent.left; anchors.right: parent.right
    anchors.margins: typography.panelPadding
    spacing: typography.controlGap
    Row {
      width: parent.width
      spacing: typography.controlGap
      Text {
        width: parent.width - closeButton.width - parent.spacing
        text: I18n.t(root.appLanguage, root.mode === "compare" ? "compare" : (root.mode === "history" ? "history" : "library"))
        color: LightPalette.popupText
        font.family: Style.font.family
        font.pixelSize: typography.title
        font.bold: true
        elide: Text.ElideRight
      }
      PixelIconButton {
        id: closeButton
        objectName: "studyCloseButton"
        pixelIconName: "close"
        iconSize: Style.space(14)
        tooltipText: I18n.t(root.appLanguage, "close")
        focusable: true
        onClicked: root.closeRequested()
      }
    }
    Flow {
      width: parent.width
      spacing: typography.controlGap
      visible: root.mode !== "compare"
      PixelButton {
        text: I18n.t(root.appLanguage, "addBookmark")
        enabled: !!root.reference.passage && !root.saving
        focusable: true
        onClicked: root.saveBookmark()
      }
    }
    Text {
      width: parent.width
      text: root.reference.passage ? String(root.reference.label || root.reference.passage) + " · " + root.versionLabel : ""
      visible: text !== ""
      color: LightPalette.accent
      font.family: Style.font.family
      font.pixelSize: typography.bodySmall
      elide: Text.ElideRight
    }
    LightTextField {
      id: search
      objectName: "studySearch"
      width: parent.width
      visible: root.mode !== "compare"
      fontSize: typography.bodySmall
      placeholderText: I18n.t(root.appLanguage, "searchLibrary")
    }
    Row {
      width: parent.width
      spacing: typography.controlGap
      visible: root.mode === "library" && /\.[0-9]+\.[0-9]+/.test(String(root.reference.passage || ""))
      LightTextField {
        id: noteInput
        objectName: "studyNote"
        enabled: !root.saving
        onTextChanged: if (root.noteDraftKey !== "") root.noteDrafts[root.noteDraftKey] = text
        width: parent.width - saveNoteButton.width - parent.spacing
        maximumLength: 10000
        fontSize: typography.bodySmall
        placeholderText: I18n.t(root.appLanguage, "notePlaceholder")
        onAccepted: root.saveNote()
      }
      PixelButton {
        id: saveNoteButton
        text: I18n.t(root.appLanguage, "addNote")
        enabled: !!noteInput.text.trim() && !root.saving
        focusable: true
        onClicked: root.saveNote()
      }
    }
    Text {
      width: parent.width
      visible: root.mode === "library" && !/\.[0-9]+\.[0-9]+/.test(String(root.reference.passage || ""))
      text: I18n.t(root.appLanguage, "selectVerseHelp")
      color: LightPalette.muted
      wrapMode: Text.WordWrap
      font.pixelSize: typography.caption
    }
    QQC.ComboBox {
      width: parent.width
      visible: root.mode === "compare"
      model: root.versions
      textRole: "label"
      valueRole: "value"
      displayText: root.comparisonVersion || I18n.t(root.appLanguage, "chooseTranslation")
      onActivated: root.compare(currentValue)
    }
    Text {
      width: parent.width
      visible: root.message !== "" || root.loading
      text: root.loading ? I18n.t(root.appLanguage, "loading") : root.message
      textFormat: Text.PlainText
      wrapMode: Text.WordWrap
      color: LightPalette.muted
      font.pixelSize: typography.bodySmall
    }
  }
  ListView {
    id: libraryList
    objectName: "studyLibraryList"
    anchors.top: header.bottom; anchors.topMargin: typography.controlGap
    anchors.left: parent.left; anchors.right: parent.right; anchors.bottom: parent.bottom
    anchors.margins: typography.panelPadding
    visible: root.mode !== "compare"
    clip: true
    model: root.visibleEntries
    spacing: typography.controlGap
    reuseItems: true
    delegate: Column {
      id: entryRow
      required property var modelData
      property bool noteExpanded: false
      readonly property bool expandsInPlace: entryRow.modelData.kind === "highlight"
        || entryRow.modelData.kind === "note" || root.mode === "history"
      readonly property int highlightRank: root.highlightRank(entryRow.modelData)
      readonly property bool showFullHighlight: entryRow.highlightRank >= 0
        && entryRow.highlightRank < root.expandedHighlightCount
      readonly property bool entryExpanded: entryRow.expandsInPlace
        ? (entryRow.showFullHighlight
          ? !root.defaultEntryCollapsed(entryRow.modelData)
          : root.entryExpanded(entryRow.modelData))
        : entryRow.noteExpanded
      readonly property bool entryLoading: !!root.entryPreviewRequests[
        root.entryPreviewTag(entryRow.modelData)]
      function toggleInPlace() {
        if (!entryRow.expandsInPlace) return
        if (entryRow.modelData.kind === "note") entryRow.noteExpanded = !entryRow.noteExpanded
        else if (entryRow.showFullHighlight) root.toggleDefaultEntry(entryRow.modelData)
        else root.toggleEntry(entryRow.modelData, false)
      }
      function activate() {
        if (entryRow.expandsInPlace) entryRow.toggleInPlace()
        else root.passageRequested(entryRow.modelData)
      }
      width: Math.max(1, libraryList.width - Style.space(10))
      spacing: typography.labelGap
      Row {
        width: parent.width
        spacing: typography.controlGap
        Item {
          width: parent.width - removeButton.width - parent.spacing
          height: Math.max(Style.spacing.controlHeight, entryLabel.implicitHeight + Style.spacing.sm * 2)
          activeFocusOnTab: true
          Accessible.role: Accessible.Button
          Accessible.name: entryLabel.text
          Keys.onReturnPressed: function(event) { entryRow.activate(); event.accepted = true }
          Keys.onEnterPressed: function(event) { entryRow.activate(); event.accepted = true }
          Keys.onSpacePressed: function(event) { entryRow.activate(); event.accepted = true }
          Text {
            id: entryLabel
            anchors.fill: parent
            anchors.leftMargin: Style.spacing.sm
            anchors.rightMargin: Style.spacing.sm
            text: String(entryRow.modelData.label || entryRow.modelData.passage)
              + " · " + root.labelForVersion(entryRow.modelData.version)
              + (entryRow.modelData.kind ? " · " + I18n.t(root.appLanguage, entryRow.modelData.kind) : "")
            textFormat: Text.PlainText
            color: LightPalette.popupText
            font.family: Style.font.family
            font.pixelSize: typography.bodySmall
            verticalAlignment: Text.AlignVCenter
            elide: Text.ElideRight
          }
          MouseArea {
            anchors.fill: parent
            z: 1
            acceptedButtons: Qt.LeftButton
            preventStealing: true
            cursorShape: Qt.PointingHandCursor
            onClicked: entryRow.activate()
            onDoubleClicked: {
              if (entryRow.expandsInPlace)
                root.passageRequested(entryRow.modelData)
            }
          }
        }
        PixelButton {
          id: removeButton
          visible: entryRow.modelData.kind === "bookmark" || entryRow.modelData.kind === "note"
          width: visible ? implicitWidth : 0
          text: I18n.t(root.appLanguage, "remove")
          enabled: !root.saving
          focusable: true
          onClicked: {
            root.saving = true
            if (entryRow.modelData.kind === "note")
              root.api.remove("/v1/user-data/notes/" + encodeURIComponent(entryRow.modelData.id), "study.remove")
            else root.api.post("/v1/study/bookmarks", {
              version: entryRow.modelData.version, passage: entryRow.modelData.passage, remove: true
            }, "study.remove")
          }
        }
      }
      Rectangle {
        id: expandedCard
        width: parent.width
        height: expandedText.implicitHeight + Style.spacing.sm * 2
        visible: entryRow.entryExpanded && expandedText.text !== ""
        color: Qt.tint(LightPalette.popupBackground, Util.alpha(LightPalette.accent, 0.07))
        border.color: Util.alpha(LightPalette.accent, 0.32)
        border.width: 1
        radius: 0
        Rectangle {
          anchors.left: parent.left
          anchors.top: parent.top
          anchors.bottom: parent.bottom
          width: Math.max(2, Style.space(2))
          color: Util.alpha(LightPalette.accent, 0.72)
        }
        Text {
          id: expandedText
          anchors.left: parent.left
          anchors.right: parent.right
          anchors.top: parent.top
          anchors.margins: Style.spacing.sm
          anchors.leftMargin: Style.spacing.sm + Style.space(2)
          readonly property bool richPreview: entryRow.modelData.previewFormat === "html"
          readonly property string previewText: String(entryRow.modelData.preview || "")
          text: richPreview ? PassageFormat.displayHtml(
            previewText,
            root.readerTextPixelSize,
            root.highlights,
            String(LightPalette.bibleText),
            root.readerFontFamily,
            root.redLetters,
            root.redLetterColor,
            root.defaultHighlightOpacity
          ) : (previewText || (entryRow.entryExpanded
            && entryRow.expandsInPlace && entryRow.entryLoading
            ? I18n.t(root.appLanguage, "loading") : ""))
          textFormat: richPreview ? Text.RichText : Text.PlainText
          color: LightPalette.muted
          font.family: richPreview ? root.readerFontFamily : Style.font.family
          font.pixelSize: richPreview ? root.readerTextPixelSize : typography.bodySmall
          wrapMode: Text.WordWrap
        }
        MouseArea {
          anchors.fill: parent
          z: 1
          acceptedButtons: Qt.LeftButton
          preventStealing: true
          cursorShape: Qt.PointingHandCursor
          onClicked: entryRow.toggleInPlace()
          onDoubleClicked: {
            if (entryRow.expandsInPlace)
              root.passageRequested(entryRow.modelData)
          }
        }
      }
    }
    Text {
      anchors.centerIn: parent
      visible: root.visibleEntries.length === 0
      text: I18n.t(root.appLanguage, "emptyLibrary")
      color: LightPalette.muted
      font.pixelSize: typography.bodySmall
    }
  }
  TransientScrollBar {
    id: libraryScrollbar
    objectName: "studyLibraryScrollbar"
    anchors.top: libraryList.top
    anchors.right: libraryList.right
    anchors.bottom: libraryList.bottom
    flickable: libraryList
  }
  Flickable {
    anchors.top: header.bottom; anchors.topMargin: typography.controlGap
    anchors.left: parent.left; anchors.right: parent.right; anchors.bottom: parent.bottom
    anchors.margins: typography.panelPadding
    visible: root.mode === "compare"
    clip: true
    contentHeight: comparisonColumn.implicitHeight
    contentWidth: width
    Column {
      id: comparisonColumn
      width: parent.width
      spacing: typography.panelGap
      TextEdit {
        width: parent.width
        text: root.originalComparison || String(root.reference.preview || "").replace(/&/g, "&amp;").replace(/</g, "&lt;")
        textFormat: TextEdit.RichText
        readOnly: true
        selectByMouse: true
        wrapMode: TextEdit.Wrap
        color: LightPalette.muted
        font.family: Style.font.family
        font.pixelSize: typography.body
      }
      TextEdit {
        width: parent.width
        text: root.comparison
        textFormat: TextEdit.RichText
        readOnly: true
        selectByMouse: true
        wrapMode: TextEdit.Wrap
        color: LightPalette.popupText
        font.family: Style.font.family
        font.pixelSize: typography.body
      }
      Text {
        width: parent.width
        text: root.comparisonCopyright
        textFormat: Text.PlainText
        wrapMode: Text.WordWrap
        color: LightPalette.muted
        font.pixelSize: typography.caption
      }
    }
  }
}
