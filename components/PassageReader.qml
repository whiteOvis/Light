pragma ComponentBehavior: Bound
import QtQuick
import qs.Commons
import qs.Ui
import "PassageFormat.js" as PassageFormat
import "I18n.js" as I18n

BorderSurface {
  id: root

  property var passage: ({})
  property var api: null
  property var keybindings: ({})
  property string versionId: ""
  property var metadata: ({})
  property string versionLabel: ""
  property string versionTitle: ""
  property string copyrightText: ""
  property bool loading: false
  property string errorMessage: ""
  property string copiedNotice: ""
  property var highlights: []
  property bool highlightPending: false
  property string defaultHighlightColor: "fffe00"
  property real defaultHighlightOpacity: 0.45
  readonly property string selectedText: passageText.selectedText
  property string selectedHighlightPassage: ""
  property string selectedExistingHighlightPassage: ""
  property string selectedExistingHighlightColor: ""
  property string selectedHighlightLabel: ""
  property var selectedHighlightRanges: []
  property real textPixelSize: Style.font.body + Style.space(4)
  property real appScale: 1.2
  property string readerFontStyle: "youversion"
  property bool redLetters: false
  property string appLanguage: "en-US"
  property bool canNavigatePrevious: false
  property bool canNavigateNext: false
  property int contextPosition: -1
  property int contextVerse: 0
  property string contextPassage: ""
  property string contextLabel: ""
  property string contextPreview: ""
  property int contextWordStart: -1
  property int contextWordEnd: -1

  function markContextWord(position) {
    contextWordStart = -1
    contextWordEnd = -1
    if (position < 0 || position >= passageText.length) return
    // TextEdit.selectWord() treats a rich-text verse block as one selectable
    // item on some Qt builds. Find the word in the rendered plain text so the
    // context marker stays on precisely the word under the pointer.
    var plainText = passageText.getText(0, passageText.length)
    if (position >= plainText.length || /[\s.,;:!?()\[\]{}\"“”«»]/.test(
      plainText.charAt(position)
    )) return
    var start = position
    var end = position + 1
    while (start > 0 && !/[\s.,;:!?()\[\]{}\"“”«»]/.test(
      plainText.charAt(start - 1)
    )) start -= 1
    while (end < plainText.length && !/[\s.,;:!?()\[\]{}\"“”«»]/.test(
      plainText.charAt(end)
    )) end += 1
    contextWordStart = start
    contextWordEnd = end
  }

  function contextWordRectangles() {
    var rectangles = []
    // Read layout inputs so resizing and font changes recompute the marker.
    var layoutWidth = passageText.width
    var fontSize = root.textPixelSize
    if (layoutWidth <= 0 || fontSize <= 0) return rectangles
    for (var i = contextWordStart; i >= 0 && i < contextWordEnd; i++) {
      var a = passageText.positionToRectangle(i)
      var b = passageText.positionToRectangle(i + 1)
      var left = Math.min(a.x, b.x)
      var right = Math.max(a.x, b.x)
      if (Math.abs(a.y - b.y) > 1) {
        left = a.x
        right = a.x + passageText.font.pixelSize * 0.55
      }
      var last = rectangles.length ? rectangles[rectangles.length - 1] : null
      if (last && Math.abs(last.y - a.y) < 1) {
        var edge = Math.max(last.x + last.width, right)
        last.x = Math.min(last.x, left)
        last.width = edge - last.x
      } else rectangles.push({ x: left, y: a.y, width: Math.max(1, right - left), height: a.height })
    }
    return rectangles
  }

  LightTypography {
    id: typography
    appScale: root.appScale
  }

  readonly property real uiTitlePixelSize: typography.title
  readonly property real uiBodyPixelSize: typography.body
  readonly property real uiBodySmallPixelSize: typography.bodySmall
  readonly property real uiCaptionPixelSize: typography.caption

  readonly property color foreground: LightPalette.popupText
  readonly property color muted: LightPalette.muted
  readonly property color accent: LightPalette.accent
  readonly property string readerFontFamily: readerFontStyle === "system"
    ? Style.font.family
    : "Source Serif 4"
  readonly property bool darkReaderTheme: (
    LightPalette.popupBackground.r * 0.2126
    + LightPalette.popupBackground.g * 0.7152
    + LightPalette.popupBackground.b * 0.0722
  ) < 0.5
  readonly property color baseRedLetterColor: LightPalette.nightMode ? "#ff7777" : (darkReaderTheme ? "#e4bfc2" : "#94000c")
  readonly property string redLetterColor: String(LightPalette.dimText(baseRedLetterColor, LightPalette.popupBackground))
  readonly property string passageContent: passage && passage.content ? String(passage.content) : ""
  readonly property string passageReference: passage && passage.reference ? String(passage.reference) : ""
  readonly property real naturalBodyHeight: loading || errorMessage !== "" || passageContent === ""
    ? Style.space(150)
    : Math.max(
      Style.space(180),
      passageText.implicitHeight + copyrightLabel.implicitHeight + Style.spacing.panelGap
    )
  readonly property real naturalHeight: root.contentTopInset + root.contentBottomInset
    + Style.spacing.controlGap * 4
    + readerHeader.implicitHeight
    + naturalBodyHeight
    + footerRow.height
  readonly property string renderedContent: PassageFormat.displayHtml(
    passageContent,
    textPixelSize,
    highlights,
    String(LightPalette.bibleText),
    readerFontFamily,
    redLetters,
    redLetterColor,
    defaultHighlightOpacity
  )
  readonly property real scrollY: Math.max(0, passageScroll.contentY)
  signal retryRequested()
  signal previousRequested()
  signal nextRequested()
  signal readingFocusRequested()
  signal closeRequested()
  signal highlightRequested(string passage, var selectionRanges)
  signal deleteHighlightRequested(string passage)
  signal compareRequested(string passage, string label, string preview)
  signal scrollYRestored()

  width: parent ? parent.width : Style.space(440)
  implicitHeight: naturalHeight
  color: LightPalette.nightMode ? "#000000" : Qt.tint(LightPalette.popupBackground, Util.alpha(root.foreground, 0.025))
  radius: 0
  borderSpec: Border.none()

  onPassageChanged: {
    passageScroll.contentY = 0
    clearTextSelection()
  }
  onAppLanguageChanged: updateTextSelection()

  function clearTextSelection() {
    passageText.deselect()
    selectedHighlightPassage = ""
    selectedExistingHighlightPassage = ""
    selectedExistingHighlightColor = ""
    selectedHighlightLabel = ""
    selectedHighlightRanges = []
  }

  function chooseExistingHighlight(passageId) {
    var selected = String(passageId || "").toUpperCase()
    if (selected === "") return
    passageText.deselect()
    selectedHighlightPassage = selected
    selectedExistingHighlightPassage = selected
    selectedExistingHighlightColor = colorForHighlight(selected)
    selectedHighlightLabel = ""
    selectedHighlightRanges = []
  }

  function verseFromLink(link) {
    var match = String(link || "").match(/^light-verse:(\d+)$/)
    return match ? Number(match[1]) : 0
  }

  function colorForHighlight(passageId) {
    var expected = String(passageId || "").toUpperCase()
    for (var i = 0; i < highlights.length; i++) {
      var item = highlights[i] || ({})
      if (String(item.passage || "").toUpperCase() === expected)
        return String(item.color || "").replace(/^#/, "").toLowerCase()
    }
    return ""
  }

  readonly property bool updatingExistingHighlight: selectedExistingHighlightPassage !== ""
    && selectedExistingHighlightColor !== ""
    && selectedExistingHighlightColor !== defaultHighlightColor.toLowerCase()

  function verseAtPosition(position) {
    if (position < 0) return 0
    var rectangle = passageText.positionToRectangle(position)
    var link = passageText.linkAt(
      rectangle.x + Math.max(1, rectangle.width / 2),
      rectangle.y + Math.max(1, rectangle.height / 2)
    )
    return verseFromLink(link)
  }

  function updateTextSelection() {
    var start = passageText.selectionStart
    var end = passageText.selectionEnd
    if (start < 0 || end <= start || String(passageText.selectedText || "").trim() === "") {
      selectedHighlightPassage = ""
      selectedExistingHighlightPassage = ""
      selectedExistingHighlightColor = ""
      selectedHighlightLabel = ""
      selectedHighlightRanges = []
      return
    }

    var verses = []
    var seen = ({})
    var formatted = passageText.getFormattedText(start, end)
    var linkPattern = /light-verse:(\d+)/g
    var match
    while ((match = linkPattern.exec(formatted)) !== null) {
      var linkedVerse = Number(match[1])
      if (!seen[linkedVerse]) {
        seen[linkedVerse] = true
        verses.push(linkedVerse)
      }
    }

    if (verses.length === 0) {
      var firstVerse = verseAtPosition(start)
      var lastVerse = verseAtPosition(Math.max(start, end - 1))
      if (firstVerse > 0) verses.push(firstVerse)
      if (lastVerse > 0 && lastVerse !== firstVerse) verses.push(lastVerse)
    }

    if (verses.length === 0) {
      selectedHighlightPassage = ""
      selectedExistingHighlightPassage = ""
      selectedExistingHighlightColor = ""
      selectedHighlightLabel = ""
      selectedHighlightRanges = []
      return
    }

    verses.sort(function(a, b) { return a - b })
    var first = verses[0]
    var last = verses[verses.length - 1]
    var base = passage && passage.id ? String(passage.id).toUpperCase() : ""
    if (!/^[A-Z0-9]{3}\.\d+$/.test(base)) {
      selectedHighlightPassage = ""
      selectedExistingHighlightPassage = ""
      selectedExistingHighlightColor = ""
      selectedHighlightLabel = ""
      selectedHighlightRanges = []
      return
    }
    selectedHighlightPassage = base + "." + first + (last === first ? "" : "-" + last)
    selectedHighlightRanges = PassageFormat.selectionRanges(
      passageText.getFormattedText(0, start),
      formatted,
      base
    )
    if (selectedHighlightRanges.length === 0) {
      selectedHighlightPassage = ""
      selectedExistingHighlightPassage = ""
      selectedExistingHighlightColor = ""
      selectedHighlightLabel = ""
      return
    }
    selectedExistingHighlightPassage = PassageFormat.highlightForSelection(
      highlights,
      selectedHighlightRanges
    )
    selectedExistingHighlightColor = colorForHighlight(selectedExistingHighlightPassage)
    selectedHighlightLabel = last === first
      ? I18n.t(appLanguage, "verse", { number: first })
      : I18n.t(appLanguage, "verses", { first: first, last: last })
  }

  function scrollBy(delta) {
    var maximum = Math.max(0, passageScroll.contentHeight - passageScroll.height)
    var nextPosition = Math.max(0, Math.min(maximum, passageScroll.contentY + delta))
    if (Math.abs(nextPosition - passageScroll.contentY) < 0.5) return
    passageScroll.contentY = nextPosition
    showScrollIndicator()
  }

  function scrollByKeyboard(direction) {
    scrollBy(direction * Math.max(Style.space(52), root.textPixelSize * 2.8))
  }

  function restoreScrollY(position) {
    var target = Number(position)
    Qt.callLater(function() {
      var maximum = Math.max(0, passageScroll.contentHeight - passageScroll.height)
      passageScroll.contentY = isFinite(target)
        ? Math.max(0, Math.min(Math.round(target), maximum))
        : 0
      root.scrollYRestored()
    })
  }

  function scrollToVerse(verse) {
    for (var position = 0; position < passageText.length; position++) {
      if (String(verseAtPosition(position)) !== String(verse)) continue
      var rectangle = passageText.positionToRectangle(position)
      passageScroll.contentY = Math.max(0, Math.min(rectangle.y,
        passageScroll.contentHeight - passageScroll.height))
      showScrollIndicator()
      return true
    }
    showCopied(I18n.t(appLanguage, "missingSearchVerse", { verse: verse }))
    return false
  }

  function showScrollIndicator() {
    passageScrollbar.reveal()
  }

  function showCopied(message) {
    copiedNotice = message
    copiedTimer.restart()
  }

  function runHighlightAction() {
    if (highlightPending || selectedHighlightPassage === "") return
    if (selectedExistingHighlightPassage !== "" && !updatingExistingHighlight)
      deleteHighlightRequested(selectedExistingHighlightPassage)
    else highlightRequested(
      selectedExistingHighlightPassage || selectedHighlightPassage,
      selectedHighlightRanges
    )
  }

  function highlightActionLabel() {
    if (selectedExistingHighlightPassage !== "")
      return I18n.t(appLanguage, updatingExistingHighlight
        ? "updateHighlight" : "deleteHighlight")
    return I18n.t(appLanguage, "highlightSelection", {
      selection: selectedHighlightLabel
    })
  }

  function selectVerseAtPosition(position, verse) {
    if (position < 0 || verse <= 0) return false
    var start = position
    var end = position
    while (start > 0 && verseAtPosition(start - 1) === verse) start -= 1
    while (end < passageText.length && verseAtPosition(end) === verse) end += 1
    if (end <= start) return false
    passageText.select(start, end)
    updateTextSelection()
    return selectedHighlightPassage !== ""
  }

  function openContextActions(position, pointX, pointY) {
    selectionUpdateTimer.stop()
    updateTextSelection()
    var hasTextSelection = passageText.selectionEnd > passageText.selectionStart
      && String(passageText.selectedText || "").trim() !== ""

    contextPosition = position
    contextVerse = verseAtPosition(position)
    var base = passage && passage.id ? String(passage.id).toUpperCase() : ""
    if (!hasTextSelection) {
      markContextWord(position)
      if (contextWordStart >= 0 && contextWordEnd > contextWordStart) {
        passageText.select(contextWordStart, contextWordEnd)
        // Selecting can refresh TextEdit's rich-text document and clear the
        // marker through onTextChanged, so restore it after the selection.
        markContextWord(position)
        updateTextSelection()
      }
    }

    contextPassage = selectedHighlightPassage !== ""
      ? selectedHighlightPassage
      : (/^[A-Z0-9]{3}\.\d+$/.test(base) && contextVerse > 0
        ? base + "." + contextVerse : "")
    contextLabel = selectedHighlightLabel !== ""
      ? selectedHighlightLabel
      : (contextVerse > 0
        ? I18n.t(appLanguage, "verse", { number: contextVerse })
        : passageReference)
    contextPreview = selectedHighlightPassage !== "" ? selectedText : ""

    var actions = []
    if (contextPassage !== "")
      actions.push({ label: I18n.t(appLanguage, "compare"), value: "compare" })
    if (selectedHighlightPassage !== "")
      actions.push({ label: highlightActionLabel(), value: "highlight" })
    passageContextMenu.options = actions
    passageContextMenu.x = Math.max(0, Math.min(root.width - passageContextMenu.width, pointX))
    passageContextMenu.y = Math.max(0, Math.min(
      root.height - passageContextMenu.implicitHeight,
      pointY
    ))
    passageContextMenu.open()
  }

  function runContextAction(action) {
    if (action === "compare" && contextPassage !== "")
      compareRequested(contextPassage, contextLabel, contextPreview)
    else if (action === "highlight") runHighlightAction()
  }

  Timer {
    id: copiedTimer
    interval: 2200
    onTriggered: root.copiedNotice = ""
  }

  Column {
    id: readerLayout
    anchors.fill: parent
    anchors.topMargin: root.contentTopInset + Style.spacing.controlGap
    anchors.rightMargin: root.contentRightInset + Style.spacing.controlGap
    anchors.bottomMargin: root.contentBottomInset + Style.spacing.controlGap
    anchors.leftMargin: root.contentLeftInset + Style.spacing.controlGap
    spacing: Style.spacing.controlGap

    Column {
      id: readerHeader
      width: parent.width
      spacing: Style.spacing.xxs

      Text {
        width: parent.width
        text: root.passageReference || I18n.t(root.appLanguage, "chooseBookChapter")
        color: root.foreground
        font.family: Style.font.family
        font.pixelSize: root.uiTitlePixelSize
        font.bold: true
        horizontalAlignment: Text.AlignHCenter
        elide: Text.ElideRight
      }

      Text {
        width: parent.width
        text: root.versionLabel
        color: root.muted
        font.family: Style.font.family
        font.pixelSize: root.uiCaptionPixelSize
        horizontalAlignment: Text.AlignHCenter
        elide: Text.ElideRight
      }
    }

    Item {
      width: parent.width
      height: Math.max(1, parent.height - readerHeader.height - footerRow.height - parent.spacing * 2)

      Text {
        anchors.centerIn: parent
        visible: root.loading
        text: I18n.t(root.appLanguage, "loadingPassage")
        color: root.muted
        font.family: Style.font.family
        font.pixelSize: root.uiBodyPixelSize
      }

      Column {
        anchors.centerIn: parent
        width: parent.width
        spacing: Style.spacing.controlGap
        visible: !root.loading && root.errorMessage !== ""

        Text {
          width: parent.width
          text: root.errorMessage
          color: LightPalette.urgent
          font.family: Style.font.family
          font.pixelSize: root.uiBodyPixelSize
          horizontalAlignment: Text.AlignHCenter
          wrapMode: Text.WordWrap
        }
        PixelButton {
          anchors.horizontalCenter: parent.horizontalCenter
          text: I18n.t(root.appLanguage, "retry")
          fontSize: root.uiBodySmallPixelSize
          bordered: true
          focusable: true
          foreground: root.foreground
          accent: root.accent
          onClicked: root.retryRequested()
        }
      }

      Text {
        anchors.centerIn: parent
        width: parent.width
        visible: !root.loading && root.errorMessage === "" && root.passageContent === ""
        text: I18n.t(root.appLanguage, "selectReference")
        color: root.muted
        font.family: Style.font.family
        font.pixelSize: root.uiBodyPixelSize
        horizontalAlignment: Text.AlignHCenter
        wrapMode: Text.WordWrap
      }

      Item {
        id: previousNav
        anchors.left: parent.left
        anchors.top: parent.top
        anchors.bottom: parent.bottom
        width: Style.space(28)
        visible: !root.loading && root.errorMessage === "" && root.passageContent !== ""
        opacity: root.canNavigatePrevious ? 1 : 0.28

        Accessible.role: Accessible.Button
        Accessible.name: I18n.t(root.appLanguage, "previousChapter")

        PixelIcon {
          anchors.centerIn: parent
          width: root.uiTitlePixelSize
          height: root.uiTitlePixelSize
          name: "left"
          color: previousHover.hovered ? root.accent : root.muted
        }

        HoverHandler { id: previousHover }

        MouseArea {
          anchors.fill: parent
          enabled: root.canNavigatePrevious
          cursorShape: enabled ? Qt.PointingHandCursor : Qt.ArrowCursor
          onClicked: root.previousRequested()
        }
      }

      Item {
        id: nextNav
        anchors.right: parent.right
        anchors.top: parent.top
        anchors.bottom: parent.bottom
        width: Style.space(28)
        visible: !root.loading && root.errorMessage === "" && root.passageContent !== ""
        opacity: root.canNavigateNext ? 1 : 0.28

        Accessible.role: Accessible.Button
        Accessible.name: I18n.t(root.appLanguage, "nextChapter")

        PixelIcon {
          anchors.centerIn: parent
          width: root.uiTitlePixelSize
          height: root.uiTitlePixelSize
          name: "right"
          color: nextHover.hovered ? root.accent : root.muted
        }

        HoverHandler { id: nextHover }

        MouseArea {
          anchors.fill: parent
          enabled: root.canNavigateNext
          cursorShape: enabled ? Qt.PointingHandCursor : Qt.ArrowCursor
          onClicked: root.nextRequested()
        }
      }

      Flickable {
        id: passageScroll
        objectName: "passageScroll"
        anchors.top: parent.top
        anchors.bottom: parent.bottom
        anchors.left: previousNav.right
        anchors.right: nextNav.left
        anchors.leftMargin: Style.spacing.xs
        anchors.rightMargin: Style.spacing.xs
        visible: !root.loading && root.errorMessage === "" && root.passageContent !== ""
        contentWidth: width
        contentHeight: passageText.implicitHeight + copyrightLabel.implicitHeight + Style.spacing.panelGap
        clip: true
        boundsBehavior: Flickable.StopAtBounds
        flickableDirection: Flickable.VerticalFlick
        // Pointer drags belong to text selection. The wheel-only layer handles
        // mouse-wheel and touchpad scrolling without consuming clicks.
        interactive: false

        MouseArea {
            anchors.fill: parent
            acceptedButtons: Qt.NoButton
            hoverEnabled: false
            propagateComposedEvents: true
            z: 10

            onWheel: function(wheel) {
                if (wheel.angleDelta.y === 0 && wheel.pixelDelta.y === 0)
                    return
                var delta = wheel.pixelDelta.y !== 0
                    ? -wheel.pixelDelta.y
                    : -wheel.angleDelta.y / 2
                root.scrollBy(delta)
                wheel.accepted = true
            }
        }

        Column {
          width: Math.max(1, passageScroll.width - Style.space(10))
          spacing: Style.spacing.panelGap

          TextEdit {
            id: passageText
            objectName: "readerPassageText"
            onTextChanged: {
              root.contextWordStart = -1
              root.contextWordEnd = -1
            }
            Repeater {
              model: root.contextWordRectangles()
              delegate: Rectangle {
                required property var modelData
                x: modelData.x
                y: modelData.y
                width: modelData.width
                height: modelData.height
                visible: passageContextMenu.opened
                color: Util.alpha(root.accent, 0.22)
                border.color: root.accent
                border.width: 1
                radius: 2
                z: 2
              }
            }
            width: parent.width
            text: root.renderedContent
            textFormat: Text.RichText
            readOnly: true
            selectByMouse: true
            persistentSelection: true
            activeFocusOnPress: true
            selectionColor: Style.selectionFillFor(root.foreground, root.accent, LightPalette.urgent)
            selectedTextColor: LightPalette.bibleText
            color: LightPalette.bibleText
            font.family: root.readerFontFamily
            font.pixelSize: root.textPixelSize
            wrapMode: Text.WordWrap
            Keys.onLeftPressed: function(event) {
              if (event.modifiers === Qt.NoModifier && root.canNavigatePrevious) {
                root.previousRequested()
                event.accepted = true
              }
            }
            Keys.onRightPressed: function(event) {
              if (event.modifiers === Qt.NoModifier && root.canNavigateNext) {
                root.nextRequested()
                event.accepted = true
              }
            }
            Keys.onUpPressed: function(event) {
              if (event.modifiers === Qt.NoModifier) {
                root.scrollByKeyboard(-1)
                event.accepted = true
              }
            }
            Keys.onDownPressed: function(event) {
              if (event.modifiers === Qt.NoModifier) {
                root.scrollByKeyboard(1)
                event.accepted = true
              }
            }
            Keys.onEscapePressed: function(event) {
              if (String(passageText.selectedText || "").length > 0
                  || root.selectedHighlightPassage !== "") {
                root.clearTextSelection()
              } else {
                root.closeRequested()
              }
              event.accepted = true
            }
            onSelectionStartChanged: selectionUpdateTimer.restart()
            onSelectionEndChanged: selectionUpdateTimer.restart()

            TapHandler {
              acceptedButtons: Qt.LeftButton
              gesturePolicy: TapHandler.ReleaseWithinBounds
              onTapped: function(eventPoint) {
                var position = passageText.positionAt(
                  eventPoint.position.x,
                  eventPoint.position.y
                )
                var verse = root.verseAtPosition(position)
                var base = root.passage && root.passage.id
                  ? String(root.passage.id).toUpperCase()
                  : ""
                var existing = PassageFormat.highlightAtPosition(
                  root.highlights,
                  base,
                  verse,
                  passageText.getFormattedText(0, position)
                )
                if (existing !== "") Qt.callLater(function() {
                  root.chooseExistingHighlight(existing)
                })
              }
            }

            TapHandler {
              acceptedButtons: Qt.RightButton
              gesturePolicy: TapHandler.ReleaseWithinBounds
              onTapped: function(eventPoint) {
                var mapped = passageText.mapToItem(
                  root,
                  eventPoint.position.x,
                  eventPoint.position.y
                )
                root.openContextActions(
                  passageText.positionAt(eventPoint.position.x, eventPoint.position.y),
                  mapped.x,
                  mapped.y
                )
              }
            }
          }

          Text {
            id: copyrightLabel
            width: parent.width
            visible: root.copyrightText !== ""
            text: root.copyrightText
            color: root.muted
            font.family: Style.font.family
            font.pixelSize: root.uiCaptionPixelSize
            wrapMode: Text.WordWrap
          }
        }

        Timer {
          id: selectionUpdateTimer
          interval: 0
          onTriggered: root.updateTextSelection()
        }
      }

      TransientScrollBar {
        id: passageScrollbar
        objectName: "passageScrollbar"
        anchors.top: passageScroll.top
        anchors.right: passageScroll.right
        anchors.bottom: passageScroll.bottom
        flickable: passageScroll
        foreground: root.muted
      }

    }

    Row {
      id: footerRow
      width: parent.width
      visible: root.copiedNotice !== ""
      height: visible ? implicitHeight : 0

      Text {
        width: parent.width
        text: root.copiedNotice
        color: root.accent
        font.family: Style.font.family
        font.pixelSize: root.uiCaptionPixelSize
        horizontalAlignment: Text.AlignRight
      }
    }
  }

  InlineOptionPopup {
    id: passageContextMenu
    objectName: "passageContextMenu"
    z: 50
    width: Math.min(root.width, Style.space(230))
    value: ""
    fontPixelSize: root.uiBodySmallPixelSize
    onSelected: function(option) { root.runContextAction(String(option.value || "")) }
  }

}
